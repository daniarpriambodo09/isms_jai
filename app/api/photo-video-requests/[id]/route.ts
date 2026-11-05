import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getIsmsAdminFromRequest, getKioskAdminFromRequest, getItAdminFromRequest, getAnyAdminOrApproverFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'
import { notifyPhotoDecision } from '@/lib/photo-notify'
import { recordNotification } from '@/lib/admin-notifications'
import { parseEscort } from '@/lib/special-area-shared'
import { ensurePhotoVideoColumns } from '@/lib/photo-video-db'

type Status = 'approved' | 'rejected'
const DECISION_STATUSES: Status[] = ['approved', 'rejected']
function isDecisionStatus(value: unknown): value is Status { return typeof value === 'string' && (DECISION_STATUSES as string[]).includes(value) }

const SELECT_COLUMNS = `r.id, r.request_type, r.nik, r.requester_name, r.dept_or_company, r.dept, r.dept_pic_kamera,
  r.from_at, r.to_at, r.location, r.objective, r.status, r.submitted_at, r.decided_at, r.decided_by, r.decision_note,
  r.pic_approve_id, pic.name AS pic_approve_name, r.taken_at, r.taken_ack_at, r.camera_control_no, r.photo_id_no,
  r.usb_control_no, r.smart_device_control_no, r.returned_at, r.returned_by, r.return_notes,
  r.virus_check, r.delete_or_format,
  r.escort_name, r.escort_dept, r.escort_set_by,
  r.main_card_returned_at, COALESCE(r.companions, '[]'::jsonb) AS companions`
const FROM_CLAUSE = `photo_video_requests r LEFT JOIN pic_approvers pic ON pic.id = r.pic_approve_id`

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getKioskAdminFromRequest(request)
  if (!admin) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID pengajuan tidak valid.' }, { status: 400 })

  try {
    await ensurePhotoVideoColumns()
    const result = await query(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE r.id = $1`, [id])
    if (result.rows.length === 0) return NextResponse.json({ message: 'Pengajuan tidak ditemukan.' }, { status: 404 })
    return NextResponse.json({ request: result.rows[0] })
  } catch (error) {
    console.error('[photo-video-requests/[id]/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat pengajuan.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getItAdminFromRequest(request)
  if (!admin) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID pengajuan tidak valid.' }, { status: 400 })

  try {
    await ensurePhotoVideoColumns()
    const body = await request.json()
    if (!isDecisionStatus(body.status)) return NextResponse.json({ message: 'Status keputusan tidak valid.' }, { status: 400 })
    const decisionNote = typeof body.decisionNote === 'string' && body.decisionNote.trim() ? body.decisionNote.trim() : null
    // Only meaningful when approving — recorded here (rather than on the
    // original submission) because it's the admin, not the requester, who
    // assigns which physical camera equipment gets issued, mirroring the
    // old system's approval screen.
    const cameraControlNo = typeof body.cameraControlNo === 'string' && body.cameraControlNo.trim() ? body.cameraControlNo.trim() : null
    const photoIdNo = typeof body.photoIdNo === 'string' && body.photoIdNo.trim() ? body.photoIdNo.trim() : null
    const usbControlNo = typeof body.usbControlNo === 'string' && body.usbControlNo.trim() ? body.usbControlNo.trim() : null
    const smartDeviceControlNo = typeof body.smartDeviceControlNo === 'string' && body.smartDeviceControlNo.trim() ? body.smartDeviceControlNo.trim() : null

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
    // Resolve real approver's full name & title (e.g. Pak Tsu / Teguh Sunjoyo) instead of raw admin username
    const reqInfo = await query<{ pic_approve_id: number | null; request_type: string }>(
      `SELECT pic_approve_id, request_type FROM photo_video_requests WHERE id = $1`,
      [id]
    )
    let approverName: string | null = null
    let approverTitle: string | null = null
    const picId = reqInfo.rows[0]?.pic_approve_id

    if (picId) {
      const picRes = await query<{ full_name: string | null; name: string; title: string | null }>(
        `SELECT full_name, name, title FROM pic_approvers WHERE id = $1`,
        [picId]
      )
      if (picRes.rows[0]) {
        approverName = picRes.rows[0].full_name || picRes.rows[0].name
        approverTitle = picRes.rows[0].title
      }
    }

    if (!approverName) {
      const defPic = await query<{ full_name: string | null; name: string; title: string | null }>(
        `SELECT full_name, name, title FROM pic_approvers WHERE is_visitor_default = true LIMIT 1`
      )
      if (defPic.rows[0]) {
        approverName = defPic.rows[0].full_name || defPic.rows[0].name
        approverTitle = defPic.rows[0].title
      }
    }

    if (!approverName) {
      approverName = 'Teguh Sunjoyo'
      approverTitle = 'Information Assets Administrator'
    }

    let companionsJson: string | null = null
    if (Array.isArray(body.companions)) {
      const companions = body.companions
        .filter((c: unknown): c is Record<string, unknown> => typeof c === 'object' && c !== null && typeof (c as Record<string, unknown>).name === 'string' && ((c as Record<string, unknown>).name as string).trim().length > 0)
        .map((c: Record<string, unknown>) => ({
          name: String(c.name).trim().slice(0, 100),
          nik: typeof c.nik === 'string' && c.nik.trim() ? c.nik.trim().slice(0, 50) : null,
          photo_id_no: typeof c.photo_id_no === 'string' && c.photo_id_no.trim()
            ? c.photo_id_no.trim().slice(0, 50)
            : (typeof c.photoIdNo === 'string' && (c.photoIdNo as string).trim() ? (c.photoIdNo as string).trim().slice(0, 50) : null),
          returned_at: typeof c.returned_at === 'string' && c.returned_at ? c.returned_at : null,
        }))
      companionsJson = JSON.stringify(companions)
    }

    const verificationCode = `JAI-${id}-${randomBytes(4).toString('hex').toUpperCase()}`
    const updated = await query<{ id: number }>(
      `UPDATE photo_video_requests
       SET status = $1, decided_at = now(), decided_by = $2, decided_by_title = $3, decision_note = $4,
           camera_control_no = COALESCE($6, camera_control_no),
           photo_id_no = COALESCE($7, photo_id_no),
           usb_control_no = COALESCE($9, usb_control_no),
           smart_device_control_no = COALESCE($10, smart_device_control_no),
           verification_code = CASE WHEN request_type = 'visitor' THEN $8 ELSE verification_code END,
           companions = COALESCE($11::jsonb, companions)
       WHERE id = $5 AND status = 'pending'
       RETURNING id`,
      [body.status, approverName, approverTitle, decisionNote, id, cameraControlNo, photoIdNo, verificationCode, usbControlNo, smartDeviceControlNo, companionsJson]
    )
    if (updated.rows.length === 0) {
      const existing = await query<{ status: string }>('SELECT status FROM photo_video_requests WHERE id = $1', [id])
      const message = existing.rows.length > 0
        ? 'Pengajuan ini sudah diputuskan sebelumnya dan tidak bisa diubah lagi.'
        : 'Pengajuan tidak ditemukan.'
      return NextResponse.json({ message }, { status: existing.rows.length > 0 ? 409 : 404 })
    }
    // History entry + the result e-mail to the requester (when they left an address).
    await notifyPhotoDecision(Number(id), 'admin')
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
    const session = getAnyAdminOrApproverFromRequest(request)
    if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

    const updated = await query<{ id: number }>(
      `UPDATE photo_video_requests SET taken_at = now(), taken_ack_at = NULL WHERE id = $1 AND status <> 'rejected' RETURNING id`,
      [id]
    )
    if (updated.rows.length === 0) return NextResponse.json({ message: 'Pengajuan tidak ditemukan atau belum disetujui.' }, { status: 404 })
    const result = await query<{ requester_name: string; location: string }>(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE r.id = $1`, [id])
    // Shown live in the bell ("sudah diambil") until acknowledged — history only here.
    await recordNotification({
      kind: 'photo_taken', category: 'photo', historyOnly: true,
      title: `Foto/video sudah diambil — ${result.rows[0]?.requester_name ?? ''}`,
      body: `${result.rows[0]?.location ?? ''} · ditandai oleh ${session.username}`, href: '/kelola-permintaan-foto-video',
    })
    return NextResponse.json({ request: result.rows[0] })
  }

  if (action === 'unmark-taken') {
    const session = getAnyAdminOrApproverFromRequest(request)
    if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

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

  // Lobby / Pos Security (or the ISM Admin) pick, change or clear the PIC Pendamping.
  if (action === 'setEscort') {
    const staff = getKioskAdminFromRequest(request)
    if (!staff) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
    const escort = parseEscort(body)
    const updated = await query<{ requester_name: string }>(
      `UPDATE photo_video_requests SET escort_name = $1::text, escort_dept = $2::text,
         escort_set_by = CASE WHEN $1::text IS NULL THEN NULL ELSE $3::text END, escort_set_at = CASE WHEN $1::text IS NULL THEN NULL ELSE now() END
       WHERE id = $4 RETURNING requester_name`,
      [escort.name, escort.dept, staff.username, id]
    )
    if (updated.rows.length === 0) return NextResponse.json({ message: 'Pengajuan tidak ditemukan.' }, { status: 404 })
    await logActivity(staff, 'update', 'photo_video_request', id, escort.name
      ? `Menetapkan PIC pendamping JAI "${escort.name}${escort.dept ? ` (${escort.dept})` : ''}" untuk pengajuan foto/video "${updated.rows[0].requester_name}"`
      : `Menghapus PIC pendamping JAI pengajuan foto/video "${updated.rows[0].requester_name}"`)
    const result = await query(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE r.id = $1`, [id])
    return NextResponse.json({ request: result.rows[0] })
  }

  // Mark camera/USB returned — stamps actual return timestamp and updates to_at officially
  if (action === 'mark-returned') {
    const session = getAnyAdminOrApproverFromRequest(request)
    if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

    const returnTime = body?.returnTime && !Number.isNaN(Date.parse(body.returnTime))
      ? new Date(body.returnTime)
      : new Date()
    const returnNotes = typeof body?.returnNotes === 'string' && body.returnNotes.trim() ? body.returnNotes.trim() : null
    const returnedBy = typeof body?.returnedBy === 'string' && body.returnedBy.trim() ? body.returnedBy.trim() : session.username
    const virusCheck = Boolean(body?.virusCheck)
    const deleteOrFormat = typeof body?.deleteOrFormat === 'string' && body.deleteOrFormat.trim() ? body.deleteOrFormat.trim() : null

    const updated = await query<{ id: number; requester_name: string }>(
      `UPDATE photo_video_requests
       SET returned_at = $2,
           to_at = $2,
           returned_by = $3,
           return_notes = $4,
           virus_check = $5,
           delete_or_format = $6,
           status = CASE WHEN status = 'pending' THEN 'approved' ELSE status END,
           decided_at = COALESCE(decided_at, $2),
           decided_by = COALESCE(decided_by, $3),
           main_card_returned_at = $2,
           companions = COALESCE(
             (SELECT jsonb_agg(jsonb_set(c, '{returned_at}', to_jsonb($2::timestamptz)))
              FROM jsonb_array_elements(COALESCE(photo_video_requests.companions, '[]'::jsonb)) c),
             '[]'::jsonb
           )
       WHERE id = $1 AND status <> 'rejected'
       RETURNING id, requester_name`,
      [id, returnTime, returnedBy, returnNotes, virusCheck, deleteOrFormat]
    )
    if (updated.rows.length === 0) return NextResponse.json({ message: 'Pengajuan tidak ditemukan atau belum disetujui.' }, { status: 404 })

    await logActivity(session, 'update', 'photo_video_request', id, `Mencatat pengembalian kamera/USB "${updated.rows[0].requester_name}" oleh ${returnedBy} (Virus Check: ${virusCheck ? 'OK' : '-'}, Delete/Format: ${deleteOrFormat || '-'})`)
    const result = await query(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE r.id = $1`, [id])
    return NextResponse.json({ request: result.rows[0] })
  }

  // Revert camera/USB return
  if (action === 'unmark-returned') {
    const session = getAnyAdminOrApproverFromRequest(request)
    if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

    const updated = await query<{ id: number; requester_name: string }>(
      `UPDATE photo_video_requests
       SET returned_at = NULL,
           returned_by = NULL,
           return_notes = NULL,
           virus_check = FALSE,
           delete_or_format = NULL,
           main_card_returned_at = NULL,
           companions = COALESCE(
             (SELECT jsonb_agg(c - 'returned_at' || '{"returned_at": null}'::jsonb)
              FROM jsonb_array_elements(COALESCE(photo_video_requests.companions, '[]'::jsonb)) c),
             '[]'::jsonb
           )
       WHERE id = $1
       RETURNING id, requester_name`,
      [id]
    )
    if (updated.rows.length === 0) return NextResponse.json({ message: 'Pengajuan tidak ditemukan.' }, { status: 404 })

    await logActivity(session, 'update', 'photo_video_request', id, `Membatalkan tanda pengembalian kamera/USB "${updated.rows[0].requester_name}"`)
    const result = await query(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE r.id = $1`, [id])
    return NextResponse.json({ request: result.rows[0] })
  }

  return NextResponse.json({ message: 'Aksi tidak dikenali.' }, { status: 400 })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getItAdminFromRequest(request)
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
