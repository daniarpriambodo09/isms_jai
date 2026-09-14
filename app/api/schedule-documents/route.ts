// app/api/schedule-documents/route.ts
//
// Replaces the old field-by-field audit/training schedule entry: an admin
// uploads PDFs or images per category and those files ARE the schedule — no
// structured rows to fill in. Each category can hold any number of files;
// uploading adds a new one rather than replacing the last. The set of
// categories itself is admin-managed via /api/schedule-categories, not
// fixed in code — "kind" here is just whichever category slug it belongs to.

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { deleteDocumentFile, saveScheduleDocument } from '@/lib/storage'
import { logActivity } from '@/lib/activity-log'

type ScheduleDocumentRow = {
  id: number
  kind: string
  file_path: string
  mime_type: string
  title: string | null
  description: string | null
  uploaded_at: string
  uploaded_by: string | null
}

const SELECT_COLUMNS = `id, kind, file_path, mime_type, title, description, uploaded_at, uploaded_by`
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

// Public — Home and /audits both need this with no login.
export async function GET() {
  try {
    const result = await query<ScheduleDocumentRow>(`SELECT ${SELECT_COLUMNS} FROM schedule_documents ORDER BY uploaded_at DESC, id DESC`)
    return NextResponse.json({ documents: result.rows })
  } catch (error) {
    console.error('[schedule-documents/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat dokumen jadwal.' }, { status: 500 })
  }
}

// Admin only — add a new file for a category.
export async function POST(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const form = await request.formData()
    const kind = form.get('kind')
    const title = form.get('title')
    const description = form.get('description')
    const file = form.get('file')

    if (typeof kind !== 'string' || !kind) return NextResponse.json({ message: 'Kategori jadwal tidak valid.' }, { status: 400 })
    const categoryCheck = await query<{ label: string }>('SELECT label FROM schedule_categories WHERE slug = $1', [kind])
    if (categoryCheck.rows.length === 0) return NextResponse.json({ message: 'Kategori jadwal tidak ditemukan.' }, { status: 400 })

    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ message: 'File wajib diunggah.' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ message: 'File harus berupa PDF, JPG, PNG, atau WebP.' }, { status: 400 })

    const filePath = await saveScheduleDocument(file)

    const result = await query<ScheduleDocumentRow>(
      `INSERT INTO schedule_documents (kind, file_path, mime_type, title, description, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SELECT_COLUMNS}`,
      [
        kind,
        filePath,
        file.type,
        typeof title === 'string' && title.trim() ? title.trim() : null,
        typeof description === 'string' && description.trim() ? description.trim() : null,
        session.username,
      ]
    )

    await logActivity(session, 'create', 'schedule_document', result.rows[0].id, `Mengunggah dokumen ${categoryCheck.rows[0].label}`)

    return NextResponse.json({ document: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[schedule-documents/POST]', error)
    return NextResponse.json({ message: 'Gagal menyimpan dokumen jadwal.' }, { status: 500 })
  }
}

// Admin only — remove one uploaded file.
export async function DELETE(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id || !/^\d+$/.test(id)) return NextResponse.json({ message: 'ID dokumen tidak valid.' }, { status: 400 })

    const result = await query<{ file_path: string; kind: string }>('DELETE FROM schedule_documents WHERE id = $1 RETURNING file_path, kind', [id])
    if (result.rows.length === 0) return NextResponse.json({ message: 'Dokumen jadwal tidak ditemukan.' }, { status: 404 })

    await deleteDocumentFile(result.rows[0].file_path)
    await logActivity(session, 'delete', 'schedule_document', id, `Menghapus dokumen jadwal (${result.rows[0].kind})`)
    return NextResponse.json({ message: 'Dokumen jadwal dihapus.' })
  } catch (error) {
    console.error('[schedule-documents/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus dokumen jadwal.' }, { status: 500 })
  }
}
