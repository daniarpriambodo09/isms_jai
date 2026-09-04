import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'

type Status = 'approved' | 'rejected'
const DECISION_STATUSES: Status[] = ['approved', 'rejected']
function isDecisionStatus(value: unknown): value is Status { return typeof value === 'string' && (DECISION_STATUSES as string[]).includes(value) }

const SELECT_COLUMNS = `id, request_type, nik, requester_name, dept_or_company, dept, dept_pic_kamera,
  from_at, to_at, location, objective, status, submitted_at, decided_at, decided_by, decision_note`

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getIsmsAdminFromRequest(request)
  if (!admin) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID pengajuan tidak valid.' }, { status: 400 })

  try {
    const result = await query(`SELECT ${SELECT_COLUMNS} FROM photo_video_requests WHERE id = $1`, [id])
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

    const result = await query(
      `UPDATE photo_video_requests
       SET status = $1, decided_at = now(), decided_by = $2, decision_note = $3
       WHERE id = $4
       RETURNING ${SELECT_COLUMNS}`,
      [body.status, admin.username, decisionNote, id]
    )
    if (result.rows.length === 0) return NextResponse.json({ message: 'Pengajuan tidak ditemukan.' }, { status: 404 })
    return NextResponse.json({ request: result.rows[0] })
  } catch (error) {
    console.error('[photo-video-requests/[id]/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan keputusan.' }, { status: 500 })
  }
}
