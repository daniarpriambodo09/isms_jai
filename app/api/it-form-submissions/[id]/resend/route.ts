// app/api/it-form-submissions/[id]/resend/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { sendItFormApprovalEmail, type ItFormSubmission } from '@/lib/it-form-service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const subRes = await query<ItFormSubmission>('SELECT * FROM it_form_submissions WHERE id = $1', [id])
    const sub = subRes.rows[0]
    if (!sub) return NextResponse.json({ message: 'Permohonan formulir IT tidak ditemukan.' }, { status: 404 })

    if (sub.status !== 'pending') {
      return NextResponse.json({ message: `Permohonan sudah berstatus ${sub.status}.` }, { status: 400 })
    }

    const sent = await sendItFormApprovalEmail(sub.id, sub.current_step)
    if (!sent) {
      return NextResponse.json({ message: 'Gagal mengirim email pengesahan. Periksa pengaturan SMTP dan email approver.' }, { status: 502 })
    }

    return NextResponse.json({ success: true, message: `Email pengesahan untuk ${sub.request_no} (tahap ${sub.current_step}) berhasil dikirim ulang.` })
  } catch (error) {
    console.error('[it-form-submissions/[id]/resend]', error)
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Gagal mengirim ulang email.' }, { status: 500 })
  }
}
