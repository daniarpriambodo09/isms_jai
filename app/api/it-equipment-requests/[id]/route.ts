// app/api/it-equipment-requests/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { query } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import type { ItEquipmentRequest } from '@/lib/it-equipment-shared'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const numId = Number(id)
    if (!numId || isNaN(numId)) {
      return NextResponse.json({ error: 'ID pengajuan tidak valid' }, { status: 400 })
    }

    const res = await query<ItEquipmentRequest>(
      `SELECT er.*,
              gl.link_code,
              gl.network_username,
              gl.network_password,
              gl.network_ssid,
              gl.assigned_ip,
              gl.subnet_mask,
              gl.gateway,
              gl.dns_primary,
              gl.dns_secondary,
              gl.ip_mode
       FROM it_equipment_requests er
       LEFT JOIN guest_it_access_links gl ON gl.equipment_request_id = er.id
       WHERE er.id = $1
       LIMIT 1`,
      [numId]
    )
    if (!res.rowCount || res.rowCount === 0) {
      return NextResponse.json({ error: 'Data pengajuan tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ request: res.rows[0] })
  } catch (error: any) {
    console.error('Error getting IT equipment request:', error)
    return NextResponse.json({ error: 'Gagal memuat data pengajuan' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (admin.role !== 'it' && admin.role !== 'ism_admin') {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya Admin IT atau ISMS Admin yang dapat menghapus data pengajuan.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const numId = Number(id)
    if (!numId || isNaN(numId)) {
      return NextResponse.json({ error: 'ID pengajuan tidak valid' }, { status: 400 })
    }

    const delRes = await query(
      `DELETE FROM it_equipment_requests WHERE id = $1`,
      [numId]
    )
    if ((delRes.rowCount ?? 0) === 0) {
      return NextResponse.json(
        { error: 'Data pengajuan tidak ditemukan atau sudah dihapus' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Data pengajuan izin alat IT berhasil dihapus.',
    })
  } catch (error: any) {
    console.error('Error deleting IT equipment request:', error)
    return NextResponse.json({ error: 'Gagal menghapus data pengajuan' }, { status: 500 })
  }
}

