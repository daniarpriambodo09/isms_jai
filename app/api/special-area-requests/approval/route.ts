// app/api/special-area-requests/approval/route.ts
//
// Public, token-secured — backs the /persetujuan-area-special page opened
// from the approver's email. Deciding is POST-only and single-use.

import { NextRequest, NextResponse } from 'next/server'
import { decideByToken, getByToken } from '@/lib/special-area'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const req = await getByToken(request.nextUrl.searchParams.get('token') ?? '')
    if (!req) return NextResponse.json({ message: 'Link tidak ditemukan atau sudah tidak berlaku.' }, { status: 404 })
    return NextResponse.json({ request: req })
  } catch (error) {
    console.error('[special-area-requests/approval/GET]', error)
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = typeof body.token === 'string' ? body.token : ''
    const action = body.action === 'approve' || body.action === 'reject' ? body.action : null
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 1000) : null
    if (!token || !action) return NextResponse.json({ message: 'Permintaan tidak valid.' }, { status: 400 })
    if (action === 'reject' && !note) return NextResponse.json({ message: 'Alasan penolakan wajib diisi.' }, { status: 400 })
    const result = await decideByToken(token, action, note)
    return NextResponse.json({ message: result.message }, { status: result.ok ? 200 : 409 })
  } catch (error) {
    console.error('[special-area-requests/approval/POST]', error)
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}
