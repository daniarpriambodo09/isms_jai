import { NextRequest, NextResponse } from 'next/server'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'

type RequestType = 'internal' | 'visitor'
type Status = 'pending' | 'approved' | 'rejected'

type PhotoVideoRequestRow = {
  id: number
  request_type: RequestType
  nik: string | null
  requester_name: string
  dept_or_company: string
  dept: string | null
  dept_pic_kamera: string | null
  from_at: string
  to_at: string
  location: string
  objective: string
  status: Status
  submitted_at: string
  decided_at: string | null
  decided_by: string | null
  decision_note: string | null
  pic_approve_id: number | null
  pic_approve_name: string | null
  taken_at: string | null
  taken_ack_at: string | null
}

const REQUEST_TYPES: RequestType[] = ['internal', 'visitor']
const STATUSES: Status[] = ['pending', 'approved', 'rejected']

function isRequestType(value: unknown): value is RequestType { return typeof value === 'string' && (REQUEST_TYPES as string[]).includes(value) }
function isStatus(value: unknown): value is Status { return typeof value === 'string' && (STATUSES as string[]).includes(value) }

const SELECT_COLUMNS = `r.id, r.request_type, r.nik, r.requester_name, r.dept_or_company, r.dept, r.dept_pic_kamera,
  r.from_at, r.to_at, r.location, r.objective, r.status, r.submitted_at, r.decided_at, r.decided_by, r.decision_note,
  r.pic_approve_id, pic.name AS pic_approve_name, r.taken_at, r.taken_ack_at`
const FROM_CLAUSE = `photo_video_requests r LEFT JOIN pic_approvers pic ON pic.id = r.pic_approve_id`

// Read access is shared with the Lobby/Security kiosk roles (getKioskAdminFromRequest)
// so those pages/the notification bell can show a view-only copy of the
// requests — deciding (PUT below) stays ism_admin-only via getIsmsAdminFromRequest.
export async function GET(request: NextRequest) {
  if (!getKioskAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const typeParam = request.nextUrl.searchParams.get('type')
    const statusParam = request.nextUrl.searchParams.get('status')
    const awaitingAck = request.nextUrl.searchParams.get('awaitingAck') === '1'
    const conditions: string[] = []
    const values: string[] = []

    if (typeParam && isRequestType(typeParam)) { values.push(typeParam); conditions.push(`r.request_type = $${values.length}`) }
    if (statusParam && isStatus(statusParam)) { values.push(statusParam); conditions.push(`r.status = $${values.length}`) }
    if (awaitingAck) conditions.push(`r.taken_at IS NOT NULL AND r.taken_ack_at IS NULL`)

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await query<PhotoVideoRequestRow>(
      `SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} ${whereClause} ORDER BY r.submitted_at DESC`,
      values
    )
    return NextResponse.json({ requests: result.rows })
  } catch (error) {
    console.error('[photo-video-requests/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar pengajuan.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const requestType = body.requestType
    if (!isRequestType(requestType)) return NextResponse.json({ message: 'Tipe pengajuan tidak valid.' }, { status: 400 })

    const requesterName = typeof body.requesterName === 'string' ? body.requesterName.trim() : ''
    const deptOrCompany = typeof body.deptOrCompany === 'string' ? body.deptOrCompany.trim() : ''
    const location = typeof body.location === 'string' ? body.location.trim() : ''
    const objective = typeof body.objective === 'string' ? body.objective.trim() : ''
    const fromAt = typeof body.fromAt === 'string' ? body.fromAt : ''
    const toAt = typeof body.toAt === 'string' ? body.toAt : ''

    if (!requesterName) return NextResponse.json({ message: 'Nama wajib diisi.' }, { status: 400 })
    if (!deptOrCompany) return NextResponse.json({ message: 'Dept/Seksi atau Company wajib diisi.' }, { status: 400 })
    if (!location) return NextResponse.json({ message: 'Lokasi wajib diisi.' }, { status: 400 })
    if (!objective) return NextResponse.json({ message: 'Tujuan wajib diisi.' }, { status: 400 })
    if (!fromAt || Number.isNaN(Date.parse(fromAt))) return NextResponse.json({ message: 'Tanggal/jam mulai tidak valid.' }, { status: 400 })
    if (!toAt || Number.isNaN(Date.parse(toAt))) return NextResponse.json({ message: 'Tanggal/jam selesai tidak valid.' }, { status: 400 })
    if (new Date(toAt).getTime() < new Date(fromAt).getTime()) return NextResponse.json({ message: 'Tanggal/jam selesai harus setelah mulai.' }, { status: 400 })

    let nik: string | null = null
    let dept: string | null = null
    let deptPicKamera: string | null = null

    if (requestType === 'internal') {
      nik = typeof body.nik === 'string' && body.nik.trim() ? body.nik.trim() : null
      deptPicKamera = typeof body.deptPicKamera === 'string' ? body.deptPicKamera.trim() : ''
      if (!deptPicKamera) return NextResponse.json({ message: 'Dept. PIC Kamera wajib dipilih.' }, { status: 400 })
    } else {
      dept = typeof body.dept === 'string' ? body.dept.trim() : ''
      if (!dept) return NextResponse.json({ message: 'Department wajib diisi.' }, { status: 400 })
    }

    const picApproveId = Number(body.picApproveId)
    if (!Number.isInteger(picApproveId) || picApproveId <= 0) {
      return NextResponse.json({ message: 'PIC Approve wajib dipilih.' }, { status: 400 })
    }
    const picCheck = await query<{ id: number }>(`SELECT id FROM pic_approvers WHERE id = $1`, [picApproveId])
    if (picCheck.rows.length === 0) return NextResponse.json({ message: 'PIC Approve tidak valid.' }, { status: 400 })

    const result = await query<PhotoVideoRequestRow>(
      `INSERT INTO photo_video_requests
         (request_type, nik, requester_name, dept_or_company, dept, dept_pic_kamera, from_at, to_at, location, objective, pic_approve_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [requestType, nik, requesterName, deptOrCompany, dept, deptPicKamera, fromAt, toAt, location, objective, picApproveId]
    )
    const created = await query<PhotoVideoRequestRow>(
      `SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE r.id = $1`,
      [result.rows[0].id]
    )
    return NextResponse.json({ request: created.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[photo-video-requests/POST]', error)
    return NextResponse.json({ message: 'Gagal mengirim pengajuan.' }, { status: 500 })
  }
}
