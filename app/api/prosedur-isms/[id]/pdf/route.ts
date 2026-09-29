// app/api/prosedur-isms/[id]/pdf/route.ts
//
// "PDF bertanda tangan": the original procedure PDF plus a Lembar Pengesahan
// page with each approver's QR signature (lib/procedure-esign-pdf.ts). Public,
// like the procedure files themselves — built on the fly, so it always shows
// the current state of the approval.

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { currentStepsFor, ensureApprovalSchema, verifyBaseUrl } from '@/lib/procedure-approval'
import { buildProcedureSignedPdf } from '@/lib/procedure-esign-pdf'

export const dynamic = 'force-dynamic'

type Row = { id: number; control_no: string; title: string; revision: number; elf_date: string; file_path: string; approval_status: 'none' | 'pending' | 'approved' | 'rejected' }

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })

  try {
    await ensureApprovalSchema()
    const result = await query<Row>(
      "SELECT id, control_no, title, revision, to_char(elf_date, 'YYYY-MM-DD') AS elf_date, file_path, approval_status FROM procedure_documents WHERE id = $1",
      [id]
    )
    const doc = result.rows[0]
    if (!doc) return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })

    const steps = (await currentStepsFor([doc.id])).get(doc.id) ?? []
    const bytes = await buildProcedureSignedPdf({
      controlNo: doc.control_no,
      title: doc.title,
      revision: doc.revision,
      effDate: doc.elf_date,
      filePath: doc.file_path,
      status: doc.approval_status,
      steps: steps.map((s) => ({ roleTitle: s.role_title, name: s.approver_name ?? '-', status: s.status, decidedAt: s.decided_at, verificationCode: s.verification_code, note: s.decision_note })),
      verifyBase: await verifyBaseUrl(request.nextUrl.origin),
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
