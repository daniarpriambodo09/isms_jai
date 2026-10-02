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
import { query, withTransaction } from '@/lib/db'
import { STORAGE_ROOT } from '@/lib/storage'
import { describeSmtpError, getSmtpSettings, sendMail, type MailAttachment } from '@/lib/smtp'
import { resolveAppBaseUrl } from '@/lib/request-origin'
import { buildProcedureApprovalEmail, buildProcedureResultEmail, LOGO_CID } from '@/lib/email-templates'
import { API_BASE_PATH } from '@/lib/config'
import { isDeliverableEmail } from '@/lib/email-address'
import { docKindInfo, type DocKind } from '@/lib/document-kinds'

export type ApproverRole = {
  code: string
  // Which register the position signs for — each kind has its own list.
  kind: DocKind
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
  // When the current link (token) was issued — it stops working for decisions
  // APPROVAL_LINK_DAYS later (an admin resend issues a fresh one).
  token_issued_at: string | null
}

// Gmail/Outlook cap a whole message at ~20–25 MB; stay safely under it.
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024

const ROLE_COLUMNS = 'code, kind, title, person_name, email, sort_order, is_default, updated_at, updated_by'

const STEP_COLUMNS ='id, document_id, revision, role_code, role_title, step, status, approver_name, notified_at, email_error, decided_at, decision_note, verification_code, token_issued_at'

// ─── schema (idempotent, created on first use — see also db/legacy/prosedur-pengesahan.sql) ───

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
      // One list of positions per register (db/migrations/0005).
      await query("ALTER TABLE procedure_approver_roles ADD COLUMN IF NOT EXISTS kind varchar(30) NOT NULL DEFAULT 'procedure'")
      // Starter positions for a brand-new table only — never re-added once an
      // admin has edited or deleted them.
      await query(`
        INSERT INTO procedure_approver_roles (code, title, person_name, sort_order, is_default)
        SELECT v.code, v.title, v.person_name, v.sort_order, v.is_default
        FROM (VALUES
          ('SSA', 'System Security Administrator', 'Ika Yuni Setyo R.', 1, true),
          ('IAA', 'Information Assets Administrator', 'Teguh Sunjoyo', 2, true),
          ('PJU', 'Penanggung Jawab Umum (Presiden Director)', 'Tomotaka Takayanagi', 3, false)
        ) AS v(code, title, person_name, sort_order, is_default)
        WHERE NOT EXISTS (SELECT 1 FROM procedure_approver_roles)
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
      await query('ALTER TABLE procedure_approvals ADD COLUMN IF NOT EXISTS token_issued_at timestamptz')
      // Where each role's QR goes on the document itself (its own signature
      // column). Coordinates are fractions (0–1) of the displayed page, top-left
      // origin; tied to file_path so a re-uploaded file never reuses old spots.
      await query(`
        CREATE TABLE IF NOT EXISTS procedure_signature_slots (
          document_id integer NOT NULL REFERENCES procedure_documents(id) ON DELETE CASCADE,
          role_code varchar(20) NOT NULL,
          file_path text NOT NULL,
          page integer NOT NULL,
          x real NOT NULL,
          y real NOT NULL,
          w real NOT NULL,
          h real NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (document_id, role_code)
        )`)
      // Optional box in the TANGGAL column of the same row, where the approval
      // date is printed (same coordinate system as the QR box).
      await query(`ALTER TABLE procedure_signature_slots
        ADD COLUMN IF NOT EXISTS date_x real, ADD COLUMN IF NOT EXISTS date_y real,
        ADD COLUMN IF NOT EXISTS date_w real, ADD COLUMN IF NOT EXISTS date_h real`)
      // A role may sign in more than one place (copies of the same QR, e.g. a
      // signature table on two pages): seq numbers them per role.
      await query('ALTER TABLE procedure_signature_slots ADD COLUMN IF NOT EXISTS seq integer NOT NULL DEFAULT 0')
      await query('ALTER TABLE procedure_signature_slots DROP CONSTRAINT IF EXISTS procedure_signature_slots_pkey')
      await query('CREATE UNIQUE INDEX IF NOT EXISTS procedure_signature_slots_role_seq ON procedure_signature_slots (document_id, role_code, seq)')
      // When an ISM Admin last dismissed this document's bell notification
      // (Disahkan / Perlu Revisi); a newer decision brings it back.
      await query('ALTER TABLE procedure_documents ADD COLUMN IF NOT EXISTS notice_ack_at timestamptz')
      // "Minta Revisi": the approver's notes, each optionally pinned to a spot
      // on the document (page + fractions, top-left origin). page NULL = the
      // general note. decision_note on the step keeps a plain-text summary.
      await query(`
        CREATE TABLE IF NOT EXISTS procedure_revision_notes (
          id serial PRIMARY KEY,
          approval_id integer NOT NULL REFERENCES procedure_approvals(id) ON DELETE CASCADE,
          document_id integer NOT NULL REFERENCES procedure_documents(id) ON DELETE CASCADE,
          revision integer NOT NULL,
          seq integer NOT NULL,
          page integer,
          x real,
          y real,
          note text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )`)
    })().catch((error) => {
      schemaReady = null
      throw error
    })
  }
  return schemaReady
}

// ─── roles ───

// Without a kind: every position of every register (codes are unique across them).
export async function listRoles(kind?: DocKind): Promise<ApproverRole[]> {
  await ensureApprovalSchema()
  const result = kind
    ? await query<ApproverRole>(`SELECT ${ROLE_COLUMNS} FROM procedure_approver_roles WHERE kind = $1 ORDER BY sort_order ASC, code ASC`, [kind])
    : await query<ApproverRole>(`SELECT ${ROLE_COLUMNS} FROM procedure_approver_roles ORDER BY kind ASC, sort_order ASC, code ASC`)
  return result.rows
}

// Keeps only the role codes known for that register, in signing order, without duplicates.
export async function normalizeRoleCodes(raw: unknown, kind: DocKind): Promise<string[]> {
  const requested = Array.isArray(raw) ? raw.filter((code): code is string => typeof code === 'string') : []
  const roles = await listRoles(kind)
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

// kind: which register the document belongs to — the engine treats them alike,
// only the names and links in e-mails and notices differ (lib/document-kinds.ts).
type DocumentInfo = { id: number; kind: DocKind; control_no: string; title: string; revision: number; elf_date: string; note: string | null; file_path: string }

async function getDocument(documentId: number) {
  // elf_date as plain YYYY-MM-DD text — a DATE sent as a JS Date shifts a day back in UTC.
  const result = await query<DocumentInfo>("SELECT id, kind, control_no, title, revision, to_char(elf_date, 'YYYY-MM-DD') AS elf_date, note, file_path FROM procedure_documents WHERE id = $1", [documentId])
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

  // Cancel the old cycle and create the new one atomically — never a
  // document with its old steps gone and no new ones.
  const started = await withTransaction(async () => {
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
      return false
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
    return true
  })
  // Emailing the first approver happens after the commit.
  if (started) await activateNextStep(documentId)
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

  const roleResult = await query<ApproverRole>(`SELECT ${ROLE_COLUMNS} FROM procedure_approver_roles WHERE code = $1`, [step.role_code])
  const role = roleResult.rows[0]
  const token = randomBytes(24).toString('hex')
  const approverName = role?.person_name ?? step.approver_name ?? step.role_title
  const approverEmail = role?.email ?? null

  await query(
    `UPDATE procedure_approvals
     SET status = 'pending', token = $1, token_issued_at = now(), approver_name = $2, approver_email = $3, role_title = COALESCE($4, role_title), notified_at = NULL, email_error = NULL
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
      chain: cycle.rows.map((row) => ({
        roleTitle: row.role_title,
        name: row.approver_name ?? '-',
        state: row.id === step.id ? 'current' as const : row.status === 'approved' ? 'done' as const : 'waiting' as const,
        decidedAt: row.decided_at,
      })),
      reviewUrl: `${base}${API_BASE_PATH}/pengesahan?token=${token}`,
      kind: docKindInfo(doc.kind),
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
  document: { id: number; kind: DocKind; control_no: string; title: string; revision: number; elf_date: string; note: string | null; file_path: string }
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

// ─── "Minta Revisi" notes ───

// A revision note: pinned to a spot on the document (page + fractions,
// top-left origin), or page null for the general note.
export type RevisionNote = { page: number | null; x: number | null; y: number | null; note: string }

const MAX_REVISION_NOTES = 30

// Validates notes sent from the /pengesahan page; drops anything malformed.
export function parseRevisionNotes(raw: unknown): RevisionNote[] {
  const list: unknown[] = Array.isArray(raw) ? raw : []
  const frac = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
  const notes: RevisionNote[] = []
  for (const item of list) {
    const n = item as Record<string, unknown>
    const text = typeof n.note === 'string' ? n.note.trim().slice(0, 500) : ''
    if (!text) continue
    const pinned = Number.isInteger(n.page) && (n.page as number) >= 0 && (n.page as number) <= 500 && frac(n.x) && frac(n.y)
    notes.push(pinned ? { page: n.page as number, x: n.x as number, y: n.y as number, note: text } : { page: null, x: null, y: null, note: text })
    if (notes.length >= MAX_REVISION_NOTES) break
  }
  return notes
}

// Plain-text summary kept in decision_note (register, emails): the general
// note first, then "1) Hal. 2: …" per pinned note.
export function summarizeRevisionNotes(general: string | null, notes: RevisionNote[]) {
  const lines: string[] = []
  if (general) lines.push(general)
  notes.filter((n) => n.page !== null).forEach((n, i) => lines.push(`${i + 1}) Hal. ${(n.page as number) + 1}: ${n.note}`))
  return lines.join('\n').slice(0, 4000)
}

export type RevisionRequest = {
  approvalId: number
  approverName: string | null
  roleTitle: string
  revision: number
  decidedAt: string
  general: string | null
  pins: { page: number; x: number; y: number; note: string }[]
}

// The most recent "Minta Revisi" on a document (in any cycle — a restart
// cancels the step but keeps its decision and notes).
export async function latestRevisionRequest(documentId: number): Promise<RevisionRequest | null> {
  await ensureApprovalSchema()
  const step = (await query<{ id: number; approver_name: string | null; role_title: string; revision: number; decided_at: string; decision_note: string | null }>(
    `SELECT id, approver_name, role_title, revision, decided_at, decision_note FROM procedure_approvals
     WHERE document_id = $1 AND decided_at IS NOT NULL AND verification_code IS NULL AND decision_note IS NOT NULL
     ORDER BY decided_at DESC LIMIT 1`,
    [documentId]
  )).rows[0]
  if (!step) return null
  const rows = (await query<{ page: number | null; x: number | null; y: number | null; note: string }>(
    'SELECT page, x, y, note FROM procedure_revision_notes WHERE approval_id = $1 ORDER BY seq',
    [step.id]
  )).rows
  const general = rows.find((r) => r.page === null)?.note ?? null
  const pins = rows.filter((r) => r.page !== null).map((r) => ({ page: r.page as number, x: r.x ?? 0, y: r.y ?? 0, note: r.note }))
  return {
    approvalId: step.id,
    approverName: step.approver_name,
    roleTitle: step.role_title,
    revision: step.revision,
    decidedAt: step.decided_at,
    // Requests made before pinned notes existed only have the summary text.
    general: rows.length ? general : step.decision_note,
    pins,
  }
}

export async function decideByToken(
  token: string,
  action: 'approve' | 'reject',
  note: string | null,
  revisionNotes: RevisionNote[] = []
): Promise<{ ok: boolean; message: string }> {
  const view = await getByToken(token)
  if (!view) return { ok: false, message: 'Link tidak ditemukan atau sudah tidak berlaku.' }
  if (view.step.status !== 'pending') return { ok: false, message: 'Tahap ini sudah diproses sebelumnya.' }
  if (view.step.revision !== view.document.revision) return { ok: false, message: 'Dokumen sudah direvisi — link ini tidak berlaku lagi.' }
  if (linkExpired(view.step)) return { ok: false, message: `Link ini sudah kedaluwarsa (lebih dari ${APPROVAL_LINK_DAYS} hari). Minta Admin ISM mengirim ulang email pengesahan.` }

  // Revision request: rows to store = the general note (page null) + the
  // pinned ones; decision_note gets the plain-text summary of all of them.
  const general = action === 'reject' ? note : null
  const pinned = action === 'reject' ? revisionNotes.filter((n) => n.page !== null) : []
  if (action === 'reject') {
    note = summarizeRevisionNotes(general, pinned) || null
    if (!note) return { ok: false, message: 'Tuliskan minimal satu catatan revisi.' }
  }

  const status = action === 'approve' ? 'approved' : 'rejected'
  // An approval is this person's e-signature: it gets its own verification
  // code, which their QR (register, PDF sheet) points at.
  const verificationCode = action === 'approve' ? `PRS-${view.step.id}-${randomBytes(4).toString('hex').toUpperCase()}` : null
  // All database effects of the decision commit together (the decision,
  // revision notes, cancelled later steps, the document status); emails go
  // out only after the commit.
  const outcome = await withTransaction(async () => {
    // Token stays on the row so the approver can reopen the link to see the result;
    // the status guard makes the decision single-use.
    const updated = await query<{ id: number }>(
      `UPDATE procedure_approvals SET status = $1, decided_at = now(), decision_note = $2, verification_code = $3
       WHERE id = $4 AND status = 'pending' RETURNING id`,
      [status, note, verificationCode, view.step.id]
    )
    if (updated.rows.length === 0) return 'already' as const

    if (action === 'reject') {
      const rows: RevisionNote[] = [...(general ? [{ page: null, x: null, y: null, note: general }] : []), ...pinned]
      for (const [seq, n] of rows.entries()) {
        await query(
          `INSERT INTO procedure_revision_notes (approval_id, document_id, revision, seq, page, x, y, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [view.step.id, view.document.id, view.document.revision, seq, n.page, n.x, n.y, n.note]
        )
      }
      await query(
        `UPDATE procedure_approvals SET status = 'cancelled', token = NULL
         WHERE document_id = $1 AND revision = $2 AND status = 'waiting'`,
        [view.document.id, view.document.revision]
      )
      await setDocumentStatus(view.document.id, 'rejected')
      return 'rejected' as const
    }

    const next = await query<{ id: number }>(
      `SELECT id FROM procedure_approvals WHERE document_id = $1 AND revision = $2 AND status = 'waiting' LIMIT 1`,
      [view.document.id, view.document.revision]
    )
    if (next.rows.length) return 'next' as const
    await setDocumentStatus(view.document.id, 'approved')
    return 'approved' as const
  })

  if (outcome === 'already') return { ok: false, message: 'Tahap ini sudah diproses sebelumnya.' }
  if (outcome === 'rejected') {
    await notifyAdmins(view.document.id, 'rejected')
    return { ok: true, message: 'Permintaan revisi terkirim. Admin ISM menerima pemberitahuan beserta catatan Anda.' }
  }
  if (outcome === 'approved') {
    await notifyAdmins(view.document.id, 'approved')
    return { ok: true, message: 'Terima kasih — dokumen telah disahkan oleh seluruh approver.' }
  }
  await activateNextStep(view.document.id)
  return { ok: true, message: 'Terima kasih — persetujuan tersimpan dan diteruskan ke approver berikutnya.' }
}

// Best-effort heads-up to ISM Admin accounts that have an email address.
async function notifyAdmins(documentId: number, outcome: 'approved' | 'rejected') {
  try {
    const settings = await getSmtpSettings()
    if (!settings?.host || !settings.port || !settings.senderEmail) return
    // Only addresses that can actually receive mail (a placeholder like
    // admin@jai.local just bounces back); with none, fall back to the SMTP
    // sender mailbox so the notification still lands somewhere.
    const admins = await query<{ email: string }>("SELECT email FROM admins WHERE role = 'ism_admin' AND email IS NOT NULL AND email <> ''")
    const deliverable = admins.rows.map((row) => row.email.trim()).filter(isDeliverableEmail)
    const recipients = deliverable.length ? deliverable : [settings.senderEmail]
    if (deliverable.length < admins.rows.length) {
      console.warn('[procedure-approval/notifyAdmins] skipped undeliverable admin email(s):', admins.rows.map((r) => r.email).filter((e) => !isDeliverableEmail(e)).join(', '))
    }
    const doc = await getDocument(documentId)
    if (!doc) return
    // Every step of the cycle that just ended — including the ones a revision
    // request skipped (cancelled), so the email shows the whole chain.
    const cycle = (await query<ApprovalStep>(
      `SELECT ${STEP_COLUMNS} FROM procedure_approvals
       WHERE document_id = $1 AND revision = $2
         AND created_at >= (SELECT max(created_at) FROM procedure_approvals WHERE document_id = $1 AND revision = $2 AND step = 1)
       ORDER BY step`,
      [documentId, doc.revision]
    )).rows
    const base = `${resolveAppBaseUrl(settings.appUrl)}${API_BASE_PATH}`
    const request = outcome === 'rejected' ? await latestRevisionRequest(documentId) : null
    // Approved: how many approvers have a QR spot on the document itself.
    const placedRoles = outcome === 'approved'
      ? new Set((await slotsFor(documentId, doc.file_path)).map((s) => s.role_code))
      : new Set<string>()
    const { subject, html } = buildProcedureResultEmail({
      outcome,
      controlNo: doc.control_no,
      title: doc.title,
      revision: doc.revision,
      effDate: doc.elf_date,
      docNote: doc.note,
      steps: cycle.map((row) => ({ step: row.step, roleCode: row.role_code, roleTitle: row.role_title, name: row.approver_name ?? '-', status: row.status, decidedAt: row.decided_at })),
      revisionRequest: request
        ? { by: request.approverName ?? '-', roleTitle: request.roleTitle, at: request.decidedAt, general: request.general, pins: request.pins.map((p) => ({ page: p.page, note: p.note })) }
        : null,
      placements: outcome === 'approved' ? { placed: cycle.filter((s) => placedRoles.has(s.role_code)).length, total: cycle.length } : undefined,
      // Opens the register already filtered to this document.
      registerUrl: `${base}${docKindInfo(doc.kind).path}?q=${encodeURIComponent(doc.control_no)}`,
      signedPdfUrl: outcome === 'approved' ? `${base}/api/prosedur-isms/${documentId}/pdf` : undefined,
      kind: docKindInfo(doc.kind),
    })
    await sendMail(settings, {
      to: recipients.join(', '),
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
  document: { id: number; kind: DocKind; control_no: string; title: string; revision: number; elf_date: string; approval_status: string }
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
  const doc = await query<{ id: number; kind: DocKind; control_no: string; title: string; revision: number; elf_date: string; approval_status: string }>(
    "SELECT id, kind, control_no, title, revision, to_char(elf_date, 'YYYY-MM-DD') AS elf_date, approval_status FROM procedure_documents WHERE id = $1",
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

// ─── signature slots (QR placement on the document itself) ───

export type DateBox = { x: number; y: number; w: number; h: number }
// One QR placement; a role can have several (seq 0, 1, …).
export type SignatureSlot = { role_code: string; seq?: number; page: number; x: number; y: number; w: number; h: number; date?: DateBox | null }

// Most placements one role may have on a document.
export const MAX_SLOTS_PER_ROLE = 8

// Slots for the document's CURRENT file only.
export async function slotsFor(documentId: number, filePath: string): Promise<SignatureSlot[]> {
  await ensureApprovalSchema()
  const result = await query<Omit<SignatureSlot, 'date'> & { date_x: number | null; date_y: number | null; date_w: number | null; date_h: number | null }>(
    `SELECT role_code, seq, page, x, y, w, h, date_x, date_y, date_w, date_h
     FROM procedure_signature_slots WHERE document_id = $1 AND file_path = $2
     ORDER BY role_code, seq`,
    [documentId, filePath]
  )
  return result.rows.map(({ date_x, date_y, date_w, date_h, ...slot }) => ({
    ...slot,
    date: date_x !== null && date_y !== null && date_w !== null && date_h !== null ? { x: date_x, y: date_y, w: date_w, h: date_h } : null,
  }))
}

export async function slotCounts(documentIds: number[]): Promise<Map<number, number>> {
  await ensureApprovalSchema()
  const map = new Map<number, number>()
  if (documentIds.length === 0) return map
  const result = await query<{ document_id: number; count: string }>(
    `SELECT s.document_id, COUNT(DISTINCT s.role_code) AS count FROM procedure_signature_slots s
     JOIN procedure_documents d ON d.id = s.document_id AND d.file_path = s.file_path
     WHERE s.document_id = ANY($1) GROUP BY s.document_id`,
    [documentIds]
  )
  for (const row of result.rows) map.set(row.document_id, Number(row.count))
  return map
}

// Validates placements sent by an editor: known roles only, fractions in
// 0–1, sane sizes, at most MAX_SLOTS_PER_ROLE per role. Invalid entries are
// dropped; an invalid date box is just cleared.
export function parseSlots(raw: unknown, allowedRoles: string[]): SignatureSlot[] {
  const list: unknown[] = Array.isArray(raw) ? raw : []
  const frac = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
  const perRole = new Map<string, number>()
  const slots: SignatureSlot[] = []
  for (const item of list) {
    const s = item as Record<string, unknown>
    if (typeof s.role_code !== 'string' || !allowedRoles.includes(s.role_code)) continue
    if (!Number.isInteger(s.page) || (s.page as number) < 0 || (s.page as number) > 500) continue
    if (![s.x, s.y, s.w, s.h].every(frac) || (s.w as number) < 0.005 || (s.h as number) < 0.005) continue
    const count = perRole.get(s.role_code) ?? 0
    if (count >= MAX_SLOTS_PER_ROLE) continue
    perRole.set(s.role_code, count + 1)
    const d = s.date as Record<string, unknown> | null | undefined
    const date = d && [d.x, d.y, d.w, d.h].every(frac) && (d.w as number) >= 0.005 && (d.h as number) >= 0.005
      ? { x: d.x as number, y: d.y as number, w: d.w as number, h: d.h as number }
      : null
    slots.push({ role_code: s.role_code, page: s.page as number, x: s.x as number, y: s.y as number, w: s.w as number, h: s.h as number, date })
  }
  return slots
}

async function insertSlots(documentId: number, filePath: string, slots: SignatureSlot[]) {
  // seq is (re)numbered per role in the order given.
  const next = new Map<string, number>()
  for (const s of slots) {
    const seq = next.get(s.role_code) ?? 0
    next.set(s.role_code, seq + 1)
    await query(
      `INSERT INTO procedure_signature_slots (document_id, role_code, seq, file_path, page, x, y, w, h, date_x, date_y, date_w, date_h)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [documentId, s.role_code, seq, filePath, s.page, s.x, s.y, s.w, s.h, s.date?.x ?? null, s.date?.y ?? null, s.date?.w ?? null, s.date?.h ?? null]
    )
  }
}

// ISM Admin: replaces every role's placements on the document.
export async function saveSlots(documentId: number, filePath: string, slots: SignatureSlot[]) {
  await ensureApprovalSchema()
  // Delete + re-insert as one unit: a failed insert never leaves the
  // document with no QR spots.
  await withTransaction(async () => {
    await query('DELETE FROM procedure_signature_slots WHERE document_id = $1', [documentId])
    await insertSlots(documentId, filePath, slots)
  })
}

// Approver (via their email link): replaces only their own role's placements.
export async function saveRoleSlots(documentId: number, filePath: string, roleCode: string, slots: SignatureSlot[]) {
  await ensureApprovalSchema()
  await withTransaction(async () => {
    await query('DELETE FROM procedure_signature_slots WHERE document_id = $1 AND role_code = $2', [documentId, roleCode])
    // Placements for an older file of this document are stale — drop them too.
    await query('DELETE FROM procedure_signature_slots WHERE document_id = $1 AND file_path <> $2', [documentId, filePath])
    await insertSlots(documentId, filePath, slots.filter((s) => s.role_code === roleCode))
  })
}

// A pending approval link works for this many days after it was issued.
export const APPROVAL_LINK_DAYS = 30
// After approving, the approver may still move their own QR for this long;
// later only an ISM Admin can (so a forwarded email can't move a signature).
export const QR_ADJUST_HOURS = 24

export function linkExpired(step: Pick<ApprovalStep, 'status' | 'token_issued_at'>, now = Date.now()) {
  if (step.status !== 'pending' || !step.token_issued_at) return false
  return now - new Date(step.token_issued_at).getTime() > APPROVAL_LINK_DAYS * 86_400_000
}

// After approving: until when the approver may still adjust their own QR
// (null once the window has passed, or for any other status).
export function qrAdjustableUntil(step: Pick<ApprovalStep, 'status' | 'decided_at'>, now = Date.now()): Date | null {
  if (step.status !== 'approved' || !step.decided_at) return null
  const until = new Date(new Date(step.decided_at).getTime() + QR_ADJUST_HOURS * 3_600_000)
  return until.getTime() > now ? until : null
}

// Whether the holder of this link may (still) place their own QR: their step
// belongs to the current revision, and it's pending on a live link or was
// approved less than QR_ADJUST_HOURS ago.
export function canPlaceOwnSlots(view: TokenView, now = Date.now()) {
  if (view.step.revision !== view.document.revision) return false
  if (view.step.status === 'pending') return !linkExpired(view.step, now)
  return qrAdjustableUntil(view.step, now) !== null
}

// ─── admin bell notifications ───

export type ProcedureNotice = {
  kind: 'revision' | 'approved'
  /** Which register the document is in (procedure / working standard). */
  docKind: DocKind
  documentId: number
  controlNo: string
  title: string
  revision: number
  at: string
  // revision: who asked and what
  by?: string | null
  roleTitle?: string
  noteCount?: number
  pinCount?: number
  firstNote?: string | null
  // approved: approvers whose QR lands on the document itself
  placed?: number
  total?: number
}

// Decisions an ISM Admin hasn't dismissed yet: documents waiting for a
// revision, and documents approved in the last 30 days. Dismissing
// (notice_ack_at) hides one until a newer decision comes in.
export async function listProcedureNotices(): Promise<ProcedureNotice[]> {
  await ensureApprovalSchema()
  const notices: ProcedureNotice[] = []

  const revisions = (await query<{ id: number; kind: DocKind; control_no: string; title: string; revision: number }>(
    `SELECT id, kind, control_no, title, revision FROM procedure_documents
     WHERE approval_status = 'rejected' ORDER BY id DESC LIMIT 20`
  )).rows
  for (const doc of revisions) {
    const req = await latestRevisionRequest(doc.id)
    if (!req) continue
    const ack = (await query<{ notice_ack_at: string | null }>('SELECT notice_ack_at FROM procedure_documents WHERE id = $1', [doc.id])).rows[0]?.notice_ack_at
    if (ack && new Date(ack) >= new Date(req.decidedAt)) continue
    const first = req.pins[0] ? `Hal. ${req.pins[0].page + 1}: ${req.pins[0].note}` : req.general
    notices.push({
      kind: 'revision', docKind: doc.kind, documentId: doc.id, controlNo: doc.control_no, title: doc.title, revision: doc.revision,
      at: req.decidedAt, by: req.approverName, roleTitle: req.roleTitle,
      noteCount: (req.general ? 1 : 0) + req.pins.length, pinCount: req.pins.length,
      firstNote: first ? first.split('\n')[0].slice(0, 140) : null,
    })
  }

  const approved = (await query<{ id: number; kind: DocKind; control_no: string; title: string; revision: number; file_path: string; at: string; total: number }>(
    `SELECT d.id, d.kind, d.control_no, d.title, d.revision, d.file_path, max(a.decided_at) AS at, count(*)::int AS total
     FROM procedure_documents d
     JOIN procedure_approvals a ON a.document_id = d.id AND a.revision = d.revision AND a.status = 'approved'
     WHERE d.approval_status = 'approved'
     GROUP BY d.id
     HAVING max(a.decided_at) > now() - interval '30 days' AND (d.notice_ack_at IS NULL OR d.notice_ack_at < max(a.decided_at))
     ORDER BY at DESC LIMIT 20`
  )).rows
  for (const doc of approved) {
    const approvedRoles = (await query<{ role_code: string }>(
      `SELECT role_code FROM procedure_approvals WHERE document_id = $1 AND revision = $2 AND status = 'approved'`,
      [doc.id, doc.revision]
    )).rows.map((r) => r.role_code)
    const placedRoles = new Set((await slotsFor(doc.id, doc.file_path)).map((s) => s.role_code))
    notices.push({
      kind: 'approved', docKind: doc.kind, documentId: doc.id, controlNo: doc.control_no, title: doc.title, revision: doc.revision, at: doc.at,
      placed: approvedRoles.filter((r) => placedRoles.has(r)).length, total: doc.total,
    })
  }

  return notices.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

export async function dismissProcedureNotice(documentId: number) {
  await ensureApprovalSchema()
  await query('UPDATE procedure_documents SET notice_ack_at = now() WHERE id = $1', [documentId])
}

// Documents currently waiting on someone — for the admin monitoring list.
export async function listPendingSteps() {
  await ensureApprovalSchema()
  const result = await query<ApprovalStep & { control_no: string; title: string; kind: DocKind; approver_email: string | null }>(
    `SELECT ${STEP_COLUMNS.split(', ').map((c) => `a.${c}`).join(', ')}, a.approver_email, d.control_no, d.title, d.kind
     FROM procedure_approvals a JOIN procedure_documents d ON d.id = a.document_id AND d.revision = a.revision
     WHERE a.status = 'pending'
     ORDER BY a.notified_at ASC NULLS FIRST, a.id ASC`
  )
  return result.rows
}
