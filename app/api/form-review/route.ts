// app/api/form-review/route.ts — "Form Review & Revisi Dokumen ISMS" (ISMS-F-001-001).
//
// The form is filled in on the portal: POST / PUT take its fields as JSON,
// turn them into the official form as a PDF (lib/review-form-pdf.ts) and hand
// that file to the shared register handlers (kind 'review_form'), so the
// approval chain, e-mails, QR signatures, revision requests and history work
// exactly as for an uploaded document. What was filled in is kept in
// document_review_forms, to edit the form later; the QR of each approver is
// placed in the form's own Prepared / Checked / Approval box automatically.
//
// GET lists the forms (like every register); GET ?form=<id> returns the
// fields of one, for the edit dialog. PATCH / DELETE are the register's.

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { documentHandlers } from '@/lib/controlled-documents-api'
import { ensureApprovalSchema, listRoles, saveSlots, type SignatureSlot, reviewFormsBeingSaved } from '@/lib/procedure-approval'
import { parseReviewForm, reviewBoxes, reviewFormTitle, type ReviewFormData } from '@/lib/review-form'
import { buildReviewFormPdf, REVIEW_SIGN_SLOTS } from '@/lib/review-form-pdf'

export const dynamic = 'force-dynamic'

const handlers = documentHandlers('review_form')
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE

type Saved = { id: number; file_path: string; approval_roles: string[] }

export async function GET(request: NextRequest) {
  const formId = request.nextUrl.searchParams.get('form')
  if (!formId) return handlers.GET(request)
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  if (!/^\d+$/.test(formId)) return NextResponse.json({ message: 'ID form tidak valid.' }, { status: 400 })
  try {
    const row = (await query<{ data: ReviewFormData; approval_roles: string[]; note: string | null }>(
      `SELECT f.data, d.approval_roles, d.note FROM document_review_forms f JOIN procedure_documents d ON d.id = f.document_id
       WHERE f.document_id = $1 AND d.kind = 'review_form'`,
      [formId]
    )).rows[0]
    if (!row) return NextResponse.json({ message: 'Form tidak ditemukan.' }, { status: 404 })
    return NextResponse.json({ form: row.data, approvalRoles: row.approval_roles, note: row.note })
  } catch (error) {
    console.error('[form-review/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat form.' }, { status: 500 })
  }
}

// The register handlers take a multipart upload — give them the generated PDF as one.
function asUpload(request: NextRequest, method: 'POST' | 'PUT', data: ReviewFormData, pdf: Uint8Array, extra: Record<string, string>) {
  const form = new FormData()
  form.set('controlNo', data.formNo)
  form.set('title', reviewFormTitle(data))
  form.set('elfDate', data.effectiveAt ?? data.reviewRequestedAt)
  for (const [key, value] of Object.entries(extra)) form.set(key, value)
  const name = `Form-Review-${data.formNo.replace(/[^a-zA-Z0-9._-]+/g, '-')}.pdf`
  form.set('file', new File([pdf as BlobPart], name, { type: 'application/pdf' }))
  return new NextRequest(request.url, { method, headers: { cookie: request.headers.get('cookie') ?? '' }, body: form })
}

// Each approver's QR and date go into the form's own box (by the position's name).
async function placeSignatures(doc: Saved) {
  const roles = (await listRoles('review_form')).filter((role) => doc.approval_roles.includes(role.code))
  const boxes = reviewBoxes(roles.map((role) => role.title))
  const slots: SignatureSlot[] = roles.flatMap((role, i) => (boxes[i] ? [{ role_code: role.code, ...REVIEW_SIGN_SLOTS[boxes[i]!] }] : []))
  await saveSlots(doc.id, doc.file_path, slots)
}

async function keepFields(documentId: number, data: ReviewFormData, username: string) {
  await query(
    `INSERT INTO document_review_forms (document_id, data, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [documentId, JSON.stringify(data), username]
  )
}

// The register handler e-mails the first approver before the form's fields
// are stored (keepFields needs the document it creates): hand them to the
// e-mail for the duration of the call, so its "Ringkasan form" is this form's.
async function whileSaving<T>(data: ReviewFormData, save: () => Promise<T>): Promise<T> {
  const key = data.formNo.toUpperCase()
  reviewFormsBeingSaved.set(key, data)
  try { return await save() } finally { reviewFormsBeingSaved.delete(key) }
}

const roleList = (raw: unknown) => JSON.stringify(Array.isArray(raw) ? raw.filter((code): code is string => typeof code === 'string') : [])

export async function POST(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    await ensureApprovalSchema()
    const body = await request.json().catch(() => ({}))
    const data = parseReviewForm(body.form)
    if (typeof data === 'string') return NextResponse.json({ message: data }, { status: 400 })

    const pdf = await buildReviewFormPdf(data)
    const res = await whileSaving(data, () => handlers.POST(asUpload(request, 'POST', data, pdf, {
      approvalRoles: roleList(body.approvalRoles),
      note: typeof body.note === 'string' ? body.note : '',
    })))
    if (!res.ok) return res
    const { document } = await res.json() as { document: Saved }

    await keepFields(document.id, data, session.username)
    // A review form is an internal record: not on the visitors' page unless the admin shows it.
    await query('UPDATE procedure_documents SET public_visible = false WHERE id = $1', [document.id])
    await placeSignatures(document)
    return NextResponse.json({ document: { ...document, public_visible: false } }, { status: 201 })
  } catch (error) {
    console.error('[form-review/POST]', error)
    return NextResponse.json({ message: 'Gagal menyimpan Form Review.' }, { status: 500 })
  }
}

// Editing regenerates the PDF — a new file, so the approval starts again
// (the previous file stays in the revision history).
export async function PUT(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    await ensureApprovalSchema()
    const body = await request.json().catch(() => ({}))
    const id = Number(body.id)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ message: 'ID form tidak valid.' }, { status: 400 })
    const data = parseReviewForm(body.form)
    if (typeof data === 'string') return NextResponse.json({ message: data }, { status: 400 })
    const existing = (await query<{ revision: number }>("SELECT revision FROM procedure_documents WHERE id = $1 AND kind = 'review_form'", [id])).rows[0]
    if (!existing) return NextResponse.json({ message: 'Form tidak ditemukan.' }, { status: 404 })

    const pdf = await buildReviewFormPdf(data)
    const res = await whileSaving(data, () => handlers.PUT(asUpload(request, 'PUT', data, pdf, {
      id: String(id),
      revision: String(existing.revision),
      approvalRoles: roleList(body.approvalRoles),
      note: typeof body.note === 'string' ? body.note : '',
    })))
    if (!res.ok) return res
    const payload = await res.json() as { document: Saved; approvalRestarted: boolean }

    await keepFields(id, data, session.username)
    await placeSignatures(payload.document)
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[form-review/PUT]', error)
    return NextResponse.json({ message: 'Gagal memperbarui Form Review.' }, { status: 500 })
  }
}
