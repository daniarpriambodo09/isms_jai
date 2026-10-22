// app/api/photo-video-requests/[id]/resend/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { resendPhotoVisitorApprovalEmail } from '@/lib/photo-notify'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  const session = getKioskAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const result = await resendPhotoVisitorApprovalEmail(Number(id))
  if (!result.success) {
    return NextResponse.json({ message: result.message }, { status: 502 })
  }

  return NextResponse.json({ success: true, message: result.message })
}
