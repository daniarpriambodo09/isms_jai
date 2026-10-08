// app/api/photo-video-requests/ledger/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'

type LedgerRow = {
  id: number
  request_type: 'internal' | 'visitor'
  nik: string | null
  requester_name: string
  dept_or_company: string
  dept: string | null
  dept_pic_kamera: string | null
  from_at: string
  to_at: string
  location: string
  objective: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  decided_at: string | null
  pic_approve_name: string | null
  camera_control_no: string | null
  photo_id_no: string | null
  camera_serial_no: string | null
  pic_jai: string | null
  escort_name: string | null
  escort_dept: string | null
  escort_set_by: string | null
  taken_at: string | null
}

// Public, read-only — a company-wide ledger of every photo/video request
// across all departments (not just the requester's own), mirroring the old
// intranet's "Ledger of Recording Photo/Video [All Dept./Section]" register
// so any department can browse it without an admin account. Deciding,
// editing, deleting etc. all still require the admin panel — this only
// ever reads.
// NIK is personal data, so the public copy shows it masked ("12****89"); only a
// logged-in ISM Admin / Lobby / Security session sees it in full.
function maskNik(nik: string | null): string | null {
  if (!nik) return nik
  return nik.length <= 4 ? '*'.repeat(nik.length) : `${nik.slice(0, 2)}${'*'.repeat(nik.length - 4)}${nik.slice(-2)}`
}

export async function GET(request: NextRequest) {
  try {
    const result = await query<LedgerRow>(
      `SELECT r.id, r.request_type, r.nik, r.requester_name, r.dept_or_company, r.dept, r.dept_pic_kamera,
              r.from_at, r.to_at, r.location, r.objective, r.status, r.submitted_at, r.decided_at,
              pic.name AS pic_approve_name, r.camera_control_no, r.photo_id_no, r.camera_serial_no, r.pic_jai,
              r.escort_name, r.escort_dept, r.escort_set_by, r.taken_at
       FROM photo_video_requests r
       LEFT JOIN pic_approvers pic ON pic.id = r.pic_approve_id
       ORDER BY r.submitted_at ASC`
    )
    const canSeeNik = !!getKioskAdminFromRequest(request)
    // Who picked the PIC Pendamping is an account name — staff only.
    const requests = canSeeNik ? result.rows : result.rows.map((row) => ({ ...row, nik: maskNik(row.nik), escort_set_by: null }))
    return NextResponse.json({ requests })
  } catch (error) {
    console.error('[photo-video-requests/ledger/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat rekap pengajuan.' }, { status: 500 })
  }
}
