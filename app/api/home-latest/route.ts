// app/api/home-latest/route.ts
//
// "Dokumen terbaru" on Home (components/home/SecurityPillars.tsx): the most
// recently uploaded documents across every register. Public, so procedures
// are limited to the published ones — the same rule as the register itself.

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Row = { kind: string; title: string; code: string | null; uploaded_at: string; slug: string | null }

const KIND: Record<string, { label: string; href: (row: Row) => string }> = {
  procedure: { label: 'Prosedur ISMS', href: (r) => `/prosedur-isms?q=${encodeURIComponent(r.code ?? r.title)}` },
  standard: { label: 'Standard TMMIN', href: (r) => `/standard-isms-p14?q=${encodeURIComponent(r.code ?? r.title)}` },
  working: { label: 'Working Standard', href: (r) => `/working-standard?q=${encodeURIComponent(r.code ?? r.title)}` },
  form: { label: 'Form Aplikasi', href: (r) => `/form-aplikasi?q=${encodeURIComponent(r.code ?? r.title)}` },
  cs: { label: 'Kontrol CS', href: (r) => `/kontrol-cs?q=${encodeURIComponent(r.code ?? r.title)}` },
  education: { label: 'Education & Training', href: (r) => `/education?q=${encodeURIComponent(r.title)}` },
  department: { label: 'Dokumen Departemen', href: (r) => `/documents/department/${r.slug}?q=${encodeURIComponent(r.title)}` },
}

export async function GET() {
  try {
    const rows = (await query<Row>(
      `SELECT * FROM (
         SELECT 'procedure' AS kind, title, control_no AS code, uploaded_at, NULL::text AS slug
           FROM procedure_documents WHERE approval_status IN ('approved', 'none') AND public_visible
         UNION ALL SELECT 'standard', title, control_no, uploaded_at, NULL FROM standard_isms_p14_documents
         UNION ALL SELECT 'working', title, control_no, uploaded_at, NULL FROM working_standard_documents
         UNION ALL SELECT CASE WHEN category = 'kontrol-cs' THEN 'cs' ELSE 'form' END, title, control_no, uploaded_at, NULL FROM form_cs_documents
         UNION ALL SELECT 'education', title, NULL, uploaded_at, NULL FROM education_documents
         UNION ALL SELECT 'department', d.title, NULL, d.uploaded_at,
                          dep.slug || COALESCE('/' || s.slug, '')
           FROM documents d JOIN departments dep ON dep.id = d.department_id LEFT JOIN sections s ON s.id = d.section_id
       ) latest
       ORDER BY uploaded_at DESC LIMIT 6`
    )).rows
    return NextResponse.json({
      documents: rows.map((row) => ({
        kind: row.kind,
        kindLabel: KIND[row.kind]?.label ?? row.kind,
        title: row.title,
        code: row.code,
        uploadedAt: row.uploaded_at,
        href: KIND[row.kind]?.href(row) ?? '/',
      })),
    })
  } catch (error) {
    console.error('[home-latest/GET]', error)
    return NextResponse.json({ documents: [] })
  }
}
