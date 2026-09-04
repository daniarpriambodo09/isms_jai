// app/api/departments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'

type DepartmentRow = { id: number; name: string; slug: string }

// Admin only — rename a department.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!getIsmsAdminFromRequest(request)) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  const { id } = await params
  const { name } = await request.json()

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ message: 'Nama departemen wajib diisi.' }, { status: 400 })
  }

  const result = await query<DepartmentRow>(
    'UPDATE departments SET name = $1 WHERE id = $2 RETURNING id, name, slug',
    [name.trim(), id]
  )

  if (result.rows.length === 0) {
    return NextResponse.json({ message: 'Departemen tidak ditemukan.' }, { status: 404 })
  }

  return NextResponse.json({ department: result.rows[0] })
}