// app/api/special-area-requests/[id]/route.ts
//
// PATCH (kiosk roles): set the ID Card No. handed to the guest, or resend the
// approval email. DELETE: ISM Admin only.

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest, getKioskAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'
import { ensureSpecialAreaSchema, getRequest, sendApprovalRequest } from '@/lib/special-area'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getKioskAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  try {
    await ensureSpecialAreaSchema()
    const req = await getRequest(Number(id))
    if (!req) return NextResponse.json({ message: 'Pengajuan tidak ditemukan.' }, { status: 404 })
    const body = await request.json().catch(() => ({}))

    if (body.action === 'resend') {
      if (req.status !== 'pending') return NextResponse.json({ message: 'Pengajuan ini sudah diputuskan.' }, { status: 409 })
      const error = await sendApprovalRequest(req.id)
      await logActivity(session, 'update', 'special_area_request', req.id, `Mengirim ulang email persetujuan area special "${req.requester_name}"`)
      if (error) return NextResponse.json({ message: error }, { status: 502 })
      return NextResponse.json({ request: await getRequest(req.id), message: 'Email persetujuan dikirim ulang.' })
    }

    if (body.action === 'setIdCard') {
      const idCardNo = typeof body.idCardNo === 'string' ? body.idCardNo.trim().slice(0, 100) : ''
      await query('UPDATE special_area_requests SET id_card_no = $1 WHERE id = $2', [idCardNo || null, req.id])
      await logActivity(session, 'update', 'special_area_request', req.id, `Mengisi ID Card No. area special "${req.requester_name}"`)
      return NextResponse.json({ request: await getRequest(req.id) })
    }

    return NextResponse.json({ message: 'Aksi tidak valid.' }, { status: 400 })
  } catch (error) {
    console.error('[special-area-requests/[id]/PATCH]', error)
    return NextResponse.json({ message: 'Gagal memperbarui pengajuan.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  try {
    await ensureSpecialAreaSchema()
    const result = await query<{ requester_name: string }>('DELETE FROM special_area_requests WHERE id = $1 RETURNING requester_name', [id])
    if (!result.rows[0]) return NextResponse.json({ message: 'Pengajuan tidak ditemukan.' }, { status: 404 })
    await logActivity(session, 'delete', 'special_area_request', id, `Menghapus pengajuan area special "${result.rows[0].requester_name}"`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[special-area-requests/[id]/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus pengajuan.' }, { status: 500 })
  }
}
