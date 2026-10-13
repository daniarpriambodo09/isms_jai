// app/api/admin/followups/route.ts
//
// ISM Admin only — for the dashboard:
//   ?what=qr                      signatures whose QR is not on the document yet
//   ?what=guests&year=&month=     the month's guest recap + cards out for more than a day

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { guestRecap, listUnplacedQr } from '@/lib/admin-followups'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    const what = request.nextUrl.searchParams.get('what')
    if (what === 'qr') return NextResponse.json({ documents: await listUnplacedQr() })
    if (what === 'guests') {
      // "this month" as the plant sees it
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))
      const year = Number.parseInt(request.nextUrl.searchParams.get('year') ?? '', 10) || now.getFullYear()
      const month = Number.parseInt(request.nextUrl.searchParams.get('month') ?? '', 10) || now.getMonth() + 1
      if (year < 2000 || year > 2100 || month < 1 || month > 12) return NextResponse.json({ message: 'Periode tidak valid.' }, { status: 400 })
      return NextResponse.json(await guestRecap(year, month))
    }
    return NextResponse.json({ message: 'Permintaan tidak dikenal.' }, { status: 400 })
  } catch (error) {
    console.error('[admin/followups]', error)
    return NextResponse.json({ message: 'Gagal memuat data.' }, { status: 500 })
  }
}
