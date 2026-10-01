import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest, getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { deleteDocumentFile, saveDocumentFile } from '@/lib/storage'
import { logActivity } from '@/lib/activity-log'
import { currentStepsFor, ensureApprovalSchema, normalizeRoleCodes, slotCounts, startApprovalCycle, verifyBaseUrl } from '@/lib/procedure-approval'

type ProcedureRow = {
  id: number
  control_no: string
  title: string
  revision: number
  elf_date: string
  uploaded_at: string
  file_path: string
  approval_roles: string[]
  note: string | null
  approval_status: string
}

// elf_date as plain YYYY-MM-DD text: a DATE sent as a JS Date shifts a day back in UTC.
const COLUMNS = "id, control_no, title, revision, to_char(elf_date, 'YYYY-MM-DD') AS elf_date, uploaded_at, file_path, approval_roles, note, approval_status"

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

// approvalRoles arrives as a JSON array of role codes in the form data.
function parseRoles(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== 'string' || !raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function parseNote(raw: FormDataEntryValue | null) {
  return typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 1000) : null
}

async function withApprovals(rows: ProcedureRow[]) {
  const steps = await currentStepsFor(rows.map((row) => row.id))
  const counts = await slotCounts(rows.map((row) => row.id))
  return rows.map((row) => ({ ...row, approvals: steps.get(row.id) ?? [], slots_count: counts.get(row.id) ?? 0 }))
}

// Visitors see a procedure only once it is final: every approver approved it,
// or it needs no approval. Waiting / sent-back documents are admin-only.
export async function GET(request: NextRequest) {
  try {
    await ensureApprovalSchema()
    const onlyPublished = !getAdminFromRequest(request)
    const result = await query<ProcedureRow>(
      `SELECT ${COLUMNS} FROM procedure_documents
       ${onlyPublished ? "WHERE approval_status IN ('approved', 'none')" : ''}
       ORDER BY control_no ASC, id ASC`
    )
    return NextResponse.json({ documents: await withApprovals(result.rows), verifyBase: await verifyBaseUrl(request.nextUrl.origin) })
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
    await ensureApprovalSchema()
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
      return NextResponse.json({ message: 'Eff Date wajib diisi.' }, { status: 400 })
    }
    if (!(file instanceof File) || file.size === 0 || file.type !== 'application/pdf') {
      return NextResponse.json({ message: 'File PDF wajib diunggah.' }, { status: 400 })
    }

    const roles = await normalizeRoleCodes(parseRoles(form.get('approvalRoles')))
    const note = parseNote(form.get('note'))

    const filePath = await saveDocumentFile(file)
    const result = await query<ProcedureRow>(
      `INSERT INTO procedure_documents (control_no, title, revision, elf_date, file_path, approval_roles, note)
       VALUES ($1, $2, 1, $3, $4, $5, $6)
       RETURNING ${COLUMNS}`,
      [controlNo.trim().toUpperCase(), title.trim(), elfDate, filePath, roles, note]
    )
    const created = result.rows[0]
    await startApprovalCycle(created.id, roles)

    await logActivity(session, 'create', 'procedure_document', created.id, `Menambahkan prosedur ISMS "${created.title}"${roles.length ? ` (pengesahan: ${roles.join(' → ')})` : ''}`)
    return NextResponse.json({ document: created }, { status: 201 })
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
    await ensureApprovalSchema()
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
      return NextResponse.json({ message: 'Eff Date wajib diisi.' }, { status: 400 })
    }
    const revision = typeof revisionRaw === 'string' && /^\d+$/.test(revisionRaw) ? Number(revisionRaw) : NaN
    if (!Number.isInteger(revision) || revision < 1) {
      return NextResponse.json({ message: 'Revisi wajib diisi dengan angka minimal 1.' }, { status: 400 })
    }
    if (file instanceof File && file.size > 0 && file.type !== 'application/pdf') {
      return NextResponse.json({ message: 'File harus berupa PDF.' }, { status: 400 })
    }

    const existing = await query<{ file_path: string; revision: number; approval_roles: string[] }>(
      'SELECT file_path, revision, approval_roles FROM procedure_documents WHERE id = $1',
      [id]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })
    }
    const before = existing.rows[0]

    const roles = await normalizeRoleCodes(parseRoles(form.get('approvalRoles')))
    const note = parseNote(form.get('note'))

    const replacement = file instanceof File && file.size > 0
    const newFilePath = replacement ? await saveDocumentFile(file) : null
    const result = await query<ProcedureRow>(
      `UPDATE procedure_documents
       SET control_no = $1,
           title = $2,
           elf_date = $3,
           file_path = COALESCE($4, file_path),
           uploaded_at = CASE WHEN $4 IS NOT NULL THEN now() ELSE uploaded_at END,
           revision = $6,
           approval_roles = $7,
           note = $8
       WHERE id = $5
       RETURNING ${COLUMNS}`,
      [controlNo.trim().toUpperCase(), title.trim(), elfDate, newFilePath, id, revision, roles, note]
    )

    if (newFilePath) await deleteDocumentFile(before.file_path)

    // A new file, a new revision number or a different set of approvers is a
    // new thing to sign — restart the cycle. Plain metadata edits keep it.
    const rolesChanged = roles.join(',') !== (before.approval_roles ?? []).join(',')
    const restarted = replacement || revision !== before.revision || rolesChanged
    if (restarted) await startApprovalCycle(Number(id), roles)

    await logActivity(session, 'update', 'procedure_document', id, `Mengubah prosedur ISMS "${result.rows[0].title}" (revisi ${result.rows[0].revision})${restarted && roles.length ? ' — pengesahan dimulai ulang' : ''}`)
    return NextResponse.json({ document: result.rows[0], approvalRestarted: restarted && roles.length > 0 })
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
