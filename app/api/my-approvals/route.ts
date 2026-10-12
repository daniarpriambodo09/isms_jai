// app/api/my-approvals/route.ts
//
// "Persetujuan Saya" — the approval requests sent to the logged-in account's
// e-mail address (any role: an Approver account, or an admin who also signs).

import { NextRequest, NextResponse } from 'next/server'
import { listMyApprovals, sessionAccount } from '@/lib/my-approvals'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const account = await sessionAccount(request)
    if (!account) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
    if (!account.email) return NextResponse.json({ email: null, pending: [], queued: [], recent: [] })
    return NextResponse.json({ email: account.email, ...(await listMyApprovals(account.email)) })
  } catch (error) {
    console.error('[my-approvals/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar persetujuan.' }, { status: 500 })
  }
}
