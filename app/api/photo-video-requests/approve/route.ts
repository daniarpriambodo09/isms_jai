// app/api/photo-video-requests/approve/route.ts
//
// Public, token-secured endpoint — this is what the "Setujui"/"Tolak"
// buttons in the Visitor approver's email hit directly, with no login.
// Security relies entirely on the token being an unguessable 24-byte
// random value known only to the addressee of that one email, and on the
// action being a no-op once the request is no longer 'pending' (so the
// link can't be replayed to flip a decision after the fact, e.g. if it
// gets forwarded or a mail client prefetches it more than once).
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { query } from '@/lib/db'
import { API_BASE_PATH } from '@/lib/config'

type Action = 'approve' | 'reject'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const action = request.nextUrl.searchParams.get('action') as Action | null
  const origin = request.nextUrl.origin

  const fail = (message: string) =>
    NextResponse.redirect(`${origin}${API_BASE_PATH}/verifikasi/gagal?message=${encodeURIComponent(message)}`)

  if (!token || (action !== 'approve' && action !== 'reject')) {
    return fail('Link tidak valid.')
  }

  try {
    const requestRow = await query<{ id: number; status: string; pic_approve_id: number | null }>(
      `SELECT id, status, pic_approve_id FROM photo_video_requests WHERE approval_token = $1 AND request_type = 'visitor'`,
      [token]
    )
    const row = requestRow.rows[0]
    if (!row) return fail('Link tidak ditemukan atau sudah tidak berlaku.')
    if (row.status !== 'pending') return fail('Pengajuan ini sudah diputuskan sebelumnya — link ini tidak berlaku lagi.')

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
    if (updated.rows.length === 0) return fail('Pengajuan ini sudah diputuskan sebelumnya — link ini tidak berlaku lagi.')

    return NextResponse.redirect(`${origin}${API_BASE_PATH}/verifikasi/${row.id}?code=${verificationCode}`)
  } catch (error) {
    console.error('[photo-video-requests/approve/GET]', error)
    return fail('Terjadi kesalahan pada server.')
  }
}
