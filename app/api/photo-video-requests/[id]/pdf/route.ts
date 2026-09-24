// app/api/photo-video-requests/[id]/pdf/route.ts
//
// Streams the e-sign certificate PDF for one decided Visitor request.
// Access is the same rule as /verify: the caller needs either the exact
// verification_code (the "Download PDF" link from /verifikasi/[id], or the
// QR itself) or a kiosk session (ISM Admin, Lobby, or Security — the same
// roles that already get read access to the request list) so those panels
// can also offer the PDF without the viewer having to know the code.
import { NextRequest, NextResponse } from 'next/server'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { getSmtpSettings } from '@/lib/smtp'
import { buildEsignPdf } from '@/lib/esign-pdf'
import { resolveAppBaseUrl } from '@/lib/request-origin'

type Row = {
  id: number
  requester_name: string
  dept_or_company: string
  dept: string | null
  from_at: string
  to_at: string
  location: string
  objective: string
  status: 'pending' | 'approved' | 'rejected'
  decided_at: string | null
  decided_by: string | null
  decided_by_title: string | null
  submitted_at: string
  verification_code: string | null
  camera_serial_no: string | null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })

  const code = request.nextUrl.searchParams.get('code')
  const isAdmin = !!getKioskAdminFromRequest(request)
  if (!isAdmin && !code) return NextResponse.json({ message: 'Kode verifikasi wajib disertakan.' }, { status: 400 })

  try {
    const result = await query<Row>(
      `SELECT id, requester_name, dept_or_company, dept, from_at, to_at, location, objective, status, decided_at, decided_by, decided_by_title, submitted_at, verification_code, camera_serial_no
       FROM photo_video_requests WHERE id = $1 AND request_type = 'visitor'${isAdmin ? '' : ' AND verification_code = $2'}`,
      isAdmin ? [id] : [id, code]
    )
    const row = result.rows[0]
    if (!row) return NextResponse.json({ message: 'Dokumen tidak ditemukan atau kode verifikasi salah.' }, { status: 404 })
    if (row.status === 'pending' || !row.decided_at || !row.decided_by || !row.verification_code) {
      return NextResponse.json({ message: 'Pengajuan ini belum diputuskan — surat pengajuan PDF belum tersedia.' }, { status: 400 })
    }

    const settings = await getSmtpSettings()
    const base = resolveAppBaseUrl(settings?.appUrl, request.nextUrl.origin)
    const verifyUrl = `${base}/isms-jai/verifikasi/${row.id}?code=${row.verification_code}`

    const pdfBytes = await buildEsignPdf(
      {
        id: row.id,
        requesterName: row.requester_name,
        deptOrCompany: row.dept_or_company,
        dept: row.dept,
        fromAt: row.from_at,
        toAt: row.to_at,
        location: row.location,
        objective: row.objective,
        status: row.status as 'approved' | 'rejected',
        decidedAt: row.decided_at,
        approverFullName: row.decided_by,
        approverTitle: row.decided_by_title,
        verificationCode: row.verification_code,
        submittedAt: row.submitted_at,
        cameraSerialNo: row.camera_serial_no,
      },
      verifyUrl
    )

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="surat-pengajuan-ijin-foto-video-${row.id}.pdf"`,
      },
    })
  } catch (error) {
    console.error('[photo-video-requests/[id]/pdf/GET]', error)
    return NextResponse.json({ message: 'Gagal membuat PDF.' }, { status: 500 })
  }
}
