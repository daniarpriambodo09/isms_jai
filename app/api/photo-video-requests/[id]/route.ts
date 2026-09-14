import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest, getKioskAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

type Status = 'approved' | 'rejected'
const DECISION_STATUSES: Status[] = ['approved', 'rejected']
function isDecisionStatus(value: unknown): value is Status { return typeof value === 'string' && (DECISION_STATUSES as string[]).includes(value) }

const SELECT_COLUMNS = `r.id, r.request_type, r.nik, r.requester_name, r.dept_or_company, r.dept, r.dept_pic_kamera,
  r.from_at, r.to_at, r.location, r.objective, r.status, r.submitted_at, r.decided_at, r.decided_by, r.decision_note,
  r.pic_approve_id, pic.name AS pic_approve_name, r.taken_at, r.taken_ack_at`
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

    const updated = await query<{ id: number }>(
      `UPDATE photo_video_requests
       SET status = $1, decided_at = now(), decided_by = $2, decision_note = $3
       WHERE id = $4
       RETURNING id`,
      [body.status, admin.username, decisionNote, id]
    )
    if (updated.rows.length === 0) return NextResponse.json({ message: 'Pengajuan tidak ditemukan.' }, { status: 404 })
    const result = await query(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE r.id = $1`, [id])
    return NextResponse.json({ request: result.rows[0] })
  } catch (error) {
    console.error('[photo-video-requests/[id]/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan keputusan.' }, { status: 500 })
  }
}

// Two narrow actions:
// - 'mark-taken' (ism_admin only): records that the photo/video has actually
//   been taken. PIC Approve is just a plain name on the request (no login of
//   its own), so this is what surfaces the "sudah diambil" notice in the
//   shared admin notification bell — there's no per-person approval step.
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
