// app/api/sections/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { deleteDocumentFile } from '@/lib/storage'
import { logActivity } from '@/lib/activity-log'

type SectionRow = { id: number; department_id: number; name: string; slug: string }

// Admin only — rename a section.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  const { id } = await params
  const { name } = await request.json()

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ message: 'Nama section wajib diisi.' }, { status: 400 })
  }

  const existing = await query<SectionRow>('SELECT id, department_id, name, slug FROM sections WHERE id = $1', [id])
  if (existing.rows.length === 0) {
    return NextResponse.json({ message: 'Section tidak ditemukan.' }, { status: 404 })
  }

  const result = await query<SectionRow>(
    'UPDATE sections SET name = $1 WHERE id = $2 RETURNING id, department_id, name, slug',
    [name.trim(), id]
  )

  await logActivity(session, 'update', 'section', id, `Mengubah nama section dari "${existing.rows[0].name}" menjadi "${result.rows[0].name}"`)

  return NextResponse.json({ section: result.rows[0] })
}

// Admin only — delete a section along with its documents (cascaded at the
// DB level). Physical PDF files are cleaned up afterwards.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  const { id } = await params

  const existing = await query<SectionRow>('SELECT id, department_id, name, slug FROM sections WHERE id = $1', [id])
  if (existing.rows.length === 0) {
    return NextResponse.json({ message: 'Section tidak ditemukan.' }, { status: 404 })
  }

  const filesToDelete = await query<{ file_path: string }>(
    'SELECT file_path FROM documents WHERE section_id = $1',
    [id]
  )

  await query('DELETE FROM sections WHERE id = $1', [id])

  await Promise.all(filesToDelete.rows.map((row) => deleteDocumentFile(row.file_path)))

  await logActivity(session, 'delete', 'section', id, `Menghapus section "${existing.rows[0].name}" beserta seluruh dokumennya`)

  return NextResponse.json({ message: 'Section dihapus.' })
}