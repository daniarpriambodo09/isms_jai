// app/api/photo-video-requests/verify/route.ts
//
// Public — backs both the /verifikasi/[id] confirmation page and anyone
// scanning the QR code printed on the e-sign PDF. Requires the exact
// verification_code (not just the id), so it doesn't turn into a way to
// browse every visitor's request by guessing small integers; an ISM Admin
// session bypasses that requirement since they're already authorized to
// see every request via the admin panel.
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'

const SELECT_COLUMNS = `r.id, r.requester_name, r.dept_or_company, r.dept, r.from_at, r.to_at, r.location, r.objective,
  r.status, r.submitted_at, r.decided_at, r.decided_by, r.verification_code`

export async function GET(request: NextRequest) {
  const idParam = request.nextUrl.searchParams.get('id')
  const code = request.nextUrl.searchParams.get('code')
  if (!idParam || !/^\d+$/.test(idParam)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })

  const isAdmin = !!getIsmsAdminFromRequest(request)
  if (!isAdmin && !code) return NextResponse.json({ message: 'Kode verifikasi wajib disertakan.' }, { status: 400 })

  try {
    const result = await query(
      `SELECT ${SELECT_COLUMNS} FROM photo_video_requests r WHERE r.id = $1 AND r.request_type = 'visitor'${isAdmin ? '' : ' AND r.verification_code = $2'}`,
      isAdmin ? [idParam] : [idParam, code]
    )
    const row = result.rows[0]
    if (!row) return NextResponse.json({ message: 'Dokumen tidak ditemukan atau kode verifikasi salah.' }, { status: 404 })
    if (row.status === 'pending') return NextResponse.json({ message: 'Pengajuan ini belum diputuskan.' }, { status: 400 })
    return NextResponse.json({ request: row })
  } catch (error) {
    console.error('[photo-video-requests/verify/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat data verifikasi.' }, { status: 500 })
  }
}
