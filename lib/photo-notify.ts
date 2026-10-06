// lib/photo-notify.ts
//
// Who hears about an Ijin Foto/Video request, and when:
// - a new Internal request → the ISM Admins get an e-mail (they decide it);
//   a new Visitor request → an Info item in the bell (the PIC decides it by
//   e-mail, the admin only needs to know);
// - a decision → the requester gets an e-mail with the result, when they left
//   an address on the form; a decision the PIC made by e-mail is also an Info
//   item in the bell;
// - Internal requests left undecided → one reminder e-mail a day to the ISM
//   Admins (sendPhotoPendingDigest, run by lib/jobs.ts).
// All of it is best-effort: a mail that can't go out never fails the request.

import 'server-only'
import path from 'path'
import { query } from '@/lib/db'
import { getSmtpSettings, sendMail } from '@/lib/smtp'
import { isDeliverableEmail } from '@/lib/email-address'
import { buildPhotoPendingDigestEmail, buildPhotoRequestAdminEmail, buildPhotoResultEmail, LOGO_CID } from '@/lib/email-templates'
import { portalBaseUrl, sendToAdmins } from '@/lib/admin-mail'
import { recordNotification } from '@/lib/admin-notifications'

type RequestRow = {
  id: number
  request_type: 'internal' | 'visitor'
  nik: string | null
  requester_name: string
  dept_or_company: string
  location: string
  objective: string
  from_at: string
  to_at: string
  status: 'pending' | 'approved' | 'rejected'
  decided_by: string | null
  decision_note: string | null
  camera_control_no: string | null
  photo_id_no: string | null
  ref_token: string | null
  verification_code: string | null
  requester_email: string | null
  result_mailed_at: string | null
  pic_name: string | null
}

async function getRow(id: number) {
  return (await query<RequestRow>(
    `SELECT r.id, r.request_type, r.nik, r.requester_name, r.dept_or_company, r.location, r.objective, r.from_at, r.to_at, r.status,
            r.decided_by, r.decision_note, r.camera_control_no, r.photo_id_no, r.ref_token, r.verification_code,
            r.requester_email, r.result_mailed_at, COALESCE(pic.full_name, pic.name) AS pic_name
     FROM photo_video_requests r LEFT JOIN pic_approvers pic ON pic.id = r.pic_approve_id WHERE r.id = $1`,
    [id]
  )).rows[0] ?? null
}

const typeLabel = (row: Pick<RequestRow, 'request_type'>) => (row.request_type === 'internal' ? 'Internal' : 'Visitor')

/** Right after a request is saved. */
export async function notifyNewPhotoRequest(id: number) {
  try {
    const row = await getRow(id)
    if (!row) return
    const internal = row.request_type === 'internal'
    await recordNotification({
      kind: 'photo_new',
      category: 'photo',
      title: `Pengajuan foto/video ${typeLabel(row)} baru — ${row.requester_name}`,
      body: `${row.dept_or_company} · ${row.location}${internal ? ' · menunggu keputusan Admin ISM' : ` · dikirim ke PIC ${row.pic_name ?? '-'}`}`,
      href: `/kelola-permintaan-foto-video?status=pending&type=${row.request_type}`,
      // Internal: shown live under "Perlu tindakan" until decided.
      historyOnly: internal,
    })
    if (!internal) return

    const base = await portalBaseUrl()
    if (!base) return
    const pendingCount = Number((await query<{ n: number }>("SELECT count(*)::int AS n FROM photo_video_requests WHERE status = 'pending' AND request_type = 'internal'")).rows[0]?.n ?? 1)
    const { subject, html } = buildPhotoRequestAdminEmail({
      requesterName: row.requester_name, nik: row.nik, deptOrCompany: row.dept_or_company, location: row.location, objective: row.objective,
      fromAt: row.from_at, toAt: row.to_at, picApprove: row.pic_name, cameraControlNo: row.camera_control_no, photoIdNo: row.photo_id_no,
      reviewUrl: `${base}/kelola-permintaan-foto-video?status=pending&type=internal`, pendingCount,
    })
    await sendToAdmins(subject, html)
  } catch (error) {
    console.error('[photo-notify/new]', error)
  }
}

/** Right after a request is approved or rejected — by the admin in the portal, or by the PIC from the e-mail. */
export async function notifyPhotoDecision(id: number, decidedVia: 'admin' | 'email') {
  try {
    const row = await getRow(id)
    if (!row || row.status === 'pending') return
    const approved = row.status === 'approved'
    await recordNotification({
      kind: `photo_${approved ? 'approved' : 'rejected'}`,
      category: 'photo',
      title: `Foto/video ${typeLabel(row)} ${approved ? 'disetujui' : 'ditolak'} — ${row.requester_name}`,
      body: `${decidedVia === 'email' ? `Oleh PIC ${row.decided_by ?? '-'} lewat email` : `Oleh ${row.decided_by ?? 'Admin ISM'}`} · ${row.location}`,
      href: '/kelola-permintaan-foto-video',
      // The admin's own decision needs no heads-up; the PIC's does.
      historyOnly: decidedVia === 'admin',
    })
    await mailRequester(row)
  } catch (error) {
    console.error('[photo-notify/decision]', error)
  }
}

async function mailRequester(row: RequestRow) {
  if (!row.requester_email || !isDeliverableEmail(row.requester_email) || row.result_mailed_at) return
  const settings = await getSmtpSettings()
  const base = await portalBaseUrl()
  if (!settings || !base || !row.ref_token) return
  const referenceCode = `${row.id}-${row.ref_token}`
  const visitor = row.request_type === 'visitor'
  const approved = row.status === 'approved'
  const { subject, html } = buildPhotoResultEmail({
    requesterName: row.requester_name, approved, location: row.location, fromAt: row.from_at, toAt: row.to_at,
    decidedBy: row.decided_by, note: row.decision_note && !/^Diproses langsung dari email/.test(row.decision_note) ? row.decision_note : null,
    referenceCode,
    statusUrl: `${base}/ijin-foto-video?type=${row.request_type}&ref=${encodeURIComponent(referenceCode)}`,
    pdfUrl: visitor && approved && row.verification_code ? `${base}/api/photo-video-requests/${row.id}/pdf?code=${encodeURIComponent(row.verification_code)}` : null,
    visitor,
  })
  await sendMail(settings, {
    to: row.requester_email,
    subject,
    html,
    attachments: [{ filename: 'yazaki-logo.jpg', path: path.join(process.cwd(), 'public', 'images', 'yazaki-logo.jpg'), cid: LOGO_CID }],
  })
  await query('UPDATE photo_video_requests SET result_mailed_at = now() WHERE id = $1', [row.id])
}

// ─── daily reminder to the ISM Admins ───

const DIGEST_KEY = 'photo_pending_digest'
// Only requests that have waited at least this long are worth a reminder.
const DIGEST_MIN_HOURS = 4

/** Once per day (WIB): 'sent', 'skipped' (nothing waiting / already sent today), or 'failed'. */
export async function sendPhotoPendingDigest(now = Date.now()): Promise<'sent' | 'skipped' | 'failed'> {
  const today = new Date(now + 7 * 3_600_000).toISOString().slice(0, 10)
  const last = (await query<{ value: { date?: string } }>('SELECT value FROM app_settings WHERE key = $1', [DIGEST_KEY]).catch(() => ({ rows: [] }))).rows[0]?.value?.date
  if (last === today) return 'skipped'

  const rows = (await query<{ requester_name: string; dept_or_company: string; location: string; from_at: string; to_at: string; submitted_at: string }>(
    `SELECT requester_name, dept_or_company, location, from_at, to_at, submitted_at FROM photo_video_requests
     WHERE status = 'pending' AND request_type = 'internal' AND submitted_at < now() - make_interval(hours => $1)
     ORDER BY submitted_at`,
    [DIGEST_MIN_HOURS]
  )).rows
  if (!rows.length) return 'skipped'

  const base = await portalBaseUrl()
  if (!base) return 'skipped'
  const { subject, html } = buildPhotoPendingDigestEmail({
    items: rows.map((r) => ({ requesterName: r.requester_name, deptOrCompany: r.dept_or_company, location: r.location, fromAt: r.from_at, submittedAt: r.submitted_at, lapsed: new Date(r.to_at).getTime() < now })),
    reviewUrl: `${base}/kelola-permintaan-foto-video?status=pending&type=internal`,
  })
  if (!(await sendToAdmins(subject, html))) return 'failed'
  await query(
    `INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ($1, $2, now(), 'system')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [DIGEST_KEY, JSON.stringify({ date: today, count: rows.length })]
  )
  return 'sent'
}
