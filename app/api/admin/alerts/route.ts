// app/api/admin/alerts/route.ts
//
// ISM Admin bell: a single summary of documents due for periodic review.
// Kept small — the bell polls it every 30 s.

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { listReviewItems } from '@/lib/document-review'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    const review = await listReviewItems()
    return NextResponse.json({ review: { overdue: review.overdue.length, soon: review.soon.length } })
  } catch (error) {
    console.error('[admin/alerts/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat peringatan.' }, { status: 500 })
  }
}
