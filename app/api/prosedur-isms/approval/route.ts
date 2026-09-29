// app/api/prosedur-isms/approval/route.ts
//
// Public, token-secured — what the /pengesahan page (opened from the
// approver's email) talks to. The 24-byte random token is the credential;
// deciding is POST-only (so a mail client prefetching the link can never
// approve anything) and single-use (a step can only leave 'pending' once).

import { NextRequest, NextResponse } from 'next/server'
import { decideByToken, getByToken, verifyBaseUrl } from '@/lib/procedure-approval'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? ''
  try {
    const view = await getByToken(token)
    if (!view) return NextResponse.json({ message: 'Link tidak ditemukan atau sudah tidak berlaku.' }, { status: 404 })
    return NextResponse.json({
      step: view.step,
      document: {
        control_no: view.document.control_no,
        title: view.document.title,
        revision: view.document.revision,
        elf_date: view.document.elf_date,
        note: view.document.note,
        file_path: view.document.file_path,
      },
      cycle: view.cycle,
      superseded: view.step.revision !== view.document.revision,
      documentId: view.document.id,
      verifyBase: await verifyBaseUrl(request.nextUrl.origin),
    })
  } catch (error) {
    console.error('[prosedur-isms/approval/GET]', error)
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
    console.error('[prosedur-isms/approval/POST]', error)
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}
