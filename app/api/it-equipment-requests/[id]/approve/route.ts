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
    const { action, stage, approver_name, approver_title, notes, rejection_reason } = body

    await query(`
      ALTER TABLE it_equipment_requests
      ADD COLUMN IF NOT EXISTS it_checked_by VARCHAR(150),
      ADD COLUMN IF NOT EXISTS it_checked_title VARCHAR(150),
      ADD COLUMN IF NOT EXISTS it_checked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS it_check_notes TEXT;
    `).catch(() => {})

    const existingRes = await query<ItEquipmentRequest>(
      `SELECT * FROM it_equipment_requests WHERE id = $1 LIMIT 1`,
      [id]
    )
    if (existingRes.rowCount === 0) {
      return NextResponse.json({ error: 'Data pengajuan tidak ditemukan' }, { status: 404 })
    }

    const currentReq = existingRes.rows[0]

    // Tahap 1: Persetujuan IAA / Manager Departemen
    if (action === 'approve_manager' || (action === 'approve' && currentReq.status === 'pending' && stage !== 'it')) {
      const signerName = approver_name?.trim() || 'Manager Departemen / IAA'
      const signerTitle = approver_title?.trim() || 'Manager Departemen / IAA'

      const updateRes = await query<ItEquipmentRequest>(
        `UPDATE it_equipment_requests
         SET status = 'approved_manager',
             approved_by = $1,
             approved_title = $2,
             approved_at = NOW(),
             approval_notes = $3,
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [signerName, signerTitle, notes || null, id]
      )

      return NextResponse.json({
        success: true,
        message: 'Tahap 1: Pengajuan berhasil disetujui oleh IAA / Manager Departemen. Selanjutnya menunggu verifikasi IT.',
        request: updateRes.rows[0],
      })
    }

    // Tahap 2: Verifikasi / Persetujuan IT (System Security Administrator)
    if (action === 'approve_it' || (action === 'approve' && (currentReq.status === 'approved_manager' || stage === 'it'))) {
      if (currentReq.status !== 'approved_manager' && currentReq.status !== 'approved') {
        return NextResponse.json(
          {
            error:
              'Alur harus berurutan: Tahap 1 (Persetujuan IAA / Manager Departemen) belum disetujui. Harap setujui Tahap 1 terlebih dahulu sebelum verifikasi IT.',
          },
          { status: 400 }
        )
      }

      const approvalCode = currentReq.approval_code || crypto.randomBytes(4).toString('hex').toUpperCase()
      const checkerName = approver_name?.trim() || admin.username || 'System Security Admin (IT)'
      const checkerTitle = approver_title?.trim() || 'System Security Administrator (IT)'

      const updateRes = await query<ItEquipmentRequest>(
        `UPDATE it_equipment_requests
         SET status = 'approved',
             approval_code = $1,
             it_checked_by = $2,
             it_checked_title = $3,
             it_checked_at = NOW(),
             it_check_notes = COALESCE($4, it_check_notes),
             updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [approvalCode, checkerName, checkerTitle, notes || null, id]
      )

      return NextResponse.json({
        success: true,
        message: 'Tahap 2: Pengajuan telah diverifikasi dan disetujui oleh IT (System Security Administrator).',
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
