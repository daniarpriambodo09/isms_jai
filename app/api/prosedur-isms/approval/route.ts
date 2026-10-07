// app/api/prosedur-isms/approval/route.ts
//
// Public, token-secured — what the /pengesahan page (opened from the
// approver's email) talks to. The 24-byte random token is the credential;
// deciding is POST-only (so a mail client prefetching the link can never
// approve anything) and single-use (a step can only leave 'pending' once).

import { NextRequest, NextResponse } from 'next/server'
import { APPROVAL_LINK_DAYS, autoPlaceSlots, canPlaceOwnSlots, decideByToken, getByToken, linkExpired, replacedLink, revisionHistory, parseRevisionNotes, qrAdjustableUntil, slotsFor, verifyBaseUrl } from '@/lib/procedure-approval'
import type { DocKind } from '@/lib/document-kinds'

export const dynamic = 'force-dynamic'

const AUTO_PLACED_KINDS: DocKind[] = ['review_form', 'working_standard']

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? ''
  try {
    const view = await getByToken(token)
    if (!view) {
      // An older link of a request that was sent again to another address.
      const replaced = await replacedLink(token)
      if (replaced) return NextResponse.json({ message: 'Link ini sudah diganti dengan link baru.', replaced }, { status: 410 })
      return NextResponse.json({ message: 'Link tidak ditemukan atau sudah tidak berlaku.' }, { status: 404 })
    }
    // The last "Minta Revisi" on this document — its notes, whichever cycle
    // it came from (the page shows it as "what was asked to be fixed").
    // Plus the earlier files, to compare a fix with what was marked.
    const history = await revisionHistory(view.document.id)
    // Form Review and Working Standard have a fixed template: the approver's QR
    // spot is already set by the portal, so approving needs no placing step.
    // (A Working Standard uploaded before that existed gets its spots when the link is opened.)
    if (view.document.kind === 'working_standard' && view.step.revision === view.document.revision) await autoPlaceSlots(view.document.id)
    const qrAutoPlaced = AUTO_PLACED_KINDS.includes(view.document.kind)
      && (await slotsFor(view.document.id, view.document.file_path)).some((slot) => slot.role_code === view.step.role_code)
    return NextResponse.json({
      qrAutoPlaced,
      revisionRequest: history?.requests[0] ?? null,
      history,
      step: view.step,
      document: {
        kind: view.document.kind,
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
