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
import { randomBytes, randomInt, timingSafeEqual } from 'crypto'
import { query, withTransaction } from '@/lib/db'
import { STORAGE_ROOT } from '@/lib/storage'
import { describeSmtpError, getSmtpSettings, sendMail, type MailAttachment } from '@/lib/smtp'
import { resolveAppBaseUrl } from '@/lib/request-origin'
import { buildProcedureApprovalEmail, buildProcedureResultEmail, LOGO_CID } from '@/lib/email-templates'
import { API_BASE_PATH } from '@/lib/config'
import { isDeliverableEmail } from '@/lib/email-address'
import { docKindInfo, type DocKind } from '@/lib/document-kinds'
import { reviewBoxes, reviewFormSummary, type ReviewFormData } from '@/lib/review-form'
import { recordNotification } from '@/lib/admin-notifications'

export type ApproverRole = {
  code: string
  // Which register the position signs for — each kind has its own list.
  kind: DocKind
  title: string
  person_name: string
  /** The 2–4 letters printed under this position's signature box (empty = from the name). */
  initials: string | null
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
  /** Initials of whoever signs this step — kept with the step, like the name. */
  approver_initials: string | null
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

const ROLE_COLUMNS = 'code, kind, title, person_name, initials, email, sort_order, is_default, updated_at, updated_by'

const STEP_COLUMNS ='id, document_id, revision, role_code, role_title, step, status, approver_name, approver_initials, notified_at, email_error, decided_at, decision_note, verification_code, token_issued_at'

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
      // The approval code sent in the request e-mail (db/migrations/0018_approval_code.sql).
      await query('ALTER TABLE procedure_approvals ADD COLUMN IF NOT EXISTS approval_code varchar(6)')
      await query('ALTER TABLE procedure_documents ADD COLUMN IF NOT EXISTS review_form_path text')
      await query("ALTER TABLE procedure_documents ADD COLUMN IF NOT EXISTS approver_overrides jsonb NOT NULL DEFAULT '{}'::jsonb")
      await query("ALTER TABLE procedure_documents ADD COLUMN IF NOT EXISTS review_roles text[] NOT NULL DEFAULT '{}'")
      await query('ALTER TABLE procedure_approvals ADD COLUMN IF NOT EXISTS approval_code_attempts integer NOT NULL DEFAULT 0')
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
      // A strike (words crossed out): the line runs from (x, y) to (x2, y2).
      await query('ALTER TABLE procedure_revision_notes ADD COLUMN IF NOT EXISTS x2 real, ADD COLUMN IF NOT EXISTS y2 real')
      // Revision history (db/migrations/0007): files replaced by a new upload,
      // and the file each decision was taken on.
      await query(`
        CREATE TABLE IF NOT EXISTS procedure_document_versions (
          id serial PRIMARY KEY,
          document_id integer NOT NULL REFERENCES procedure_documents(id) ON DELETE CASCADE,
          revision integer NOT NULL,
          file_path text NOT NULL,
          uploaded_at timestamptz,
          replaced_at timestamptz NOT NULL DEFAULT now(),
          replaced_by varchar(100)
        )`)
      await query('ALTER TABLE procedure_approvals ADD COLUMN IF NOT EXISTS file_path text')
      // Initials printed under the signature box (db/migrations/0016).
      await query('ALTER TABLE procedure_approver_roles ADD COLUMN IF NOT EXISTS initials varchar(5)')
      await query('ALTER TABLE procedure_approvals ADD COLUMN IF NOT EXISTS approver_initials varchar(5)')
      // Reminders to an approver who hasn't decided (db/migrations/0012).
      await query('ALTER TABLE procedure_approvals ADD COLUMN IF NOT EXISTS reminded_at timestamptz, ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0')
      // Links replaced by a newer one (db/migrations/0009) — see replacedLink().
      await query(`
        CREATE TABLE IF NOT EXISTS procedure_approval_old_tokens (
          token varchar(64) PRIMARY KEY,
          approval_id integer NOT NULL REFERENCES procedure_approvals(id) ON DELETE CASCADE,
          replaced_at timestamptz NOT NULL DEFAULT now()
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
type DocumentInfo = { id: number; kind: DocKind; control_no: string; title: string; revision: number; elf_date: string; note: string | null; file_path: string; review_form_path: string | null; approver_overrides: ApproverOverrides | null; approval_roles: string[]; review_roles: string[] }

// ─── who approves this document ───
// A position's usual holder (Approver Pengesahan) can be replaced on one
// document: someone stands in, or documents go to different people in the
// same position. procedure_documents.approver_overrides maps a position code
// to that person; positions not listed use their usual holder.
export type ApproverOverride = { name: string; email: string }
export type ApproverOverrides = Record<string, ApproverOverride>

/** The Form Review positions used when none are chosen: the default ones that can be e-mailed. */
export async function defaultReviewRoles(overrides: ApproverOverrides = {}): Promise<string[]> {
  return (await listRoles('review_form')).filter((role) => role.is_default && (overrides[role.code] || (role.email && isDeliverableEmail(role.email)))).map((role) => role.code)
}

/** The overrides sent with a document, for the positions it uses. A string is what's wrong with them. */
export function parseApproverOverrides(raw: unknown, roleCodes: string[]): ApproverOverrides | string {
  let value: unknown = raw
  if (typeof raw === 'string') { try { value = raw.trim() ? JSON.parse(raw) : {} } catch { return 'Data approver tidak valid.' } }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: ApproverOverrides = {}
  for (const [code, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!roleCodes.includes(code) || !entry || typeof entry !== 'object') continue
    const name = String((entry as Record<string, unknown>).name ?? '').trim().slice(0, 100)
    const email = String((entry as Record<string, unknown>).email ?? '').trim().slice(0, 150)
    if (!name && !email) continue
    if (!name) return `Nama approver untuk ${code} wajib diisi.`
    if (!isDeliverableEmail(email)) return `Email approver untuk ${code} (${name}) tidak valid.`
    out[code] = { name, email }
  }
  return out
}

/** Same overrides, written the same way (to tell whether they changed). */
export const overridesKey = (value: ApproverOverrides | null | undefined) =>
  JSON.stringify(Object.keys(value ?? {}).sort().map((code) => [code, value![code].name, value![code].email.toLowerCase()]))

async function getDocument(documentId: number) {
  // elf_date as plain YYYY-MM-DD text — a DATE sent as a JS Date shifts a day back in UTC.
  const result = await query<DocumentInfo>("SELECT id, kind, control_no, title, revision, to_char(elf_date, 'YYYY-MM-DD') AS elf_date, note, file_path, review_form_path, approver_overrides, approval_roles, review_roles FROM procedure_documents WHERE id = $1", [documentId])
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
  // Cancelled steps keep their token: an old link from an earlier email then
  // opens a page saying it was replaced by the re-submission (it can't decide
  // anything or open the file any more — see getByToken's callers).
  const started = await withTransaction(async () => {
    await query(
      `UPDATE procedure_approvals SET status = 'cancelled'
       WHERE document_id = $1 AND status IN ('waiting', 'pending', 'rejected', 'approved') AND revision = $2`,
      [documentId, doc.revision]
    )
    await query(
      `UPDATE procedure_approvals SET status = 'cancelled'
       WHERE document_id = $1 AND status IN ('waiting', 'pending')`,
      [documentId]
    )

    // The Form Review beside the document is signed by its own positions
    // (Prepared / Checked / Approval) — first, then the document's approvers.
    const all = await listRoles()
    const reviewCodes = doc.review_form_path ? (doc.review_roles ?? []).filter((code) => !roleCodes.includes(code)) : []
    const roles = [
      ...all.filter((role) => role.kind === 'review_form' && reviewCodes.includes(role.code)),
      ...all.filter((role) => roleCodes.includes(role.code)),
    ]
    if (roles.length === 0) {
      await setDocumentStatus(documentId, 'none')
      return false
    }

    for (const [index, role] of roles.entries()) {
      await query(
        `INSERT INTO procedure_approvals (document_id, revision, role_code, role_title, step, status, approver_name, approver_initials)
         VALUES ($1, $2, $3, $4, $5, 'waiting', $6, $7)`,
        // the person for this document when one is set, else the position's usual holder
        [documentId, doc.revision, role.code, role.title, index + 1, doc.approver_overrides?.[role.code]?.name ?? role.person_name, doc.approver_overrides?.[role.code] ? null : role.initials]
      )
    }
    await setDocumentStatus(documentId, 'pending')
    return true
  })
  // Sheets on the boxed template (PREPARED / CHECKED / APPROVED …): the QR
  // spots are found from the box headings in the file itself, before the
  // first approver opens it.
  if (started && placesQrItself(doc.kind)) await autoPlaceSlots(documentId)
  // Emailing the first approver happens after the commit, straight away.
  // Nobody places a QR when signing: the approver only presses Setujui, and
  // a QR shows on the document once its approver has approved.
  // - Working Standard: every QR is placed automatically above (the sheet's
  //   boxes, else the default spot) — nobody has to set anything.
  // - The other registers: the Admin ISM sets where each position's QR is
  //   printed once that position has approved (boxed templates found above).
  if (started) await activateNextStep(documentId)
}

/**
 * Working Standard: every QR is placed by the portal (the sheet's signature
 * boxes, else a default spot), so nobody has to set it; the Admin ISM may
 * still move them at any time. The other registers: the Admin ISM places a
 * position's QR once it has approved.
 */
export function autoPlacesEveryQr(kind: DocKind) {
  return kind === 'working_standard'
}

// Registers whose uploaded sheets may carry the boxed signature template —
// Working Standard always does, a Standard Requirement TMMIN often does. A
// file without those boxes is simply left to "Atur Posisi QR".
export function usesSignatureBoxes(kind: DocKind) {
  return kind === 'working_standard' || kind === 'tmmin_standard'
}

// Registers whose approvers needn't place their QR: the boxed sheets, and the
// Form Review (filled in on the portal, or an uploaded copy of the same form).
export function placesQrItself(kind: DocKind) {
  return kind === 'review_form' || usesSignatureBoxes(kind)
}

/**
 * Places the approvers' QR spots automatically from the signature-box
 * headings in the document's file (lib/auto-slots.ts) — only for positions
 * that have no spot on the current file yet, so hand-placed ones are kept.
 * Returns how many positions were placed. Never throws: a file the headings
 * can't be read from just keeps the manual "Atur Posisi QR".
 */
export async function autoPlaceSlots(documentId: number): Promise<number> {
  try {
    const doc = await getDocument(documentId)
    if (!doc) return 0
    const existing = await slotsFor(doc.id, doc.file_path)
    const placed = new Set(existing.map((slot) => slot.role_code))
    const all = (await query<{ role_code: string; role_title: string }>(
      `SELECT role_code, role_title FROM procedure_approvals
       WHERE document_id = $1 AND revision = $2 AND status <> 'cancelled' ORDER BY step`,
      [doc.id, doc.revision]
    )).rows
    const steps = all.filter((step) => !placed.has(step.role_code))
    if (!steps.length) return 0
    const { detectSignatureSlots, detectReviewFormLayout } = await import('@/lib/auto-slots')
    let found: SignatureSlot[]
    if (doc.kind === 'review_form') {
      // The form's three boxes, each with its QR and "/ /" date line — measured on this copy of the form.
      const layout = await detectReviewFormLayout(doc.file_path)
      const boxes = reviewBoxes(all.map((step) => step.role_title))
      found = all.flatMap((step, i) => {
        const spot = boxes[i] ? layout?.slots[boxes[i]!] : undefined
        return spot && !placed.has(step.role_code) ? [{ ...spot, role_code: step.role_code }] : []
      })
    } else {
      found = await detectSignatureSlots(doc.file_path, steps.map((step) => ({ code: step.role_code, title: step.role_title })))
    }
    // Working Standard: whoever is still without a spot gets the default one.
    if (autoPlacesEveryQr(doc.kind)) {
      const { detectDefaultSlots } = await import('@/lib/auto-slots')
      const missing = steps.filter((step) => !found.some((slot) => slot.role_code === step.role_code)).map((step) => step.role_code)
      found = [...found, ...await detectDefaultSlots(doc.file_path, missing)]
    }
    if (!found.length) return 0
    await saveSlots(doc.id, doc.file_path, [...existing, ...found])
    return found.length
  } catch (error) {
    console.error('[procedure-approval/autoPlaceSlots]', (error as Error).message)
    return 0
  }
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

// The steps of the current cycle that are still open, when nobody has been
// asked yet (null otherwise): a request held for its QR boxes.
async function heldSteps(doc: DocumentInfo): Promise<{ role_code: string }[] | null> {
  const steps = (await query<{ role_code: string; status: string }>(
    `SELECT role_code, status FROM procedure_approvals
     WHERE document_id = $1 AND revision = $2 AND status IN ('waiting', 'pending', 'rejected') ORDER BY step`,
    [doc.id, doc.revision]
  )).rows
  return steps.length && steps.every((step) => step.status === 'waiting') ? steps : null
}

/**
 * A request that hasn't been sent to its first approver yet. Only documents
 * from the short time requests waited for their QR boxes can be like this;
 * "Kirim ke approver" (sendHeld) sends them.
 */
export async function approvalHeld(documentId: number): Promise<boolean> {
  const doc = await getDocument(documentId)
  if (!doc) return false
  const steps = await heldSteps(doc)
  if (!steps) return false
  // Mid-chain (someone approved, the next e-mail is about to go) is not "held".
  const signed = await query('SELECT 1 FROM procedure_approvals WHERE document_id = $1 AND revision = $2 AND status = \'approved\' LIMIT 1', [doc.id, doc.revision])
  return signed.rows.length === 0
}

/** Sends a held request to its first approver now. Returns true when the e-mail went out. */
export async function sendHeld(documentId: number): Promise<boolean> {
  if (!(await approvalHeld(documentId))) return false
  const doc = await getDocument(documentId)
  if (doc && placesQrItself(doc.kind)) await autoPlaceSlots(documentId)
  return activateNextStep(documentId)
}

/** The positions of the current cycle that have approved — the only ones whose QR the Admin ISM may place. */
export async function approvedRoleCodes(documentId: number): Promise<string[]> {
  const doc = await getDocument(documentId)
  if (!doc) return []
  return (await query<{ role_code: string }>(
    `SELECT DISTINCT role_code FROM procedure_approvals WHERE document_id = $1 AND revision = $2 AND status = 'approved'`,
    [doc.id, doc.revision]
  )).rows.map((row) => row.role_code)
}

/**
 * Sends a held request to its first approver once every position chosen for
 * the document has a QR box on the current file. Returns true when the e-mail
 * went out now.
 */
export async function releaseIfPlaced(documentId: number): Promise<boolean> {
  const doc = await getDocument(documentId)
  if (!doc) return false
  const steps = await heldSteps(doc)
  if (!steps) return false
  const placed = new Set((await slotsFor(doc.id, doc.file_path)).map((slot) => slot.role_code))
  if (steps.some((step) => !placed.has(step.role_code))) return false
  return activateNextStep(documentId)
}

/**
 * Issues a fresh token for a step (invalidating any earlier link), points it
 * at whoever currently holds the role, marks it pending and emails them.
 * Used for the first send, for "Kirim ulang", and when a role changes hands.
 */
export async function sendStepRequest(stepId: number): Promise<{ sent: boolean; error: string | null }> {
  const stepResult = await query<ApprovalStep & { approver_email: string | null; token: string | null; approval_code: string | null; approval_code_attempts: number }>(`SELECT ${STEP_COLUMNS}, approver_email, token, approval_code, approval_code_attempts FROM procedure_approvals WHERE id = $1`, [stepId])
  const step = stepResult.rows[0]
  if (!step) return { sent: false, error: 'Tahap pengesahan tidak ditemukan.' }

  const roleResult = await query<ApproverRole>(`SELECT ${ROLE_COLUMNS} FROM procedure_approver_roles WHERE code = $1`, [step.role_code])
  const role = roleResult.rows[0]
  // This document's own person for the position, when one is set.
  const override = (await query<{ approver_overrides: ApproverOverrides | null }>('SELECT approver_overrides FROM procedure_documents WHERE id = $1', [step.document_id])).rows[0]?.approver_overrides?.[step.role_code] ?? null
  const approverName = override?.name ?? role?.person_name ?? step.approver_name ?? step.role_title
  const approverEmail = override?.email ?? role?.email ?? null

  // Re-sending to the SAME address keeps the link, so the earlier e-mail in
  // that inbox still works (its validity period starts again). Only when the
  // request goes to a different address does it get a fresh link — and the
  // old one is remembered, so opening it explains that it was replaced.
  const sameRecipient = step.status === 'pending' && !!step.token && !!approverEmail
    && (step.approver_email ?? '').trim().toLowerCase() === approverEmail.trim().toLowerCase()
  const token = sameRecipient ? step.token! : randomBytes(24).toString('hex')
  if (step.token && step.token !== token) {
    await query('INSERT INTO procedure_approval_old_tokens (token, approval_id) VALUES ($1, $2) ON CONFLICT (token) DO NOTHING', [step.token, stepId])
  }
  // The approval code travels in the e-mail body with the link. The same
  // inbox keeps its code (the earlier e-mail still works) — unless it was
  // locked by wrong entries; a new address gets a new one.
  const code = sameRecipient && step.approval_code && step.approval_code_attempts < APPROVAL_CODE_TRIES ? step.approval_code : newApprovalCode()
  await query('UPDATE procedure_approvals SET approval_code = $1::text, approval_code_attempts = CASE WHEN approval_code = $1::text THEN approval_code_attempts ELSE 0 END WHERE id = $2', [code, stepId])

  await query(
    `UPDATE procedure_approvals
     SET status = 'pending', token = $1, token_issued_at = now(), approver_name = $2, approver_email = $3, role_title = COALESCE($4, role_title), approver_initials = COALESCE($6, approver_initials), notified_at = NULL, email_error = NULL, reminded_at = NULL, reminder_count = 0
     WHERE id = $5`,
    [token, approverName, approverEmail, role?.title ?? null, stepId, override ? null : role?.initials ?? null]
  )

  const error = await emailStep(stepId, token)
  await query(
    `UPDATE procedure_approvals SET notified_at = CASE WHEN $1::text IS NULL THEN now() ELSE NULL END, email_error = $1 WHERE id = $2`,
    [error, stepId]
  )
  // Shown live under "Perlu tindakan" while it lasts — history only here.
  if (error) await recordStepEvent(stepId, 'esign_mailfail', (doc, who) => ({ title: `Email pengesahan gagal terkirim — ${doc}`, body: `${who} · ${error}` }))
  return { sent: error === null, error }
}

// Wrong codes allowed before a step is locked (the Admin ISM re-sends to unlock it).
export const APPROVAL_CODE_TRIES = 5
const newApprovalCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

/**
 * Checks the approval code typed on the approval page. A step from before
 * codes existed has none and needs none. Each wrong entry is counted; after
 * APPROVAL_CODE_TRIES the step is locked.
 */
async function checkApprovalCode(stepId: number, typed: string | null): Promise<string | null> {
  const row = (await query<{ approval_code: string | null; approval_code_attempts: number }>('SELECT approval_code, approval_code_attempts FROM procedure_approvals WHERE id = $1', [stepId])).rows[0]
  if (!row?.approval_code) return null
  if (row.approval_code_attempts >= APPROVAL_CODE_TRIES) return `Kode persetujuan salah ${APPROVAL_CODE_TRIES} kali — persetujuan dikunci. Minta Admin ISM mengirim ulang email pengesahan untuk mendapatkan kode baru.`
  const entered = (typed ?? '').replace(/\D/g, '')
  if (!entered) return 'Masukkan kode persetujuan 6 angka yang ada di email pengesahan.'
  const a = Buffer.from(entered.padEnd(6, ' ').slice(0, 6)), b = Buffer.from(row.approval_code)
  if (entered.length === 6 && timingSafeEqual(a, b)) return null
  const attempts = (await query<{ n: number }>('UPDATE procedure_approvals SET approval_code_attempts = approval_code_attempts + 1 WHERE id = $1 RETURNING approval_code_attempts AS n', [stepId])).rows[0]?.n ?? APPROVAL_CODE_TRIES
  const left = APPROVAL_CODE_TRIES - attempts
  return left > 0
    ? `Kode persetujuan salah. Periksa kode 6 angka di email pengesahan (sisa ${left} kali percobaan).`
    : `Kode persetujuan salah ${APPROVAL_CODE_TRIES} kali — persetujuan dikunci. Minta Admin ISM mengirim ulang email pengesahan untuk mendapatkan kode baru.`
}

/** Whether approving this step asks for the code from the e-mail. */
export async function approvalCodeRequired(stepId: number): Promise<{ required: boolean; locked: boolean }> {
  const row = (await query<{ approval_code: string | null; approval_code_attempts: number }>('SELECT approval_code, approval_code_attempts FROM procedure_approvals WHERE id = $1', [stepId])).rows[0]
  return { required: !!row?.approval_code, locked: !!row?.approval_code && row.approval_code_attempts >= APPROVAL_CODE_TRIES }
}

// A history entry about one signing step, worded by `describe` from the document and the approver.
async function recordStepEvent(stepId: number, kind: string, describe: (doc: string, who: string) => { title: string; body: string }) {
  try {
    const row = (await query<{ control_no: string; title: string; kind: DocKind; approver_name: string | null; role_title: string }>(
      `SELECT d.control_no, d.title, d.kind, a.approver_name, a.role_title
       FROM procedure_approvals a JOIN procedure_documents d ON d.id = a.document_id WHERE a.id = $1`,
      [stepId]
    )).rows[0]
    if (!row) return
    const info = docKindInfo(row.kind)
    const text = describe(`${row.control_no} · ${row.title}`, `${row.approver_name ?? row.role_title} (${row.role_title})`)
    await recordNotification({ kind, category: 'esign', historyOnly: true, ...text, href: `${info.path}?q=${encodeURIComponent(row.control_no)}` })
  } catch (error) {
    console.error('[procedure-approval/recordStepEvent]', (error as Error).message)
  }
}

// Form Review fields on their way to the database, by form number: saving a
// form creates the document (which e-mails the first approver) before its
// fields can be stored, and an edit re-sends before the new fields replace
// the old ones. app/api/form-review sets the entry around that call so the
// e-mail summarises what is actually being submitted.
export const reviewFormsBeingSaved = new Map<string, ReviewFormData>()

// reminder: this is a follow-up of a request already sent (see sendApprovalReminders).
async function emailStep(stepId: number, token: string, reminder: { count: number; waitingDays: number } | null = null): Promise<string | null> {
  try {
    const stepResult = await query<ApprovalStep & { approver_email: string | null; approval_code: string | null }>(`SELECT ${STEP_COLUMNS}, approver_email, approval_code FROM procedure_approvals WHERE id = $1`, [stepId])
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

    // After a "Minta Revisi" every request is a re-submission: the email
    // says so, lists what was asked, and that earlier links no longer work.
    const requests = await revisionRequests(doc.id)
    const lastRequest = requests[0] ?? null

    // A Form Review beside the document has its own approvers (review_roles):
    // they get the Form Review's request, with their part of the chain; the
    // document's approvers get the document's, with theirs.
    const reviewCodes = doc.review_form_path ? doc.review_roles ?? [] : []
    const signsReview = reviewCodes.includes(step.role_code)
    const part = reviewCodes.length ? cycle.rows.filter((row) => reviewCodes.includes(row.role_code) === signsReview) : cycle.rows

    // A Form Review carries what was filled in, so the mail can summarise it.
    // While the form is being saved the first request goes out before its
    // fields are stored — the ones being saved are taken then (reviewFormsBeingSaved).
    const reviewForm = doc.kind === 'review_form'
      ? reviewFormsBeingSaved.get(doc.control_no.toUpperCase())
        ?? await query<{ data: ReviewFormData }>('SELECT data FROM document_review_forms WHERE document_id = $1', [doc.id]).then((r) => r.rows[0]?.data ?? null).catch(() => null)
      : null

    const base = resolveAppBaseUrl(settings.appUrl)
    const { subject, html } = buildProcedureApprovalEmail({
      reviewForm: reviewForm ? reviewFormSummary(reviewForm) : null,
      reminder,
      resubmission: lastRequest
        ? {
          round: requests.length + 1,
          by: lastRequest.approverName ?? lastRequest.roleTitle,
          at: lastRequest.decidedAt,
          general: lastRequest.general,
          pins: lastRequest.pins.map((p) => ({ page: p.page, note: p.note, strike: typeof p.x2 === 'number' })),
          fileChanged: !!lastRequest.filePath && lastRequest.filePath !== doc.file_path,
        }
        : null,
      approverName: step.approver_name ?? step.role_title,
      roleTitle: step.role_title,
      controlNo: doc.control_no,
      title: doc.title,
      revision: doc.revision,
      effDate: doc.elf_date,
      note: doc.note,
      stepNumber: part.findIndex((row) => row.id === step.id) + 1,
      stepTotal: part.length,
      chain: part.map((row) => ({
        roleTitle: row.role_title,
        name: row.approver_name ?? '-',
        state: row.id === step.id ? 'current' as const : row.status === 'approved' ? 'done' as const : 'waiting' as const,
        decidedAt: row.decided_at,
      })),
      reviewUrl: `${base}${API_BASE_PATH}/pengesahan?token=${token}`,
      approvalCode: step.approval_code,
      // a Form Review approver gets the Form Review's mail, in the form's look
      kind: signsReview ? docKindInfo('review_form') : docKindInfo(doc.kind),
      formReviewOf: signsReview ? { controlNo: doc.control_no, title: doc.title, registerLabel: docKindInfo(doc.kind).label } : null,
    })
    // The procedure itself travels with the email ("telah saya lampirkan pada
    // email ini"), unless it's too big for typical mail servers — then the
    // review link (which shows the PDF) is the way in.
    const attachments: MailAttachment[] = [{ filename: 'yazaki-logo.jpg', path: path.join(process.cwd(), 'public', 'images', 'yazaki-logo.jpg'), cid: LOGO_CID }]
    // What this approver signs comes first; the other file travels along to read with it.
    const files: { filename: string; filePath: string }[] = [{ filename: `${doc.control_no} - ${doc.title}.pdf`, filePath: doc.file_path }]
    if (doc.review_form_path) files[signsReview ? 'unshift' : 'push']({ filename: `Form Review - ${doc.control_no}.pdf`, filePath: doc.review_form_path })
    for (const file of files) {
      const full = path.join(STORAGE_ROOT, file.filePath)
      const size = await stat(full).then((s) => s.size).catch(() => 0)
      if (size > 0 && size <= MAX_ATTACHMENT_BYTES) attachments.push({ filename: file.filename.replace(/[\\/:*?"<>|]/g, '-'), path: full, contentType: 'application/pdf' })
    }

    await sendMail(settings, { to: step.approver_email, subject, html, attachments })
    return null
  } catch (error) {
    console.error('[procedure-approval/emailStep]', error)
    return describeSmtpError(error)
  }
}

// ─── approver positions that can't be e-mailed ───

// Of these positions, the ones without a usable e-mail address: a request to
// them could never be delivered, so the document would wait forever.
export async function rolesWithoutEmail(roleCodes: string[], kind: DocKind, overrides: ApproverOverrides = {}): Promise<ApproverRole[]> {
  if (!roleCodes.length) return []
  return (await listRoles(kind)).filter((role) => roleCodes.includes(role.code) && !overrides[role.code] && !(role.email && isDeliverableEmail(role.email)))
}

/** The message shown when a document can't be submitted because of them (null when all are fine). */
export function missingEmailMessage(roles: ApproverRole[]): string | null {
  if (!roles.length) return null
  const names = roles.map((role) => `${role.title} (${role.code})`).join(', ')
  return `Jabatan ${names} belum punya email, jadi permintaan pengesahannya tidak bisa dikirim. Isi emailnya di Admin Settings → Approver Pengesahan, atau lepas centangnya.`
}

// ─── initials ───

/**
 * What is printed under a signature box: the initials set for the position,
 * or — when none are set — the first three letters of the name ("Naufal Aqil"
 * → "NAU"). Empty for a position nobody holds yet.
 */
export function approverInitials(initials: string | null | undefined, name: string | null | undefined): string {
  const set = (initials ?? '').trim().toUpperCase()
  if (set) return set
  const letters = (name ?? '').replace(/[^A-Za-z]/g, '')
  return /^belum\s*diisi$/i.test((name ?? '').trim()) ? '' : letters.slice(0, 3).toUpperCase()
}

/** Steps not signed yet follow the position's current initials (signed ones keep theirs). */
export async function syncRoleInitials(code: string) {
  await query(
    `UPDATE procedure_approvals a SET approver_initials = r.initials
     FROM procedure_approver_roles r WHERE r.code = a.role_code AND a.role_code = $1 AND a.status IN ('waiting', 'pending')`,
    [code]
  )
}

// ─── reminders ───

// An approver who hasn't decided gets a reminder every REMINDER_EVERY_DAYS,
// at most REMINDER_MAX times, as long as the link still works. The reminder
// carries the same link and does not extend its validity.
export const REMINDER_EVERY_DAYS = 3
export const REMINDER_MAX = 5

type ReminderState = Pick<ApprovalStep, 'status' | 'notified_at' | 'token_issued_at'> & { reminded_at: string | null; reminder_count: number }

export function reminderDue(step: ReminderState, now = Date.now()): boolean {
  if (step.status !== 'pending' || !step.notified_at) return false // never delivered: an e-mail problem, not a forgetful approver
  if (linkExpired(step, now) || step.reminder_count >= REMINDER_MAX) return false
  const last = new Date(step.reminded_at ?? step.notified_at).getTime()
  return now - last >= REMINDER_EVERY_DAYS * 86_400_000
}

export async function sendApprovalReminders(now = Date.now()): Promise<{ sent: number; failed: number }> {
  await ensureApprovalSchema()
  const rows = (await query<ReminderState & { id: number; token: string | null }>(
    `SELECT a.id, a.status, a.notified_at, a.token_issued_at, a.reminded_at, a.reminder_count, a.token
     FROM procedure_approvals a JOIN procedure_documents d ON d.id = a.document_id AND d.revision = a.revision
     WHERE a.status = 'pending' AND a.token IS NOT NULL AND a.notified_at IS NOT NULL AND a.reminder_count < $1`,
    [REMINDER_MAX]
  )).rows
  let sent = 0
  let failed = 0
  for (const row of rows) {
    if (!row.token || !reminderDue(row, now)) continue
    const waitingDays = Math.floor((now - new Date(row.notified_at as string).getTime()) / 86_400_000)
    const error = await emailStep(row.id, row.token, { count: row.reminder_count + 1, waitingDays })
    if (error) { failed++; continue }
    await query('UPDATE procedure_approvals SET reminded_at = now(), reminder_count = reminder_count + 1 WHERE id = $1', [row.id])
    // That was the last reminder: from now on it shows under "Perlu tindakan" in the bell.
    if (row.reminder_count + 1 >= REMINDER_MAX) {
      await recordStepEvent(row.id, 'esign_stuck', (doc, who) => ({ title: `Approver belum tanda tangan setelah ${REMINDER_MAX} pengingat — ${doc}`, body: who }))
    }
    sent++
  }
  return { sent, failed }
}

// ─── decisions (public, token-secured) ───

export type ReplacedLink = { controlNo: string; title: string; kind: DocKind; replacedAt: string; stillPending: boolean }

// A link that no longer works because a newer one was issued for the same
// step (see sendStepRequest). Tells the /pengesahan page what to say; gives
// no access to the document.
export async function replacedLink(token: string): Promise<ReplacedLink | null> {
  await ensureApprovalSchema()
  if (!/^[a-f0-9]{48}$/.test(token)) return null
  const row = (await query<{ control_no: string; title: string; kind: DocKind; replaced_at: string; status: string }>(
    `SELECT d.control_no, d.title, d.kind, o.replaced_at, a.status
     FROM procedure_approval_old_tokens o
     JOIN procedure_approvals a ON a.id = o.approval_id
     JOIN procedure_documents d ON d.id = a.document_id
     WHERE o.token = $1`,
    [token]
  )).rows[0]
  return row ? { controlNo: row.control_no, title: row.title, kind: row.kind, replacedAt: row.replaced_at, stillPending: row.status === 'pending' } : null
}

export type TokenView = {
  step: ApprovalStep
  document: { id: number; kind: DocKind; control_no: string; title: string; revision: number; elf_date: string; note: string | null; file_path: string; review_form_path?: string | null; review_roles?: string[] }
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
// top-left origin), or page null for the general note. With x2/y2 it is a
// strike — a line from (x, y) to (x2, y2) crossing words out, the way it is
// done on a hardcopy; its note says what to write instead.
export type RevisionNote = { page: number | null; x: number | null; y: number | null; note: string; x2?: number | null; y2?: number | null }

export const isStrike = (n: { x2?: number | null; y2?: number | null }) => typeof n.x2 === 'number' && typeof n.y2 === 'number'

// A strike sent without any text simply means "remove this".
export const STRIKE_DEFAULT_NOTE = 'Hapus bagian yang dicoret.'

const MAX_REVISION_NOTES = 30

// Validates notes sent from the /pengesahan page; drops anything malformed.
export function parseRevisionNotes(raw: unknown): RevisionNote[] {
  const list: unknown[] = Array.isArray(raw) ? raw : []
  const frac = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
  const notes: RevisionNote[] = []
  for (const item of list) {
    const n = item as Record<string, unknown>
    const pinned = Number.isInteger(n.page) && (n.page as number) >= 0 && (n.page as number) <= 500 && frac(n.x) && frac(n.y)
    const strike = pinned && frac(n.x2) && frac(n.y2)
    const text = (typeof n.note === 'string' ? n.note.trim().slice(0, 500) : '') || (strike ? STRIKE_DEFAULT_NOTE : '')
    if (!text) continue
    if (strike) notes.push({ page: n.page as number, x: n.x as number, y: n.y as number, x2: n.x2 as number, y2: n.y2 as number, note: text })
    else notes.push(pinned ? { page: n.page as number, x: n.x as number, y: n.y as number, note: text } : { page: null, x: null, y: null, note: text })
    if (notes.length >= MAX_REVISION_NOTES) break
  }
  return notes
}

// Plain-text summary kept in decision_note (register, emails): the general
// note first, then "1) Hal. 2: …" per pinned note ("Hal. 2 (coret)" for a strike).
export function summarizeRevisionNotes(general: string | null, notes: RevisionNote[]) {
  const lines: string[] = []
  if (general) lines.push(general)
  notes.filter((n) => n.page !== null).forEach((n, i) => lines.push(`${i + 1}) Hal. ${(n.page as number) + 1}${isStrike(n) ? ' (coret)' : ''}: ${n.note}`))
  return lines.join('\n').slice(0, 4000)
}

export type RevisionRequest = {
  approvalId: number
  approverName: string | null
  roleTitle: string
  revision: number
  decidedAt: string
  general: string | null
  pins: { page: number; x: number; y: number; note: string; x2: number | null; y2: number | null }[]
  // The file the marks were made on (null for requests from before this was
  // recorded); fileKept = that file can still be opened.
  filePath: string | null
  fileKept: boolean
}

// Every "Minta Revisi" on a document, newest first (in any cycle — a restart
// cancels the step but keeps its decision and notes).
export async function revisionRequests(documentId: number, limit = 50): Promise<RevisionRequest[]> {
  await ensureApprovalSchema()
  const steps = (await query<{ id: number; approver_name: string | null; role_title: string; revision: number; decided_at: string; decision_note: string | null; file_path: string | null; file_kept: boolean }>(
    `SELECT a.id, a.approver_name, a.role_title, a.revision, a.decided_at, a.decision_note, a.file_path,
            (a.file_path = d.file_path OR EXISTS (SELECT 1 FROM procedure_document_versions v WHERE v.document_id = a.document_id AND v.file_path = a.file_path)) AS file_kept
     FROM procedure_approvals a JOIN procedure_documents d ON d.id = a.document_id
     WHERE a.document_id = $1 AND a.decided_at IS NOT NULL AND a.verification_code IS NULL AND a.decision_note IS NOT NULL
     ORDER BY a.decided_at DESC LIMIT $2`,
    [documentId, limit]
  )).rows
  if (!steps.length) return []
  const notes = (await query<{ approval_id: number; page: number | null; x: number | null; y: number | null; x2: number | null; y2: number | null; note: string }>(
    'SELECT approval_id, page, x, y, x2, y2, note FROM procedure_revision_notes WHERE approval_id = ANY($1) ORDER BY approval_id, seq',
    [steps.map((s) => s.id)]
  )).rows
  return steps.map((step) => {
    const rows = notes.filter((n) => n.approval_id === step.id)
    const general = rows.find((r) => r.page === null)?.note ?? null
    return {
      approvalId: step.id,
      approverName: step.approver_name,
      roleTitle: step.role_title,
      revision: step.revision,
      decidedAt: step.decided_at,
      // Requests made before pinned notes existed only have the summary text.
      general: rows.length ? general : step.decision_note,
      pins: rows.filter((r) => r.page !== null).map((r) => ({ page: r.page as number, x: r.x ?? 0, y: r.y ?? 0, note: r.note, x2: r.x2, y2: r.y2 })),
      filePath: step.file_path,
      fileKept: step.file_kept === true,
    }
  })
}

// The most recent "Minta Revisi" on a document.
export async function latestRevisionRequest(documentId: number): Promise<RevisionRequest | null> {
  return (await revisionRequests(documentId, 1))[0] ?? null
}

export type DocumentVersion = { revision: number; filePath: string; uploadedAt: string | null; replacedAt: string; replacedBy: string | null }

export type RevisionHistory = {
  current: { revision: number; filePath: string; uploadedAt: string }
  // Earlier files, newest first.
  versions: DocumentVersion[]
  requests: RevisionRequest[]
}

// What the document looked like before each new upload, with every revision
// request — for comparing the fixed file with the one the marks were made on.
export async function revisionHistory(documentId: number): Promise<RevisionHistory | null> {
  await ensureApprovalSchema()
  const doc = (await query<{ revision: number; file_path: string; uploaded_at: string }>(
    'SELECT revision, file_path, uploaded_at FROM procedure_documents WHERE id = $1', [documentId]
  )).rows[0]
  if (!doc) return null
  const versions = (await query<{ revision: number; file_path: string; uploaded_at: string | null; replaced_at: string; replaced_by: string | null }>(
    'SELECT revision, file_path, uploaded_at, replaced_at, replaced_by FROM procedure_document_versions WHERE document_id = $1 ORDER BY replaced_at DESC, id DESC',
    [documentId]
  )).rows
  return {
    current: { revision: doc.revision, filePath: doc.file_path, uploadedAt: doc.uploaded_at },
    versions: versions.map((v) => ({ revision: v.revision, filePath: v.file_path, uploadedAt: v.uploaded_at, replacedAt: v.replaced_at, replacedBy: v.replaced_by })),
    requests: await revisionRequests(documentId),
  }
}

// Per document: earlier files kept + revision requests (register badge).
export async function historyCounts(documentIds: number[]): Promise<Map<number, number>> {
  await ensureApprovalSchema()
  const map = new Map<number, number>()
  if (!documentIds.length) return map
  const result = await query<{ document_id: number; n: string }>(
    `SELECT document_id, count(*) AS n FROM (
       SELECT document_id FROM procedure_document_versions WHERE document_id = ANY($1)
       UNION ALL
       SELECT document_id FROM procedure_approvals
       WHERE document_id = ANY($1) AND decided_at IS NOT NULL AND verification_code IS NULL AND decision_note IS NOT NULL
     ) t GROUP BY document_id`,
    [documentIds]
  )
  for (const row of result.rows) map.set(row.document_id, Number(row.n))
  return map
}

export async function decideByToken(
  token: string,
  action: 'approve' | 'reject',
  note: string | null,
  revisionNotes: RevisionNote[] = [],
  approvalCode: string | null = null
): Promise<{ ok: boolean; message: string; codeError?: boolean }> {
  const view = await getByToken(token)
  if (!view) return { ok: false, message: 'Link tidak ditemukan atau sudah tidak berlaku.' }
  if (view.step.status !== 'pending') return { ok: false, message: 'Tahap ini sudah diproses sebelumnya.' }
  if (view.step.revision !== view.document.revision) return { ok: false, message: 'Dokumen sudah direvisi — link ini tidak berlaku lagi.' }
  if (linkExpired(view.step)) return { ok: false, message: `Link ini sudah kedaluwarsa (lebih dari ${APPROVAL_LINK_DAYS} hari). Minta Admin ISM mengirim ulang email pengesahan.` }
  // Signing takes the code from the e-mail body as well as the link.
  if (action === 'approve') {
    const wrong = await checkApprovalCode(view.step.id, approvalCode)
    if (wrong) return { ok: false, message: wrong, codeError: true }
  }

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
      `UPDATE procedure_approvals SET status = $1, decided_at = now(), decision_note = $2, verification_code = $3, file_path = $5
       WHERE id = $4 AND status = 'pending' RETURNING id`,
      [status, note, verificationCode, view.step.id, view.document.file_path]
    )
    if (updated.rows.length === 0) return 'already' as const

    if (action === 'reject') {
      const rows: RevisionNote[] = [...(general ? [{ page: null, x: null, y: null, note: general }] : []), ...pinned]
      for (const [seq, n] of rows.entries()) {
        await query(
          `INSERT INTO procedure_revision_notes (approval_id, document_id, revision, seq, page, x, y, note, x2, y2)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [view.step.id, view.document.id, view.document.revision, seq, n.page, n.x, n.y, n.note, n.x2 ?? null, n.y2 ?? null]
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
  // History of the signing (the bell already shows approved / revision notices live).
  {
    const kindInfo = docKindInfo(view.document.kind)
    const docLabel = `${view.document.control_no} · ${view.document.title}`
    const who = `${view.step.approver_name ?? view.step.role_title} (${view.step.role_title})`
    await recordNotification({
      kind: outcome === 'rejected' ? 'esign_rejected' : outcome === 'approved' ? 'esign_approved' : 'esign_step',
      category: 'esign',
      historyOnly: true,
      title: outcome === 'rejected' ? `${kindInfo.short} perlu revisi — ${docLabel}` : outcome === 'approved' ? `${kindInfo.short} disahkan — ${docLabel}` : `${kindInfo.short} disetujui ${who} — ${docLabel}`,
      body: outcome === 'rejected' ? `Diminta oleh ${who}` : outcome === 'approved' ? `Tanda tangan terakhir oleh ${who}` : 'Diteruskan ke approver berikutnya',
      href: `${kindInfo.path}?q=${encodeURIComponent(view.document.control_no)}`,
    })
  }
  if (outcome === 'rejected') {
    await notifyAdmins(view.document.id, 'rejected')
    return { ok: true, message: 'Permintaan revisi terkirim. Admin ISM menerima pemberitahuan beserta catatan Anda.' }
  }
  if (outcome === 'approved') {
    // The document takes effect the day its last approver signs: Eff Date
    // follows that date. (A Form Review filled in on the portal keeps the
    // date written in the form itself.)
    await query(
      `UPDATE procedure_documents d SET elf_date = (now() AT TIME ZONE 'Asia/Jakarta')::date
       WHERE d.id = $1 AND NOT EXISTS (SELECT 1 FROM document_review_forms f WHERE f.document_id = d.id)`,
      [view.document.id]
    ).catch((error) => console.error('[procedure-approval/effDate]', (error as Error).message))
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
        ? { by: request.approverName ?? '-', roleTitle: request.roleTitle, at: request.decidedAt, general: request.general, pins: request.pins.map((p) => ({ page: p.page, note: p.note, x2: p.x2 })) }
        : null,
      placements: outcome === 'approved' ? (() => {
        const own = cycle.filter((s) => (doc.approval_roles ?? []).includes(s.role_code))
        return { placed: own.filter((s) => placedRoles.has(s.role_code)).length, total: own.length }
      })() : undefined,
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
  await syncRoleInitials(code)
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
  // One QR per position per page: a second box of the same person on the
  // same page would print the same QR twice (a page further on is fine).
  const onPage = new Set<string>()
  const slots: SignatureSlot[] = []
  for (const item of list) {
    const s = item as Record<string, unknown>
    if (typeof s.role_code !== 'string' || !allowedRoles.includes(s.role_code)) continue
    if (!Number.isInteger(s.page) || (s.page as number) < 0 || (s.page as number) > 500) continue
    if (![s.x, s.y, s.w, s.h].every(frac) || (s.w as number) < 0.005 || (s.h as number) < 0.005) continue
    const count = perRole.get(s.role_code) ?? 0
    if (count >= MAX_SLOTS_PER_ROLE) continue
    const pageKey = `${s.role_code}@${s.page}`
    if (onPage.has(pageKey)) continue
    onPage.add(pageKey)
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
    const first = req.pins[0] ? `Hal. ${req.pins[0].page + 1}${isStrike(req.pins[0]) ? ' (coret)' : ''}: ${req.pins[0].note}` : req.general
    notices.push({
      kind: 'revision', docKind: doc.kind, documentId: doc.id, controlNo: doc.control_no, title: doc.title, revision: doc.revision,
      at: req.decidedAt, by: req.approverName, roleTitle: req.roleTitle,
      noteCount: (req.general ? 1 : 0) + req.pins.length, pinCount: req.pins.length,
      firstNote: first ? first.split('\n')[0].slice(0, 140) : null,
    })
  }

  const approved = (await query<{ id: number; kind: DocKind; control_no: string; title: string; revision: number; file_path: string; at: string; total: number; approval_roles: string[] }>(
    `SELECT d.id, d.kind, d.control_no, d.title, d.revision, d.file_path, d.approval_roles, max(a.decided_at) AS at, count(*)::int AS total
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
    )).rows.map((r) => r.role_code).filter((r) => (doc.approval_roles ?? []).includes(r)) // the document's own approvers
    const placedRoles = new Set((await slotsFor(doc.id, doc.file_path)).map((s) => s.role_code))
    notices.push({
      kind: 'approved', docKind: doc.kind, documentId: doc.id, controlNo: doc.control_no, title: doc.title, revision: doc.revision, at: doc.at,
      placed: approvedRoles.filter((r) => placedRoles.has(r)).length, total: approvedRoles.length,
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
  const result = await query<ApprovalStep & { control_no: string; title: string; kind: DocKind; approver_email: string | null; reminded_at: string | null; reminder_count: number }>(
    `SELECT ${STEP_COLUMNS.split(', ').map((c) => `a.${c}`).join(', ')}, a.approver_email, a.reminded_at, a.reminder_count, d.control_no, d.title, d.kind
     FROM procedure_approvals a JOIN procedure_documents d ON d.id = a.document_id AND d.revision = a.revision
     WHERE a.status = 'pending'
     ORDER BY a.notified_at ASC NULLS FIRST, a.id ASC`
  )
  return result.rows
}
