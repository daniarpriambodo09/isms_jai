import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import path from 'path'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { getSmtpSettings, sendMail } from '@/lib/smtp'
import { buildVisitorApprovalEmail, LOGO_CID } from '@/lib/email-templates'

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
  camera_control_no: string | null
  photo_id_no: string | null
  pic_jai: string | null
}

const REQUEST_TYPES: RequestType[] = ['internal', 'visitor']
const STATUSES: Status[] = ['pending', 'approved', 'rejected']

function isRequestType(value: unknown): value is RequestType { return typeof value === 'string' && (REQUEST_TYPES as string[]).includes(value) }
function isStatus(value: unknown): value is Status { return typeof value === 'string' && (STATUSES as string[]).includes(value) }

const SELECT_COLUMNS = `r.id, r.request_type, r.nik, r.requester_name, r.dept_or_company, r.dept, r.dept_pic_kamera,
  r.from_at, r.to_at, r.location, r.objective, r.status, r.submitted_at, r.decided_at, r.decided_by, r.decision_note,
  r.pic_approve_id, pic.name AS pic_approve_name, r.taken_at, r.taken_ack_at, r.camera_control_no, r.photo_id_no, r.pic_jai`
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
    if (objective.length > 2000) return NextResponse.json({ message: 'Tujuan maksimal 2000 karakter.' }, { status: 400 })
    if (!fromAt || Number.isNaN(Date.parse(fromAt))) return NextResponse.json({ message: 'Tanggal/jam mulai tidak valid.' }, { status: 400 })
    if (!toAt || Number.isNaN(Date.parse(toAt))) return NextResponse.json({ message: 'Tanggal/jam selesai tidak valid.' }, { status: 400 })
    if (new Date(toAt).getTime() < new Date(fromAt).getTime()) return NextResponse.json({ message: 'Tanggal/jam selesai harus setelah mulai.' }, { status: 400 })

    let nik: string | null = null
    let dept: string | null = null
    let cameraSerialNo: string | null = null
    let deptPicKamera: string | null = null
    let cameraControlNo: string | null = null
    let picJai: string | null = null
    let photoIdNo: string | null = null
    let picApproveId: number

    if (requestType === 'internal') {
      nik = typeof body.nik === 'string' && body.nik.trim() ? body.nik.trim() : null
      deptPicKamera = typeof body.deptPicKamera === 'string' ? body.deptPicKamera.trim() : ''
      if (!deptPicKamera) return NextResponse.json({ message: 'Dept. PIC Kamera wajib dipilih.' }, { status: 400 })

      cameraControlNo = typeof body.cameraControlNo === 'string' ? body.cameraControlNo.trim() : ''
      if (!cameraControlNo) return NextResponse.json({ message: 'No. Kontrol Kamera wajib dipilih.' }, { status: 400 })
      // Cross-check against the roster (rather than trusting the client's
      // string outright) — must actually exist and belong to the chosen
      // Dept. PIC Kamera, or be one of the department-agnostic cameras.
      const cameraCheck = await query<{ id: number }>(
        `SELECT ce.id FROM camera_equipment ce
         LEFT JOIN departments d ON d.id = ce.department_id
         WHERE ce.code = $1 AND (ce.department_id IS NULL OR d.name = $2)`,
        [cameraControlNo, deptPicKamera]
      )
      if (cameraCheck.rows.length === 0) return NextResponse.json({ message: 'No. Kontrol Kamera tidak valid untuk departemen ini.' }, { status: 400 })

      photoIdNo = typeof body.photoIdNo === 'string' ? body.photoIdNo.trim() : ''
      if (!photoIdNo) return NextResponse.json({ message: 'No. ID Photography wajib dipilih.' }, { status: 400 })
      const photoIdCheck = await query<{ id: number }>(
        `SELECT p.id FROM photo_id_equipment p
         LEFT JOIN departments d ON d.id = p.department_id
         WHERE p.code = $1 AND (p.department_id IS NULL OR d.name = $2)`,
        [photoIdNo, deptPicKamera]
      )
      if (photoIdCheck.rows.length === 0) return NextResponse.json({ message: 'No. ID Photography tidak valid untuk departemen ini.' }, { status: 400 })

      picApproveId = Number(body.picApproveId)
      if (!Number.isInteger(picApproveId) || picApproveId <= 0) {
        return NextResponse.json({ message: 'PIC Approve wajib dipilih.' }, { status: 400 })
      }
      const picCheck = await query<{ id: number }>(`SELECT id FROM pic_approvers WHERE id = $1`, [picApproveId])
      if (picCheck.rows.length === 0) return NextResponse.json({ message: 'PIC Approve tidak valid.' }, { status: 400 })
    } else {
      dept = typeof body.dept === 'string' ? body.dept.trim() : ''
      if (!dept) return NextResponse.json({ message: 'Department wajib diisi.' }, { status: 400 })
      cameraSerialNo = typeof body.cameraSerialNo === 'string' && body.cameraSerialNo.trim() ? body.cameraSerialNo.trim() : null

      picJai = typeof body.picJai === 'string' ? body.picJai.trim() : ''
      if (!picJai) return NextResponse.json({ message: 'PIC JAI wajib diisi.' }, { status: 400 })
      photoIdNo = typeof body.photoIdNo === 'string' && body.photoIdNo.trim() ? body.photoIdNo.trim() : null

      // Visitor requests don't let the requester pick a PIC — they're always
      // routed to whichever PIC an ISM Admin has marked as the Visitor
      // default (see /api/pic-approvers/visitor-default), so the client's
      // own picApproveId (if any) is ignored here.
      const visitorPic = await query<{ id: number }>(`SELECT id FROM pic_approvers WHERE is_visitor_default = true LIMIT 1`)
      if (visitorPic.rows.length === 0) {
        return NextResponse.json({ message: 'Approver untuk pengajuan Visitor belum diatur. Hubungi Admin ISM.' }, { status: 400 })
      }
      picApproveId = visitorPic.rows[0].id
    }

    // Only Visitor requests get a token — it's what lets the approver act
    // straight from the email link without logging in (see the
    // approve/reject route).
    const approvalToken = requestType === 'visitor' ? randomBytes(24).toString('hex') : null

    // Internal requests skip the admin decision step entirely — picking a
    // real PIC Approve, camera, and ID Photography at submission time IS
    // the approval, so the row is inserted already 'approved' instead of
    // 'pending'. Visitor keeps the normal pending -> approved/rejected flow,
    // decided externally via the emailed approve/reject link.
    const status = requestType === 'internal' ? 'approved' : 'pending'
    const decidedAt = requestType === 'internal' ? 'now()' : 'NULL'
    const decisionNote = requestType === 'internal' ? 'Disetujui otomatis saat pengajuan (Internal) — tidak melalui approval admin.' : null

    const result = await query<PhotoVideoRequestRow>(
      `INSERT INTO photo_video_requests
         (request_type, nik, requester_name, dept_or_company, dept, dept_pic_kamera, from_at, to_at, location, objective, pic_approve_id, approval_token, camera_serial_no, camera_control_no, pic_jai, photo_id_no, status, decided_at, decision_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, ${decidedAt}, $18)
       RETURNING id`,
      [requestType, nik, requesterName, deptOrCompany, dept, deptPicKamera, fromAt, toAt, location, objective, picApproveId, approvalToken, cameraSerialNo, cameraControlNo, picJai, photoIdNo, status, decisionNote]
    )
    const created = await query<PhotoVideoRequestRow>(
      `SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE r.id = $1`,
      [result.rows[0].id]
    )

    if (requestType === 'visitor') {
      await notifyVisitorApprover({ ...created.rows[0], approval_token: approvalToken }, request.nextUrl.origin)
    }

    return NextResponse.json({ request: created.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[photo-video-requests/POST]', error)
    return NextResponse.json({ message: 'Gagal mengirim pengajuan.' }, { status: 500 })
  }
}

// Best-effort email to the configured Visitor approver — failures are
// logged, never surfaced to the requester, since the submission itself
// already succeeded (the DB row is the source of truth either way).
async function notifyVisitorApprover(requestRow: PhotoVideoRequestRow & { approval_token: string | null }, requestOrigin: string) {
  try {
    const picResult = await query<{ email: string | null }>(
      `SELECT email FROM pic_approvers WHERE id = $1`,
      [requestRow.pic_approve_id]
    )
    const pic = picResult.rows[0]
    if (!pic?.email) return

    const settings = await getSmtpSettings()
    if (!settings || !settings.host || !settings.port || !settings.senderEmail) return
    if (!requestRow.approval_token) return

    // Prefer the host:port this submission actually came in on (guaranteed
    // reachable, and includes the right port) over the admin-configured App
    // URL, which is easy to leave without a port — see the matching note
    // in [id]/pdf/route.ts.
    const base = requestOrigin || settings.appUrl?.replace(/\/$/, '') || ''
    const approveUrl = `${base}/isms-jai/api/photo-video-requests/approve?token=${requestRow.approval_token}&action=approve`
    const rejectUrl = `${base}/isms-jai/api/photo-video-requests/approve?token=${requestRow.approval_token}&action=reject`

    const { subject, html } = buildVisitorApprovalEmail({
      requesterName: requestRow.requester_name,
      deptOrCompany: requestRow.dept_or_company,
      dept: requestRow.dept,
      fromAt: requestRow.from_at,
      toAt: requestRow.to_at,
      location: requestRow.location,
      objective: requestRow.objective,
      picJai: requestRow.pic_jai ?? '-',
      approveUrl,
      rejectUrl,
    })

    // Attached (not linked) — see the comment on LOGO_CID for why an
    // external <img src> can never load here.
    await sendMail(settings, {
      to: pic.email,
      subject,
      html,
      attachments: [{ filename: 'yazaki-logo.jpg', path: path.join(process.cwd(), 'public', 'images', 'yazaki-logo.jpg'), cid: LOGO_CID }],
    })
  } catch (error) {
    console.error('[photo-video-requests/notifyVisitorApprover]', error)
  }
}
