// lib/my-approvals.ts
//
// "Persetujuan Saya": what a logged-in account is asked to approve. Requests
// are matched by e-mail address — whatever was sent to the account's address
// is listed, so a position changing hands moves the list along by itself.
// Being logged in to the mailbox's account stands in for the 6-digit code of
// the e-mail (sessionOwnsStep), the same way the code stands in for a login.
//
// Unified across all approval workflows:
// 1. Prosedur ISMS / Form Review / Standar ISMS (procedure_approvals)
// 2. Formulir Layanan IT E-Sign (it_form_signatures + it_form_submissions)
// 3. Izin Akses Area Special (special_area_requests)
// 4. Izin Foto / Video (photo_video_requests + pic_approvers)

import 'server-only'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { docKindInfo } from '@/lib/document-kinds'
import { ensureItFormTables } from '@/lib/it-form-service'

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

export type ApprovalCategory = 'procedure' | 'it_form' | 'special_area' | 'photo_video'

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
   * False while the Admin ISMS still has to put it there ("Atur posisi QR") —
   * the document then still shows without the QR.
   */
  qrPlaced: boolean
  /** 6-digit approval code sent to this approver's email / messages. */
  code?: string | null
  codeLocked?: boolean
  filePath?: string
  note?: string | null
  uploadedAt?: string | null
  effDate?: string | null
  approverName?: string | null

  // Extended fields for unified forms:
  category: ApprovalCategory
  actionUrl: string
  applicantName?: string | null
  department?: string | null
  verificationCode?: string | null
  extraData?: Record<string, unknown> | null
}

type ProcedureRow = {
  id: number; token: string | null; status: MyApproval['status']; role_code: string; role_title: string; notified_at: string | null; decided_at: string | null
  document_id: number; control_no: string; title: string; revision: number; kind: string; file_path: string; note: string | null
  uploaded_at: string | null; elf_date: string | null; approver_name: string | null; review_form_path: string | null; review_roles: string[] | null
  qr_placed: boolean
  approval_code: string | null
  approval_code_attempts: number
}

/**
 * The account's requests across all workflows:
 * 1. Prosedur ISMS / Form Review
 * 2. Form Layanan IT (E-Sign)
 * 3. Izin Area Special
 * 4. Izin Foto / Video
 */
export async function listMyApprovals(email: string): Promise<{ pending: MyApproval[]; queued: MyApproval[]; recent: MyApproval[] }> {
  const address = email.trim().toLowerCase()

  // 1. Prosedur ISMS
  const procRows = (await query<ProcedureRow>(
    `SELECT a.id, a.token, a.status, a.role_code, a.role_title, a.notified_at, a.decided_at,
            a.approval_code, a.approval_code_attempts, a.approver_name,
            d.id AS document_id, d.control_no, d.title, d.revision, d.kind, d.file_path, d.note,
            to_char(d.uploaded_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS uploaded_at,
            to_char(d.elf_date, 'YYYY-MM-DD') AS elf_date,
            d.review_form_path, d.review_roles,
            EXISTS (SELECT 1 FROM procedure_signature_slots s WHERE s.document_id = d.id AND s.role_code = a.role_code AND s.file_path IN (d.file_path, d.review_form_path)) AS qr_placed
     FROM procedure_approvals a
     JOIN procedure_documents d ON d.id = a.document_id AND d.revision = a.revision
     LEFT JOIN procedure_approver_roles r ON r.code = a.role_code
     WHERE a.status IN ('pending', 'waiting', 'approved', 'rejected')
       AND (
         lower(trim(a.approver_email)) = $1
         OR (a.status = 'waiting' AND lower(trim(COALESCE(d.approver_overrides -> a.role_code ->> 'email', r.email))) = $1)
       )
     ORDER BY COALESCE(a.decided_at, a.notified_at, a.created_at) DESC`,
    [address]
  )).rows

  // who each queued step is waiting for in procedure approvals
  const queuedDocs = [...new Set(procRows.filter((row) => row.status === 'waiting').map((row) => row.document_id))]
  const deciding = queuedDocs.length
    ? (await query<{ document_id: number; role_code: string; approver_name: string | null; role_title: string }>(
        `SELECT a.document_id, a.role_code, a.approver_name, a.role_title FROM procedure_approvals a
         JOIN procedure_documents d ON d.id = a.document_id AND d.revision = a.revision
         WHERE a.document_id = ANY($1) AND a.status = 'pending'`, [queuedDocs]
      )).rows
    : []

  const procItems: MyApproval[] = procRows.map((row) => {
    const review = row.review_form_path ? row.review_roles ?? [] : []
    const signsReview = review.includes(row.role_code)
    const ahead = row.status === 'waiting' ? deciding.find((step) => step.document_id === row.document_id && review.includes(step.role_code) === signsReview) : null
    return {
      stepId: row.id,
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
      code: row.status === 'pending' ? row.approval_code : null,
      codeLocked: (row.approval_code_attempts ?? 0) >= 5,
      filePath: row.file_path,
      note: row.note,
      uploadedAt: row.uploaded_at,
      effDate: row.elf_date,
      approverName: row.approver_name,
      category: 'procedure',
      actionUrl: row.token ? `/pengesahan?token=${row.token}` : `/pengesahan?stepId=${row.id}`,
    }
  })

  // 2. Form Layanan IT (E-Sign)
  const itItems: MyApproval[] = []
  try {
    await ensureItFormTables()
    const itRows = (await query<{
      sig_id: number; step_number: number; slot_label: string; role_title: string; approver_name: string; approver_email: string | null
      sig_status: 'pending' | 'waiting' | 'approved' | 'rejected'; verification_code: string | null; signature_note: string | null
      sub_id: number; request_no: string; form_code: string; form_name: string; applicant_name: string; department: string
      submission_status: string; current_step: number; total_steps: number; token: string; notes: string | null
      submitted_at: string; decided_at: string | null
    }>(
      `SELECT s.id AS sig_id, s.step_number, s.slot_label, s.role_title, s.approver_name, s.approver_email,
              s.status AS sig_status, s.verification_code, s.signature_note,
              sub.id AS sub_id, sub.request_no, sub.form_code, sub.form_name, sub.applicant_name, sub.department,
              sub.status AS submission_status, sub.current_step, sub.total_steps, sub.token, sub.notes,
              to_char(sub.created_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS submitted_at,
              to_char(s.signed_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS decided_at
       FROM it_form_signatures s
       JOIN it_form_submissions sub ON sub.id = s.submission_id
       WHERE lower(trim(s.approver_email)) = $1
       ORDER BY COALESCE(s.signed_at, sub.created_at) DESC`,
      [address]
    )).rows

    // Find who queued steps are waiting for
    const waitingSubIds = itRows.filter((r) => r.sig_status === 'waiting' && r.submission_status === 'pending').map((r) => r.sub_id)
    const itDeciding = waitingSubIds.length
      ? (await query<{ submission_id: number; approver_name: string; role_title: string }>(
          `SELECT submission_id, approver_name, role_title FROM it_form_signatures
           WHERE submission_id = ANY($1) AND status = 'pending'`,
          [waitingSubIds]
        )).rows
      : []

    for (const row of itRows) {
      let status: MyApproval['status'] = row.sig_status
      if (row.submission_status === 'rejected' && row.sig_status === 'waiting') {
        // Earlier approver rejected
        status = 'rejected'
      }
      const ahead = status === 'waiting' ? itDeciding.find((d) => d.submission_id === row.sub_id) : null

      itItems.push({
        stepId: 1_000_000 + row.sig_id,
        token: row.token,
        status,
        roleCode: row.slot_label,
        roleTitle: row.role_title,
        signsReview: false,
        documentId: row.sub_id,
        controlNo: row.request_no,
        title: `${row.form_name} (${row.form_code})`,
        revision: row.step_number,
        kindLabel: `Form IT (${row.form_code})`,
        sentAt: row.submitted_at,
        decidedAt: row.decided_at,
        waitingFor: ahead ? (ahead.approver_name ? `${ahead.approver_name} (${ahead.role_title})` : ahead.role_title) : null,
        qrPlaced: true,
        code: null,
        codeLocked: false,
        filePath: `/api/it-form-submissions/${row.sub_id}/pdf?token=${row.token}`,
        note: row.signature_note || row.notes,
        uploadedAt: row.submitted_at,
        effDate: row.submitted_at,
        approverName: row.approver_name,
        category: 'it_form',
        actionUrl: `/form-it-esign?token=${row.token}`,
        applicantName: row.applicant_name,
        department: row.department,
        verificationCode: row.verification_code,
        extraData: {
          stepNumber: row.step_number,
          totalSteps: row.total_steps,
          submissionId: row.sub_id,
        },
      })
    }
  } catch (err) {
    console.error('[my-approvals] Failed to fetch it_form_signatures:', err)
  }

  // 3. Izin Akses Area Special
  const specialAreaItems: MyApproval[] = []
  try {
    const specialRows = (await query<{
      id: number; token: string; status: 'pending' | 'approved' | 'rejected'; approver_name: string | null; approver_title: string | null
      area: string; requester_name: string; org_company: string; department: string | null; purpose: string
      verification_code: string | null; decision_note: string | null
      submitted_at: string; decided_at: string | null; from_at: string; to_at: string
    }>(
      `SELECT r.id, r.token, r.status, r.approver_name, r.approver_title,
              r.area, r.requester_name, r.org_company, r.department, r.purpose,
              r.verification_code, r.decision_note,
              to_char(r.submitted_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS submitted_at,
              to_char(r.decided_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS decided_at,
              to_char(r.from_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS from_at,
              to_char(r.to_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS to_at
       FROM special_area_requests r
       WHERE lower(trim(r.approver_email)) = $1
       ORDER BY COALESCE(r.decided_at, r.submitted_at) DESC`,
      [address]
    )).rows

    for (const r of specialRows) {
      specialAreaItems.push({
        stepId: 2_000_000 + r.id,
        token: r.token,
        status: r.status,
        roleCode: 'APPROVER_SPECIAL_AREA',
        roleTitle: r.approver_title || 'Approver Area Special',
        signsReview: false,
        documentId: r.id,
        controlNo: r.verification_code || `SA-${String(r.id).padStart(4, '0')}`,
        title: `Izin Area Special — ${r.area}`,
        revision: 1,
        kindLabel: 'Izin Area Special',
        sentAt: r.submitted_at,
        decidedAt: r.decided_at,
        waitingFor: null,
        qrPlaced: true,
        code: null,
        codeLocked: false,
        filePath: `/api/special-area-requests/${r.id}/pdf`,
        note: r.decision_note || r.purpose,
        uploadedAt: r.submitted_at,
        effDate: r.from_at,
        approverName: r.approver_name,
        category: 'special_area',
        actionUrl: `/persetujuan-area-special?token=${r.token}`,
        applicantName: r.requester_name,
        department: r.org_company || r.department || null,
        verificationCode: r.verification_code,
      })
    }
  } catch (err) {
    console.error('[my-approvals] Failed to fetch special_area_requests:', err)
  }

  // 4. Izin Foto / Video
  const photoItems: MyApproval[] = []
  try {
    const photoRows = (await query<{
      id: number; approval_token: string | null; status: 'pending' | 'approved' | 'rejected'; location: string; requester_name: string
      dept_or_company: string; dept: string | null; objective: string; request_type: string; verification_code: string | null
      submitted_at: string; decided_at: string | null; from_at: string; to_at: string
      pic_name: string | null; pic_full_name: string | null; pic_email: string | null; pic_title: string | null
    }>(
      `SELECT r.id, r.approval_token, r.status, r.location, r.requester_name, r.dept_or_company, r.dept,
              r.objective, r.request_type, r.verification_code,
              to_char(r.submitted_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS submitted_at,
              to_char(r.decided_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS decided_at,
              to_char(r.from_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS from_at,
              to_char(r.to_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS to_at,
              pic.name AS pic_name, pic.full_name AS pic_full_name, pic.email AS pic_email, pic.title AS pic_title
       FROM photo_video_requests r
       JOIN pic_approvers pic ON pic.id = r.pic_approve_id
       WHERE lower(trim(pic.email)) = $1
       ORDER BY COALESCE(r.decided_at, r.submitted_at) DESC`,
      [address]
    )).rows

    for (const r of photoRows) {
      photoItems.push({
        stepId: 3_000_000 + r.id,
        token: r.approval_token,
        status: r.status,
        roleCode: 'PIC_APPROVER',
        roleTitle: r.pic_title || `PIC Approver (${r.pic_name || 'Foto/Video'})`,
        signsReview: false,
        documentId: r.id,
        controlNo: r.verification_code || `PV-${String(r.id).padStart(4, '0')}`,
        title: `Izin Foto / Video — ${r.location}`,
        revision: 1,
        kindLabel: 'Izin Foto / Video',
        sentAt: r.submitted_at,
        decidedAt: r.decided_at,
        waitingFor: null,
        qrPlaced: true,
        code: null,
        codeLocked: false,
        filePath: `/api/photo-video-requests/${r.id}/pdf`,
        note: r.objective,
        uploadedAt: r.submitted_at,
        effDate: r.from_at,
        approverName: r.pic_full_name || r.pic_name,
        category: 'photo_video',
        actionUrl: r.approval_token ? `/konfirmasi-approval?token=${r.approval_token}` : `/kelola-permintaan-foto-video`,
        applicantName: r.requester_name,
        department: r.dept_or_company || r.dept || null,
        verificationCode: r.verification_code,
      })
    }
  } catch (err) {
    console.error('[my-approvals] Failed to fetch photo_video_requests:', err)
  }

  // Combine and sort
  const allItems = [...procItems, ...itItems, ...specialAreaItems, ...photoItems]

  const sortByDateDesc = (a: MyApproval, b: MyApproval) => {
    const timeA = new Date(a.decidedAt || a.sentAt || a.uploadedAt || 0).getTime()
    const timeB = new Date(b.decidedAt || b.sentAt || b.uploadedAt || 0).getTime()
    return timeB - timeA
  }

  const pending = allItems
    .filter((item) => item.status === 'pending' && item.token)
    .sort(sortByDateDesc)

  const queued = allItems
    .filter((item) => item.status === 'waiting')
    .sort(sortByDateDesc)

  const recent = allItems
    .filter((item) => item.status === 'approved' || item.status === 'rejected')
    .sort(sortByDateDesc)
    .slice(0, 15)

  return { pending, queued, recent }
}

export type ApprovalMessage = {
  stepId: number
  controlNo: string
  title: string
  roleTitle: string
  sentAt: string | null
  code: string | null
  locked: boolean
  category: ApprovalCategory
  actionUrl: string
  applicantName?: string | null
  department?: string | null
}

/**
 * The logged-in approver's active pending items across all 4 workflows.
 * The 6-digit code is provided for procedure approvals (same as in email),
 * while for IT Forms, Special Area, and Photo/Video, direct approval actions are enabled.
 */
export async function listMyApprovalMessages(email: string): Promise<ApprovalMessage[]> {
  const address = email.trim().toLowerCase()
  const messages: ApprovalMessage[] = []

  // 1. Procedure Approvals
  try {
    const procRows = (await query<{
      id: number; control_no: string; title: string; role_title: string; notified_at: string | null
      approval_code: string | null; approval_code_attempts: number; token: string
    }>(
      `SELECT a.id, d.control_no, d.title, a.role_title, a.notified_at, a.approval_code, a.approval_code_attempts, a.token
       FROM procedure_approvals a
       JOIN procedure_documents d ON d.id = a.document_id AND d.revision = a.revision
       WHERE a.status = 'pending' AND a.token IS NOT NULL AND lower(trim(a.approver_email)) = $1
       ORDER BY COALESCE(a.notified_at, a.created_at) DESC`,
      [address]
    )).rows

    for (const r of procRows) {
      messages.push({
        stepId: r.id,
        controlNo: r.control_no,
        title: r.title,
        roleTitle: r.role_title,
        sentAt: r.notified_at,
        code: r.approval_code,
        locked: (r.approval_code_attempts ?? 0) >= 5,
        category: 'procedure',
        actionUrl: `/pengesahan?token=${r.token}`,
      })
    }
  } catch (err) {
    console.error('[my-approvals/messages] Failed to query procedure approvals:', err)
  }

  // 2. IT Form Signatures
  try {
    await ensureItFormTables()
    const itRows = (await query<{
      sig_id: number; request_no: string; form_name: string; form_code: string; role_title: string
      applicant_name: string; department: string; submitted_at: string; token: string
    }>(
      `SELECT s.id AS sig_id, sub.request_no, sub.form_name, sub.form_code, s.role_title,
              sub.applicant_name, sub.department, to_char(sub.created_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS submitted_at, sub.token
       FROM it_form_signatures s
       JOIN it_form_submissions sub ON sub.id = s.submission_id
       WHERE s.status = 'pending' AND sub.status = 'pending' AND lower(trim(s.approver_email)) = $1
       ORDER BY sub.created_at DESC`,
      [address]
    )).rows

    for (const r of itRows) {
      messages.push({
        stepId: 1_000_000 + r.sig_id,
        controlNo: r.request_no,
        title: `${r.form_name} (${r.form_code})`,
        roleTitle: r.role_title,
        sentAt: r.submitted_at,
        code: null,
        locked: false,
        category: 'it_form',
        actionUrl: `/form-it-esign?token=${r.token}`,
        applicantName: r.applicant_name,
        department: r.department,
      })
    }
  } catch (err) {
    console.error('[my-approvals/messages] Failed to query it form signatures:', err)
  }

  // 3. Special Area
  try {
    const specialRows = (await query<{
      id: number; area: string; requester_name: string; org_company: string; department: string | null
      approver_title: string | null; token: string; submitted_at: string
    }>(
      `SELECT r.id, r.area, r.requester_name, r.org_company, r.department, r.approver_title, r.token,
              to_char(r.submitted_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS submitted_at
       FROM special_area_requests r
       WHERE r.status = 'pending' AND lower(trim(r.approver_email)) = $1
       ORDER BY r.submitted_at DESC`,
      [address]
    )).rows

    for (const r of specialRows) {
      messages.push({
        stepId: 2_000_000 + r.id,
        controlNo: `SA-${String(r.id).padStart(4, '0')}`,
        title: `Izin Area Special — ${r.area}`,
        roleTitle: r.approver_title || 'Approver Area Special',
        sentAt: r.submitted_at,
        code: null,
        locked: false,
        category: 'special_area',
        actionUrl: `/persetujuan-area-special?token=${r.token}`,
        applicantName: r.requester_name,
        department: r.org_company || r.department || null,
      })
    }
  } catch (err) {
    console.error('[my-approvals/messages] Failed to query special area:', err)
  }

  // 4. Photo Video
  try {
    const photoRows = (await query<{
      id: number; location: string; requester_name: string; dept_or_company: string
      pic_title: string | null; pic_name: string | null; approval_token: string; submitted_at: string
    }>(
      `SELECT r.id, r.location, r.requester_name, r.dept_or_company, pic.title AS pic_title, pic.name AS pic_name,
              r.approval_token, to_char(r.submitted_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS submitted_at
       FROM photo_video_requests r
       JOIN pic_approvers pic ON pic.id = r.pic_approve_id
       WHERE r.status = 'pending' AND r.approval_token IS NOT NULL AND lower(trim(pic.email)) = $1
       ORDER BY r.submitted_at DESC`,
      [address]
    )).rows

    for (const r of photoRows) {
      messages.push({
        stepId: 3_000_000 + r.id,
        controlNo: `PV-${String(r.id).padStart(4, '0')}`,
        title: `Izin Foto / Video — ${r.location}`,
        roleTitle: r.pic_title || `PIC Approver (${r.pic_name || 'Foto/Video'})`,
        sentAt: r.submitted_at,
        code: null,
        locked: false,
        category: 'photo_video',
        actionUrl: `/konfirmasi-approval?token=${r.approval_token}`,
        applicantName: r.requester_name,
        department: r.dept_or_company,
      })
    }
  } catch (err) {
    console.error('[my-approvals/messages] Failed to query photo video:', err)
  }

  return messages.sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime())
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
  /** Approved and still standing, but the Admin ISMS has not placed its QR on the file yet. */
  qrPending: boolean
  // Unified fields:
  category?: ApprovalCategory
  actionUrl?: string
  applicantName?: string | null
}

export const HISTORY_PAGE_SIZE = 20

/**
 * Every decision the account's address has made across all 4 workflows:
 * 1. Prosedur ISMS
 * 2. Form IT E-Sign
 * 3. Izin Area Special
 * 4. Izin Foto / Video
 */
export async function listMyHistory(email: string, opts: { q?: string; page?: number; outcome?: 'approved' | 'rejected' | null } = {}) {
  const address = email.trim().toLowerCase()
  const allHistory: MyHistoryItem[] = []

  // 1. Prosedur ISMS
  try {
    const procRows = (await query<{
      id: number; status: string; decided_at: string; role_title: string; role_kind: string | null; verification_code: string | null; decision_note: string | null; token: string | null
      step_revision: number; document_id: number; control_no: string; title: string; revision: number; kind: string; qr_placed: boolean
    }>(
      `SELECT a.id, a.status, to_char(a.decided_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS decided_at, a.role_title, r.kind AS role_kind, a.verification_code, a.decision_note, a.token, a.revision AS step_revision,
              d.id AS document_id, d.control_no, d.title, d.revision, d.kind,
              EXISTS (SELECT 1 FROM procedure_signature_slots s WHERE s.document_id = d.id AND s.role_code = a.role_code AND s.file_path IN (d.file_path, d.review_form_path)) AS qr_placed
       FROM procedure_approvals a
       JOIN procedure_documents d ON d.id = a.document_id
       LEFT JOIN procedure_approver_roles r ON r.code = a.role_code
       WHERE lower(trim(a.approver_email)) = $1 AND a.decided_at IS NOT NULL
       ORDER BY a.decided_at DESC`,
      [address]
    )).rows

    for (const row of procRows) {
      const superseded = row.status === 'cancelled' || row.step_revision !== row.revision
      allHistory.push({
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
        category: 'procedure',
        actionUrl: row.token ? `/pengesahan?token=${row.token}` : `/pengesahan?stepId=${row.id}`,
      })
    }
  } catch (err) {
    console.error('[my-approvals/history] Failed to query procedure history:', err)
  }

  // 2. Form IT E-Sign
  try {
    await ensureItFormTables()
    const itRows = (await query<{
      sig_id: number; step_number: number; role_title: string; verification_code: string | null; signature_note: string | null
      decided_at: string; sub_id: number; request_no: string; form_code: string; form_name: string; applicant_name: string; token: string
      status: 'approved' | 'rejected'
    }>(
      `SELECT s.id AS sig_id, s.step_number, s.role_title, s.verification_code, s.signature_note,
              to_char(s.signed_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS decided_at, s.status,
              sub.id AS sub_id, sub.request_no, sub.form_code, sub.form_name, sub.applicant_name, sub.token
       FROM it_form_signatures s
       JOIN it_form_submissions sub ON sub.id = s.submission_id
       WHERE lower(trim(s.approver_email)) = $1 AND s.signed_at IS NOT NULL AND s.status IN ('approved', 'rejected')
       ORDER BY s.signed_at DESC`,
      [address]
    )).rows

    for (const r of itRows) {
      allHistory.push({
        stepId: 1_000_000 + r.sig_id,
        outcome: r.status === 'approved' ? 'approved' : 'rejected',
        decidedAt: r.decided_at,
        roleTitle: r.role_title,
        signsReview: false,
        documentId: r.sub_id,
        controlNo: r.request_no,
        title: `${r.form_name} (${r.form_code})`,
        revision: r.step_number,
        kindLabel: `Form IT (${r.form_code})`,
        note: r.signature_note,
        superseded: false,
        token: r.token,
        qrPending: false,
        category: 'it_form',
        actionUrl: `/form-it-esign?token=${r.token}`,
        applicantName: r.applicant_name,
      })
    }
  } catch (err) {
    console.error('[my-approvals/history] Failed to query it form history:', err)
  }

  // 3. Special Area
  try {
    const specialRows = (await query<{
      id: number; area: string; requester_name: string; approver_title: string | null; status: 'approved' | 'rejected'
      verification_code: string | null; decision_note: string | null; token: string; decided_at: string
    }>(
      `SELECT r.id, r.area, r.requester_name, r.approver_title, r.status, r.verification_code, r.decision_note, r.token,
              to_char(r.decided_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS decided_at
       FROM special_area_requests r
       WHERE lower(trim(r.approver_email)) = $1 AND r.decided_at IS NOT NULL AND r.status IN ('approved', 'rejected')
       ORDER BY r.decided_at DESC`,
      [address]
    )).rows

    for (const r of specialRows) {
      allHistory.push({
        stepId: 2_000_000 + r.id,
        outcome: r.status === 'approved' ? 'approved' : 'rejected',
        decidedAt: r.decided_at,
        roleTitle: r.approver_title || 'Approver Area Special',
        signsReview: false,
        documentId: r.id,
        controlNo: r.verification_code || `SA-${String(r.id).padStart(4, '0')}`,
        title: `Izin Area Special — ${r.area}`,
        revision: 1,
        kindLabel: 'Izin Area Special',
        note: r.decision_note,
        superseded: false,
        token: r.token,
        qrPending: false,
        category: 'special_area',
        actionUrl: `/persetujuan-area-special?token=${r.token}`,
        applicantName: r.requester_name,
      })
    }
  } catch (err) {
    console.error('[my-approvals/history] Failed to query special area history:', err)
  }

  // 4. Photo Video
  try {
    const photoRows = (await query<{
      id: number; location: string; requester_name: string; pic_title: string | null; status: 'approved' | 'rejected'
      verification_code: string | null; approval_token: string | null; decided_at: string
    }>(
      `SELECT r.id, r.location, r.requester_name, pic.title AS pic_title, r.status, r.verification_code, r.approval_token,
              to_char(r.decided_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS decided_at
       FROM photo_video_requests r
       JOIN pic_approvers pic ON pic.id = r.pic_approve_id
       WHERE lower(trim(pic.email)) = $1 AND r.decided_at IS NOT NULL AND r.status IN ('approved', 'rejected')
       ORDER BY r.decided_at DESC`,
      [address]
    )).rows

    for (const r of photoRows) {
      allHistory.push({
        stepId: 3_000_000 + r.id,
        outcome: r.status === 'approved' ? 'approved' : 'rejected',
        decidedAt: r.decided_at,
        roleTitle: r.pic_title || 'PIC Approver Foto/Video',
        signsReview: false,
        documentId: r.id,
        controlNo: r.verification_code || `PV-${String(r.id).padStart(4, '0')}`,
        title: `Izin Foto / Video — ${r.location}`,
        revision: 1,
        kindLabel: 'Izin Foto / Video',
        note: null,
        superseded: false,
        token: r.approval_token,
        qrPending: false,
        category: 'photo_video',
        actionUrl: r.approval_token ? `/konfirmasi-approval?token=${r.approval_token}` : `/kelola-permintaan-foto-video`,
        applicantName: r.requester_name,
      })
    }
  } catch (err) {
    console.error('[my-approvals/history] Failed to query photo video history:', err)
  }

  // Filter in memory
  let filtered = allHistory.sort((a, b) => new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime())

  if (opts.outcome) {
    filtered = filtered.filter((item) => item.outcome === opts.outcome)
  }

  if (opts.q) {
    const queryTerm = opts.q.toLowerCase()
    filtered = filtered.filter(
      (item) =>
        item.controlNo.toLowerCase().includes(queryTerm) ||
        item.title.toLowerCase().includes(queryTerm) ||
        (item.applicantName && item.applicantName.toLowerCase().includes(queryTerm)) ||
        item.roleTitle.toLowerCase().includes(queryTerm)
    )
  }

  const total = filtered.length
  const pages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE))
  const page = Math.min(Math.max(1, opts.page ?? 1), pages)
  const items = filtered.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE)

  return { items, total, page, pages, pageSize: HISTORY_PAGE_SIZE }
}

