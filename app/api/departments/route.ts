// app/api/departments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getItAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'
import { slugify } from '@/lib/slug'

type DepartmentRow = { id: number; name: string; slug: string }
type SectionRow = { id: number; department_id: number; name: string; slug: string }

// Public — the navbar and every visitor need this to browse documents.
export async function GET() {
  try {
    const [departmentsResult, sectionsResult] = await Promise.all([
      query<DepartmentRow>('SELECT id, name, slug FROM departments ORDER BY id'),
      query<SectionRow>('SELECT id, department_id, name, slug FROM sections ORDER BY id'),
    ])

    // Automatically sync slugs if they differ from the slugified name (e.g. if renamed in Manage Department)
    for (const d of departmentsResult.rows) {
      const properSlug = slugify(d.name) || `dept-${d.id}`
      if (d.slug !== properSlug) {
        d.slug = properSlug
        query('UPDATE departments SET slug = $1 WHERE id = $2', [properSlug, d.id]).catch(() => {})
      }
    }
    for (const s of sectionsResult.rows) {
      const properSlug = slugify(s.name) || `sec-${s.id}`
      if (s.slug !== properSlug) {
        s.slug = properSlug
        query('UPDATE sections SET slug = $1 WHERE id = $2', [properSlug, s.id]).catch(() => {})
      }
    }

    const departments = departmentsResult.rows.map((department) => ({
      ...department,
      sections: sectionsResult.rows.filter((section) => section.department_id === department.id),
    }))

    return NextResponse.json({ departments })
  } catch (error) {
    console.error('[departments/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat data departemen.' }, { status: 500 })
  }
}

// Admin only — add a new department.
export async function POST(request: NextRequest) {
  const session = getItAdminFromRequest(request)
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  const { name } = await request.json()

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ message: 'Nama departemen wajib diisi.' }, { status: 400 })
  }

  const slug = slugify(name)

  try {
    const result = await query<DepartmentRow>(
      'INSERT INTO departments (name, slug) VALUES ($1, $2) RETURNING id, name, slug',
      [name.trim(), slug]
    )
    await logActivity(session, 'create', 'department', result.rows[0].id, `Menambahkan departemen "${result.rows[0].name}"`)
    return NextResponse.json({ department: { ...result.rows[0], sections: [] } }, { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ message: 'Departemen dengan nama itu sudah ada.' }, { status: 409 })
    }
    console.error('[departments/POST]', error)
    return NextResponse.json({ message: 'Gagal menambahkan departemen.' }, { status: 500 })
  }
}