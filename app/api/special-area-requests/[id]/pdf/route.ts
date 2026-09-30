// app/api/special-area-requests/[id]/pdf/route.ts
//
// The filled-in ISMS-F-006-001 form with the approver's QR. Available once
// decided, to kiosk roles, or to anyone holding the verification code (the
// link on the verification page / approval page).

import { NextRequest, NextResponse } from 'next/server'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { ensureSpecialAreaSchema, getRequest, verifyBaseUrl } from '@/lib/special-area'
import { buildSpecialAreaPdf } from '@/lib/special-area-pdf'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  try {
    await ensureSpecialAreaSchema()
    const req = await getRequest(Number(id))
    const code = request.nextUrl.searchParams.get('code')
    const allowed = !!getKioskAdminFromRequest(request) || (!!code && req?.verification_code === code)
    if (!req || !allowed) return NextResponse.json({ message: 'Dokumen tidak ditemukan atau kode verifikasi salah.' }, { status: 404 })
    if (req.status === 'pending' || !req.verification_code) return NextResponse.json({ message: 'Pengajuan belum diputuskan — form PDF belum tersedia.' }, { status: 400 })

    const bytes = await buildSpecialAreaPdf(req, `${await verifyBaseUrl(request.nextUrl.origin)}${req.verification_code}`)
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="ijin-area-special-${req.id}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[special-area-requests/[id]/pdf]', error)
    return NextResponse.json({ message: 'Gagal membuat PDF.' }, { status: 500 })
  }
}
