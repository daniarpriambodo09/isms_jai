// app/api/departments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

type DepartmentRow = { id: number; name: string; slug: string }
type SectionRow = { id: number; department_id: number; name: string; slug: string }

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