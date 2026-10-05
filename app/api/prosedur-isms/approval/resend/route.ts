// app/api/prosedur-isms/approval/resend/route.ts
//
// ism_admin only. mode 'resend' re-emails whoever the document is currently
// waiting on (same link when it goes to the same address; a fresh one — the old then says "replaced" — when the address changed); mode 'restart' starts
// the whole approval cycle again from the first approver (e.g. after a
// rejection, once the document has been fixed without a new revision).

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'
import { ensureApprovalSchema, sendStepRequest, startApprovalCycle, missingEmailMessage, rolesWithoutEmail } from '@/lib/procedure-approval'
import { docKindInfo, isDocKind } from '@/lib/document-kinds'

export async function POST(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    await ensureApprovalSchema()
    const body = await request.json().catch(() => ({}))
    const documentId = Number(body.documentId)
    const mode = body.mode === 'restart' ? 'restart' : 'resend'
    if (!Number.isInteger(documentId) || documentId <= 0) return NextResponse.json({ message: 'ID dokumen tidak valid.' }, { status: 400 })

    const doc = await query<{ kind: string; title: string; revision: number; approval_roles: string[] }>('SELECT kind, title, revision, approval_roles FROM procedure_documents WHERE id = $1', [documentId])
    if (!doc.rows[0]) return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })

    if (mode === 'restart') {
      if (!doc.rows[0].approval_roles?.length) return NextResponse.json({ message: 'Dokumen ini tidak memerlukan pengesahan.' }, { status: 400 })
      const noEmail = missingEmailMessage(await rolesWithoutEmail(doc.rows[0].approval_roles, isDocKind(doc.rows[0].kind) ? doc.rows[0].kind : 'procedure'))
      if (noEmail) return NextResponse.json({ message: noEmail }, { status: 400 })
      await startApprovalCycle(documentId, doc.rows[0].approval_roles)
      await logActivity(session, 'update', 'procedure_document', documentId, `Memulai ulang pengesahan ${docKindInfo(doc.rows[0].kind).label} "${doc.rows[0].title}"`)
    } else {
      const pending = await query<{ id: number }>(
        `SELECT id FROM procedure_approvals WHERE document_id = $1 AND revision = $2 AND status = 'pending' LIMIT 1`,
        [documentId, doc.rows[0].revision]
      )
      if (!pending.rows[0]) return NextResponse.json({ message: 'Tidak ada tahap yang sedang menunggu.' }, { status: 400 })
      const result = await sendStepRequest(pending.rows[0].id)
      await logActivity(session, 'update', 'procedure_document', documentId, `Mengirim ulang email pengesahan ${docKindInfo(doc.rows[0].kind).label} "${doc.rows[0].title}"`)
      if (!result.sent) return NextResponse.json({ message: result.error ?? 'Gagal mengirim email.' }, { status: 502 })
    }

    const step = await query<{ approver_name: string | null; email_error: string | null; status: string }>(
      `SELECT approver_name, email_error, status FROM procedure_approvals
       WHERE document_id = $1 AND status = 'pending' ORDER BY step LIMIT 1`,
      [documentId]
    )
    const current = step.rows[0]
    if (current?.email_error) return NextResponse.json({ message: current.email_error }, { status: 502 })
    const name = current?.approver_name ?? ''
    return NextResponse.json({ message: current ? `Email pengesahan dikirim ke ${name}${name.endsWith('.') ? '' : '.'}` : 'Selesai.' })
  } catch (error) {
    console.error('[prosedur-isms/approval/resend]', error)
    return NextResponse.json({ message: 'Gagal mengirim ulang pengesahan.' }, { status: 500 })
  }
}
