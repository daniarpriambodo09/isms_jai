// app/api/prosedur-isms/verify/route.ts
//
// Public — what a scanned signature QR resolves to (via /verifikasi-pengesahan).
// Needs the exact code (PRS-<id>-<8 hex>), so it can't be used to enumerate.

import { NextRequest, NextResponse } from 'next/server'
import { getSignature } from '@/lib/procedure-approval'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const code = (request.nextUrl.searchParams.get('code') ?? '').trim().toUpperCase()
  try {
    const signature = await getSignature(code)
    if (!signature) return NextResponse.json({ message: 'Kode tanda tangan tidak ditemukan.' }, { status: 404 })
    return NextResponse.json({ signature })
  } catch (error) {
    console.error('[prosedur-isms/verify/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat data verifikasi.' }, { status: 500 })
  }
}
