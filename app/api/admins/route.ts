// app/api/admins/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import path from 'path'
import { getIsmsAdminFromRequest, type AdminRole } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'
import { EMAIL_HINT, isDeliverableEmail } from '@/lib/email-address'
import { getSmtpSettings, sendMail } from '@/lib/smtp'
import { buildAccountCreatedEmail, LOGO_CID } from '@/lib/email-templates'
import { resolveAppBaseUrl } from '@/lib/request-origin'
import { API_BASE_PATH } from '@/lib/config'

type AdminRow = { id: number; username: string; email: string | null; role: AdminRole; created_at: string; current_password?: string | null }
const ROLES: AdminRole[] = ['ism_admin', 'lobby', 'security', 'approver', 'it']

let schemaChecked = false
async function ensureAdminColumns() {
  if (schemaChecked) return
  try {
    await query(`
      ALTER TABLE admins
      ADD COLUMN IF NOT EXISTS current_password VARCHAR(255);
    `)
    // Seed initial defaults if current_password is null
    await query(`
      UPDATE admins
      SET current_password = CASE
        WHEN username = 'admin' AND current_password IS NULL THEN 'admin123'
        WHEN username = 'admin_lobby' AND current_password IS NULL THEN 'Lobby#2026'
        WHEN username = 'admin_possecurity' AND current_password IS NULL THEN 'Security#2026'
        WHEN username = 'it.admin' AND current_password IS NULL THEN 'ITAdmin#2026'
        ELSE current_password
      END
      WHERE current_password IS NULL;
    `)
    schemaChecked = true
  } catch {
    // Ignore if table/column already exists
  }
}

export async function GET(request: NextRequest) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    await ensureAdminColumns()
    const result = await query<AdminRow>('SELECT id, username, email, role, created_at, current_password FROM admins ORDER BY created_at ASC')
    return NextResponse.json({ admins: result.rows })
  } catch (error) {
    console.error('[admins/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar admin.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    await ensureAdminColumns()
    const body = await request.json() as { username?: string; password?: string; role?: string; email?: string }
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null
    const role = body.role

    if (!username) return NextResponse.json({ message: 'Username wajib diisi.' }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ message: 'Password minimal 6 karakter.' }, { status: 400 })
    if (!role || !ROLES.includes(role as AdminRole)) return NextResponse.json({ message: 'Role tidak valid.' }, { status: 400 })
    if (email && !isDeliverableEmail(email)) return NextResponse.json({ message: `Email tidak valid. ${EMAIL_HINT}` }, { status: 400 })
    // An Approver account sees the requests sent to its address — without one it would see nothing.
    if (role === 'approver' && !email) return NextResponse.json({ message: 'Akun Approver wajib punya email — sama dengan email approver di Approver Pengesahan.' }, { status: 400 })
    if (email && (await query('SELECT 1 FROM admins WHERE lower(email) = lower($1)', [email])).rows.length > 0) {
      return NextResponse.json({ message: 'Email ini sudah dipakai akun lain. Akun itu sudah bisa membuka "Persetujuan Saya" untuk alamat tersebut.' }, { status: 409 })
    }

    const existing = await query('SELECT 1 FROM admins WHERE username = $1', [username])
    if (existing.rows.length > 0) return NextResponse.json({ message: 'Username sudah dipakai.' }, { status: 409 })

    const passwordHash = await bcrypt.hash(password, 10)
    const result = await query<AdminRow>(
      'INSERT INTO admins (username, email, password_hash, role, current_password) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role, created_at, current_password',
      [username, email, passwordHash, role, password]
    )
    const created = result.rows[0]

    await logActivity(session, 'create', 'admin', created.id, `Membuat akun admin "${created.username}" (role: ${created.role})`)

    let emailSent = false
    let emailError: string | null = null
    if (created.email) {
      try {
        const settings = await getSmtpSettings()
        if (settings?.host && settings.port && settings.senderEmail) {
          const base = `${resolveAppBaseUrl(settings.appUrl)}${API_BASE_PATH}`
          const loginUrl = `${base}/login`
          const dashboardUrl = `${base}/persetujuan-saya`
          const { subject, html } = buildAccountCreatedEmail({
            recipientName: created.username,
            username: created.username,
            password,
            role: created.role,
            email: created.email,
            loginUrl,
            dashboardUrl,
          })
          const logoPath = path.join(process.cwd(), 'public', 'images', 'yazaki-logo.jpg')
          const attachments = [{ filename: 'yazaki-logo.jpg', path: logoPath, cid: LOGO_CID }]
          await sendMail(settings, {
            to: created.email,
            subject,
            html,
            attachments,
          })
          emailSent = true
        } else {
          emailError = 'Pengaturan SMTP belum dikonfigurasi'
        }
      } catch (mailErr) {
        console.error('[admins/create-welcome-email]', mailErr)
        emailError = mailErr instanceof Error ? mailErr.message : 'Gagal mengirim email ucapan selamat'
      }
    }

    return NextResponse.json({ admin: created, emailSent, emailError }, { status: 201 })
  } catch (error) {
    console.error('[admins/POST]', error)
    return NextResponse.json({ message: 'Gagal membuat akun admin.' }, { status: 500 })
  }
}
