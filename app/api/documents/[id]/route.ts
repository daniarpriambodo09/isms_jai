// app/api/documents/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { deleteDocumentFile, saveDocumentFile } from '@/lib/storage'

type DocumentRow = {
  id: number
  title: string
  revision: number
  file_path: string
  uploaded_at: string
}

// Admin only — edit nama dokumen, tanggal upload, dan (opsional) ganti
// file PDF-nya. Setiap kali diedit, "Revisi" (jumlah berapa kali revisi)
// otomatis bertambah 1 — bukan field yang diketik manual.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminFromRequest(request)) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  const { id } = await params
  const form = await request.formData()
  const title = form.get('title')
  const uploadedAt = form.get('uploadedAt')
  const file = form.get('file')

  if (typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ message: 'Nama dokumen wajib diisi.' }, { status: 400 })
  }
  if (file instanceof File && file.size > 0 && file.type !== 'application/pdf') {
    return NextResponse.json({ message: 'File harus berupa PDF.' }, { status: 400 })
  }

  try {
    const existing = await query<{ file_path: string }>(
      'SELECT file_path FROM documents WHERE id = $1',
      [id]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })
    }

    const newFilePath = file instanceof File && file.size > 0 ? await saveDocumentFile(file) : null

    const result = await query<DocumentRow>(
      `UPDATE documents
       SET title = $1,
           uploaded_at = COALESCE($2::timestamptz, uploaded_at),
           file_path = COALESCE($3, file_path),
           revision = revision + 1
       WHERE id = $4
       RETURNING id, title, revision, file_path, uploaded_at`,
      [title.trim(), typeof uploadedAt === 'string' && uploadedAt ? uploadedAt : null, newFilePath, id]
    )

    if (newFilePath) {
      await deleteDocumentFile(existing.rows[0].file_path)
    }

    return NextResponse.json({ document: result.rows[0] })
  } catch (error) {
    console.error('[documents/[id]/PUT]', error)
    return NextResponse.json({ message: 'Gagal memperbarui dokumen.' }, { status: 500 })
  }
}

// Admin only — hapus dokumen (baris DB + file fisik di storage).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminFromRequest(request)) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  const { id } = await params

  try {
    const result = await query<DocumentRow>(
      'DELETE FROM documents WHERE id = $1 RETURNING id, file_path',
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })
    }

    await deleteDocumentFile(result.rows[0].file_path)

    return NextResponse.json({ message: 'Dokumen dihapus.' })
  } catch (error) {
    console.error('[documents/[id]/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus dokumen.' }, { status: 500 })
  }
}