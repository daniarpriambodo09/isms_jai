// app/api/it-form-submissions/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import {
  getItFormSubmissionById,
  deleteItFormSubmission,
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
