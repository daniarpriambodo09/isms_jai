// app/api/departments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

type DepartmentRow = { id: number; name: string; slug: string }
type SectionRow = { id: number; department_id: number; name: string; slug: string }

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Public — the navbar and every visitor need this to browse documents.
export async function GET() {
  try {
    const [departmentsResult, sectionsResult] = await Promise.all([
      query<DepartmentRow>('SELECT id, name, slug FROM departments ORDER BY id'),
      query<SectionRow>('SELECT id, department_id, name, slug FROM sections ORDER BY id'),
    ])

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
  const session = getIsmsAdminFromRequest(request)
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