import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { deleteDocumentFile, saveDocumentFile } from '@/lib/storage'

type Category = 'form-aplikasi' | 'kontrol-cs'
type DocumentRow = { id: number; control_no: string; title: string; language: string; uploaded_at: string; file_path: string }

function isCategory(value: string): value is Category { return value === 'form-aplikasi' || value === 'kontrol-cs' }
function categoryLabel(category: Category) { return category === 'form-aplikasi' ? 'Form Aplikasi' : 'Kontrol CS' }

async function getCategory(params: Promise<{ category: string }>) {
  const { category } = await params
  return isCategory(category) ? category : null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const category = await getCategory(params)
  if (!category) return NextResponse.json({ message: 'Kategori dokumen tidak valid.' }, { status: 400 })

  try {
    const result = await query<DocumentRow>(
      `SELECT id, control_no, title, language, uploaded_at, file_path
       FROM form_cs_documents
       WHERE category = $1
       ORDER BY control_no ASC, id ASC`,
      [category]
    )
    return NextResponse.json({ documents: result.rows })
  } catch (error) {
    console.error('[form-cs/GET]', error)
    return NextResponse.json({ message: `Gagal memuat daftar ${categoryLabel(category)}.` }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const category = await getCategory(params)
  if (!category) return NextResponse.json({ message: 'Kategori dokumen tidak valid.' }, { status: 400 })
  if (!getAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const form = await request.formData()
    const controlNo = form.get('controlNo')
    const title = form.get('title')
    const language = form.get('language')
    const file = form.get('file')

    if (typeof controlNo !== 'string' || !controlNo.trim()) return NextResponse.json({ message: 'No. Kontrol wajib diisi.' }, { status: 400 })
    if (typeof title !== 'string' || !title.trim()) return NextResponse.json({ message: 'Nama dokumen wajib diisi.' }, { status: 400 })
    if (typeof language !== 'string' || !language.trim()) return NextResponse.json({ message: 'Bahasa wajib diisi.' }, { status: 400 })
    if (!(file instanceof File) || file.size === 0 || file.type !== 'application/pdf') return NextResponse.json({ message: 'File PDF wajib diunggah.' }, { status: 400 })

    const filePath = await saveDocumentFile(file)
    const result = await query<DocumentRow>(
      `INSERT INTO form_cs_documents (category, control_no, title, language, file_path)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, control_no, title, language, uploaded_at, file_path`,
      [category, controlNo.trim(), title.trim(), language.trim(), filePath]
    )
    return NextResponse.json({ document: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[form-cs/POST]', error)
    return NextResponse.json({ message: `Gagal menyimpan ${categoryLabel(category)}.` }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const category = await getCategory(params)
  if (!category) return NextResponse.json({ message: 'Kategori dokumen tidak valid.' }, { status: 400 })
  if (!getAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const form = await request.formData()
    const id = form.get('id')
    const controlNo = form.get('controlNo')
    const title = form.get('title')
    const language = form.get('language')
    const file = form.get('file')

    if (typeof id !== 'string' || !/^\d+$/.test(id)) return NextResponse.json({ message: 'ID dokumen tidak valid.' }, { status: 400 })
    if (typeof controlNo !== 'string' || !controlNo.trim()) return NextResponse.json({ message: 'No. Kontrol wajib diisi.' }, { status: 400 })
    if (typeof title !== 'string' || !title.trim()) return NextResponse.json({ message: 'Nama dokumen wajib diisi.' }, { status: 400 })
    if (typeof language !== 'string' || !language.trim()) return NextResponse.json({ message: 'Bahasa wajib diisi.' }, { status: 400 })
    if (file instanceof File && file.size > 0 && file.type !== 'application/pdf') return NextResponse.json({ message: 'File harus berupa PDF.' }, { status: 400 })

    const existing = await query<{ file_path: string }>('SELECT file_path FROM form_cs_documents WHERE id = $1 AND category = $2', [id, category])
    if (existing.rows.length === 0) return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })

    const replacement = file instanceof File && file.size > 0
    const newFilePath = replacement ? await saveDocumentFile(file) : null
    const result = await query<DocumentRow>(
      `UPDATE form_cs_documents
       SET control_no = $1, title = $2, language = $3,
           file_path = COALESCE($4, file_path),
           uploaded_at = CASE WHEN $4 IS NOT NULL THEN now() ELSE uploaded_at END
       WHERE id = $5 AND category = $6
       RETURNING id, control_no, title, language, uploaded_at, file_path`,
      [controlNo.trim(), title.trim(), language.trim(), newFilePath, id, category]
    )

    if (newFilePath) await deleteDocumentFile(existing.rows[0].file_path)
    return NextResponse.json({ document: result.rows[0] })
  } catch (error) {
    console.error('[form-cs/PUT]', error)
    return NextResponse.json({ message: `Gagal memperbarui ${categoryLabel(category)}.` }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const category = await getCategory(params)
  if (!category) return NextResponse.json({ message: 'Kategori dokumen tidak valid.' }, { status: 400 })
  if (!getAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id || !/^\d+$/.test(id)) return NextResponse.json({ message: 'ID dokumen tidak valid.' }, { status: 400 })
    const result = await query<{ file_path: string }>('DELETE FROM form_cs_documents WHERE id = $1 AND category = $2 RETURNING file_path', [id, category])
    if (result.rows.length === 0) return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })
    await deleteDocumentFile(result.rows[0].file_path)
    return NextResponse.json({ message: 'Dokumen dihapus.' })
  } catch (error) {
    console.error('[form-cs/DELETE]', error)
    return NextResponse.json({ message: `Gagal menghapus ${categoryLabel(category)}.` }, { status: 500 })
  }
}
