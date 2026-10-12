// app/api/my-approvals/history/route.ts
//
// "Persetujuan Saya" → Riwayat: everything the logged-in account has decided,
// newest first, searchable by control number or title. ?q=&page=

import { NextRequest, NextResponse } from 'next/server'
import { listMyHistory, sessionAccount } from '@/lib/my-approvals'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const account = await sessionAccount(request)
    if (!account) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
    if (!account.email) return NextResponse.json({ items: [], total: 0, page: 1, pages: 1, pageSize: 20 })
    const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100)
    const outcome = request.nextUrl.searchParams.get('outcome')
    const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10) || 1)
    return NextResponse.json(await listMyHistory(account.email, { q, page, outcome: outcome === 'approved' || outcome === 'rejected' ? outcome : null }))
  } catch (error) {
    console.error('[my-approvals/history]', error)
    return NextResponse.json({ message: 'Gagal memuat riwayat persetujuan.' }, { status: 500 })
  }
}
