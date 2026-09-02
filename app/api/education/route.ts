// app/api/education/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { deleteDocumentFile, saveDocumentFile } from '@/lib/storage'

type EducationRow = {
  id: number
  title: string
  category: string
  language: string
  file_path: string
  uploaded_at: string
}

export async function GET() {
  try {
    const result = await query<EducationRow>(
      `SELECT id, title, category, language, file_path, uploaded_at
       FROM education_documents
       ORDER BY uploaded_at DESC, id DESC`
    )
    return NextResponse.json({ documents: result.rows })
  } catch (error) {
    console.error('[education/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar dokumen education.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!getAdminFromRequest(request)) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const form = await request.formData()
    const title = form.get('title')
    const category = form.get('category')
    const language = form.get('language')
    const file = form.get('file')

    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ message: 'Judul materi wajib diisi.' }, { status: 400 })
    }
    if (typeof category !== 'string' || !category.trim()) {
      return NextResponse.json({ message: 'Kategori wajib diisi.' }, { status: 400 })
    }
    if (typeof language !== 'string' || !language.trim()) {
      return NextResponse.json({ message: 'Bahasa wajib dipilih.' }, { status: 400 })
    }
    if (!(file instanceof File) || file.size === 0 || file.type !== 'application/pdf') {
      return NextResponse.json({ message: 'File PDF wajib diunggah.' }, { status: 400 })
    }

    const filePath = await saveDocumentFile(file)
    const result = await query<EducationRow>(
      `INSERT INTO education_documents (title, category, language, file_path)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, category, language, file_path, uploaded_at`,
      [title.trim(), category.trim(), language.trim(), filePath]
    )

    return NextResponse.json({ document: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[education/POST]', error)
    return NextResponse.json({ message: 'Gagal menyimpan dokumen education.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  if (!getAdminFromRequest(request)) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const form = await request.formData()
    const id = form.get('id')
    const title = form.get('title')
    const category = form.get('category')
    const language = form.get('language')
    const file = form.get('file')

    if (typeof id !== 'string' || !/^\d+$/.test(id)) {
      return NextResponse.json({ message: 'ID dokumen tidak valid.' }, { status: 400 })
    }
    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ message: 'Judul materi wajib diisi.' }, { status: 400 })
    }
    if (typeof category !== 'string' || !category.trim()) {
      return NextResponse.json({ message: 'Kategori wajib diisi.' }, { status: 400 })
    }
    if (typeof language !== 'string' || !language.trim()) {
      return NextResponse.json({ message: 'Bahasa wajib dipilih.' }, { status: 400 })
    }
    if (file instanceof File && file.size > 0 && file.type !== 'application/pdf') {
      return NextResponse.json({ message: 'File harus berupa PDF.' }, { status: 400 })
    }

    const existing = await query<{ file_path: string }>(
      'SELECT file_path FROM education_documents WHERE id = $1',
      [id]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })
    }

    const replacement = file instanceof File && file.size > 0
    const newFilePath = replacement ? await saveDocumentFile(file) : null
    const result = await query<EducationRow>(
      `UPDATE education_documents
       SET title     = $1,
           category  = $2,
           language  = $3,
           file_path = COALESCE($4, file_path),
           uploaded_at = CASE WHEN $4 IS NOT NULL THEN now() ELSE uploaded_at END
       WHERE id = $5
       RETURNING id, title, category, language, file_path, uploaded_at`,
      [title.trim(), category.trim(), language.trim(), newFilePath, id]
    )

    if (newFilePath) await deleteDocumentFile(existing.rows[0].file_path)
    return NextResponse.json({ document: result.rows[0] })
  } catch (error) {
    console.error('[education/PUT]', error)
    return NextResponse.json({ message: 'Gagal memperbarui dokumen education.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!getAdminFromRequest(request)) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id || !/^\d+$/.test(id)) {
      return NextResponse.json({ message: 'ID dokumen tidak valid.' }, { status: 400 })
    }

    const result = await query<{ id: number; file_path: string }>(
      'DELETE FROM education_documents WHERE id = $1 RETURNING id, file_path',
      [id]
    )
    if (result.rows.length === 0) {
      return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })
    }

    await deleteDocumentFile(result.rows[0].file_path)
    return NextResponse.json({ message: 'Dokumen dihapus.' })
  } catch (error) {
    console.error('[education/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus dokumen education.' }, { status: 500 })
  }
}
