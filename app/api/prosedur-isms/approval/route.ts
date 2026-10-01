// app/api/prosedur-isms/approval/route.ts
//
// Public, token-secured — what the /pengesahan page (opened from the
// approver's email) talks to. The 24-byte random token is the credential;
// deciding is POST-only (so a mail client prefetching the link can never
// approve anything) and single-use (a step can only leave 'pending' once).

import { NextRequest, NextResponse } from 'next/server'
import { APPROVAL_LINK_DAYS, canPlaceOwnSlots, decideByToken, getByToken, latestRevisionRequest, linkExpired, parseRevisionNotes, qrAdjustableUntil, verifyBaseUrl } from '@/lib/procedure-approval'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? ''
  try {
    const view = await getByToken(token)
    if (!view) return NextResponse.json({ message: 'Link tidak ditemukan atau sudah tidak berlaku.' }, { status: 404 })
    // The last "Minta Revisi" on this document — its notes, whichever cycle
    // it came from (the page shows it as "what was asked to be fixed").
    const revisionRequest = await latestRevisionRequest(view.document.id)
    return NextResponse.json({
      revisionRequest,
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
      // Pending link older than APPROVAL_LINK_DAYS: can't decide any more.
      linkExpired: linkExpired(view.step),
      linkValidDays: APPROVAL_LINK_DAYS,
      // Whether (and until when) the approver may still move their own QR.
      canPlaceQr: canPlaceOwnSlots(view),
      qrAdjustableUntil: qrAdjustableUntil(view.step)?.toISOString() ?? null,
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
    // "Minta Revisi": notes pinned on the document, plus the general note above.
    const notes = action === 'reject' ? parseRevisionNotes(body.notes) : []
    if (!token || !action) return NextResponse.json({ message: 'Permintaan tidak valid.' }, { status: 400 })
    if (action === 'reject' && !note && !notes.some((n) => n.page !== null)) {
      return NextResponse.json({ message: 'Tuliskan minimal satu catatan revisi.' }, { status: 400 })
    }

    const result = await decideByToken(token, action, note, notes)
    return NextResponse.json({ message: result.message }, { status: result.ok ? 200 : 409 })
  } catch (error) {
    console.error('[prosedur-isms/approval/POST]', error)
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}
