// app/api/it-equipment-requests/[id]/approve/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import crypto from 'crypto'
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

    // Role check: 'it' or 'ism_admin'
    if (admin.role !== 'it' && admin.role !== 'ism_admin') {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya IT Administrator atau ISMS Admin yang dapat menyetujui pengajuan ini.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { action, approver_name, approver_title, notes, rejection_reason } = body

    const existingRes = await query<ItEquipmentRequest>(
      `SELECT * FROM it_equipment_requests WHERE id = $1 LIMIT 1`,
      [id]
    )
    if (existingRes.rowCount === 0) {
      return NextResponse.json({ error: 'Data pengajuan tidak ditemukan' }, { status: 404 })
    }

    const currentReq = existingRes.rows[0]

    if (action === 'approve') {
      const approvalCode = crypto.randomBytes(4).toString('hex').toUpperCase() // e.g. 8 chars
      const signerName = approver_name?.trim() || admin.username
      const signerTitle = approver_title?.trim() || 'System Security Administrator (IT)'

      const updateRes = await query<ItEquipmentRequest>(
        `UPDATE it_equipment_requests
         SET status = 'approved',
             approval_code = $1,
             approved_by = $2,
             approved_title = $3,
             approved_at = NOW(),
             approval_notes = $4,
             updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [approvalCode, signerName, signerTitle, notes || null, id]
      )

      return NextResponse.json({
        success: true,
        message: 'Pengajuan berhasil disetujui (ACC)',
        request: updateRes.rows[0],
      })
    } else if (action === 'reject') {
      if (!rejection_reason?.trim()) {
        return NextResponse.json({ error: 'Alasan penolakan wajib diisi' }, { status: 400 })
      }

      const updateRes = await query<ItEquipmentRequest>(
        `UPDATE it_equipment_requests
         SET status = 'rejected',
             rejected_by = $1,
             rejected_at = NOW(),
             rejection_reason = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [admin.username, rejection_reason.trim(), id]
      )

      return NextResponse.json({
        success: true,
        message: 'Pengajuan telah ditolak',
        request: updateRes.rows[0],
      })
    } else {
      return NextResponse.json({ error: 'Aksi tidak valid (approve/reject)' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Error approving/rejecting IT equipment request:', error)
    return NextResponse.json({ error: 'Gagal memproses persetujuan' }, { status: 500 })
  }
}
