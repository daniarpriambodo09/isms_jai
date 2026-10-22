// app/api/usb-equipment/route.ts
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

// Public — form Ijin Foto/Video (Internal) needs this to populate "No. Kontrol USB",
// optionally filtered by department/section. A null department_id means it applies across all departments.
export async function GET() {
  try {
    const result = await query<UsbEquipmentRow>(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} ORDER BY u.code ASC`)
    return NextResponse.json({ usbList: result.rows })
  } catch (error) {
    console.error('[usb-equipment/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar kontrol USB.' }, { status: 500 })
  }
}

// Admin only — add a USB control number to the roster.
export async function POST(request: NextRequest) {
  const session = getAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
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

    const inserted = await query<{ id: number }>(
      'INSERT INTO usb_equipment (code, department_id, section_id) VALUES ($1, $2, $3) RETURNING id',
      [code, departmentId, sectionId]
    )
    const result = await query<UsbEquipmentRow>(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE u.id = $1`, [inserted.rows[0].id])

    await logActivity(session, 'create', 'usb_equipment', inserted.rows[0].id, `Menambahkan kontrol USB "${code}"`)
    return NextResponse.json({ item: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ message: 'Kode kontrol USB itu sudah ada untuk departemen/section ini.' }, { status: 409 })
    }
    console.error('[usb-equipment/POST]', error)
    return NextResponse.json({ message: 'Gagal menambahkan kontrol USB.' }, { status: 500 })
  }
}
