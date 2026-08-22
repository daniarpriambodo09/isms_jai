// app/api/sections/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'

type SectionRow = { id: number; department_id: number; name: string; slug: string }

// Admin only — rename a section.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!getAdminFromRequest(request)) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  const { id } = await params
  const { name } = await request.json()

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ message: 'Nama section wajib diisi.' }, { status: 400 })
  }

  const result = await query<SectionRow>(
    'UPDATE sections SET name = $1 WHERE id = $2 RETURNING id, department_id, name, slug',
    [name.trim(), id]
  )

  if (result.rows.length === 0) {
    return NextResponse.json({ message: 'Section tidak ditemukan.' }, { status: 404 })
  }

  return NextResponse.json({ section: result.rows[0] })
}