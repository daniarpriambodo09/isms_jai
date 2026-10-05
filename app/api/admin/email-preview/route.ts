// app/api/admin/email-preview/route.ts
//
// ISM Admin: the list of e-mails the portal sends, and a sample rendering of
// one of them (?id=...) for the "Pratinjau Email" page. Built from made-up
// data by the real template functions — nothing is sent.

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { EMAIL_PREVIEWS, renderEmailPreview } from '@/lib/email-preview'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ items: EMAIL_PREVIEWS })
  try {
    const mail = renderEmailPreview(id, request.nextUrl.origin)
    if (!mail) return NextResponse.json({ message: 'Contoh email tidak ditemukan.' }, { status: 404 })
    return NextResponse.json(mail)
  } catch (error) {
    console.error('[admin/email-preview/GET]', error)
    return NextResponse.json({ message: 'Gagal membuat pratinjau email.' }, { status: 500 })
  }
}
