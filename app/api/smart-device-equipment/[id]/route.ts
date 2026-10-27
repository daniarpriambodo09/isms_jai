// app/api/smart-device-equipment/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

type SmartDeviceEquipmentRow = {
  id: number
  code: string
  department_id: number | null
  department_name: string | null
  section_id: number | null
  section_name: string | null
}
const SELECT_COLUMNS = `sde.id, sde.code, sde.department_id, d.name AS department_name, sde.section_id, s.name AS section_name`
const FROM_CLAUSE = `smart_device_equipment sde LEFT JOIN departments d ON d.id = sde.department_id LEFT JOIN sections s ON s.id = sde.section_id`

// Admin only — rename a Smart Device control code or reassign its department/section.
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

  if (!code) return NextResponse.json({ message: 'Kode kontrol smart device wajib diisi.' }, { status: 400 })
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
    const existing = await query<{ id: number }>('SELECT id FROM smart_device_equipment WHERE id = $1', [id])
    if (existing.rows.length === 0) return NextResponse.json({ message: 'Kontrol smart device tidak ditemukan.' }, { status: 404 })

    await query('UPDATE smart_device_equipment SET code = $1, department_id = $2, section_id = $3 WHERE id = $4', [code, departmentId, sectionId, id])
    const result = await query<SmartDeviceEquipmentRow>(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE sde.id = $1`, [id])

    await logActivity(session, 'update', 'smart_device_equipment', id, `Mengubah kontrol Smart Device "${code}"`)
    return NextResponse.json({ item: result.rows[0] })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ message: 'Kode kontrol smart device itu sudah ada untuk departemen/section ini.' }, { status: 409 })
    }
    console.error('[smart-device-equipment/[id]/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan perubahan kontrol smart device.' }, { status: 500 })
  }
}

// Admin only — remove a Smart Device control number from the roster.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const { id } = await params
  try {
    const result = await query<{ id: number; code: string }>('DELETE FROM smart_device_equipment WHERE id = $1 RETURNING id, code', [id])
    if (result.rows.length === 0) return NextResponse.json({ message: 'Kontrol smart device tidak ditemukan.' }, { status: 404 })

    await logActivity(session, 'delete', 'smart_device_equipment', id, `Menghapus kontrol Smart Device "${result.rows[0].code}"`)
    return NextResponse.json({ message: 'Kontrol smart device dihapus.' })
  } catch (error) {
    console.error('[smart-device-equipment/[id]/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus kontrol smart device.' }, { status: 500 })
  }
}
