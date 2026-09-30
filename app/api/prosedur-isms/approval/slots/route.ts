// app/api/prosedur-isms/approval/slots/route.ts
//
// Public, token-secured: lets an approver — who has no portal account — place
// their OWN QR signature(s) on the document from the /pengesahan page opened
// from their email. The link's token is the credential; it can only ever
// write placements for the role that token belongs to, and only while that
// step is still live (pending, or approved on the current revision).

import { NextRequest, NextResponse } from 'next/server'
import { canPlaceOwnSlots, getByToken, parseSlots, saveRoleSlots, slotsFor } from '@/lib/procedure-approval'
import { isRateLimited } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const clientIp = (request: NextRequest) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? ''
  try {
    const view = await getByToken(token)
    if (!view) return NextResponse.json({ message: 'Link tidak ditemukan atau sudah tidak berlaku.' }, { status: 404 })
    return NextResponse.json({
      document: { control_no: view.document.control_no, title: view.document.title, revision: view.document.revision, file_path: view.document.file_path },
      // Every role in this signing chain, so the others' spots can be shown
      // (read-only) next to the approver's own.
      roles: view.cycle.map((step) => ({ code: step.role_code, title: step.role_title, person_name: step.approver_name ?? '-' })),
      ownRole: view.step.role_code,
      editable: canPlaceOwnSlots(view),
      slots: await slotsFor(view.document.id, view.document.file_path),
    })
  } catch (error) {
    console.error('[prosedur-isms/approval/slots/GET]', error)
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  if (isRateLimited(`approval-slots:${clientIp(request)}`, 30, 60_000)) {
    return NextResponse.json({ message: 'Terlalu banyak percobaan. Coba lagi sebentar.' }, { status: 429 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const view = await getByToken(typeof body.token === 'string' ? body.token : '')
    if (!view) return NextResponse.json({ message: 'Link tidak ditemukan atau sudah tidak berlaku.' }, { status: 404 })
    if (!canPlaceOwnSlots(view)) {
      return NextResponse.json({ message: 'Posisi tanda tangan tidak dapat diubah lagi untuk link ini.' }, { status: 409 })
    }
    const own = view.step.role_code
    const slots = parseSlots(body.slots, [own])
    await saveRoleSlots(view.document.id, view.document.file_path, own, slots)
    return NextResponse.json({ slots: await slotsFor(view.document.id, view.document.file_path) })
  } catch (error) {
    console.error('[prosedur-isms/approval/slots/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan posisi tanda tangan.' }, { status: 500 })
  }
}
