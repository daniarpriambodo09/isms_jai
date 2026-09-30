// app/api/prosedur-isms/[id]/revision-notes/route.ts
//
// ISM Admin: the latest "Minta Revisi" on a procedure — the approver's
// general note and the notes pinned on the document — for the register's
// "Lihat catatan di dokumen" viewer.

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { ensureApprovalSchema, latestRevisionRequest } from '@/lib/procedure-approval'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  try {
    await ensureApprovalSchema()
    const doc = (await query<{ control_no: string; title: string; revision: number; file_path: string }>(
      'SELECT control_no, title, revision, file_path FROM procedure_documents WHERE id = $1',
      [id]
    )).rows[0]
    if (!doc) return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 })
    return NextResponse.json({ document: doc, revisionRequest: await latestRevisionRequest(Number(id)) })
  } catch (error) {
    console.error('[prosedur-isms/revision-notes/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat catatan revisi.' }, { status: 500 })
  }
}
