// app/api/it-form-approvers/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { getItApprovers, addItApprover, seedDefaultApprovers } from '@/lib/it-form-service'
import { getAdminFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const formCode = searchParams.get('form_code') || undefined
    const approvers = await getItApprovers(formCode)
    return NextResponse.json({ approvers })
  } catch (error: any) {
    console.error('Error fetching IT approvers:', error)
    return NextResponse.json({ error: error.message || 'Gagal mengambil daftar approver' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized: Harap login sebagai Admin' }, { status: 401 })
    }

    const body = await request.json()

    if (body.action === 'reset_defaults') {
      await seedDefaultApprovers()
      const approvers = await getItApprovers(body.form_code || undefined)
      return NextResponse.json({ success: true, message: 'Berhasil reset ke default', approvers })
    }

    if (!body.form_code || !body.role_title || !body.person_name) {
      return NextResponse.json({ error: 'Kode form, jabatan approver, dan nama pejabat wajib diisi' }, { status: 400 })
    }

    const created = await addItApprover({
      form_code: body.form_code,
      form_name: body.form_name,
      slot_number: Number(body.slot_number) || 1,
      slot_label: body.slot_label || 'APPROVAL',
      role_title: body.role_title,
      person_name: body.person_name,
      salutation: body.salutation || 'Bapak',
      initials: body.initials || '',
      email: body.email || null,
      department: body.department || null,
      is_active: body.is_active !== false,
      sort_order: Number(body.sort_order) || Number(body.slot_number) || 1,
    })

    return NextResponse.json({ success: true, approver: created }, { status: 201 })
  } catch (error: any) {
    console.error('Error adding IT approver:', error)
    return NextResponse.json({ error: error.message || 'Gagal menambahkan approver' }, { status: 500 })
  }
}
