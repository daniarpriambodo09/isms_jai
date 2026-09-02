import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { deleteDocumentFile, saveDocumentFile } from '@/lib/storage'

type Category = 'form-aplikasi' | 'kontrol-cs'
type KeteranganType = 'none' | 'plain-note' | 'web-base-approval' | 'list-all-daftar'
type FileKind = 'pdf' | 'xls'
type DocumentRow = {
  id: number
  control_no: string
  title: string
  language: string
  uploaded_at: string
  file_path: string
  keterangan_type: KeteranganType
  keterangan_note: string | null
  file_variant: string | null
  file_kind: FileKind
  title_emphasis_from: number | null
}

const KETERANGAN_TYPES: KeteranganType[] = ['none', 'plain-note', 'web-base-approval', 'list-all-daftar']
const FILE_KINDS: FileKind[] = ['pdf', 'xls']

function isCategory(value: string): value is Category { return value === 'form-aplikasi' || value === 'kontrol-cs' }
function categoryLabel(category: Category) { return category === 'form-aplikasi' ? 'Form Aplikasi' : 'Kontrol CS' }
function isKeteranganType(value: string): value is KeteranganType { return (KETERANGAN_TYPES as string[]).includes(value) }
function isFileKind(value: string): value is FileKind { return (FILE_KINDS as string[]).includes(value) }

async function getCategory(params: Promise<{ category: string }>) {
  const { category } = await params
  return isCategory(category) ? category : null
}

const SELECT_COLUMNS = `id, control_no, title, language, uploaded_at, file_path,
  keterangan_type, keterangan_note, file_variant, file_kind, title_emphasis_from`

export async function GET(_request: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const category = await getCategory(params)
  if (!category) return NextResponse.json({ message: 'Kategori dokumen tidak valid.' }, { status: 400 })

  try {
    const result = await query<DocumentRow>(
      `SELECT ${SELECT_COLUMNS}
       FROM form_cs_documents
       WHERE category = $1
       ORDER BY control_no ASC, file_variant ASC NULLS FIRST, id ASC`,
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
    const keteranganTypeRaw = form.get('keteranganType')
    const keteranganNoteRaw = form.get('keteranganNote')
    const fileVariantRaw = form.get('fileVariant')
    const fileKindRaw = form.get('fileKind')
    const titleEmphasisFromRaw = form.get('titleEmphasisFrom')

    if (typeof controlNo !== 'string' || !controlNo.trim()) return NextResponse.json({ message: 'No. Kontrol wajib diisi.' }, { status: 400 })
    if (typeof title !== 'string' || !title.trim()) return NextResponse.json({ message: 'Nama dokumen wajib diisi.' }, { status: 400 })
    if (typeof language !== 'string' || !language.trim()) return NextResponse.json({ message: 'Bahasa wajib diisi.' }, { status: 400 })
    if (!(file instanceof File) || file.size === 0 || file.type !== 'application/pdf') return NextResponse.json({ message: 'File PDF wajib diunggah.' }, { status: 400 })

    const keteranganType: KeteranganType = typeof keteranganTypeRaw === 'string' && isKeteranganType(keteranganTypeRaw) ? keteranganTypeRaw : 'none'
    const keteranganNote = keteranganType === 'plain-note' && typeof keteranganNoteRaw === 'string' && keteranganNoteRaw.trim() ? keteranganNoteRaw.trim() : null
    const fileVariant = typeof fileVariantRaw === 'string' && fileVariantRaw.trim() ? fileVariantRaw.trim().toUpperCase() : null
    const fileKind: FileKind = typeof fileKindRaw === 'string' && isFileKind(fileKindRaw) ? fileKindRaw : 'pdf'
    const titleEmphasisFrom = typeof titleEmphasisFromRaw === 'string' && /^\d+$/.test(titleEmphasisFromRaw) ? Number(titleEmphasisFromRaw) : null

    const filePath = await saveDocumentFile(file)
    const result = await query<DocumentRow>(
      `INSERT INTO form_cs_documents
         (category, control_no, title, language, file_path, keterangan_type, keterangan_note, file_variant, file_kind, title_emphasis_from)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${SELECT_COLUMNS}`,
      [category, controlNo.trim(), title.trim(), language.trim(), filePath, keteranganType, keteranganNote, fileVariant, fileKind, titleEmphasisFrom]
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
    const keteranganTypeRaw = form.get('keteranganType')
    const keteranganNoteRaw = form.get('keteranganNote')
    const fileVariantRaw = form.get('fileVariant')
    const fileKindRaw = form.get('fileKind')
    const titleEmphasisFromRaw = form.get('titleEmphasisFrom')

    if (typeof id !== 'string' || !/^\d+$/.test(id)) return NextResponse.json({ message: 'ID dokumen tidak valid.' }, { status: 400 })
    if (typeof controlNo !== 'string' || !controlNo.trim()) return NextResponse.json({ message: 'No. Kontrol wajib diisi.' }, { status: 400 })
    if (typeof title !== 'string' || !title.trim()) return NextResponse.json({ message: 'Nama dokumen wajib diisi.' }, { status: 400 })
    if (typeof language !== 'string' || !language.trim()) return NextResponse.json({ message: 'Bahasa wajib diisi.' }, { status: 400 })
    if (file instanceof File && file.size > 0 && file.type !== 'application/pdf') return NextResponse.json({ message: 'File harus berupa PDF.' }, { status: 400 })

    const keteranganType: KeteranganType = typeof keteranganTypeRaw === 'string' && isKeteranganType(keteranganTypeRaw) ? keteranganTypeRaw : 'none'
    const keteranganNote = keteranganType === 'plain-note' && typeof keteranganNoteRaw === 'string' && keteranganNoteRaw.trim() ? keteranganNoteRaw.trim() : null
    const fileVariant = typeof fileVariantRaw === 'string' && fileVariantRaw.trim() ? fileVariantRaw.trim().toUpperCase() : null
    const fileKind: FileKind = typeof fileKindRaw === 'string' && isFileKind(fileKindRaw) ? fileKindRaw : 'pdf'
    const titleEmphasisFrom = typeof titleEmphasisFromRaw === 'string' && /^\d+$/.test(titleEmphasisFromRaw) ? Number(titleEmphasisFromRaw) : null

    const existing = await query<{ file_path: string }>('SELECT file_path FROM form_cs_documents WHERE id = $1 AND category = $2', [id, category])
    if (existing.rows.length === 0) return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })

    const replacement = file instanceof File && file.size > 0
    const newFilePath = replacement ? await saveDocumentFile(file) : null
    const result = await query<DocumentRow>(
      `UPDATE form_cs_documents
       SET control_no = $1, title = $2, language = $3,
           file_path = COALESCE($4, file_path),
           uploaded_at = CASE WHEN $4 IS NOT NULL THEN now() ELSE uploaded_at END,
           keterangan_type = $5, keterangan_note = $6, file_variant = $7, file_kind = $8, title_emphasis_from = $9
       WHERE id = $10 AND category = $11
       RETURNING ${SELECT_COLUMNS}`,
      [controlNo.trim(), title.trim(), language.trim(), newFilePath, keteranganType, keteranganNote, fileVariant, fileKind, titleEmphasisFrom, id, category]
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
