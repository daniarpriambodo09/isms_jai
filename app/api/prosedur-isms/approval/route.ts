// app/api/prosedur-isms/approval/route.ts
//
// Public, token-secured — what the /pengesahan page (opened from the
// approver's email) talks to. The 24-byte random token is the credential;
// deciding is POST-only (so a mail client prefetching the link can never
// approve anything) and single-use (a step can only leave 'pending' once).

import { NextRequest, NextResponse } from 'next/server'
import { APPROVAL_LINK_DAYS, approvalCodeRequired, autoPlaceSlots, canPlaceOwnSlots, currentStepsFor, decideByToken, getByToken, linkExpired, replacedLink, revisionHistory, parseRevisionNotes, qrAdjustableUntil, slotsFor, placesQrItself, stepApproverEmail, verifyBaseUrl } from '@/lib/procedure-approval'
import { sessionOwnsStep } from '@/lib/my-approvals'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'



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
    // The approver never places a QR. Form Review and sheets on the boxed
    // template (Working Standard, Standard Requirement TMMIN) get their spots
    // from the portal (a sheet uploaded before that existed, when the link is
    // opened); any other document, from the Admin ISM ("Atur posisi QR").
    // qrAutoPlaced: this approver's QR has its place on the document already.
    if (placesQrItself(view.document.kind) && view.step.revision === view.document.revision) await autoPlaceSlots(view.document.id)
    const qrAutoPlaced = (await slotsFor(view.document.id, view.document.file_path)).some((slot) => slot.role_code === view.step.role_code)
    // Approving asks for the code from the e-mail (steps sent before codes existed don't).
    const code = await approvalCodeRequired(view.step.id)
    // An old link (its step was cancelled when the approval started again —
    // a new file, a Form Review added, other approvers): where this position
    // stands in the approval running now, so the page can say what to do.
    let now: { mine: 'pending' | 'waiting' | 'approved' | 'rejected' | 'none'; waitingFor: { title: string; name: string | null; review: boolean } | null; finished: boolean; revising: boolean } | null = null
    if (view.step.status === 'cancelled') {
      const steps = (await currentStepsFor([view.document.id])).get(view.document.id) ?? []
      const mine = steps.find((step) => step.role_code === view.step.role_code)
      // the one being waited for in this approver's own chain (Form Review / document)
      const inReview = (code: string) => (view.document.review_roles ?? []).includes(code)
      const pending = steps.find((step) => step.status === 'pending' && inReview(step.role_code) === inReview(view.step.role_code)) ?? steps.find((step) => step.status === 'pending')
      now = {
        mine: mine ? (mine.status as 'pending' | 'waiting' | 'approved' | 'rejected') : 'none',
        waitingFor: pending ? { title: pending.role_title, name: pending.approver_name, review: (view.document.review_roles ?? []).includes(pending.role_code) } : null,
        finished: steps.length > 0 && steps.every((step) => step.status === 'approved'),
        // someone asked for a revision: every request of this round stopped
        revising: steps.some((step) => step.status === 'rejected'),
      }
    }
    const signedIn = await sessionOwnsStep(request, await stepApproverEmail(view.step.id))
    let codeValue: string | null = null
    if (signedIn) {
      codeValue = (await query<{ approval_code: string | null }>('SELECT approval_code FROM procedure_approvals WHERE id = $1', [view.step.id])).rows[0]?.approval_code ?? null
    }

    return NextResponse.json({
      now,
      qrAutoPlaced,
      codeRequired: code.required,
      codeLocked: code.locked,
      signedIn,
      codeValue,
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
        has_review_form: !!view.document.review_form_path,
        // this approver signs the Form Review beside the document (not the document)
        signs_review: !!view.document.review_form_path && (view.document.review_roles ?? []).includes(view.step.role_code),
      },
      cycle: view.cycle,
      // "Tahap x dari y" counts within this approver's own chain — the Form
      // Review's approvers and the document's sign side by side.
      part: (() => {
        const review = view.document.review_form_path ? view.document.review_roles ?? [] : []
        const mine = view.cycle.filter((row) => review.includes(row.role_code) === review.includes(view.step.role_code))
        return { index: Math.max(1, mine.findIndex((row) => row.id === view.step.id) + 1), total: Math.max(1, mine.length) }
      })(),
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

    const code = typeof body.code === 'string' ? body.code.slice(0, 12) : null
    const result = await decideByToken(token, action, note, notes, code)
    return NextResponse.json({ message: result.message, codeError: result.codeError ?? false }, { status: result.ok ? 200 : result.codeError ? 400 : 409 })
  } catch (error) {
    console.error('[prosedur-isms/approval/POST]', error)
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}
