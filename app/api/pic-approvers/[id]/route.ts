// app/api/pic-approvers/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

type PicApproverRow = { id: number; name: string; department_id: number | null; department_name: string | null }
const SELECT_COLUMNS = `p.id, p.name, p.department_id, d.name AS department_name`
const FROM_CLAUSE = `pic_approvers p LEFT JOIN departments d ON d.id = p.department_id`

// Admin only — rename a PIC or reassign their department.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const departmentId = body.departmentId === null || body.departmentId === undefined || body.departmentId === ''
    ? null
    : Number(body.departmentId)

  if (!name) return NextResponse.json({ message: 'Nama PIC wajib diisi.' }, { status: 400 })
  if (departmentId !== null && !Number.isInteger(departmentId)) {
    return NextResponse.json({ message: 'Departemen tidak valid.' }, { status: 400 })
  }

  const existing = await query<{ id: number }>('SELECT id FROM pic_approvers WHERE id = $1', [id])
  if (existing.rows.length === 0) return NextResponse.json({ message: 'PIC tidak ditemukan.' }, { status: 404 })

  await query('UPDATE pic_approvers SET name = $1, department_id = $2 WHERE id = $3', [name, departmentId, id])
  const result = await query<PicApproverRow>(`SELECT ${SELECT_COLUMNS} FROM ${FROM_CLAUSE} WHERE p.id = $1`, [id])

  await logActivity(session, 'update', 'pic_approver', id, `Mengubah PIC Approve "${name}"`)
  return NextResponse.json({ pic: result.rows[0] })
}

// Admin only — remove a person from the PIC Approve roster. Requests that
// referenced them keep their history; pic_approve_id just goes to NULL
// (ON DELETE SET NULL).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const { id } = await params
  const result = await query<{ id: number; name: string }>('DELETE FROM pic_approvers WHERE id = $1 RETURNING id, name', [id])
  if (result.rows.length === 0) return NextResponse.json({ message: 'PIC tidak ditemukan.' }, { status: 404 })

  await logActivity(session, 'delete', 'pic_approver', id, `Menghapus PIC Approve "${result.rows[0].name}"`)
  return NextResponse.json({ message: 'PIC dihapus.' })
}
