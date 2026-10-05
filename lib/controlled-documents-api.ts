// lib/controlled-documents-api.ts
//
// List / add / edit / show-hide / delete for the registers whose documents go
// through e-sign approval ("Catatan Pengesahan"): Prosedur ISMS and Working
// Standard. Both live in procedure_documents, told apart by `kind`; each
// register's route file is one line — documentHandlers('<kind>') — so the two
// can never drift apart. (Approval, QR placement, signed PDF and the other
// per-document routes are under /api/prosedur-isms/… and serve both kinds.)

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest, getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { deleteDocumentFile, saveDocumentFile } from '@/lib/storage'
import { logActivity } from '@/lib/activity-log'
import { currentStepsFor, ensureApprovalSchema, historyCounts, normalizeRoleCodes, slotCounts, startApprovalCycle, verifyBaseUrl } from '@/lib/procedure-approval'
import { DOC_KIND_INFO, type DocKind } from '@/lib/document-kinds'
import { parseOrderedIds } from '@/lib/ordered-ids'

type DocumentRow = {
  id: number
  kind: DocKind
  control_no: string
  title: string
  revision: number
  elf_date: string
  uploaded_at: string
  file_path: string
  approval_roles: string[]
  note: string | null
  approval_status: string
  public_visible: boolean
}

// elf_date as plain YYYY-MM-DD text: a DATE sent as a JS Date shifts a day back in UTC.
const COLUMNS = "id, kind, control_no, title, revision, to_char(elf_date, 'YYYY-MM-DD') AS elf_date, uploaded_at, file_path, approval_roles, note, approval_status, public_visible"

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

async function withApprovals(rows: DocumentRow[]) {
  const steps = await currentStepsFor(rows.map((row) => row.id))
  const counts = await slotCounts(rows.map((row) => row.id))
  const history = await historyCounts(rows.map((row) => row.id))
  return rows.map((row) => ({ ...row, approvals: steps.get(row.id) ?? [], slots_count: counts.get(row.id) ?? 0, history_count: history.get(row.id) ?? 0 }))
}

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === '23505'

export function documentHandlers(kind: DocKind) {
  const info = DOC_KIND_INFO[kind]
  const tag = info.api.replace('/api/', '')
  const duplicate = () => NextResponse.json({ message: `No. Kontrol itu sudah dipakai dokumen lain di ${info.label}.` }, { status: 409 })

  // Visitors see a document only when it is final — every approver approved
  // it, or it needs no approval — AND the admin has it set to show
  // (public_visible). Waiting / sent-back / hidden documents are admin-only.
  async function GET(request: NextRequest) {
    try {
      await ensureApprovalSchema()
      const onlyPublished = !getAdminFromRequest(request)
      const result = await query<DocumentRow>(
        `SELECT ${COLUMNS} FROM procedure_documents
         WHERE kind = $1 ${onlyPublished ? "AND approval_status IN ('approved', 'none') AND public_visible" : ''}
         ORDER BY sort_order ASC NULLS LAST, control_no ASC, id ASC`,
        [kind]
      )
      return NextResponse.json({ documents: await withApprovals(result.rows), verifyBase: await verifyBaseUrl(request.nextUrl.origin) })
    } catch (error) {
      console.error(`[${tag}/GET]`, error)
      return NextResponse.json({ message: `Gagal memuat daftar ${info.label}.` }, { status: 500 })
    }
  }

  async function POST(request: NextRequest) {
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

      const roles = await normalizeRoleCodes(parseRoles(form.get('approvalRoles')), kind)
      const note = parseNote(form.get('note'))

      const filePath = await saveDocumentFile(file)
      let created: DocumentRow
      try {
        created = (await query<DocumentRow>(
          `INSERT INTO procedure_documents (kind, control_no, title, revision, elf_date, file_path, approval_roles, note, sort_order)
           VALUES ($1, $2, $3, 1, $4, $5, $6, $7, (SELECT COALESCE(max(sort_order), 0) + 1 FROM procedure_documents WHERE kind = $1))
           RETURNING ${COLUMNS}`,
          [kind, controlNo.trim().toUpperCase(), title.trim(), elfDate, filePath, roles, note]
        )).rows[0]
      } catch (error) {
        await deleteDocumentFile(filePath).catch(() => {})
        if (isUniqueViolation(error)) return duplicate()
        throw error
      }
      await startApprovalCycle(created.id, roles)

      await logActivity(session, 'create', 'procedure_document', created.id, `Menambahkan ${info.label} "${created.title}"${roles.length ? ` (pengesahan: ${roles.join(' → ')})` : ''}`)
      return NextResponse.json({ document: created }, { status: 201 })
    } catch (error) {
      console.error(`[${tag}/POST]`, error)
      return NextResponse.json({ message: `Gagal menyimpan ${info.label}.` }, { status: 500 })
    }
  }

  async function PUT(request: NextRequest) {
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

      const existing = await query<{ file_path: string; revision: number; approval_roles: string[]; uploaded_at: string }>(
        'SELECT file_path, revision, approval_roles, uploaded_at FROM procedure_documents WHERE id = $1 AND kind = $2',
        [id, kind]
      )
      if (existing.rows.length === 0) {
        return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })
      }
      const before = existing.rows[0]

      const roles = await normalizeRoleCodes(parseRoles(form.get('approvalRoles')), kind)
      const note = parseNote(form.get('note'))

      const replacement = file instanceof File && file.size > 0
      const newFilePath = replacement ? await saveDocumentFile(file) : null
      let updated: DocumentRow
      try {
        updated = (await query<DocumentRow>(
          `UPDATE procedure_documents
           SET control_no = $1,
               title = $2,
               elf_date = $3,
               file_path = COALESCE($4, file_path),
               uploaded_at = CASE WHEN $4 IS NOT NULL THEN now() ELSE uploaded_at END,
               revision = $6,
               approval_roles = $7,
               note = $8
           WHERE id = $5 AND kind = $9
           RETURNING ${COLUMNS}`,
          [controlNo.trim().toUpperCase(), title.trim(), elfDate, newFilePath, id, revision, roles, note, kind]
        )).rows[0]
      } catch (error) {
        if (newFilePath) await deleteDocumentFile(newFilePath).catch(() => {})
        if (isUniqueViolation(error)) return duplicate()
        throw error
      }

      // The replaced file is kept as an earlier version, so a fix can be
      // compared with the file the revision was asked on.
      if (newFilePath) {
        await ensureApprovalSchema()
        await query(
          'INSERT INTO procedure_document_versions (document_id, revision, file_path, uploaded_at, replaced_by) VALUES ($1, $2, $3, $4, $5)',
          [id, before.revision, before.file_path, before.uploaded_at, session.username]
        )
      }

      // A new file, a new revision number or a different set of approvers is a
      // new thing to sign — restart the cycle. Plain metadata edits keep it.
      const rolesChanged = roles.join(',') !== (before.approval_roles ?? []).join(',')
      const restarted = replacement || revision !== before.revision || rolesChanged
      if (restarted) await startApprovalCycle(Number(id), roles)

      await logActivity(session, 'update', 'procedure_document', id, `Mengubah ${info.label} "${updated.title}" (revisi ${updated.revision})${restarted && roles.length ? ' — pengesahan dimulai ulang' : ''}`)
      return NextResponse.json({ document: updated, approvalRestarted: restarted && roles.length > 0 })
    } catch (error) {
      console.error(`[${tag}/PUT]`, error)
      return NextResponse.json({ message: `Gagal memperbarui ${info.label}.` }, { status: 500 })
    }
  }

  // ISM Admin: show / hide documents on the visitors' page, or set the order.
  // Body: { ids: number[], publicVisible: boolean }. Only final documents ever
  // reach visitors, whatever this is set to.
  async function PATCH(request: NextRequest) {
    const session = getIsmsAdminFromRequest(request)
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
    }

    try {
      const body = await request.json().catch(() => ({}))

      // { order: number[] } — the register's order set by hand: every document
      // of this kind, top to bottom (drag a row, or up / down).
      if (body.order !== undefined) {
        const order = parseOrderedIds(body.order)
        if (!order) return NextResponse.json({ message: 'Urutan dokumen tidak valid.' }, { status: 400 })
        const total = Number((await query<{ n: string }>('SELECT count(*) AS n FROM procedure_documents WHERE kind = $1', [kind])).rows[0].n)
        const known = Number((await query<{ n: string }>('SELECT count(*) AS n FROM procedure_documents WHERE kind = $1 AND id = ANY($2)', [kind, order])).rows[0].n)
        if (known !== order.length || total !== order.length) {
          return NextResponse.json({ message: 'Daftar dokumen sudah berubah — muat ulang halaman lalu coba lagi.' }, { status: 409 })
        }
        await query(
          'UPDATE procedure_documents d SET sort_order = v.position FROM unnest($1::int[]) WITH ORDINALITY AS v(id, position) WHERE d.id = v.id AND d.kind = $2',
          [order, kind]
        )
        await logActivity(session, 'update', 'procedure_document', null, `Mengubah urutan ${order.length} dokumen ${info.label}`)
        return NextResponse.json({ updated: order.length })
      }

      const ids: number[] = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => Number.isInteger(id) && (id as number) > 0).slice(0, 500) : []
      if (ids.length === 0 || typeof body.publicVisible !== 'boolean') {
        return NextResponse.json({ message: 'Pilih dokumen dan tentukan tampil / sembunyikan.' }, { status: 400 })
      }

      const result = await query<{ id: number; control_no: string }>(
        'UPDATE procedure_documents SET public_visible = $2 WHERE id = ANY($1) AND kind = $3 AND public_visible <> $2 RETURNING id, control_no',
        [ids, body.publicVisible, kind]
      )
      if (result.rows.length > 0) {
        const names = result.rows.map((row) => row.control_no).join(', ').slice(0, 300)
        await logActivity(session, 'update', 'procedure_document', result.rows.length === 1 ? result.rows[0].id : null,
          `${body.publicVisible ? 'Menampilkan ke pengunjung' : 'Menyembunyikan dari pengunjung'} (${info.label}): ${names}`)
      }
      return NextResponse.json({ updated: result.rows.length })
    } catch (error) {
      console.error(`[${tag}/PATCH]`, error)
      return NextResponse.json({ message: 'Gagal mengubah tampilan dokumen.' }, { status: 500 })
    }
  }

  async function DELETE(request: NextRequest) {
    const session = getIsmsAdminFromRequest(request)
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
    }

    try {
      const id = request.nextUrl.searchParams.get('id')
      if (!id || !/^\d+$/.test(id)) {
        return NextResponse.json({ message: 'ID dokumen tidak valid.' }, { status: 400 })
      }

      await ensureApprovalSchema()
      // Earlier versions go with the document (rows by cascade, files below).
      const versions = (await query<{ file_path: string }>(
        'SELECT v.file_path FROM procedure_document_versions v JOIN procedure_documents d ON d.id = v.document_id WHERE d.id = $1 AND d.kind = $2',
        [id, kind]
      )).rows
      const result = await query<{ id: number; title: string; file_path: string }>(
        'DELETE FROM procedure_documents WHERE id = $1 AND kind = $2 RETURNING id, title, file_path',
        [id, kind]
      )
      if (result.rows.length === 0) {
        return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })
      }

      await deleteDocumentFile(result.rows[0].file_path)
      for (const v of versions) await deleteDocumentFile(v.file_path).catch(() => {})
      await logActivity(session, 'delete', 'procedure_document', id, `Menghapus ${info.label} "${result.rows[0].title}"`)
      return NextResponse.json({ message: 'Dokumen dihapus.' })
    } catch (error) {
      console.error(`[${tag}/DELETE]`, error)
      return NextResponse.json({ message: `Gagal menghapus ${info.label}.` }, { status: 500 })
    }
  }

  return { GET, POST, PUT, PATCH, DELETE }
}
