// app/api/it-equipment-requests/[id]/return/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import type { ItEquipmentRequest } from '@/lib/it-equipment-shared'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (admin.role !== 'it' && admin.role !== 'security' && admin.role !== 'ism_admin') {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya IT, Security, atau ISMS Admin yang dapat memvalidasi pengembalian.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const {
      return_check_items = true,
      return_check_confidential = true,
      returned_notes = '',
      inspector_name = '',
    } = body

    const existingRes = await query<ItEquipmentRequest>(
      `SELECT * FROM it_equipment_requests WHERE id = $1 LIMIT 1`,
      [id]
    )
    if (existingRes.rowCount === 0) {
      return NextResponse.json({ error: 'Data pengajuan tidak ditemukan' }, { status: 404 })
    }

    const current = existingRes.rows[0]
    if (current.status !== 'approved') {
      return NextResponse.json(
        { error: `Hanya pengajuan berstatus Disetujui (ACC) yang dapat diproses pengembaliannya (status saat ini: ${current.status}).` },
        { status: 400 }
      )
    }

    const checker = inspector_name?.trim() || admin.username

    const updateRes = await query<ItEquipmentRequest>(
      `UPDATE it_equipment_requests
       SET status = 'returned',
           returned_at = NOW(),
           returned_checked_by = $1,
           returned_notes = $2,
           return_check_items = $3,
           return_check_confidential = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        checker,
        returned_notes || null,
        Boolean(return_check_items),
        Boolean(return_check_confidential),
        id,
      ]
    )

    return NextResponse.json({
      success: true,
      message: 'Pengecekan pengembalian alat selesai dicatat.',
      request: updateRes.rows[0],
    })
  } catch (error: any) {
    console.error('Error recording return check:', error)
    return NextResponse.json({ error: 'Gagal memproses pengembalian' }, { status: 500 })
  }
}
