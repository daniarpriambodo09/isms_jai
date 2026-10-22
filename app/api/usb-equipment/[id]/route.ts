// app/api/usb-equipment/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

type UsbEquipmentRow = {
  id: number
  code: string
  department_id: number | null
  department_name: string | null
  section_id: number | null
  section_name: string | null
}
const SELECT_COLUMNS = `u.id, u.code, u.department_id, d.name AS department_name, u.section_id, s.name AS section_name`
const FROM_CLAUSE = `usb_equipment u LEFT JOIN departments d ON d.id = u.department_id LEFT JOIN sections s ON s.id = u.section_id`

// Admin only — rename a USB control code or reassign its department/section.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const departmentId = body.departmentId === null || body.departmentId === undefined || body.departmentId === ''
    ? null
    : Number(body.departmentId)
  const sectionId = body.sectionId === null || body.sectionId === undefined || body.sectionId === ''
    ? null
    : Number(body.sectionId)

  if (!code) return NextResponse.json({ message: 'Kode kontrol USB wajib diisi.' }, { status: 400 })
  if (departmentId !== null && !Number.isInteger(departmentId)) {
    return NextResponse.json({ message: 'Departemen tidak valid.' }, { status: 400 })
  }
  if (sectionId !== null && !Number.isInteger(sectionId)) {
    return NextResponse.json({ message: 'Section tidak valid.' }, { status: 400 })
  }
  if (sectionId !== null && departmentId === null) {
    return NextResponse.json({ message: 'Pilih departemen dahulu sebelum memilih section.' }, { status: 400 })
  }

  try {
    const existing = await query<{ id: number }>('SELECT id FROM usb_equipment WHERE id = $1', [id])
    if (existing.rows.length === 0) return NextResponse.json({ message: 'Kontrol USB tidak ditemukan.' }, { status: 404 })

    await query('UPDATE usb_equipment SET code = $1, department_id = $2, section_id = $3 WHERE id = $4', [code, departmentId, sectionId, id])
    const result = await query<UsbEquipmentRow>(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE u.id = $1`, [id])

    await logActivity(session, 'update', 'usb_equipment', id, `Mengubah kontrol USB "${code}"`)
    return NextResponse.json({ item: result.rows[0] })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ message: 'Kode kontrol USB itu sudah ada untuk departemen/section ini.' }, { status: 409 })
    }
    console.error('[usb-equipment/[id]/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan perubahan kontrol USB.' }, { status: 500 })
  }
}

// Admin only — remove a USB control number from the roster.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const { id } = await params
  try {
    const result = await query<{ id: number; code: string }>('DELETE FROM usb_equipment WHERE id = $1 RETURNING id, code', [id])
    if (result.rows.length === 0) return NextResponse.json({ message: 'Kontrol USB tidak ditemukan.' }, { status: 404 })

    await logActivity(session, 'delete', 'usb_equipment', id, `Menghapus kontrol USB "${result.rows[0].code}"`)
    return NextResponse.json({ message: 'Kontrol USB dihapus.' })
  } catch (error) {
    console.error('[usb-equipment/[id]/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus kontrol USB.' }, { status: 500 })
  }
}
