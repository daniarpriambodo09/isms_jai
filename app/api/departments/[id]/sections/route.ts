// app/api/departments/[id]/sections/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'

type SectionRow = { id: number; department_id: number; name: string; slug: string }

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Admin only — add a new section under a department.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!getIsmsAdminFromRequest(request)) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  const { id } = await params
  const { name } = await request.json()

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ message: 'Nama section wajib diisi.' }, { status: 400 })
  }

  const slug = slugify(name)

  try {
    const result = await query<SectionRow>(
      'INSERT INTO sections (department_id, name, slug) VALUES ($1, $2, $3) RETURNING id, department_id, name, slug',
      [id, name.trim(), slug]
    )
    return NextResponse.json({ section: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ message: 'Section dengan nama itu sudah ada di departemen ini.' }, { status: 409 })
    }
    console.error('[departments/[id]/sections/POST]', error)
    return NextResponse.json({ message: 'Gagal menambahkan section.' }, { status: 500 })
  }
}