// app/api/camera-equipment/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

type CameraEquipmentRow = {
  id: number
  code: string
  department_id: number | null
  department_name: string | null
  section_id: number | null
  section_name: string | null
}

const SELECT_COLUMNS = `c.id, c.code, c.department_id, d.name AS department_name, c.section_id, s.name AS section_name`
const FROM_CLAUSE = `camera_equipment c LEFT JOIN departments d ON d.id = c.department_id LEFT JOIN sections s ON s.id = c.section_id`

// Public — the admin's approval screen needs this to populate "Kontrol No.
// Kamera", filtered by the request's department/section. A null
// department_id means the equipment applies across every department; a
// null section_id (with a department set) means it applies to every
// section within that department.
export async function GET() {
  try {
    const result = await query<CameraEquipmentRow>(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} ORDER BY c.code ASC`)
    return NextResponse.json({ cameras: result.rows })
  } catch (error) {
    console.error('[camera-equipment/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar kontrol kamera.' }, { status: 500 })
  }
}

// Admin only — add a camera control number to the roster.
export async function POST(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
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

    if (!code) return NextResponse.json({ message: 'Kode kontrol kamera wajib diisi.' }, { status: 400 })
    if (departmentId !== null && !Number.isInteger(departmentId)) {
      return NextResponse.json({ message: 'Departemen tidak valid.' }, { status: 400 })
    }
    if (sectionId !== null && !Number.isInteger(sectionId)) {
      return NextResponse.json({ message: 'Section tidak valid.' }, { status: 400 })
    }
    // A section always belongs to one department — picking one without the
    // other would silently apply the code more broadly than intended.
    if (sectionId !== null && departmentId === null) {
      return NextResponse.json({ message: 'Pilih departemen dahulu sebelum memilih section.' }, { status: 400 })
    }

    const inserted = await query<{ id: number }>(
      'INSERT INTO camera_equipment (code, department_id, section_id) VALUES ($1, $2, $3) RETURNING id',
      [code, departmentId, sectionId]
    )
    const result = await query<CameraEquipmentRow>(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE c.id = $1`, [inserted.rows[0].id])

    await logActivity(session, 'create', 'camera_equipment', inserted.rows[0].id, `Menambahkan kontrol kamera "${code}"`)
    return NextResponse.json({ camera: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ message: 'Kode kontrol kamera itu sudah ada untuk departemen/section ini.' }, { status: 409 })
    }
    console.error('[camera-equipment/POST]', error)
    return NextResponse.json({ message: 'Gagal menambahkan kontrol kamera.' }, { status: 500 })
  }
}
