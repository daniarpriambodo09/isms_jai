// app/api/it-form-approvers/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { updateItApprover, deleteItApprover } from '@/lib/it-form-service'
import { getAdminFromRequest } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized: Harap login sebagai Admin' }, { status: 401 })
    }

    const { id } = await params
    const approverId = Number(id)
    if (!approverId) {
      return NextResponse.json({ error: 'ID Approver tidak valid' }, { status: 400 })
    }

    const body = await request.json()
    const updated = await updateItApprover(approverId, body)
    if (!updated) {
      return NextResponse.json({ error: 'Approver tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ success: true, approver: updated })
  } catch (error: any) {
    console.error('Error updating IT approver:', error)
    return NextResponse.json({ error: error.message || 'Gagal memperbarui approver' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized: Harap login sebagai Admin' }, { status: 401 })
    }

    const { id } = await params
    const approverId = Number(id)
    if (!approverId) {
      return NextResponse.json({ error: 'ID Approver tidak valid' }, { status: 400 })
    }

    const ok = await deleteItApprover(approverId)
    if (!ok) {
      return NextResponse.json({ error: 'Approver tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Approver berhasil dihapus' })
  } catch (error: any) {
    console.error('Error deleting IT approver:', error)
    return NextResponse.json({ error: error.message || 'Gagal menghapus approver' }, { status: 500 })
  }
}
