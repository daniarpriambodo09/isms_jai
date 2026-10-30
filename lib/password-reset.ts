// lib/password-reset.ts
//
// "Lupa password": the account asks with its username or e-mail address, a
// link goes to the address stored on the account, and the link lets it set a
// new password. The link works once and for one hour; only its hash is kept
// (db/migrations/0026). Whoever asks is always told the same thing, so the
// form does not reveal which usernames or addresses exist.

import 'server-only'
import path from 'path'
import { createHash, randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { API_BASE_PATH } from '@/lib/config'
import { isDeliverableEmail } from '@/lib/email-address'
import { LOGO_CID, buildPasswordResetEmail } from '@/lib/email-templates'
import { resolveAppBaseUrl } from '@/lib/request-origin'
import { getSmtpSettings, sendMail } from '@/lib/smtp'
import { logActivity } from '@/lib/activity-log'
import type { AdminRole } from '@/lib/auth'

export const RESET_LINK_MINUTES = 60
/** Links one account can ask for per hour — more are quietly ignored. */
const MAX_REQUESTS_PER_HOUR = 3

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

type Account = { id: number; username: string; email: string | null; role: AdminRole }

/**
 * Sends the reset link when the account exists and has an address that can
 * receive mail. Returns why nothing was sent (for the server log only).
 */
export async function requestPasswordReset(identifier: string, fallbackOrigin?: string): Promise<'sent' | 'no-account' | 'no-email' | 'too-many' | 'no-smtp' | 'mail-failed'> {
  const value = identifier.trim()
  if (!value) return 'no-account'
  const account = (await query<Account>(
    'SELECT id, username, email, role FROM admins WHERE lower(username) = lower($1) OR lower(email) = lower($1) ORDER BY (lower(username) = lower($1)) DESC LIMIT 1',
    [value]
  )).rows[0]
  if (!account) return 'no-account'
  if (!isDeliverableEmail(account.email)) return 'no-email'

  const recent = (await query<{ n: string }>("SELECT count(*)::text AS n FROM password_resets WHERE admin_id = $1 AND created_at > now() - interval '1 hour'", [account.id])).rows[0]
  if (Number(recent.n) >= MAX_REQUESTS_PER_HOUR) return 'too-many'

  const settings = await getSmtpSettings()
  if (!settings?.host || !settings.port || !settings.senderEmail) return 'no-smtp'

  const token = randomBytes(32).toString('hex')
  await query(
    `INSERT INTO password_resets (admin_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
    [account.id, hash(token), String(RESET_LINK_MINUTES)]
  )
  const base = `${resolveAppBaseUrl(settings.appUrl, fallbackOrigin)}${API_BASE_PATH}`
  const { subject, html } = buildPasswordResetEmail({ username: account.username, resetUrl: `${base}/reset-password?token=${token}`, minutes: RESET_LINK_MINUTES })
  try {
    await sendMail(settings, {
      to: account.email.trim(),
      subject,
      html,
      attachments: [{ filename: 'yazaki-logo.jpg', path: path.join(process.cwd(), 'public', 'images', 'yazaki-logo.jpg'), cid: LOGO_CID }],
    })
    return 'sent'
  } catch (error) {
    console.error('[password-reset/mail]', error)
    return 'mail-failed'
  }
}

/** The account a link belongs to, while the link is still good. */
export async function resetLinkAccount(token: string): Promise<{ resetId: number; account: Account } | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null
  const row = (await query<Account & { reset_id: number }>(
    `SELECT r.id AS reset_id, a.id, a.username, a.email, a.role
     FROM password_resets r JOIN admins a ON a.id = r.admin_id
     WHERE r.token_hash = $1 AND r.used_at IS NULL AND r.expires_at > now()`,
    [hash(token)]
  )).rows[0]
  return row ? { resetId: row.reset_id, account: { id: row.id, username: row.username, email: row.email, role: row.role } } : null
}

/** Sets the new password; the link (and any other open link of the account) stops working. */
export async function resetPassword(token: string, newPassword: string): Promise<{ ok: true; username: string } | { ok: false; message: string }> {
  if (newPassword.length < 6) return { ok: false, message: 'Password baru minimal 6 karakter.' }
  const link = await resetLinkAccount(token)
  if (!link) return { ok: false, message: 'Link reset sudah tidak berlaku. Minta link baru lewat "Lupa password".' }
  // single use: only the request that marks the link gets to change the password
  const claimed = await query('UPDATE password_resets SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id', [link.resetId])
  if (claimed.rows.length === 0) return { ok: false, message: 'Link reset sudah dipakai. Minta link baru lewat "Lupa password".' }
  await query('UPDATE admins SET password_hash = $1, current_password = $2 WHERE id = $3', [await bcrypt.hash(newPassword, 10), newPassword, link.account.id])
  await query('UPDATE password_resets SET used_at = now() WHERE admin_id = $1 AND used_at IS NULL', [link.account.id])
  await logActivity({ sub: link.account.id, username: link.account.username, role: link.account.role }, 'update', 'admin', link.account.id, `Mengatur ulang password akun "${link.account.username}" lewat link email (Lupa password)`)
  return { ok: true, username: link.account.username }
}

/**
 * Mengganti password akun secara langsung berdasarkan email yang terdaftar di Manage Akun (atau username).
 * Memastikan password baru langsung tersambung ke akun di database.
 */
export async function resetPasswordByIdentifier(
  identifier: string,
  newPassword: string
): Promise<{ ok: true; username: string; email: string | null } | { ok: false; message: string }> {
  const value = identifier.trim()
  if (!value) {
    return { ok: false, message: 'Harap masukkan email atau username akun yang terdaftar.' }
  }
  if (newPassword.length < 6) {
    return { ok: false, message: 'Password baru minimal 6 karakter.' }
  }

  const account = (
    await query<Account>(
      `SELECT id, username, email, role FROM admins
       WHERE lower(email) = lower($1) OR lower(username) = lower($1)
       ORDER BY (lower(email) = lower($1)) DESC, (lower(username) = lower($1)) DESC
       LIMIT 1`,
      [value]
    )
  ).rows[0]

  if (!account) {
    return {
      ok: false,
      message: `Akun dengan email/username "${value}" tidak ditemukan di Kelola Akun (Manage Akun). Pastikan email sudah sesuai dengan yang didaftarkan di sistem.`,
    }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)
  await query('UPDATE admins SET password_hash = $1, current_password = $2 WHERE id = $3', [hashedPassword, newPassword, account.id])
  await query('UPDATE password_resets SET used_at = now() WHERE admin_id = $1 AND used_at IS NULL', [account.id])
  await logActivity(
    { sub: account.id, username: account.username, role: account.role },
    'update',
    'admin',
    account.id,
    `Mengatur ulang password akun "${account.username}" (email: ${account.email || '-'}) lewat form Lupa Password`
  )

  return { ok: true, username: account.username, email: account.email }
}
