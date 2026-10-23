// app/api/photo-video-requests/[id]/pdf/route.ts
//
// Streams the e-sign certificate PDF for one decided Visitor request.
// Accessible by admins, callers with verification_code (QR or verify link),
// and general ledger viewers (/rekap-foto-video).
import { NextRequest, NextResponse } from 'next/server'
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
  escort_name: string | null
  escort_dept: string | null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })

  const code = request.nextUrl.searchParams.get('code')

  try {
    const result = await query<Row>(
      `SELECT id, requester_name, dept_or_company, dept, from_at, to_at, location, objective, status, decided_at, decided_by, decided_by_title, submitted_at, verification_code, camera_serial_no, escort_name, escort_dept
       FROM photo_video_requests WHERE id = $1 AND request_type = 'visitor'`,
      [id]
    )
    const row = result.rows[0]
    if (!row) return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })

    if (code && row.verification_code !== code) {
      return NextResponse.json({ message: 'Kode verifikasi tidak sesuai.' }, { status: 403 })
    }

    if (row.status === 'pending' || !row.decided_at || !row.decided_by || !row.verification_code) {
      return NextResponse.json({ message: 'Pengajuan ini belum diputuskan — surat pengajuan PDF belum tersedia.' }, { status: 400 })
    }

    const settings = await getSmtpSettings()
    const base = resolveAppBaseUrl(settings?.appUrl, request.nextUrl.origin)
    const verifyUrl = `${base}/isms-jai/verifikasi/${row.id}?code=${row.verification_code}`

    // Resolve the approver's full name and title from pic_approvers (e.g. Pak Tsu / Teguh Sunjoyo)
    const picResult = await query<{ full_name: string | null; name: string; title: string | null }>(
      `SELECT pic.full_name, pic.name, pic.title
       FROM photo_video_requests r
       LEFT JOIN pic_approvers pic ON pic.id = r.pic_approve_id
       WHERE r.id = $1`,
      [id]
    )
    const defApprover = await query<{ full_name: string | null; name: string; title: string | null }>(
      `SELECT full_name, name, title FROM pic_approvers WHERE is_visitor_default = true LIMIT 1`
    )

    const rawDecidedBy = (row.decided_by || '').trim()
    const isAdminGeneric = !rawDecidedBy || rawDecidedBy.toLowerCase() === 'admin' || rawDecidedBy.toLowerCase() === 'admin isms'

    const approverFullName = (!isAdminGeneric && rawDecidedBy)
      ? rawDecidedBy
      : picResult.rows[0]?.full_name || picResult.rows[0]?.name || defApprover.rows[0]?.full_name || defApprover.rows[0]?.name || 'Teguh Sunjoyo'

    const approverTitle = row.decided_by_title
      || picResult.rows[0]?.title
      || defApprover.rows[0]?.title
      || 'Information Assets Administrator'

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
        approverFullName,
        approverTitle,
        verificationCode: row.verification_code,
        submittedAt: row.submitted_at,
        cameraSerialNo: row.camera_serial_no,
        escort: row.escort_name ? `${row.escort_name}${row.escort_dept ? ` (${row.escort_dept})` : ''}` : null,
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
