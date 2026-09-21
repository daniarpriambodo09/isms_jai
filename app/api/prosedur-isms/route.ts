import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { deleteDocumentFile, saveDocumentFile } from '@/lib/storage'
import { logActivity } from '@/lib/activity-log'

type ProcedureRow = {
  id: number
  control_no: string
  title: string
  revision: number
  elf_date: string
  uploaded_at: string
  file_path: string
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export async function GET() {
  try {
    const result = await query<ProcedureRow>(
      `SELECT id, control_no, title, revision, elf_date, uploaded_at, file_path
       FROM procedure_documents
       ORDER BY control_no ASC, id ASC`
    )
    return NextResponse.json({ documents: result.rows })
  } catch (error) {
    console.error('[prosedur-isms/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar prosedur ISMS.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const form = await request.formData()
    const controlNo = form.get('controlNo')
    const title = form.get('title')
    const elfDate = form.get('elfDate')
    const file = form.get('file')

    if (typeof controlNo !== 'string' || !controlNo.trim()) {
      return NextResponse.json({ message: 'No. Kontrol wajib diisi.' }, { status: 400 })
    }
    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ message: 'Nama dokumen wajib diisi.' }, { status: 400 })
    }
    if (!isValidDate(elfDate)) {
      return NextResponse.json({ message: 'Elf Date wajib diisi.' }, { status: 400 })
    }
    if (!(file instanceof File) || file.size === 0 || file.type !== 'application/pdf') {
      return NextResponse.json({ message: 'File PDF wajib diunggah.' }, { status: 400 })
    }

    const filePath = await saveDocumentFile(file)
    const result = await query<ProcedureRow>(
      `INSERT INTO procedure_documents (control_no, title, revision, elf_date, file_path)
       VALUES ($1, $2, 1, $3, $4)
       RETURNING id, control_no, title, revision, elf_date, uploaded_at, file_path`,
      [controlNo.trim().toUpperCase(), title.trim(), elfDate, filePath]
    )

    await logActivity(session, 'create', 'procedure_document', result.rows[0].id, `Menambahkan prosedur ISMS "${result.rows[0].title}"`)
    return NextResponse.json({ document: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[prosedur-isms/POST]', error)
    return NextResponse.json({ message: 'Gagal menyimpan prosedur ISMS.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const form = await request.formData()
    const id = form.get('id')
    const controlNo = form.get('controlNo')
    const title = form.get('title')
    const elfDate = form.get('elfDate')
    const revisionRaw = form.get('revision')
    const file = form.get('file')

    if (typeof id !== 'string' || !/^\d+$/.test(id)) {
      return NextResponse.json({ message: 'ID dokumen tidak valid.' }, { status: 400 })
    }
    if (typeof controlNo !== 'string' || !controlNo.trim()) {
      return NextResponse.json({ message: 'No. Kontrol wajib diisi.' }, { status: 400 })
    }
    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ message: 'Nama dokumen wajib diisi.' }, { status: 400 })
    }
    if (!isValidDate(elfDate)) {
      return NextResponse.json({ message: 'Elf Date wajib diisi.' }, { status: 400 })
    }
    const revision = typeof revisionRaw === 'string' && /^\d+$/.test(revisionRaw) ? Number(revisionRaw) : NaN
    if (!Number.isInteger(revision) || revision < 1) {
      return NextResponse.json({ message: 'Revisi wajib diisi dengan angka minimal 1.' }, { status: 400 })
    }
    if (file instanceof File && file.size > 0 && file.type !== 'application/pdf') {
      return NextResponse.json({ message: 'File harus berupa PDF.' }, { status: 400 })
    }

    const existing = await query<{ file_path: string }>(
      'SELECT file_path FROM procedure_documents WHERE id = $1',
      [id]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })
    }

    const replacement = file instanceof File && file.size > 0
    const newFilePath = replacement ? await saveDocumentFile(file) : null
    const result = await query<ProcedureRow>(
      `UPDATE procedure_documents
       SET control_no = $1,
           title = $2,
           elf_date = $3,
           file_path = COALESCE($4, file_path),
           uploaded_at = CASE WHEN $4 IS NOT NULL THEN now() ELSE uploaded_at END,
           revision = $6
       WHERE id = $5
       RETURNING id, control_no, title, revision, elf_date, uploaded_at, file_path`,
      [controlNo.trim().toUpperCase(), title.trim(), elfDate, newFilePath, id, revision]
    )

    if (newFilePath) await deleteDocumentFile(existing.rows[0].file_path)
    await logActivity(session, 'update', 'procedure_document', id, `Mengubah prosedur ISMS "${result.rows[0].title}" (revisi ${result.rows[0].revision})`)
    return NextResponse.json({ document: result.rows[0] })
  } catch (error) {
    console.error('[prosedur-isms/PUT]', error)
    return NextResponse.json({ message: 'Gagal memperbarui prosedur ISMS.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id || !/^\d+$/.test(id)) {
      return NextResponse.json({ message: 'ID dokumen tidak valid.' }, { status: 400 })
    }

    const result = await query<{ id: number; title: string; file_path: string }>(
      'DELETE FROM procedure_documents WHERE id = $1 RETURNING id, title, file_path',
      [id]
    )
    if (result.rows.length === 0) {
      return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })
    }

    await deleteDocumentFile(result.rows[0].file_path)
    await logActivity(session, 'delete', 'procedure_document', id, `Menghapus prosedur ISMS "${result.rows[0].title}"`)
    return NextResponse.json({ message: 'Dokumen dihapus.' })
  } catch (error) {
    console.error('[prosedur-isms/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus prosedur ISMS.' }, { status: 500 })
  }
}
