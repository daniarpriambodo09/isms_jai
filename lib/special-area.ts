// lib/special-area.ts
//
// "Pengajuan Ijin Masuk Area Special Security" (ISMS-F-006-001) — same e-sign
// model as the Visitor Ijin Foto/Video: a request is emailed to the approver
// with a one-off token link (no login); approving issues a verification code
// that the QR on the filled-in form PDF points at.
//
// The approver is whoever holds the IAA position in Approver Pengesahan
// (procedure_approver_roles) — the paper form prints "Information Assets
// Administrator" — so a change of office is made in one place only. Name and
// title are snapshotted on each request so history stays correct.

import 'server-only'
import path from 'path'
import { randomBytes } from 'crypto'
import { query } from '@/lib/db'
import { describeSmtpError, getSmtpSettings, sendMail } from '@/lib/smtp'
import { resolveAppBaseUrl } from '@/lib/request-origin'
import { buildSpecialAreaApprovalEmail, LOGO_CID } from '@/lib/email-templates'
import { API_BASE_PATH } from '@/lib/config'
import { ensureApprovalSchema } from '@/lib/procedure-approval'
import type { SpecialAreaRequest } from '@/lib/special-area-shared'

// ─── approver setting ───
// Who approves special-area requests is its own setting (app_settings key
// 'special_area_approver'): either follow one of the positions in Approver
// Pengesahan (default IAA — what the paper form prints), or a name/title/
// email entered by hand. Either way a change of office is one edit.

export type ApproverSetting =
  | { mode: 'role'; roleCode: string }
  | { mode: 'custom'; name: string; title: string; email: string | null }

export type ResolvedApprover = { name: string | null; title: string | null; email: string | null; source: string }

const SETTING_KEY = 'special_area_approver'
const DEFAULT_SETTING: ApproverSetting = { mode: 'role', roleCode: 'IAA' }

async function ensureSettingsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(60) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by VARCHAR(100)
    )`)
}

export async function getApproverSetting(): Promise<{ setting: ApproverSetting; updatedAt: string | null; updatedBy: string | null }> {
  await ensureSettingsTable()
  const row = (await query<{ value: ApproverSetting; updated_at: string; updated_by: string | null }>(
    'SELECT value, updated_at, updated_by FROM app_settings WHERE key = $1', [SETTING_KEY]
  )).rows[0]
  return { setting: row?.value ?? DEFAULT_SETTING, updatedAt: row?.updated_at ?? null, updatedBy: row?.updated_by ?? null }
}

export async function saveApproverSetting(setting: ApproverSetting, username: string) {
  await ensureSettingsTable()
  await query(
    `INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ($1, $2, now(), $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [SETTING_KEY, JSON.stringify(setting), username]
  )
}

export async function resolveApprover(): Promise<ResolvedApprover> {
  const { setting } = await getApproverSetting()
  if (setting.mode === 'custom') {
    return { name: setting.name, title: setting.title, email: setting.email, source: 'Diatur manual' }
  }
  const role = (await query<{ person_name: string; title: string; email: string | null }>(
    'SELECT person_name, title, email FROM procedure_approver_roles WHERE code = $1', [setting.roleCode]
  )).rows[0]
  return role
    ? { name: role.person_name, title: role.title, email: role.email, source: `Jabatan ${setting.roleCode} (Approver Pengesahan)` }
    : { name: null, title: null, email: null, source: `Jabatan ${setting.roleCode} tidak ditemukan` }
}

// Re-points every still-pending request at the current approver (fresh link each).
export async function resendAllPending() {
  const pending = await query<{ id: number }>("SELECT id FROM special_area_requests WHERE status = 'pending'")
  let sent = 0, failed = 0
  for (const row of pending.rows) {
    if (await sendApprovalRequest(row.id)) failed++
    else sent++
  }
  return { sent, failed }
}

export const SELECT_COLUMNS = `id, requester_name, org_company, department, from_at, to_at, area, purpose, id_card_no,
  status, submitted_at, submitted_by, approver_name, approver_title, notified_at, email_error,
  decided_at, decision_note, verification_code`

let ready: Promise<void> | null = null

export function ensureSpecialAreaSchema() {
  if (!ready) {
    ready = (async () => {
      await ensureApprovalSchema() // approver roles live there
      await query(`
        CREATE TABLE IF NOT EXISTS special_area_requests (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          requester_name varchar(255) NOT NULL,
          org_company varchar(255) NOT NULL,
          department varchar(255),
          from_at timestamptz NOT NULL,
          to_at timestamptz NOT NULL,
          area varchar(255) NOT NULL,
          purpose text NOT NULL,
          id_card_no varchar(100),
          status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
          submitted_at timestamptz NOT NULL DEFAULT now(),
          submitted_by varchar(100),
          approver_name varchar(150),
          approver_title varchar(150),
          approver_email varchar(255),
          token varchar(64) UNIQUE,
          notified_at timestamptz,
          email_error text,
          decided_at timestamptz,
          decision_note text,
          verification_code varchar(40) UNIQUE,
          CONSTRAINT special_area_requests_dates_check CHECK (to_at >= from_at)
        )`)
      await query('CREATE INDEX IF NOT EXISTS special_area_requests_status_idx ON special_area_requests (status, submitted_at DESC)')
    })().catch((error) => { ready = null; throw error })
  }
  return ready
}

export async function getRequest(id: number) {
  const result = await query<SpecialAreaRequest>(`SELECT ${SELECT_COLUMNS} FROM special_area_requests WHERE id = $1`, [id])
  return result.rows[0] ?? null
}

/**
 * (Re)sends the approval email for a pending request to whoever currently
 * holds the approver role — issuing a fresh token, so an older link stops
 * working. Returns null on success, or a short reason on failure.
 */
export async function sendApprovalRequest(id: number): Promise<string | null> {
  const approver = await resolveApprover()
  const token = randomBytes(24).toString('hex')
  await query(
    `UPDATE special_area_requests SET token = $1, approver_name = $2, approver_title = $3, approver_email = $4, notified_at = NULL, email_error = NULL
     WHERE id = $5 AND status = 'pending'`,
    [token, approver.name, approver.title, approver.email, id]
  )

  let error: string | null = null
  try {
    const req = await getRequest(id)
    if (!req) return 'Pengajuan tidak ditemukan.'
    if (!approver.name) error = `Approver belum diatur (${approver.source}) — atur di halaman Izin Area Special.`
    else if (!approver.email) error = `Email approver (${approver.name}) belum diisi — atur di halaman Izin Area Special.`
    else {
      const settings = await getSmtpSettings()
      if (!settings?.host || !settings.port || !settings.senderEmail) error = 'SMTP belum dikonfigurasi (Admin Settings → SMTP Settings).'
      else {
        const base = resolveAppBaseUrl(settings.appUrl)
        const { subject, html } = buildSpecialAreaApprovalEmail({
          approverName: approver.name,
          requesterName: req.requester_name,
          orgCompany: req.org_company,
          department: req.department,
          fromAt: req.from_at,
          toAt: req.to_at,
          area: req.area,
          purpose: req.purpose,
          idCardNo: req.id_card_no,
          approveUrl: `${base}${API_BASE_PATH}/persetujuan-area-special?token=${token}&action=approve`,
          rejectUrl: `${base}${API_BASE_PATH}/persetujuan-area-special?token=${token}&action=reject`,
        })
        await sendMail(settings, {
          to: approver.email,
          subject,
          html,
          attachments: [{ filename: 'yazaki-logo.jpg', path: path.join(process.cwd(), 'public', 'images', 'yazaki-logo.jpg'), cid: LOGO_CID }],
        })
      }
    }
  } catch (e) {
    console.error('[special-area/sendApprovalRequest]', e)
    error = describeSmtpError(e)
  }
  await query(
    `UPDATE special_area_requests SET notified_at = CASE WHEN $1::text IS NULL THEN now() ELSE NULL END, email_error = $1 WHERE id = $2`,
    [error, id]
  )
  return error
}

export async function getByToken(token: string) {
  await ensureSpecialAreaSchema()
  if (!/^[a-f0-9]{48}$/.test(token)) return null
  const result = await query<SpecialAreaRequest>(`SELECT ${SELECT_COLUMNS} FROM special_area_requests WHERE token = $1`, [token])
  return result.rows[0] ?? null
}

export async function decideByToken(token: string, action: 'approve' | 'reject', note: string | null) {
  const req = await getByToken(token)
  if (!req) return { ok: false, message: 'Link tidak ditemukan atau sudah tidak berlaku.' }
  if (req.status !== 'pending') return { ok: false, message: 'Pengajuan ini sudah diproses sebelumnya.' }
  const status = action === 'approve' ? 'approved' : 'rejected'
  const code = `JAI-SA-${req.id}-${randomBytes(4).toString('hex').toUpperCase()}`
  const updated = await query<{ id: number }>(
    `UPDATE special_area_requests SET status = $1, decided_at = now(), decision_note = $2, verification_code = $3
     WHERE id = $4 AND status = 'pending' RETURNING id`,
    [status, note, code, req.id]
  )
  if (!updated.rows.length) return { ok: false, message: 'Pengajuan ini sudah diproses sebelumnya.' }
  return { ok: true, message: action === 'approve' ? 'Terima kasih — pengajuan disetujui. Surat izin ber-QR sudah tersedia.' : 'Pengajuan ditolak.' }
}

export async function getByCode(code: string) {
  await ensureSpecialAreaSchema()
  if (!/^JAI-SA-\d+-[A-F0-9]{8}$/.test(code)) return null
  const result = await query<SpecialAreaRequest>(`SELECT ${SELECT_COLUMNS} FROM special_area_requests WHERE verification_code = $1`, [code])
  return result.rows[0] ?? null
}

export async function verifyBaseUrl(fallbackOrigin?: string) {
  const settings = await getSmtpSettings()
  return `${resolveAppBaseUrl(settings?.appUrl, fallbackOrigin)}${API_BASE_PATH}/verifikasi-area-special?code=`
}
