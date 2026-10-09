// app/api/prosedur-isms/[id]/slots/route.ts
//
// ISM Admin: where each approver's QR is stamped on this document's own
// signature column (see the "Atur Posisi QR" editor). Coordinates are
// fractions (0–1) of the displayed page, top-left origin.
// A position's QR can only be placed once that approver has pressed Setujui
// (editableRoles); the spots of the others are left as they are. Working
// Standard is the exception: its QR are placed automatically, and the Admin
// ISM may move them at any time.

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'
import { approvalHeld, approvedRoleCodes, autoPlacesEveryQr, ensureApprovalSchema, listRoles, parseSlots, releaseIfPlaced, saveSlots, slotsFor } from '@/lib/procedure-approval'
import { isDocKind } from '@/lib/document-kinds'

type Doc = { id: number; kind: string; control_no: string; title: string; revision: number; file_path: string; approval_roles: string[] }

const beforeSending = (doc: Doc) => isDocKind(doc.kind) && autoPlacesEveryQr(doc.kind)

async function getDoc(id: string) {
  const result = await query<Doc>('SELECT id, kind, control_no, title, revision, file_path, approval_roles FROM procedure_documents WHERE id = $1', [id])
  return result.rows[0] ?? null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  try {
    await ensureApprovalSchema()
    const doc = await getDoc(id)
    if (!doc) return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })
    const roles = (await listRoles()).filter((r) => doc.approval_roles.includes(r.code)).map((r) => ({ code: r.code, title: r.title, person_name: r.person_name }))
    return NextResponse.json({ document: doc, roles, slots: await slotsFor(doc.id, doc.file_path), editableRoles: beforeSending(doc) ? doc.approval_roles : await approvedRoleCodes(doc.id), held: await approvalHeld(doc.id) })
  } catch (error) {
    console.error('[prosedur-isms/slots/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat posisi QR.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  try {
    await ensureApprovalSchema()
    const doc = await getDoc(id)
    if (!doc) return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })

    // Working Standard: every position, any time (a request from the held period goes out once they're saved).
    if (beforeSending(doc)) {
      const body = await request.json().catch(() => ({}))
      const slots = parseSlots(body.slots, doc.approval_roles)
      await saveSlots(doc.id, doc.file_path, slots)
      await logActivity(session, 'update', 'procedure_document', doc.id, `Mengatur posisi QR tanda tangan "${doc.title}" (${slots.length} posisi)`)
      const sent = await releaseIfPlaced(doc.id)
      if (sent) await logActivity(session, 'update', 'procedure_document', doc.id, `Mengirim permintaan pengesahan "${doc.title}" ke approver pertama (posisi QR sudah diatur)`)
      return NextResponse.json({ slots: await slotsFor(doc.id, doc.file_path), editableRoles: doc.approval_roles, sent, held: await approvalHeld(doc.id) })
    }
    const approved = await approvedRoleCodes(doc.id)
    if (!approved.length) return NextResponse.json({ message: 'Posisi QR bisa diatur setelah approver menekan Setujui.' }, { status: 409 })
    const body = await request.json().catch(() => ({}))
    const placed = parseSlots(body.slots, approved)
    // the positions that haven't approved yet keep their spots (e.g. found on the sheet's template)
    const kept = (await slotsFor(doc.id, doc.file_path)).filter((slot) => !approved.includes(slot.role_code))
    await saveSlots(doc.id, doc.file_path, [...kept, ...placed])
    await logActivity(session, 'update', 'procedure_document', doc.id, `Mengatur posisi QR tanda tangan "${doc.title}" (${placed.length} posisi)`)
    // Hand back what was stored (with seq numbers).
    return NextResponse.json({ slots: await slotsFor(doc.id, doc.file_path), editableRoles: approved, sent: false, held: await approvalHeld(doc.id) })
  } catch (error) {
    console.error('[prosedur-isms/slots/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan posisi QR.' }, { status: 500 })
  }
}
