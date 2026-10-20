// app/api/it-form-submissions/[id]/sign/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { signItFormStep } from '@/lib/it-form-service'
import { getAdminFromRequest } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const submissionId = Number(id)
    if (!submissionId) {
      return NextResponse.json({ error: 'ID Permohonan tidak valid' }, { status: 400 })
    }

    const body = await request.json()
    const { step_number, decision, approver_name, signature_note } = body

    if (!step_number || !decision) {
      return NextResponse.json({ error: 'Tahapan step dan keputusan approval wajib diisi' }, { status: 400 })
    }

    // Check if user is logged in admin or signing with valid name
    const admin = await getAdminFromRequest(request)
    const effectiveApprover = approver_name || admin?.username || 'Approver IT'

    const result = await signItFormStep(submissionId, Number(step_number), {
      decision: decision === 'reject' ? 'reject' : 'approve',
      approverName: effectiveApprover,
      signatureNote: signature_note,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error signing IT form step:', error)
    return NextResponse.json({ error: error.message || 'Gagal memproses tanda tangan' }, { status: 500 })
  }
}
