// app/api/pic-approvers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

type PicApproverRow = { id: number; name: string; department_id: number | null; department_name: string | null }

const SELECT_COLUMNS = `p.id, p.name, p.department_id, d.name AS department_name`
const FROM_CLAUSE = `pic_approvers p LEFT JOIN departments d ON d.id = p.department_id`

// Public — the Ijin Foto/Video form (filled by anyone, logged in or not)
// needs this list to populate its "PIC Approve" dropdown, filtered by the
// department the requester picked. A null department_id means the PIC
// applies across every department (e.g. a general/HQ-level approver).
export async function GET() {
  try {
    const result = await query<PicApproverRow>(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} ORDER BY p.name ASC`)
    return NextResponse.json({ pics: result.rows })
  } catch (error) {
    console.error('[pic-approvers/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar PIC Approve.' }, { status: 500 })
  }
}

// Admin only — add a person to the PIC Approve roster.
export async function POST(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const departmentId = body.departmentId === null || body.departmentId === undefined || body.departmentId === ''
      ? null
      : Number(body.departmentId)

    if (!name) return NextResponse.json({ message: 'Nama PIC wajib diisi.' }, { status: 400 })
    if (departmentId !== null && !Number.isInteger(departmentId)) {
      return NextResponse.json({ message: 'Departemen tidak valid.' }, { status: 400 })
    }

    const inserted = await query<{ id: number }>(
      'INSERT INTO pic_approvers (name, department_id) VALUES ($1, $2) RETURNING id',
      [name, departmentId]
    )
    const result = await query<PicApproverRow>(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE p.id = $1`, [inserted.rows[0].id])

    await logActivity(session, 'create', 'pic_approver', inserted.rows[0].id, `Menambahkan PIC Approve "${name}"`)
    return NextResponse.json({ pic: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[pic-approvers/POST]', error)
    return NextResponse.json({ message: 'Gagal menambahkan PIC Approve.' }, { status: 500 })
  }
}
