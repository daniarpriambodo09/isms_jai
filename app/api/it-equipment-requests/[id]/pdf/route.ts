// app/api/it-equipment-requests/[id]/pdf/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import { buildItEquipmentPdf } from '@/lib/it-equipment-pdf'
import type { ItEquipmentRequest } from '@/lib/it-equipment-shared'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    let reqRecord: ItEquipmentRequest | null = null

    if (token) {
      const res = await query<ItEquipmentRequest>(
        `SELECT * FROM it_equipment_requests WHERE id = $1 AND token = $2 LIMIT 1`,
        [id, token]
      )
      if (res.rowCount && res.rowCount > 0) {
        reqRecord = res.rows[0]
      }
    } else {
      const admin = await getAdminFromRequest(request)
      if (admin) {
        const res = await query<ItEquipmentRequest>(
          `SELECT * FROM it_equipment_requests WHERE id = $1 LIMIT 1`,
          [id]
        )
        if (res.rowCount && res.rowCount > 0) {
          reqRecord = res.rows[0]
        }
      }
    }

    if (!reqRecord) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan atau akses ditolak' }, { status: 404 })
    }

    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const verifyUrl = `${protocol}://${host}/ijin-masuk-alat-it?token=${reqRecord.token || ''}`

    const pdfBytes = await buildItEquipmentPdf(reqRecord, verifyUrl)

    const filename = `${reqRecord.form_type === 'out' ? 'ISMS-F-03-00-002' : 'ISMS-F-03-00-001'}-${reqRecord.request_no}.pdf`

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    console.error('Error rendering IT equipment request PDF:', error)
    return NextResponse.json({ error: 'Gagal membuat file PDF' }, { status: 500 })
  }
}
