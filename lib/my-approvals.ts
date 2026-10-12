// lib/my-approvals.ts
//
// "Persetujuan Saya": what a logged-in account is asked to approve. Requests
// are matched by e-mail address — whatever was sent to the account's address
// is listed, so a position changing hands moves the list along by itself.
// Being logged in to the mailbox's account stands in for the 6-digit code of
// the e-mail (sessionOwnsStep), the same way the code stands in for a login.

import 'server-only'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { docKindInfo } from '@/lib/document-kinds'

export type SessionAccount = { id: number; username: string; role: string; email: string | null }

/** The logged-in account (any role), read fresh — the e-mail is not in the session cookie. */
export async function sessionAccount(request: NextRequest): Promise<SessionAccount | null> {
  const session = getSessionFromRequest(request)
  if (!session) return null
  const row = (await query<SessionAccount>('SELECT id, username, role, email FROM admins WHERE id = $1', [session.sub])).rows[0]
  return row ?? null
}

const sameAddress = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

/** Whether the request comes from the account this step's e-mail was sent to. */
export async function sessionOwnsStep(request: NextRequest, approverEmail: string | null | undefined): Promise<boolean> {
  if (!approverEmail) return false
  const account = await sessionAccount(request)
  return sameAddress(account?.email, approverEmail)
}

export type MyApproval = {
  stepId: number
  token: string | null
  status: 'pending' | 'waiting' | 'approved' | 'rejected'
  roleCode: string
  roleTitle: string
  /** This request is for the Form Review beside the document, not the document itself. */
  signsReview: boolean
  documentId: number
  controlNo: string
  title: string
  revision: number
  kindLabel: string
  sentAt: string | null
  decidedAt: string | null
  /** For a step still queued: who is being waited for in its chain. */
  waitingFor: string | null
  /**
   * Approved, and the QR of this signature already has its place on the file.
   * False while the Admin ISM still has to put it there ("Atur posisi QR") —
   * the document then still shows without the QR.
   */
  qrPlaced: boolean
}

type Row = {
  id: number; token: string | null; status: MyApproval['status']; role_code: string; role_title: string; notified_at: string | null; decided_at: string | null
  document_id: number; control_no: string; title: string; revision: number; kind: string; review_form_path: string | null; review_roles: string[] | null
  qr_placed: boolean
}

/**
 * The account's requests on current documents: the ones to decide now, the
 * ones still queued behind someone, and the last few already decided.
 * A queued step has no address yet, so it is matched through its position's
 * holder (or the document's own person for that position).
 */
export async function listMyApprovals(email: string): Promise<{ pending: MyApproval[]; queued: MyApproval[]; recent: MyApproval[] }> {
  const address = email.trim().toLowerCase()
  const rows = (await query<Row>(
    `SELECT a.id, a.token, a.status, a.role_code, a.role_title, a.notified_at, a.decided_at,
            d.id AS document_id, d.control_no, d.title, d.revision, d.kind, d.review_form_path, d.review_roles,
            EXISTS (SELECT 1 FROM procedure_signature_slots s WHERE s.document_id = d.id AND s.role_code = a.role_code AND s.file_path IN (d.file_path, d.review_form_path)) AS qr_placed
     FROM procedure_approvals a
     JOIN procedure_documents d ON d.id = a.document_id AND d.revision = a.revision
     LEFT JOIN procedure_approver_roles r ON r.code = a.role_code
     WHERE a.status IN ('pending', 'waiting', 'approved', 'rejected')
       AND (
         lower(a.approver_email) = $1
         OR (a.status = 'waiting' AND lower(COALESCE(d.approver_overrides -> a.role_code ->> 'email', r.email)) = $1)
       )
     ORDER BY COALESCE(a.decided_at, a.notified_at, a.created_at) DESC`,
    [address]
  )).rows

  // who each queued step is waiting for: the one deciding now in the same chain
  const queuedDocs = [...new Set(rows.filter((row) => row.status === 'waiting').map((row) => row.document_id))]
  const deciding = queuedDocs.length
    ? (await query<{ document_id: number; role_code: string; approver_name: string | null; role_title: string }>(
        `SELECT a.document_id, a.role_code, a.approver_name, a.role_title FROM procedure_approvals a
         JOIN procedure_documents d ON d.id = a.document_id AND d.revision = a.revision
         WHERE a.document_id = ANY($1) AND a.status = 'pending'`, [queuedDocs]
      )).rows
    : []

  const shape = (row: Row): MyApproval => {
    const review = row.review_form_path ? row.review_roles ?? [] : []
    const signsReview = review.includes(row.role_code)
    const ahead = row.status === 'waiting' ? deciding.find((step) => step.document_id === row.document_id && review.includes(step.role_code) === signsReview) : null
    return {
      stepId: row.id,
      // the account's own link: to decide (pending) or to look at what it signed
      token: row.status === 'waiting' ? null : row.token,
      status: row.status,
      roleCode: row.role_code,
      roleTitle: row.role_title,
      signsReview,
      documentId: row.document_id,
      controlNo: row.control_no,
      title: row.title,
      revision: row.revision,
      kindLabel: docKindInfo(row.kind).label,
      sentAt: row.notified_at,
      decidedAt: row.decided_at,
      waitingFor: ahead ? ahead.approver_name ?? ahead.role_title : null,
      qrPlaced: row.qr_placed,
    }
  }
  return {
    pending: rows.filter((row) => row.status === 'pending' && row.token).map(shape),
    queued: rows.filter((row) => row.status === 'waiting').map(shape),
    recent: rows.filter((row) => row.status === 'approved' || row.status === 'rejected').slice(0, 10).map(shape),
  }
}

export type MyHistoryItem = {
  stepId: number
  outcome: 'approved' | 'rejected'
  decidedAt: string
  roleTitle: string
  signsReview: boolean
  documentId: number
  controlNo: string
  title: string
  /** The revision that was decided on. */
  revision: number
  kindLabel: string
  note: string | null
  /** The signing was started again afterwards, or the document has a newer revision. */
  superseded: boolean
  /** The account's own link to what it signed — only while that decision still stands. */
  token: string | null
  /** Approved and still standing, but the Admin ISM has not placed its QR on the file yet. */
  qrPending: boolean
}

export const HISTORY_PAGE_SIZE = 20

/**
 * Every decision the account's address has made — every revision, also the
 * ones whose signing was started again later — newest first.
 */
export async function listMyHistory(email: string, opts: { q?: string; page?: number; outcome?: 'approved' | 'rejected' | null } = {}) {
  const values: unknown[] = [email.trim().toLowerCase()]
  // An approval leaves a verification code; a revision request does not.
  const conditions = ['lower(a.approver_email) = $1', 'a.decided_at IS NOT NULL']
  // % _ and \ in the search text are looked for literally
  if (opts.q) { values.push(`%${opts.q.replace(/[\\%_]/g, (c) => '\\' + c)}%`); conditions.push(`(d.control_no ILIKE $${values.length} OR d.title ILIKE $${values.length})`) }
  if (opts.outcome === 'approved') conditions.push('a.verification_code IS NOT NULL')
  if (opts.outcome === 'rejected') conditions.push('a.verification_code IS NULL')
  const where = conditions.join(' AND ')
  const from = `FROM procedure_approvals a JOIN procedure_documents d ON d.id = a.document_id LEFT JOIN procedure_approver_roles r ON r.code = a.role_code`

  const total = Number((await query<{ n: string }>(`SELECT count(*)::text AS n ${from} WHERE ${where}`, values)).rows[0].n)
  const pages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE))
  const page = Math.min(Math.max(1, opts.page ?? 1), pages)
  const rows = (await query<{
    id: number; status: string; decided_at: string; role_title: string; role_kind: string | null; verification_code: string | null; decision_note: string | null; token: string | null
    step_revision: number; document_id: number; control_no: string; title: string; revision: number; kind: string; qr_placed: boolean
  }>(
    `SELECT a.id, a.status, a.decided_at, a.role_title, r.kind AS role_kind, a.verification_code, a.decision_note, a.token, a.revision AS step_revision,
            d.id AS document_id, d.control_no, d.title, d.revision, d.kind,
            EXISTS (SELECT 1 FROM procedure_signature_slots s WHERE s.document_id = d.id AND s.role_code = a.role_code AND s.file_path IN (d.file_path, d.review_form_path)) AS qr_placed
     ${from} WHERE ${where}
     ORDER BY a.decided_at DESC, a.id DESC
     LIMIT ${HISTORY_PAGE_SIZE} OFFSET ${(page - 1) * HISTORY_PAGE_SIZE}`,
    values
  )).rows

  const items: MyHistoryItem[] = rows.map((row) => {
    const superseded = row.status === 'cancelled' || row.step_revision !== row.revision
    return {
      stepId: row.id,
      outcome: row.verification_code ? 'approved' : 'rejected',
      decidedAt: row.decided_at,
      roleTitle: row.role_title,
      signsReview: row.role_kind === 'review_form',
      documentId: row.document_id,
      controlNo: row.control_no,
      title: row.title,
      revision: row.step_revision,
      kindLabel: docKindInfo(row.kind).label,
      note: row.verification_code ? null : row.decision_note,
      superseded,
      token: superseded ? null : row.token,
      qrPending: !superseded && !!row.verification_code && !row.qr_placed,
    }
  })
  return { items, total, page, pages, pageSize: HISTORY_PAGE_SIZE }
}
