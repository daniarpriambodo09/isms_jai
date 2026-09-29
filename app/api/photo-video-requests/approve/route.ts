// app/api/photo-video-requests/approve/route.ts
//
// Public, token-secured endpoint behind the Visitor approver's email
// buttons — no login. Security relies on the token being an unguessable
// 24-byte random value known only to the addressee of that one email, and on
// a decision being final once made (the link can't be replayed to flip it).
//
// Deciding is a POST, never a GET: mail scanners, link previewers and
// antivirus tools routinely open every link in an email with a GET, which
// used to approve or reject requests on their own before the approver ever
// looked. Now the email link (GET) only lands on a confirmation page, and
// the approver's own click on its button is what sends the POST.
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { query } from '@/lib/db'
import { isRateLimited } from '@/lib/rate-limit'
import { API_BASE_PATH } from '@/lib/config'

type Action = 'approve' | 'reject'

const isAction = (value: unknown): value is Action => value === 'approve' || value === 'reject'
const clientIp = (request: NextRequest) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'

// GET never changes anything.
// - ?preview=1: returns the request's details for the confirmation page.
// - otherwise: redirects to the confirmation page (this is what the button
//   URLs in already-sent emails still point at).
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const action = request.nextUrl.searchParams.get('action')

  if (request.nextUrl.searchParams.get('preview') === '1') {
    if (isRateLimited(`approve-preview:${clientIp(request)}`, 30, 60_000)) {
      return NextResponse.json({ message: 'Terlalu banyak percobaan. Coba lagi sebentar.' }, { status: 429 })
    }
    if (!token) return NextResponse.json({ message: 'Link tidak valid.' }, { status: 400 })
    try {
      const result = await query<{
        id: number; status: string; requester_name: string; dept_or_company: string; dept: string | null
        from_at: string; to_at: string; location: string; objective: string; pic_jai: string | null; verification_code: string | null
      }>(
        `SELECT id, status, requester_name, dept_or_company, dept, from_at, to_at, location, objective, pic_jai, verification_code
         FROM photo_video_requests WHERE approval_token = $1 AND request_type = 'visitor'`,
        [token]
      )
      const row = result.rows[0]
      if (!row) return NextResponse.json({ message: 'Link tidak ditemukan atau sudah tidak berlaku.' }, { status: 404 })
      // Already decided: hand back the verification code so the page can
      // send the approver straight to the result (same idempotent behavior
      // the email link always had).
      return NextResponse.json({ request: { ...row, verification_code: row.status === 'pending' ? null : row.verification_code } })
    } catch (error) {
      console.error('[photo-video-requests/approve/GET preview]', error)
      return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 })
    }
  }

  const target = new URL(`${request.nextUrl.origin}${API_BASE_PATH}/konfirmasi-approval`)
  if (token) target.searchParams.set('token', token)
  if (isAction(action)) target.searchParams.set('action', action)
  return NextResponse.redirect(target)
}

export async function POST(request: NextRequest) {
  if (isRateLimited(`approve-post:${clientIp(request)}`, 20, 60_000)) {
    return NextResponse.json({ message: 'Terlalu banyak percobaan. Coba lagi sebentar.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null) as { token?: unknown; action?: unknown } | null
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!token || !isAction(body?.action)) return NextResponse.json({ message: 'Link tidak valid.' }, { status: 400 })
  const action = body.action

  try {
    const requestRow = await query<{ id: number; status: string; pic_approve_id: number | null; verification_code: string | null }>(
      `SELECT id, status, pic_approve_id, verification_code FROM photo_video_requests WHERE approval_token = $1 AND request_type = 'visitor'`,
      [token]
    )
    const row = requestRow.rows[0]
    if (!row) return NextResponse.json({ message: 'Link tidak ditemukan atau sudah tidak berlaku.' }, { status: 404 })

    // Already decided earlier — report the existing outcome instead of an
    // error, and never flip it.
    if (row.status !== 'pending') {
      if (row.verification_code) return NextResponse.json({ id: row.id, code: row.verification_code, alreadyDecided: true })
      return NextResponse.json({ message: 'Pengajuan ini sudah diputuskan sebelumnya — link ini tidak berlaku lagi.' }, { status: 409 })
    }

    const picResult = await query<{ full_name: string | null; name: string; title: string | null }>(
      `SELECT full_name, name, title FROM pic_approvers WHERE id = $1`,
      [row.pic_approve_id]
    )
    const approverName = picResult.rows[0]?.full_name ?? picResult.rows[0]?.name ?? 'Approver'
    const approverTitle = picResult.rows[0]?.title ?? null

    const status = action === 'approve' ? 'approved' : 'rejected'
    const verificationCode = `JAI-${row.id}-${randomBytes(4).toString('hex').toUpperCase()}`

    const updated = await query<{ id: number }>(
      `UPDATE photo_video_requests
       SET status = $1, decided_at = now(), decided_by = $2, decided_by_title = $3, decision_note = $4, verification_code = $5
       WHERE id = $6 AND status = 'pending'
       RETURNING id`,
      [status, approverName, approverTitle, 'Diproses langsung dari email (tanpa login)', verificationCode, row.id]
    )
    if (updated.rows.length === 0) {
      // Raced with another decision between the SELECT above and this UPDATE.
      const raced = await query<{ verification_code: string | null }>(
        `SELECT verification_code FROM photo_video_requests WHERE id = $1`,
        [row.id]
      )
      const racedCode = raced.rows[0]?.verification_code
      if (racedCode) return NextResponse.json({ id: row.id, code: racedCode, alreadyDecided: true })
      return NextResponse.json({ message: 'Pengajuan ini sudah diputuskan sebelumnya — link ini tidak berlaku lagi.' }, { status: 409 })
    }

    return NextResponse.json({ id: row.id, code: verificationCode })
  } catch (error) {
    console.error('[photo-video-requests/approve/POST]', error)
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}
