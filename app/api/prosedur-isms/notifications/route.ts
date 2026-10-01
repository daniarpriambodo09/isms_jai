// app/api/prosedur-isms/notifications/route.ts
//
// ISM Admin bell: procedure approvals that need attention — documents an
// approver sent back for revision, and freshly approved ones (with a heads-up
// when not every QR is placed on the document). POST dismisses one.

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { dismissProcedureNotice, listProcedureNotices } from '@/lib/procedure-approval'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    return NextResponse.json({ notices: await listProcedureNotices() })
  } catch (error) {
    console.error('[prosedur-isms/notifications/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat notifikasi.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const documentId = Number(body.documentId)
  if (!Number.isInteger(documentId) || documentId <= 0) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  try {
    await dismissProcedureNotice(documentId)
    return NextResponse.json({ message: 'Notifikasi ditutup.' })
  } catch (error) {
    console.error('[prosedur-isms/notifications/POST]', error)
    return NextResponse.json({ message: 'Gagal menutup notifikasi.' }, { status: 500 })
  }
}
