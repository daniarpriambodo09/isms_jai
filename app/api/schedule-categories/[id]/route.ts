// app/api/schedule-categories/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { deleteDocumentFile } from '@/lib/storage'
import { logActivity } from '@/lib/activity-log'

type ScheduleCategoryRow = { id: number; slug: string; label: string; sort_order: number }

// Admin only — rename a category. The slug stays put (schedule_documents.kind
// references it) so renaming never orphans existing uploads.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const label = typeof body.label === 'string' ? body.label.trim() : ''
  if (!label) return NextResponse.json({ message: 'Nama kategori wajib diisi.' }, { status: 400 })

  const existing = await query<ScheduleCategoryRow>('SELECT id, slug, label, sort_order FROM schedule_categories WHERE id = $1', [id])
  if (existing.rows.length === 0) return NextResponse.json({ message: 'Kategori tidak ditemukan.' }, { status: 404 })

  const result = await query<ScheduleCategoryRow>(
    'UPDATE schedule_categories SET label = $1 WHERE id = $2 RETURNING id, slug, label, sort_order',
    [label, id]
  )
  await logActivity(session, 'update', 'schedule_category', id, `Mengubah nama kategori jadwal dari "${existing.rows[0].label}" menjadi "${label}"`)
  return NextResponse.json({ category: result.rows[0] })
}

// Admin only — delete a category along with every file uploaded under it
// (cascaded at the DB level). Physical files are cleaned up afterwards.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const { id } = await params
  const existing = await query<ScheduleCategoryRow>('SELECT id, slug, label FROM schedule_categories WHERE id = $1', [id])
  if (existing.rows.length === 0) return NextResponse.json({ message: 'Kategori tidak ditemukan.' }, { status: 404 })

  const filesToDelete = await query<{ file_path: string }>('SELECT file_path FROM schedule_documents WHERE kind = $1', [existing.rows[0].slug])

  await query('DELETE FROM schedule_categories WHERE id = $1', [id])
  await Promise.all(filesToDelete.rows.map((row) => deleteDocumentFile(row.file_path)))

  await logActivity(session, 'delete', 'schedule_category', id, `Menghapus kategori jadwal "${existing.rows[0].label}" beserta seluruh filenya`)
  return NextResponse.json({ message: 'Kategori dihapus.' })
}
