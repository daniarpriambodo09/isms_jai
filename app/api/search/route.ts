// app/api/search/route.ts
//
// Global search (navbar, Ctrl+K): every published document — procedures,
// TMMIN standards, working standards, application forms, CS control,
// education material and department documents — by control number or title,
// plus the portal's own pages. Public, like the documents themselves.

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { isRateLimited } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

type Hit = { group: string; title: string; subtitle: string; href: string; filePath: string | null; mimeType: string | null }

const PAGES: { title: string; href: string; keywords: string }[] = [
  { title: 'Home', href: '/', keywords: 'beranda home portal' },
  { title: 'Kebijakan Dasar ISMS', href: '/kebijakan-dasar-ISMS', keywords: 'kebijakan policy basic isms' },
  { title: 'Prosedur ISMS', href: '/prosedur-isms', keywords: 'prosedur procedure' },
  { title: 'Standard Requirement TMMIN', href: '/standard-isms-p14', keywords: 'standard tmmin requirement p14' },
  { title: 'Working Standard', href: '/working-standard', keywords: 'working standard ws' },
  { title: 'Education & Training', href: '/education', keywords: 'education training edukasi materi pelatihan' },
  { title: 'Form Aplikasi', href: '/form-aplikasi', keywords: 'form aplikasi formulir' },
  { title: 'Kontrol CS', href: '/kontrol-cs', keywords: 'kontrol cs control' },
  { title: 'Jadwal Audit', href: '/audits', keywords: 'jadwal audit schedule' },
  { title: 'Ijin Foto/Video', href: '/ijin-foto-video', keywords: 'izin ijin foto video kamera photography' },
  { title: 'Rekap Foto/Video', href: '/rekap-foto-video', keywords: 'rekap foto video ledger' },
  { title: 'Verifikasi Pengesahan', href: '/verifikasi-pengesahan', keywords: 'verifikasi qr pengesahan tanda tangan' },
]

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (isRateLimited(`search:${ip}`, 120, 60_000)) return NextResponse.json({ message: 'Terlalu banyak pencarian.' }, { status: 429 })
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80)
  if (q.length < 2) return NextResponse.json({ results: [] })

  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  const qWords = q.toLowerCase().split(/\s+/)
  const pages: Hit[] = PAGES
    .filter((p) => qWords.every((w) => `${p.title} ${p.keywords}`.toLowerCase().includes(w)))
    .map((p) => ({ group: 'Halaman', title: p.title, subtitle: 'Menu portal', href: p.href, filePath: null, mimeType: null }))

  try {
    const run = <T extends Record<string, unknown>>(sql: string) => query<T>(sql, [like]).then((r) => r.rows).catch(() => [] as T[])
    const [procedures, standards, working, forms, education, departmentDocs] = await Promise.all([
      run<{ control_no: string; title: string; revision: number; file_path: string }>(
        // Only published procedures — waiting, sent-back or admin-hidden ones aren't public.
        "SELECT control_no, title, revision, file_path FROM procedure_documents WHERE kind = 'procedure' AND approval_status IN ('approved', 'none') AND public_visible AND (control_no ILIKE $1 OR title ILIKE $1) ORDER BY control_no LIMIT 8"),
      run<{ control_no: string; title: string; revision: number; file_path: string }>(
        "SELECT control_no, title, revision, file_path FROM standard_isms_p14_documents WHERE control_no ILIKE $1 OR title ILIKE $1 ORDER BY control_no LIMIT 8"),
      run<{ control_no: string; title: string; revision: number; file_path: string }>(
        // Working standards share the procedures' table and publishing rule.
        "SELECT control_no, title, revision, file_path FROM procedure_documents WHERE kind = 'working_standard' AND approval_status IN ('approved', 'none') AND public_visible AND (control_no ILIKE $1 OR title ILIKE $1) ORDER BY control_no LIMIT 8"),
      run<{ control_no: string; title: string; category: string; file_path: string; file_kind: string }>(
        "SELECT control_no, title, category, file_path, file_kind FROM form_cs_documents WHERE control_no ILIKE $1 OR title ILIKE $1 ORDER BY category, control_no LIMIT 10"),
      run<{ title: string; category: string; language: string; file_path: string; mime_type: string }>(
        "SELECT title, category, language, file_path, mime_type FROM education_documents WHERE title ILIKE $1 OR category ILIKE $1 ORDER BY title LIMIT 8"),
      run<{ title: string; revision: number | null; file_path: string; dept_name: string; dept_slug: string; section_name: string | null; section_slug: string | null }>(
        `SELECT d.title, d.revision, d.file_path, dep.name AS dept_name, dep.slug AS dept_slug, s.name AS section_name, s.slug AS section_slug
         FROM documents d JOIN departments dep ON dep.id = d.department_id LEFT JOIN sections s ON s.id = d.section_id
         WHERE d.title ILIKE $1 ORDER BY d.title LIMIT 8`),
    ])

    const results: Hit[] = [
      ...pages,
      ...procedures.map((d) => ({ group: 'Prosedur ISMS', title: d.title, subtitle: `${d.control_no} · Rev. ${d.revision}`, href: `/prosedur-isms?q=${encodeURIComponent(d.control_no)}`, filePath: d.file_path, mimeType: 'application/pdf' })),
      ...standards.map((d) => ({ group: 'Standard TMMIN', title: d.title, subtitle: `${d.control_no} · Rev. ${d.revision}`, href: `/standard-isms-p14?q=${encodeURIComponent(d.control_no)}`, filePath: d.file_path, mimeType: 'application/pdf' })),
      ...working.map((d) => ({ group: 'Working Standard', title: d.title, subtitle: `${d.control_no} · Rev. ${d.revision}`, href: `/working-standard?q=${encodeURIComponent(d.control_no)}`, filePath: d.file_path, mimeType: 'application/pdf' })),
      ...forms.map((d) => ({
        group: d.category === 'kontrol-cs' ? 'Kontrol CS' : 'Form Aplikasi', title: d.title, subtitle: d.control_no,
        href: `/${d.category}?q=${encodeURIComponent(d.control_no)}`, filePath: d.file_path,
        mimeType: d.file_kind === 'xls' ? 'application/vnd.ms-excel' : 'application/pdf',
      })),
      ...education.map((d) => ({ group: 'Education & Training', title: d.title, subtitle: `${d.category} · ${d.language}`, href: `/education?q=${encodeURIComponent(d.title)}`, filePath: d.file_path, mimeType: d.mime_type })),
      ...departmentDocs.map((d) => ({
        group: 'Dokumen Departemen', title: d.title, subtitle: [d.dept_name, d.section_name].filter(Boolean).join(' · '),
        href: `/documents/department/${d.dept_slug}${d.section_slug ? `/${d.section_slug}` : ''}?q=${encodeURIComponent(d.title)}`,
        filePath: d.file_path, mimeType: 'application/pdf',
      })),
    ]
    return NextResponse.json({ results })
  } catch (error) {
    console.error('[search/GET]', error)
    return NextResponse.json({ results: pages })
  }
}
