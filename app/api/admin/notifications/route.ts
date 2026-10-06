// app/api/admin/notifications/route.ts
//
// The ISM Admin bell (polled every 30 s): GET → { action, info } items from
// lib/admin-notifications.ts. POST { dismiss: { type, id } } closes one Info
// item; POST { all: true } marks every Info item as seen.
// GET ?history=1[&category=…] → the event log for the Riwayat Notifikasi page.

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { dismiss, dismissAll, getBell, listHistory, type DismissRef, type NoticeCategory } from '@/lib/admin-notifications'

export const dynamic = 'force-dynamic'

const CATEGORIES: NoticeCategory[] = ['photo', 'special', 'esign', 'guest', 'review']

export async function GET(request: NextRequest) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    if (request.nextUrl.searchParams.get('history') === '1') {
      const category = request.nextUrl.searchParams.get('category')
      return NextResponse.json({ history: await listHistory({ category: CATEGORIES.includes(category as NoticeCategory) ? (category as NoticeCategory) : null }) })
    }
    return NextResponse.json(await getBell())
  } catch (error) {
    console.error('[admin/notifications/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat notifikasi.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  try {
    if (body?.all === true) return NextResponse.json({ dismissed: await dismissAll() })
    const ref = body?.dismiss as Partial<DismissRef> | undefined
    const id = Number(ref?.id)
    if (!ref || !['procedure', 'taken', 'log'].includes(ref.type as string) || !Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: 'Notifikasi tidak valid.' }, { status: 400 })
    }
    await dismiss({ type: ref.type as DismissRef['type'], id })
    return NextResponse.json({ message: 'Notifikasi ditutup.' })
  } catch (error) {
    console.error('[admin/notifications/POST]', error)
    return NextResponse.json({ message: 'Gagal menutup notifikasi.' }, { status: 500 })
  }
}
