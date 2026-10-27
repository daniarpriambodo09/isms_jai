// app/api/it-form-submissions/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import {
  getItFormSubmissionById,
  deleteItFormSubmission,
  updateItFormSubmissionData,
} from '@/lib/it-form-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const subId = Number(id)
    if (!subId || isNaN(subId)) {
      return NextResponse.json({ error: 'ID permohonan tidak valid' }, { status: 400 })
    }

    const submission = await getItFormSubmissionById(subId)
    if (!submission) {
      return NextResponse.json({ error: 'Permohonan tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ submission })
  } catch (error: any) {
    console.error('Error getting IT form submission:', error)
    return NextResponse.json({ error: error.message || 'Gagal memuat permohonan' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const subId = Number(id)
    if (!subId || isNaN(subId)) {
      return NextResponse.json({ error: 'ID permohonan tidak valid' }, { status: 400 })
    }

    const success = await deleteItFormSubmission(subId)
    if (!success) {
      return NextResponse.json({ error: 'Permohonan tidak ditemukan atau sudah dihapus' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Permohonan berhasil dihapus' })
  } catch (error: any) {
    console.error('Error deleting IT form submission:', error)
    return NextResponse.json({ error: error.message || 'Gagal menghapus permohonan' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const subId = Number(id)
    if (!subId || isNaN(subId)) {
      return NextResponse.json({ error: 'ID permohonan tidak valid' }, { status: 400 })
    }

    const body = await request.json()
    const { assigned_ip, form_data } = body
    const updates: Record<string, any> = { ...(form_data || {}) }
    if (assigned_ip !== undefined) {
      const cleanIp = String(assigned_ip).trim()
      updates.assigned_ip = cleanIp
      updates.static_ip = cleanIp
      updates.ip_address = cleanIp
    }

    const ok = await updateItFormSubmissionData(subId, updates)
    if (!ok) {
      return NextResponse.json({ error: 'Permohonan tidak ditemukan' }, { status: 404 })
    }

    const updated = await getItFormSubmissionById(subId)
    return NextResponse.json({ success: true, submission: updated })
  } catch (error: any) {
    console.error('Error updating IT form submission:', error)
    return NextResponse.json({ error: error.message || 'Gagal memperbarui permohonan' }, { status: 500 })
  }
}
