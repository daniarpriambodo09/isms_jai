import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { deleteDocumentFile, saveDocumentFile } from '@/lib/storage'
import { logActivity } from '@/lib/activity-log'

type WorkingStandardRow = {
  id: number
  control_no: string
  title: string
  revision: number
  uploaded_at: string
  file_path: string
  effective_date: string | null
}

export async function GET() {
  try {
    const result = await query<WorkingStandardRow>(
      `SELECT id, control_no, title, revision, uploaded_at, file_path, effective_date
       FROM working_standard_documents
       ORDER BY control_no ASC, id ASC`
    )
    return NextResponse.json({ documents: result.rows })
  } catch (error) {
    console.error('[working-standard/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar Working Standard.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const form = await request.formData()
    const controlNo = form.get('controlNo')
    const title = form.get('title')
    const effectiveDateRaw = form.get('effectiveDate')
    const file = form.get('file')

    if (typeof controlNo !== 'string' || !controlNo.trim()) return NextResponse.json({ message: 'No. Kontrol wajib diisi.' }, { status: 400 })
    if (typeof title !== 'string' || !title.trim()) return NextResponse.json({ message: 'Nama dokumen wajib diisi.' }, { status: 400 })
    if (!(file instanceof File) || file.size === 0 || file.type !== 'application/pdf') return NextResponse.json({ message: 'File PDF wajib diunggah.' }, { status: 400 })
    const effectiveDate = typeof effectiveDateRaw === 'string' && effectiveDateRaw.trim() ? effectiveDateRaw.trim() : null

    const filePath = await saveDocumentFile(file)
    const result = await query<WorkingStandardRow>(
      `INSERT INTO working_standard_documents (control_no, title, file_path, effective_date)
       VALUES ($1, $2, $3, $4)
       RETURNING id, control_no, title, revision, uploaded_at, file_path, effective_date`,
      [controlNo.trim().toUpperCase(), title.trim(), filePath, effectiveDate]
    )
    await logActivity(session, 'create', 'working_standard_document', result.rows[0].id, `Menambahkan Working Standard "${result.rows[0].title}"`)
    return NextResponse.json({ document: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[working-standard/POST]', error)
    return NextResponse.json({ message: 'Gagal menyimpan Working Standard.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const form = await request.formData()
    const id = form.get('id')
    const controlNo = form.get('controlNo')
    const title = form.get('title')
    const revisionRaw = form.get('revision')
    const effectiveDateRaw = form.get('effectiveDate')
    const file = form.get('file')

    if (typeof id !== 'string' || !/^\d+$/.test(id)) return NextResponse.json({ message: 'ID dokumen tidak valid.' }, { status: 400 })
    if (typeof controlNo !== 'string' || !controlNo.trim()) return NextResponse.json({ message: 'No. Kontrol wajib diisi.' }, { status: 400 })
    if (typeof title !== 'string' || !title.trim()) return NextResponse.json({ message: 'Nama dokumen wajib diisi.' }, { status: 400 })
    const revision = typeof revisionRaw === 'string' && /^\d+$/.test(revisionRaw) ? Number(revisionRaw) : NaN
    if (!Number.isInteger(revision) || revision < 1) return NextResponse.json({ message: 'Revisi wajib diisi dengan angka minimal 1.' }, { status: 400 })
    if (file instanceof File && file.size > 0 && file.type !== 'application/pdf') return NextResponse.json({ message: 'File harus berupa PDF.' }, { status: 400 })
    const effectiveDate = typeof effectiveDateRaw === 'string' && effectiveDateRaw.trim() ? effectiveDateRaw.trim() : null

    const existing = await query<{ file_path: string }>('SELECT file_path FROM working_standard_documents WHERE id = $1', [id])
    if (existing.rows.length === 0) return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })

    const replacement = file instanceof File && file.size > 0
    const newFilePath = replacement ? await saveDocumentFile(file) : null
    const result = await query<WorkingStandardRow>(
      `UPDATE working_standard_documents
       SET control_no = $1,
           title = $2,
           file_path = COALESCE($3, file_path),
           uploaded_at = CASE WHEN $3 IS NOT NULL THEN now() ELSE uploaded_at END,
           revision = $5,
           effective_date = $6
       WHERE id = $4
       RETURNING id, control_no, title, revision, uploaded_at, file_path, effective_date`,
      [controlNo.trim().toUpperCase(), title.trim(), newFilePath, id, revision, effectiveDate]
    )

    if (newFilePath) await deleteDocumentFile(existing.rows[0].file_path)
    await logActivity(session, 'update', 'working_standard_document', id, `Mengubah Working Standard "${result.rows[0].title}" (revisi ${result.rows[0].revision})`)
    return NextResponse.json({ document: result.rows[0] })
  } catch (error) {
    console.error('[working-standard/PUT]', error)
    return NextResponse.json({ message: 'Gagal memperbarui Working Standard.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id || !/^\d+$/.test(id)) return NextResponse.json({ message: 'ID dokumen tidak valid.' }, { status: 400 })

    const result = await query<{ title: string; file_path: string }>('DELETE FROM working_standard_documents WHERE id = $1 RETURNING title, file_path', [id])
    if (result.rows.length === 0) return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })

    await deleteDocumentFile(result.rows[0].file_path)
    await logActivity(session, 'delete', 'working_standard_document', id, `Menghapus Working Standard "${result.rows[0].title}"`)
    return NextResponse.json({ message: 'Dokumen dihapus.' })
  } catch (error) {
    console.error('[working-standard/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus Working Standard.' }, { status: 500 })
  }
}
