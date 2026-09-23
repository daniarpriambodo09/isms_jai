// app/api/photo-id-equipment/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

type PhotoIdEquipmentRow = {
  id: number
  code: string
  department_id: number | null
  department_name: string | null
  section_id: number | null
  section_name: string | null
}

const SELECT_COLUMNS = `p.id, p.code, p.department_id, d.name AS department_name, p.section_id, s.name AS section_name`
const FROM_CLAUSE = `photo_id_equipment p LEFT JOIN departments d ON d.id = p.department_id LEFT JOIN sections s ON s.id = p.section_id`

// Public — the Internal Ijin Foto/Video form needs this to populate its
// "No. ID Photography" dropdown, filtered by the requester's chosen Dept./
// Seksi PIC Kamera, mirroring camera-equipment. A null department_id means
// the ID applies across every department; a null section_id (with a
// department set) means it applies to every section within it.
export async function GET() {
  try {
    const result = await query<PhotoIdEquipmentRow>(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} ORDER BY p.code ASC`)
    return NextResponse.json({ photoIds: result.rows })
  } catch (error) {
    console.error('[photo-id-equipment/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar ID Photography.' }, { status: 500 })
  }
}

// Admin only — add an ID Photography number to the roster.
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

    if (!code) return NextResponse.json({ message: 'Kode ID Photography wajib diisi.' }, { status: 400 })
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
      'INSERT INTO photo_id_equipment (code, department_id, section_id) VALUES ($1, $2, $3) RETURNING id',
      [code, departmentId, sectionId]
    )
    const result = await query<PhotoIdEquipmentRow>(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE p.id = $1`, [inserted.rows[0].id])

    await logActivity(session, 'create', 'photo_id_equipment', inserted.rows[0].id, `Menambahkan ID Photography "${code}"`)
    return NextResponse.json({ photoId: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ message: 'Kode ID Photography itu sudah ada untuk departemen/section ini.' }, { status: 409 })
    }
    console.error('[photo-id-equipment/POST]', error)
    return NextResponse.json({ message: 'Gagal menambahkan ID Photography.' }, { status: 500 })
  }
}
