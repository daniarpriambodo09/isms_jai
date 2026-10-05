// app/api/documents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { saveDocumentFile } from '@/lib/storage'
import { logActivity } from '@/lib/activity-log'
import { parseOrderedIds } from '@/lib/ordered-ids'

type DocumentRow = {
  id: number
  title: string
  revision: string
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
             ORDER BY d.sort_order ASC NULLS LAST, d.uploaded_at DESC, d.id DESC`,
            [departmentSlug, sectionSlug]
          )
        ).rows
      : (
          await query<DocumentRow>(
            `SELECT d.id, d.title, d.revision, d.file_path, d.uploaded_at
             FROM documents d
             JOIN departments dept ON dept.id = d.department_id
             WHERE dept.slug = $1 AND d.section_id IS NULL
             ORDER BY d.sort_order ASC NULLS LAST, d.uploaded_at DESC, d.id DESC`,
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
  const session = getIsmsAdminFromRequest(request)
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const form = await request.formData()
    const title = form.get('title')
    const departmentId = form.get('departmentId')
    const sectionId = form.get('sectionId')
    const revisionRaw = form.get('revision')
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

    const revision = typeof revisionRaw === 'string' ? revisionRaw.trim() : ''
    const filePath = await saveDocumentFile(file)

    // A new document goes to the bottom of its list (see PATCH for the order).
    const result = await query<DocumentRow>(
      `INSERT INTO documents (department_id, section_id, title, revision, file_path, sort_order)
       VALUES ($1, $2, $3, $5, $4,
         (SELECT COALESCE(max(sort_order), 0) + 1 FROM documents WHERE department_id = $1 AND section_id IS NOT DISTINCT FROM $2))
       RETURNING id, title, revision, file_path, uploaded_at`,
      [departmentId, sectionId && typeof sectionId === 'string' ? sectionId : null, title.trim(), filePath, revision]
    )

    await logActivity(session, 'create', 'document', result.rows[0].id, `Menambahkan dokumen "${result.rows[0].title}"`)
    return NextResponse.json({ document: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[documents/POST]', error)
    return NextResponse.json({ message: 'Gagal menyimpan dokumen.' }, { status: 500 })
  }
}
// Admin only — the order of one department/section list, set by hand
// (drag a row, or up / down). Body: { ids: number[] } = that list, top to bottom.
export async function PATCH(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const ids = parseOrderedIds(body.ids)
    if (!ids) return NextResponse.json({ message: 'Urutan dokumen tidak valid.' }, { status: 400 })
    // Every id must belong to one and the same list — never mix departments.
    const scopes = await query<{ department_id: number; section_id: number | null; n: string }>(
      'SELECT department_id, section_id, count(*) AS n FROM documents WHERE id = ANY($1) GROUP BY department_id, section_id',
      [ids]
    )
    if (scopes.rows.length !== 1 || Number(scopes.rows[0].n) !== ids.length) {
      return NextResponse.json({ message: 'Daftar dokumen sudah berubah — muat ulang halaman lalu coba lagi.' }, { status: 409 })
    }
    // …and it must be the whole list, so every position is set exactly once.
    const scope = scopes.rows[0]
    const total = Number((await query<{ n: string }>(
      'SELECT count(*) AS n FROM documents WHERE department_id = $1 AND section_id IS NOT DISTINCT FROM $2', [scope.department_id, scope.section_id]
    )).rows[0].n)
    if (total !== ids.length) {
      return NextResponse.json({ message: 'Daftar dokumen sudah berubah — muat ulang halaman lalu coba lagi.' }, { status: 409 })
    }
    await query(
      'UPDATE documents d SET sort_order = v.position FROM unnest($1::int[]) WITH ORDINALITY AS v(id, position) WHERE d.id = v.id',
      [ids]
    )
    await logActivity(session, 'update', 'document', null, `Mengubah urutan ${ids.length} dokumen departemen`)
    return NextResponse.json({ updated: ids.length })
  } catch (error) {
    console.error('[documents/PATCH]', error)
    return NextResponse.json({ message: 'Gagal menyimpan urutan dokumen.' }, { status: 500 })
  }
}
