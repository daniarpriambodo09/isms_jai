// app/api/it-form-submissions/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import {
  createItFormSubmission,
  getItFormSubmissions,
  getItFormSubmissionByToken,
  deleteItFormSubmission,
} from '@/lib/it-form-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    if (token) {
      const sub = await getItFormSubmissionByToken(token)
      if (!sub) {
        return NextResponse.json({ error: 'Permohonan tidak ditemukan' }, { status: 404 })
      }
      return NextResponse.json({ submission: sub })
    }

    const formCode = searchParams.get('form_code') || undefined
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined

    const submissions = await getItFormSubmissions({
      form_code: formCode,
      status,
      search,
      limit,
    })

    return NextResponse.json({ submissions })
  } catch (error: any) {
    console.error('Error getting IT form submissions:', error)
    return NextResponse.json({ error: error.message || 'Gagal memuat permohonan' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.form_code || !body.applicant_name || !body.department) {
      return NextResponse.json(
        { error: 'Form, Nama Pemohon, dan Departemen wajib diisi' },
        { status: 400 }
      )
    }

    const submission = await createItFormSubmission({
      form_code: body.form_code,
      applicant_name: body.applicant_name,
      applicant_nik: body.applicant_nik,
      applicant_position: body.applicant_position,
      employee_status: body.employee_status,
      department: body.department,
      company_name: body.company_name,
      purpose: body.purpose,
      form_data: body.form_data || {},
      notes: body.notes,
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Permohonan berhasil diajukan dan masuk ke antrian tanda tangan digital (E-Sign)',
        submission,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating IT form submission:', error)
    return NextResponse.json({ error: error.message || 'Gagal mengajukan permohonan' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'ID permohonan tidak valid' }, { status: 400 })
    }

    const success = await deleteItFormSubmission(Number(id))
    if (!success) {
      return NextResponse.json({ error: 'Permohonan tidak ditemukan atau sudah dihapus' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Permohonan berhasil dihapus' })
  } catch (error: any) {
    console.error('Error deleting IT form submission:', error)
    return NextResponse.json({ error: error.message || 'Gagal menghapus permohonan' }, { status: 500 })
  }
}
