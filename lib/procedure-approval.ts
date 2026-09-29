// lib/procedure-approval.ts
//
// "Catatan Pengesahan" for Prosedur ISMS documents (see the DRAWING WEBSITE
// ISMS sheet): each document lists which positions must sign it off —
// Penanggung Jawab Umum (Presiden Director), Information Assets
// Administrator, System Security Administrator — or none at all ("–").
//
// Positions live in procedure_approver_roles, NOT on the documents, so when
// someone changes jobs an admin edits one row (name + email) in
// /kelola-pengesahan and every future request goes to the new person. Each
// approval row snapshots the name it was sent to, so the history of who
// actually signed stays correct after the change.
//
// Flow: saving a document with roles starts a "cycle" for its current
// revision — one row per role, ordered by the role's sort_order. Only the
// first row is 'pending' (emailed with a one-off token link); the rest wait.
// Approving moves the pending mark (and a fresh email) to the next row;
// rejecting stops the cycle. Approvers act from /pengesahan?token=… with no
// login — the unguessable token is the credential, same model as the Visitor
// photo/video approval.

import 'server-only'
import path from 'path'
import { stat } from 'fs/promises'
import { randomBytes } from 'crypto'
import { query } from '@/lib/db'
import { STORAGE_ROOT } from '@/lib/storage'
import { describeSmtpError, getSmtpSettings, sendMail, type MailAttachment } from '@/lib/smtp'
import { resolveAppBaseUrl } from '@/lib/request-origin'
import { buildProcedureApprovalEmail, buildProcedureResultEmail, LOGO_CID } from '@/lib/email-templates'
import { API_BASE_PATH } from '@/lib/config'

export type ApproverRole = {
  code: string
  title: string
  person_name: string
  email: string | null
  sort_order: number
  is_default: boolean
  updated_at: string
  updated_by: string | null
}

export type ApprovalStepStatus = 'waiting' | 'pending' | 'approved' | 'rejected' | 'cancelled'
export type DocumentApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected'

// Public shape — no emails, no tokens.
export type ApprovalStep = {
  id: number
  document_id: number
  revision: number
  role_code: string
  role_title: string
  step: number
  status: ApprovalStepStatus
  approver_name: string | null
  notified_at: string | null
  email_error: string | null
  decided_at: string | null
  decision_note: string | null
  verification_code: string | null
}

// Gmail/Outlook cap a whole message at ~20–25 MB; stay safely under it.
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024

const STEP_COLUMNS ='id, document_id, revision, role_code, role_title, step, status, approver_name, notified_at, email_error, decided_at, decision_note, verification_code'

// ─── schema (idempotent, created on first use — see also prosedur-pengesahan.sql) ───

let schemaReady: Promise<void> | null = null

export function ensureApprovalSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS procedure_approver_roles (
          code varchar(20) PRIMARY KEY,
          title varchar(150) NOT NULL,
          person_name varchar(150) NOT NULL,
          email varchar(255),
          sort_order integer NOT NULL DEFAULT 0,
          is_default boolean NOT NULL DEFAULT true,
          updated_at timestamptz NOT NULL DEFAULT now(),
          updated_by varchar(100)
        )`)
      await query(`
        INSERT INTO procedure_approver_roles (code, title, person_name, sort_order, is_default) VALUES
          ('SSA', 'System Security Administrator', 'Ika Yuni Setyo R.', 1, true),
          ('IAA', 'Information Assets Administrator', 'Teguh Sunjoyo', 2, true),
          ('PJU', 'Penanggung Jawab Umum (Presiden Director)', 'Tomotaka Takayanagi', 3, false)
        ON CONFLICT (code) DO NOTHING`)
      await query(`
        ALTER TABLE procedure_documents
          ADD COLUMN IF NOT EXISTS approval_roles text[] NOT NULL DEFAULT '{}',
          ADD COLUMN IF NOT EXISTS note text,
          ADD COLUMN IF NOT EXISTS approval_status varchar(20) NOT NULL DEFAULT 'none'`)
      await query(`
        CREATE TABLE IF NOT EXISTS procedure_approvals (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          document_id integer NOT NULL REFERENCES procedure_documents(id) ON DELETE CASCADE,
          revision integer NOT NULL,
          role_code varchar(20) NOT NULL,
          role_title varchar(150) NOT NULL,
          step integer NOT NULL,
          status varchar(20) NOT NULL DEFAULT 'waiting',
          token varchar(64) UNIQUE,
          approver_name varchar(150),
          approver_email varchar(255),
          notified_at timestamptz,
          email_error text,
          decided_at timestamptz,
          decision_note text,
          created_at timestamptz NOT NULL DEFAULT now()
        )`)
      await query('CREATE INDEX IF NOT EXISTS procedure_approvals_document_idx ON procedure_approvals (document_id, revision)')
      // Per-person e-signature: issued when someone approves, encoded in their QR.
      await query('ALTER TABLE procedure_approvals ADD COLUMN IF NOT EXISTS verification_code varchar(40) UNIQUE')
    })().catch((error) => {
      schemaReady = null
      throw error
    })
  }
  return schemaReady
}

// ─── roles ───

export async function listRoles(): Promise<ApproverRole[]> {
  await ensureApprovalSchema()
  const result = await query<ApproverRole>('SELECT code, title, person_name, email, sort_order, is_default, updated_at, updated_by FROM procedure_approver_roles ORDER BY sort_order ASC, code ASC')
  return result.rows
}

// Keeps only known role codes, in signing order, without duplicates.
export async function normalizeRoleCodes(raw: unknown): Promise<string[]> {
  const requested = Array.isArray(raw) ? raw.filter((code): code is string => typeof code === 'string') : []
  const roles = await listRoles()
  return roles.filter((role) => requested.includes(role.code)).map((role) => role.code)
}

// ─── reading ───

// Current cycle for each document = its current revision's non-cancelled rows.
export async function currentStepsFor(documentIds: number[]): Promise<Map<number, ApprovalStep[]>> {
  await ensureApprovalSchema()
  const map = new Map<number, ApprovalStep[]>()
  if (documentIds.length === 0) return map
  const result = await query<ApprovalStep>(
    `SELECT ${STEP_COLUMNS.split(', ').map((c) => `a.${c}`).join(', ')}
     FROM procedure_approvals a
     JOIN procedure_documents d ON d.id = a.document_id AND d.revision = a.revision
     WHERE a.document_id = ANY($1) AND a.status <> 'cancelled'
     ORDER BY a.document_id, a.step`,
    [documentIds]
  )
  for (const row of result.rows) {
    const list = map.get(row.document_id) ?? []
    list.push(row)
    map.set(row.document_id, list)
  }
  return map
}

// ─── cycle ───

type DocumentInfo = { id: number; control_no: string; title: string; revision: number; elf_date: string; note: string | null; file_path: string }

async function getDocument(documentId: number) {
  // elf_date as plain YYYY-MM-DD text — a DATE sent as a JS Date shifts a day back in UTC.
  const result = await query<DocumentInfo>("SELECT id, control_no, title, revision, to_char(elf_date, 'YYYY-MM-DD') AS elf_date, note, file_path FROM procedure_documents WHERE id = $1", [documentId])
  return result.rows[0] ?? null
}

async function setDocumentStatus(documentId: number, status: DocumentApprovalStatus) {
  await query('UPDATE procedure_documents SET approval_status = $1 WHERE id = $2', [status, documentId])
}

/**
 * (Re)starts the approval cycle for a document's current revision: cancels
 * whatever was still open, creates one row per role and emails the first.
 * With no roles the document is simply marked as not needing approval.
 */
export async function startApprovalCycle(documentId: number, roleCodes: string[]) {
  await ensureApprovalSchema()
  const doc = await getDocument(documentId)
  if (!doc) return

  await query(
    `UPDATE procedure_approvals SET status = 'cancelled', token = NULL
     WHERE document_id = $1 AND status IN ('waiting', 'pending', 'rejected', 'approved') AND revision = $2`,
    [documentId, doc.revision]
  )
  await query(
    `UPDATE procedure_approvals SET status = 'cancelled', token = NULL
     WHERE document_id = $1 AND status IN ('waiting', 'pending')`,
    [documentId]
  )

  if (roleCodes.length === 0) {
    await setDocumentStatus(documentId, 'none')
    return
  }

  const roles = (await listRoles()).filter((role) => roleCodes.includes(role.code))
  for (const [index, role] of roles.entries()) {
    await query(
      `INSERT INTO procedure_approvals (document_id, revision, role_code, role_title, step, status, approver_name)
       VALUES ($1, $2, $3, $4, $5, 'waiting', $6)`,
      [documentId, doc.revision, role.code, role.title, index + 1, role.person_name]
    )
  }
  await setDocumentStatus(documentId, 'pending')
  await activateNextStep(documentId)
}

// Marks the lowest waiting step of the current cycle as pending and emails
// its approver. Returns false when nothing is left (cycle complete).
async function activateNextStep(documentId: number): Promise<boolean> {
  const doc = await getDocument(documentId)
  if (!doc) return false
  const next = await query<{ id: number }>(
    `SELECT id FROM procedure_approvals
     WHERE document_id = $1 AND revision = $2 AND status = 'waiting'
     ORDER BY step ASC LIMIT 1`,
    [documentId, doc.revision]
  )
  if (!next.rows[0]) return false
  await sendStepRequest(next.rows[0].id)
  return true
}

/**
 * Issues a fresh token for a step (invalidating any earlier link), points it
 * at whoever currently holds the role, marks it pending and emails them.
 * Used for the first send, for "Kirim ulang", and when a role changes hands.
 */
export async function sendStepRequest(stepId: number): Promise<{ sent: boolean; error: string | null }> {
  const stepResult = await query<ApprovalStep & { approver_email: string | null }>(`SELECT ${STEP_COLUMNS}, approver_email FROM procedure_approvals WHERE id = $1`, [stepId])
  const step = stepResult.rows[0]
  if (!step) return { sent: false, error: 'Tahap pengesahan tidak ditemukan.' }

  const roleResult = await query<ApproverRole>('SELECT code, title, person_name, email, sort_order, is_default, updated_at, updated_by FROM procedure_approver_roles WHERE code = $1', [step.role_code])
  const role = roleResult.rows[0]
  const token = randomBytes(24).toString('hex')
  const approverName = role?.person_name ?? step.approver_name ?? step.role_title
  const approverEmail = role?.email ?? null

  await query(
    `UPDATE procedure_approvals
     SET status = 'pending', token = $1, approver_name = $2, approver_email = $3, role_title = COALESCE($4, role_title), notified_at = NULL, email_error = NULL
     WHERE id = $5`,
    [token, approverName, approverEmail, role?.title ?? null, stepId]
  )

  const error = await emailStep(stepId, token)
  await query(
    `UPDATE procedure_approvals SET notified_at = CASE WHEN $1::text IS NULL THEN now() ELSE NULL END, email_error = $1 WHERE id = $2`,
    [error, stepId]
  )
  return { sent: error === null, error }
}

async function emailStep(stepId: number, token: string): Promise<string | null> {
  try {
    const stepResult = await query<ApprovalStep & { approver_email: string | null }>(`SELECT ${STEP_COLUMNS}, approver_email FROM procedure_approvals WHERE id = $1`, [stepId])
    const step = stepResult.rows[0]
    if (!step) return 'Tahap tidak ditemukan.'
    if (!step.approver_email) return `Email untuk ${step.role_title} belum diisi di Kelola Pengesahan.`

    const settings = await getSmtpSettings()
    if (!settings?.host || !settings.port || !settings.senderEmail) return 'SMTP belum dikonfigurasi (Admin Settings → SMTP Settings).'

    const doc = await getDocument(step.document_id)
    if (!doc) return 'Dokumen tidak ditemukan.'
    const cycle = await query<ApprovalStep>(
      `SELECT ${STEP_COLUMNS} FROM procedure_approvals WHERE document_id = $1 AND revision = $2 AND status <> 'cancelled' ORDER BY step`,
      [doc.id, doc.revision]
    )

    const base = resolveAppBaseUrl(settings.appUrl)
    const { subject, html } = buildProcedureApprovalEmail({
      approverName: step.approver_name ?? step.role_title,
      roleTitle: step.role_title,
      controlNo: doc.control_no,
      title: doc.title,
      revision: doc.revision,
      effDate: doc.elf_date,
      note: doc.note,
      stepNumber: step.step,
      stepTotal: cycle.rows.length,
      previous: cycle.rows.filter((row) => row.status === 'approved').map((row) => ({ roleTitle: row.role_title, name: row.approver_name ?? '-', decidedAt: row.decided_at })),
      reviewUrl: `${base}${API_BASE_PATH}/pengesahan?token=${token}`,
    })
    // The procedure itself travels with the email ("telah saya lampirkan pada
    // email ini"), unless it's too big for typical mail servers — then the
    // review link (which shows the PDF) is the way in.
    const attachments: MailAttachment[] = [{ filename: 'yazaki-logo.jpg', path: path.join(process.cwd(), 'public', 'images', 'yazaki-logo.jpg'), cid: LOGO_CID }]
    const docPath = path.join(STORAGE_ROOT, doc.file_path)
    const docSize = await stat(docPath).then((s) => s.size).catch(() => 0)
    if (docSize > 0 && docSize <= MAX_ATTACHMENT_BYTES) {
      const filename = `${doc.control_no} - ${doc.title}.pdf`.replace(/[\\/:*?"<>|]/g, '-')
      attachments.push({ filename, path: docPath, contentType: 'application/pdf' })
    }

    await sendMail(settings, { to: step.approver_email, subject, html, attachments })
    return null
  } catch (error) {
    console.error('[procedure-approval/emailStep]', error)
    return describeSmtpError(error)
  }
}

// ─── decisions (public, token-secured) ───

export type TokenView = {
  step: ApprovalStep
  document: { id: number; control_no: string; title: string; revision: number; elf_date: string; note: string | null; file_path: string }
  cycle: ApprovalStep[]
}

export async function getByToken(token: string): Promise<TokenView | null> {
  await ensureApprovalSchema()
  if (!/^[a-f0-9]{48}$/.test(token)) return null
  const stepResult = await query<ApprovalStep>(`SELECT ${STEP_COLUMNS} FROM procedure_approvals WHERE token = $1`, [token])
  const step = stepResult.rows[0]
  if (!step) return null
  const doc = await getDocument(step.document_id)
  if (!doc) return null
  const cycle = await query<ApprovalStep>(
    `SELECT ${STEP_COLUMNS} FROM procedure_approvals WHERE document_id = $1 AND revision = $2 AND status <> 'cancelled' ORDER BY step`,
    [step.document_id, step.revision]
  )
  return { step, document: doc, cycle: cycle.rows }
}

export async function decideByToken(token: string, action: 'approve' | 'reject', note: string | null): Promise<{ ok: boolean; message: string }> {
  const view = await getByToken(token)
  if (!view) return { ok: false, message: 'Link tidak ditemukan atau sudah tidak berlaku.' }
  if (view.step.status !== 'pending') return { ok: false, message: 'Tahap ini sudah diproses sebelumnya.' }
  if (view.step.revision !== view.document.revision) return { ok: false, message: 'Dokumen sudah direvisi — link ini tidak berlaku lagi.' }

  const status = action === 'approve' ? 'approved' : 'rejected'
  // An approval is this person's e-signature: it gets its own verification
  // code, which their QR (register, PDF sheet) points at.
  const verificationCode = action === 'approve' ? `PRS-${view.step.id}-${randomBytes(4).toString('hex').toUpperCase()}` : null
  // Token stays on the row so the approver can reopen the link to see the result;
  // the status guard makes the decision single-use.
  const updated = await query<{ id: number }>(
    `UPDATE procedure_approvals SET status = $1, decided_at = now(), decision_note = $2, verification_code = $3
     WHERE id = $4 AND status = 'pending' RETURNING id`,
    [status, note, verificationCode, view.step.id]
  )
  if (updated.rows.length === 0) return { ok: false, message: 'Tahap ini sudah diproses sebelumnya.' }

  if (action === 'reject') {
    await query(
      `UPDATE procedure_approvals SET status = 'cancelled', token = NULL
       WHERE document_id = $1 AND revision = $2 AND status = 'waiting'`,
      [view.document.id, view.document.revision]
    )
    await setDocumentStatus(view.document.id, 'rejected')
    await notifyAdmins(view.document.id, 'rejected')
    return { ok: true, message: 'Dokumen ditolak. Admin ISM akan menerima pemberitahuan.' }
  }

  const hasNext = await activateNextStep(view.document.id)
  if (!hasNext) {
    await setDocumentStatus(view.document.id, 'approved')
    await notifyAdmins(view.document.id, 'approved')
    return { ok: true, message: 'Terima kasih — dokumen telah disahkan oleh seluruh approver.' }
  }
  return { ok: true, message: 'Terima kasih — persetujuan tersimpan dan diteruskan ke approver berikutnya.' }
}

// Best-effort heads-up to ISM Admin accounts that have an email address.
async function notifyAdmins(documentId: number, outcome: 'approved' | 'rejected') {
  try {
    const settings = await getSmtpSettings()
    if (!settings?.host || !settings.port || !settings.senderEmail) return
    const admins = await query<{ email: string }>("SELECT email FROM admins WHERE role = 'ism_admin' AND email IS NOT NULL AND email <> ''")
    if (admins.rows.length === 0) return
    const doc = await getDocument(documentId)
    if (!doc) return
    const cycle = (await currentStepsFor([documentId])).get(documentId) ?? []
    const { subject, html } = buildProcedureResultEmail({
      outcome,
      controlNo: doc.control_no,
      title: doc.title,
      revision: doc.revision,
      steps: cycle.map((row) => ({ roleTitle: row.role_title, name: row.approver_name ?? '-', status: row.status, decidedAt: row.decided_at, note: row.decision_note })),
      registerUrl: `${resolveAppBaseUrl(settings.appUrl)}${API_BASE_PATH}/prosedur-isms`,
    })
    await sendMail(settings, {
      to: admins.rows.map((row) => row.email).join(', '),
      subject,
      html,
      attachments: [{ filename: 'yazaki-logo.jpg', path: path.join(process.cwd(), 'public', 'images', 'yazaki-logo.jpg'), cid: LOGO_CID }],
    })
  } catch (error) {
    console.error('[procedure-approval/notifyAdmins]', error)
  }
}

/**
 * After a role changes hands (name or email edited), re-points every step
 * still waiting on that role at the new person — pending ones get a fresh
 * link emailed (the old link stops working), waiting ones just show the new name.
 */
export async function reassignRole(code: string): Promise<{ resent: number; failed: number }> {
  const role = (await listRoles()).find((r) => r.code === code)
  if (!role) return { resent: 0, failed: 0 }
  await query(
    `UPDATE procedure_approvals SET approver_name = $1, role_title = $2 WHERE role_code = $3 AND status = 'waiting'`,
    [role.person_name, role.title, code]
  )
  const pending = await query<{ id: number }>(`SELECT id FROM procedure_approvals WHERE role_code = $1 AND status = 'pending'`, [code])
  let resent = 0
  let failed = 0
  for (const row of pending.rows) {
    const result = await sendStepRequest(row.id)
    if (result.sent) resent++
    else failed++
  }
  return { resent, failed }
}

// ─── e-signature verification (QR) ───

export type SignatureValidity = 'valid' | 'superseded' | 'voided'

export type SignatureView = {
  code: string
  approver_name: string | null
  role_title: string
  decided_at: string
  revision: number
  document: { id: number; control_no: string; title: string; revision: number; elf_date: string; approval_status: string }
  validity: SignatureValidity
}

/**
 * Looks up one person's signature by its QR code. 'valid' = still part of
 * the document's current revision; 'superseded' = signed an older revision;
 * 'voided' = the approval cycle it belonged to was restarted.
 */
export async function getSignature(code: string): Promise<SignatureView | null> {
  await ensureApprovalSchema()
  if (!/^PRS-\d+-[A-F0-9]{8}$/.test(code)) return null
  const result = await query<{ status: string; approver_name: string | null; role_title: string; decided_at: string; revision: number; document_id: number }>(
    `SELECT status, approver_name, role_title, decided_at, revision, document_id FROM procedure_approvals WHERE verification_code = $1`,
    [code]
  )
  const row = result.rows[0]
  if (!row) return null
  const doc = await query<{ id: number; control_no: string; title: string; revision: number; elf_date: string; approval_status: string }>(
    "SELECT id, control_no, title, revision, to_char(elf_date, 'YYYY-MM-DD') AS elf_date, approval_status FROM procedure_documents WHERE id = $1",
    [row.document_id]
  )
  if (!doc.rows[0]) return null
  const validity: SignatureValidity = row.status !== 'approved' ? 'voided' : row.revision !== doc.rows[0].revision ? 'superseded' : 'valid'
  return { code, approver_name: row.approver_name, role_title: row.role_title, decided_at: row.decided_at, revision: row.revision, document: doc.rows[0], validity }
}

// What every signature QR points at, minus the code — built from the
// admin-configured App URL (like the email links), so a QR scanned on a
// phone opens the LAN address rather than whatever host generated it.
export async function verifyBaseUrl(fallbackOrigin?: string) {
  const settings = await getSmtpSettings()
  return `${resolveAppBaseUrl(settings?.appUrl, fallbackOrigin)}${API_BASE_PATH}/verifikasi-pengesahan?code=`
}

// Documents currently waiting on someone — for the admin monitoring list.
export async function listPendingSteps() {
  await ensureApprovalSchema()
  const result = await query<ApprovalStep & { control_no: string; title: string; approver_email: string | null }>(
    `SELECT ${STEP_COLUMNS.split(', ').map((c) => `a.${c}`).join(', ')}, a.approver_email, d.control_no, d.title
     FROM procedure_approvals a JOIN procedure_documents d ON d.id = a.document_id AND d.revision = a.revision
     WHERE a.status = 'pending'
     ORDER BY a.notified_at ASC NULLS FIRST, a.id ASC`
  )
  return result.rows
}
