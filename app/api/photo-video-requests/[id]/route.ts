import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getIsmsAdminFromRequest, getKioskAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

type Status = 'approved' | 'rejected'
const DECISION_STATUSES: Status[] = ['approved', 'rejected']
function isDecisionStatus(value: unknown): value is Status { return typeof value === 'string' && (DECISION_STATUSES as string[]).includes(value) }

const SELECT_COLUMNS = `r.id, r.request_type, r.nik, r.requester_name, r.dept_or_company, r.dept, r.dept_pic_kamera,
  r.from_at, r.to_at, r.location, r.objective, r.status, r.submitted_at, r.decided_at, r.decided_by, r.decision_note,
  r.pic_approve_id, pic.name AS pic_approve_name, r.taken_at, r.taken_ack_at, r.camera_control_no, r.photo_id_no`
const FROM_CLAUSE = `photo_video_requests r LEFT JOIN pic_approvers pic ON pic.id = r.pic_approve_id`

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getIsmsAdminFromRequest(request)
  if (!admin) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID pengajuan tidak valid.' }, { status: 400 })

  try {
    const result = await query(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE r.id = $1`, [id])
    if (result.rows.length === 0) return NextResponse.json({ message: 'Pengajuan tidak ditemukan.' }, { status: 404 })
    return NextResponse.json({ request: result.rows[0] })
  } catch (error) {
    console.error('[photo-video-requests/[id]/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat pengajuan.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getIsmsAdminFromRequest(request)
  if (!admin) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID pengajuan tidak valid.' }, { status: 400 })

  try {
    const body = await request.json()
    if (!isDecisionStatus(body.status)) return NextResponse.json({ message: 'Status keputusan tidak valid.' }, { status: 400 })
    const decisionNote = typeof body.decisionNote === 'string' && body.decisionNote.trim() ? body.decisionNote.trim() : null
    // Only meaningful when approving — recorded here (rather than on the
    // original submission) because it's the admin, not the requester, who
    // assigns which physical camera equipment gets issued, mirroring the
    // old system's approval screen.
    const cameraControlNo = typeof body.cameraControlNo === 'string' && body.cameraControlNo.trim() ? body.cameraControlNo.trim() : null
    const photoIdNo = typeof body.photoIdNo === 'string' && body.photoIdNo.trim() ? body.photoIdNo.trim() : null

    // Only a pending request can be decided — once approved/rejected, a
    // second PUT (e.g. someone re-opening the modal and misclicking) must
    // not silently flip the decision, especially after the photo/video may
    // already have been taken on the strength of the first decision.
    //
    // Also stamps a verification_code for Visitor requests decided here
    // (from the admin panel), same as the email approve/reject flow does —
    // otherwise a Visitor request an admin decided directly (rather than
    // via the emailed link) would have no code and its e-sign certificate
    // could never be generated.
    const verificationCode = `JAI-${id}-${randomBytes(4).toString('hex').toUpperCase()}`
    const updated = await query<{ id: number }>(
      `UPDATE photo_video_requests
       SET status = $1, decided_at = now(), decided_by = $2, decision_note = $3,
           camera_control_no = $5, photo_id_no = $6,
           verification_code = CASE WHEN request_type = 'visitor' THEN $7 ELSE verification_code END
       WHERE id = $4 AND status = 'pending'
       RETURNING id`,
      [body.status, admin.username, decisionNote, id, cameraControlNo, photoIdNo, verificationCode]
    )
    if (updated.rows.length === 0) {
      const existing = await query<{ status: string }>('SELECT status FROM photo_video_requests WHERE id = $1', [id])
      const message = existing.rows.length > 0
        ? 'Pengajuan ini sudah diputuskan sebelumnya dan tidak bisa diubah lagi.'
        : 'Pengajuan tidak ditemukan.'
      return NextResponse.json({ message }, { status: existing.rows.length > 0 ? 409 : 404 })
    }
    const result = await query(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE r.id = $1`, [id])
    return NextResponse.json({ request: result.rows[0] })
  } catch (error) {
    console.error('[photo-video-requests/[id]/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan keputusan.' }, { status: 500 })
  }
}

// Three narrow actions:
// - 'mark-taken' (ism_admin only): records that the photo/video has actually
//   been taken. PIC Approve is just a plain name on the request (no login of
//   its own), so this is what surfaces the "sudah diambil" notice in the
//   shared admin notification bell — there's no per-person approval step.
// - 'unmark-taken' (ism_admin only): undoes a 'mark-taken' done by mistake,
//   clearing both taken_at and any acknowledgement so it goes back to
//   looking like it hasn't been picked up yet.
// - 'dismiss-taken' (any admin who can see the list): clears that notice
//   once someone has seen it, same as clicking into any other notification.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID pengajuan tidak valid.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const action = body?.action

  if (action === 'mark-taken') {
    const admin = getIsmsAdminFromRequest(request)
    if (!admin) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

    const updated = await query<{ id: number }>(
      `UPDATE photo_video_requests SET taken_at = now(), taken_ack_at = NULL WHERE id = $1 AND status = 'approved' RETURNING id`,
      [id]
    )
    if (updated.rows.length === 0) return NextResponse.json({ message: 'Pengajuan tidak ditemukan atau belum disetujui.' }, { status: 404 })
    const result = await query(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE r.id = $1`, [id])
    return NextResponse.json({ request: result.rows[0] })
  }

  if (action === 'unmark-taken') {
    const admin = getIsmsAdminFromRequest(request)
    if (!admin) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

    const updated = await query<{ id: number }>(
      `UPDATE photo_video_requests SET taken_at = NULL, taken_ack_at = NULL WHERE id = $1 RETURNING id`,
      [id]
    )
    if (updated.rows.length === 0) return NextResponse.json({ message: 'Pengajuan tidak ditemukan.' }, { status: 404 })
    const result = await query(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE r.id = $1`, [id])
    return NextResponse.json({ request: result.rows[0] })
  }

  if (action === 'dismiss-taken') {
    if (!getKioskAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

    const updated = await query<{ id: number }>(
      `UPDATE photo_video_requests SET taken_ack_at = now() WHERE id = $1 RETURNING id`,
      [id]
    )
    if (updated.rows.length === 0) return NextResponse.json({ message: 'Pengajuan tidak ditemukan.' }, { status: 404 })
    return NextResponse.json({ message: 'Notifikasi ditutup.' })
  }

  return NextResponse.json({ message: 'Aksi tidak dikenali.' }, { status: 400 })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getIsmsAdminFromRequest(request)
  if (!admin) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID pengajuan tidak valid.' }, { status: 400 })

  try {
    const result = await query<{ id: number; requester_name: string }>(
      'DELETE FROM photo_video_requests WHERE id = $1 RETURNING id, requester_name',
      [id]
    )
    if (result.rows.length === 0) return NextResponse.json({ message: 'Pengajuan tidak ditemukan.' }, { status: 404 })

    await logActivity(admin, 'delete', 'photo_video_request', id, `Menghapus pengajuan foto/video dari "${result.rows[0].requester_name}"`)
    return NextResponse.json({ message: 'Pengajuan dihapus.' })
  } catch (error) {
    console.error('[photo-video-requests/[id]/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus pengajuan.' }, { status: 500 })
  }
}
