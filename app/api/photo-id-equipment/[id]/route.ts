// app/api/photo-id-equipment/[id]/route.ts
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

// Admin only — rename an ID Photography code or reassign its department/section.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getIsmsAdminFromRequest(request)
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

  try {
    const existing = await query<{ id: number }>('SELECT id FROM photo_id_equipment WHERE id = $1', [id])
    if (existing.rows.length === 0) return NextResponse.json({ message: 'ID Photography tidak ditemukan.' }, { status: 404 })

    await query('UPDATE photo_id_equipment SET code = $1, department_id = $2, section_id = $3 WHERE id = $4', [code, departmentId, sectionId, id])
    const result = await query<PhotoIdEquipmentRow>(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE p.id = $1`, [id])

    await logActivity(session, 'update', 'photo_id_equipment', id, `Mengubah ID Photography "${code}"`)
    return NextResponse.json({ photoId: result.rows[0] })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ message: 'Kode ID Photography itu sudah ada untuk departemen/section ini.' }, { status: 409 })
    }
    console.error('[photo-id-equipment/[id]/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan perubahan ID Photography.' }, { status: 500 })
  }
}

// Admin only — remove an ID Photography code from the roster. Requests that
// already recorded it (photo_id_no is just a plain text snapshot, not a
// foreign key) keep their history untouched.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const { id } = await params
  try {
    const result = await query<{ id: number; code: string }>('DELETE FROM photo_id_equipment WHERE id = $1 RETURNING id, code', [id])
    if (result.rows.length === 0) return NextResponse.json({ message: 'ID Photography tidak ditemukan.' }, { status: 404 })

    await logActivity(session, 'delete', 'photo_id_equipment', id, `Menghapus ID Photography "${result.rows[0].code}"`)
    return NextResponse.json({ message: 'ID Photography dihapus.' })
  } catch (error) {
    console.error('[photo-id-equipment/[id]/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus ID Photography.' }, { status: 500 })
  }
}
