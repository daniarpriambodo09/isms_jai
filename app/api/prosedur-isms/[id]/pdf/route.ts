// app/api/prosedur-isms/[id]/pdf/route.ts
//
// "PDF bertanda tangan": the original procedure PDF with each approver's QR
// signature stamped into its own signature column (lib/procedure-esign-pdf.ts).
// Built on the fly, so it always shows the current state of the approval:
// approver 2 sees approver 1's QR already in place, and so on. Public once
// final, like the procedure files themselves.

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { approverInitials, autoPlaceSlots, currentStepsFor, ensureApprovalSchema, slotsFor, usesSignatureBoxes, verifyBaseUrl } from '@/lib/procedure-approval'
import { detectInitials } from '@/lib/auto-slots'
import { getAdminFromRequest, getIsmsAdminFromRequest } from '@/lib/auth'
import { buildProcedureSignedPdf } from '@/lib/procedure-esign-pdf'
import { docKindInfo, type DocKind } from '@/lib/document-kinds'
import { REVIEW_DATE_SLASHES } from '@/lib/review-form-pdf'

export const dynamic = 'force-dynamic'

type Row = { id: number; kind: string; control_no: string; title: string; revision: number; elf_date: string; file_path: string; approval_status: 'none' | 'pending' | 'approved' | 'rejected'; public_visible: boolean }

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })

  try {
    await ensureApprovalSchema()
    const result = await query<Row>(
      "SELECT id, kind, control_no, title, revision, to_char(elf_date, 'YYYY-MM-DD') AS elf_date, file_path, approval_status, public_visible FROM procedure_documents WHERE id = $1",
      [id]
    )
    const doc = result.rows[0]
    if (!doc) return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })
    // Not published (waiting / sent back, or hidden by the admin): admins, or
    // an approver of this document with the token from their email link —
    // same 404 otherwise.
    const published = (doc.approval_status === 'approved' || doc.approval_status === 'none') && doc.public_visible
    if (!published && !getAdminFromRequest(request)) {
      const token = request.nextUrl.searchParams.get('token') ?? ''
      const allowed = token && (await query("SELECT 1 FROM procedure_approvals WHERE document_id = $1 AND token = $2 AND status <> 'cancelled'", [doc.id, token.slice(0, 100)])).rowCount
      if (!allowed) return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })
    }

    const steps = (await currentStepsFor([doc.id])).get(doc.id) ?? []
    // ?preview=1 (ISM Admin only): every role shown as signed with a sample QR,
    // to check the QR placement before anyone has actually approved.
    const preview = request.nextUrl.searchParams.get('preview') === '1' && !!getIsmsAdminFromRequest(request)
    // A sheet uploaded before QR spots were placed automatically gets them now.
    const boxed = usesSignatureBoxes(doc.kind as DocKind)
    if (boxed) await autoPlaceSlots(doc.id)
    // The initials row under the boxes: the approvers chosen for this document
    // (a box nobody signs in is left blank). Skipped when the row isn't found.
    // A document without e-sign, or whose positions match none of the boxes
    // (custom titles, QR placed by hand), keeps the sheet's own initials.
    const cells = boxed && steps.length
      ? await detectInitials(doc.file_path, steps.map((s) => ({ title: s.role_title, step: s })), ({ step }) => approverInitials(step.approver_initials, step.approver_name))
        .catch((error) => { console.error('[prosedur-isms/pdf] initials', (error as Error).message); return [] })
      : []
    const initials = cells.some((cell) => cell.text) ? cells : []
    const bytes = await buildProcedureSignedPdf({
      kindLabel: docKindInfo(doc.kind).label,
      controlNo: doc.control_no,
      title: doc.title,
      revision: doc.revision,
      effDate: doc.elf_date,
      filePath: doc.file_path,
      status: preview ? 'approved' : doc.approval_status,
      steps: steps.map((s) => preview
        ? { roleCode: s.role_code, roleTitle: s.role_title, name: s.approver_name ?? '-', status: 'approved' as const, decidedAt: new Date().toISOString(), verificationCode: 'PRATINJAU', note: null }
        : { roleCode: s.role_code, roleTitle: s.role_title, name: s.approver_name ?? '-', status: s.status, decidedAt: s.decided_at, verificationCode: s.verification_code, note: s.decision_note }),
      verifyBase: await verifyBaseUrl(request.nextUrl.origin),
      slots: await slotsFor(doc.id, doc.file_path),
      // Form Review: the date goes on the form's own "/  /" line under the QR.
      dateSlashes: doc.kind === 'review_form' ? REVIEW_DATE_SLASHES : null,
      initials,
    })

    const filename = `pengesahan-${doc.control_no}-rev${doc.revision}.pdf`.replace(/[^A-Za-z0-9._-]/g, '_')
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"`, 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[prosedur-isms/[id]/pdf/GET]', error)
    return NextResponse.json({ message: 'Gagal membuat PDF.' }, { status: 500 })
  }
}
