// app/api/it-form-submissions/[id]/pdf/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { buildItFormPdf } from '@/lib/it-form-pdf'
import type { ItFormSubmission, ItFormSignature } from '@/lib/it-form-service'
import { API_BASE_PATH } from '@/lib/config'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const submissionId = Number(id)
    if (!submissionId) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    let subRecord: ItFormSubmission | null = null

    if (token) {
      const res = await query<ItFormSubmission>(
        `SELECT * FROM it_form_submissions WHERE id = $1 AND token = $2 LIMIT 1`,
        [submissionId, token]
      )
      if (res.rowCount && res.rowCount > 0) {
        subRecord = res.rows[0]
      }
    } else {
      const res = await query<ItFormSubmission>(
        `SELECT * FROM it_form_submissions WHERE id = $1 LIMIT 1`,
        [submissionId]
      )
      if (res.rowCount && res.rowCount > 0) {
        subRecord = res.rows[0]
      }
    }

    if (!subRecord) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan atau akses ditolak' }, { status: 404 })
    }

    const sigs = await query<ItFormSignature>(
      `SELECT * FROM it_form_signatures WHERE submission_id = $1 ORDER BY step_number ASC`,
      [subRecord.id]
    )
    subRecord.signatures = sigs.rows

    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const targetPath = subRecord.form_code === 'ISMS-F-02-00-002' ? '/registrasi-fingerprint' : '/form-it-esign'
    const verifyUrl = `${protocol}://${host}${API_BASE_PATH}${targetPath}?token=${subRecord.token || ''}`

    const pdfBytes = await buildItFormPdf(subRecord, verifyUrl)
    const filename = `${subRecord.form_code}-${subRecord.request_no}.pdf`

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    console.error('Error rendering IT form PDF:', error)
    return NextResponse.json({ error: 'Gagal membuat file PDF' }, { status: 500 })
  }
}
