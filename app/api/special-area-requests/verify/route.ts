// app/api/special-area-requests/verify/route.ts
// Public — what a scanned QR on the special area form resolves to.

import { NextRequest, NextResponse } from 'next/server'
import { getByCode } from '@/lib/special-area'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const req = await getByCode((request.nextUrl.searchParams.get('code') ?? '').trim().toUpperCase())
    if (!req) return NextResponse.json({ message: 'Kode verifikasi tidak ditemukan.' }, { status: 404 })
    return NextResponse.json({ request: req })
  } catch (error) {
    console.error('[special-area-requests/verify/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat data verifikasi.' }, { status: 500 })
  }
}
