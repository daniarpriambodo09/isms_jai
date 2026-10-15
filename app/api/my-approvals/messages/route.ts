// Active approval messages for the signed-in approver. Each message repeats
// the one-time code delivered in the approval e-mail.

import { NextRequest, NextResponse } from 'next/server'
import { listMyApprovalMessages, sessionAccount } from '@/lib/my-approvals'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const account = await sessionAccount(request)
    if (!account) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
    if (!account.email) return NextResponse.json({ email: null, messages: [] })
    return NextResponse.json({ email: account.email, messages: await listMyApprovalMessages(account.email) })
  } catch (error) {
    console.error('[my-approvals/messages/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat pesan persetujuan.' }, { status: 500 })
  }
}
