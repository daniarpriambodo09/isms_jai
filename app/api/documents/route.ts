// app/api/documents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { saveDocumentFile } from '@/lib/storage'

type DocumentRow = {
  id: number
  title: string
  revision: number
  file_path: string
  uploaded_at: string
}

// Public — anyone can browse the document register for a department/section.
export async function GET(request: NextRequest) {
  const departmentSlug = request.nextUrl.searchParams.get('department')
  const sectionSlug = request.nextUrl.searchParams.get('section')

  if (!departmentSlug) {
    return NextResponse.json({ message: 'Parameter department wajib diisi.' }, { status: 400 })
  }

  try {
    const rows = sectionSlug
      ? (
          await query<DocumentRow>(
            `SELECT d.id, d.title, d.revision, d.file_path, d.uploaded_at
             FROM documents d
             JOIN departments dept ON dept.id = d.department_id
             JOIN sections sec ON sec.id = d.section_id
             WHERE dept.slug = $1 AND sec.slug = $2
             ORDER BY d.uploaded_at DESC`,
            [departmentSlug, sectionSlug]
          )
        ).rows
      : (
          await query<DocumentRow>(
            `SELECT d.id, d.title, d.revision, d.file_path, d.uploaded_at
             FROM documents d
             JOIN departments dept ON dept.id = d.department_id
             WHERE dept.slug = $1 AND d.section_id IS NULL
             ORDER BY d.uploaded_at DESC`,
            [departmentSlug]
          )
        ).rows

    return NextResponse.json({ documents: rows })
  } catch (error) {
    console.error('[documents/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar dokumen.' }, { status: 500 })
  }
}

// Admin only — "Tambah Dokumen".
export async function POST(request: NextRequest) {
  if (!getAdminFromRequest(request)) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const form = await request.formData()
    const title = form.get('title')
    const departmentId = form.get('departmentId')
    const sectionId = form.get('sectionId')
    const file = form.get('file')

    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ message: 'Nama dokumen wajib diisi.' }, { status: 400 })
    }
    if (typeof departmentId !== 'string' || !departmentId) {
      return NextResponse.json({ message: 'Departemen wajib diisi.' }, { status: 400 })
    }
    if (!(file instanceof File) || file.type !== 'application/pdf') {
      return NextResponse.json({ message: 'File PDF wajib diunggah.' }, { status: 400 })
    }

    const filePath = await saveDocumentFile(file)

    const result = await query<DocumentRow>(
      `INSERT INTO documents (department_id, section_id, title, revision, file_path)
       VALUES ($1, $2, $3, 1, $4)
       RETURNING id, title, revision, file_path, uploaded_at`,
      [departmentId, sectionId && typeof sectionId === 'string' ? sectionId : null, title.trim(), filePath]
    )

    return NextResponse.json({ document: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[documents/POST]', error)
    return NextResponse.json({ message: 'Gagal menyimpan dokumen.' }, { status: 500 })
  }
}