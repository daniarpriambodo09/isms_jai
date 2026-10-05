// app/api/home-stats/route.ts
//
// Aggregate counters for the Home "ISMS dalam angka" strip
// (components/home/IsmsPulse.tsx). Public on purpose, like the Home page
// itself — it only ever returns counts, never names or document titles.
// Each count is isolated so a table that doesn't exist yet (lazy schemas,
// fresh installs) just reads as 0 instead of failing the whole strip.

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

async function count(sql: string): Promise<number> {
  try {
    const result = await query<{ n: number }>(sql)
    return Number(result.rows[0]?.n ?? 0)
  } catch {
    return 0
  }
}

const DOCUMENT_TABLES = [
  'procedure_documents', // procedures, working standards and TMMIN standards (kind)
  'form_cs_documents',
  'education_documents',
  'documents',
]

const THIS_MONTH = `date_trunc('month', now())`

export async function GET() {
  const [
    documentCounts,
    proceduresApproved,
    proceduresPending,
    photoApproved,
    photoTotal,
    visitsTotal,
    visitsMonth,
    specialAreaApproved,
  ] = await Promise.all([
    // (Form Review records share procedure_documents but are not library documents.)
    Promise.all(DOCUMENT_TABLES.map((table) => count(`SELECT count(*)::int AS n FROM ${table}${table === 'procedure_documents' ? " WHERE kind <> 'review_form'" : ''}`))),
    count(`SELECT count(*)::int AS n FROM procedure_documents WHERE kind = 'procedure' AND approval_status = 'approved'`),
    count(`SELECT count(*)::int AS n FROM procedure_documents WHERE kind = 'procedure' AND approval_status = 'pending'`),
    count(`SELECT count(*)::int AS n FROM photo_video_requests WHERE status = 'approved'`),
    count(`SELECT count(*)::int AS n FROM photo_video_requests`),
    count(`SELECT count(*)::int AS n FROM vendor_registrations`),
    count(`SELECT count(*)::int AS n FROM vendor_registrations WHERE registered_at >= ${THIS_MONTH}`),
    count(`SELECT count(*)::int AS n FROM special_area_requests WHERE status = 'approved'`),
  ])

  return NextResponse.json(
    {
      documents: documentCounts.reduce((sum, n) => sum + n, 0),
      proceduresApproved,
      proceduresPending,
      photoApproved,
      photoTotal,
      visitsTotal,
      visitsMonth,
      specialAreaApproved,
      generatedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
