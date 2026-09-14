// app/api/schedule-categories/route.ts
//
// The admin-managed list of "kinds" a schedule document can belong to.
// Started as a fixed audit/training pair; now open-ended so an admin can
// add arbitrary categories (e.g. "Diagram Security Area") without a code
// change — Kelola Jadwal renders one upload slot per category, and Home
// renders one section per category that actually has files.

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

type ScheduleCategoryRow = { id: number; slug: string; label: string; sort_order: number }

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// Public — Home, /audits, and Kelola Jadwal all need this with no login.
export async function GET() {
  try {
    const result = await query<ScheduleCategoryRow>('SELECT id, slug, label, sort_order FROM schedule_categories ORDER BY sort_order ASC, id ASC')
    return NextResponse.json({ categories: result.rows })
  } catch (error) {
    console.error('[schedule-categories/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat kategori jadwal.' }, { status: 500 })
  }
}

// Admin only — add a new category.
export async function POST(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json()
    const label = typeof body.label === 'string' ? body.label.trim() : ''
    if (!label) return NextResponse.json({ message: 'Nama kategori wajib diisi.' }, { status: 400 })

    const slug = slugify(label)
    if (!slug) return NextResponse.json({ message: 'Nama kategori tidak valid.' }, { status: 400 })

    const maxOrder = await query<{ max: number | null }>('SELECT MAX(sort_order) AS max FROM schedule_categories')
    const sortOrder = (maxOrder.rows[0].max ?? 0) + 1

    const result = await query<ScheduleCategoryRow>(
      'INSERT INTO schedule_categories (slug, label, sort_order) VALUES ($1, $2, $3) RETURNING id, slug, label, sort_order',
      [slug, label, sortOrder]
    )
    await logActivity(session, 'create', 'schedule_category', result.rows[0].id, `Menambahkan kategori jadwal "${label}"`)
    return NextResponse.json({ category: result.rows[0] }, { status: 201 })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return NextResponse.json({ message: 'Kategori dengan nama itu sudah ada.' }, { status: 409 })
    }
    console.error('[schedule-categories/POST]', error)
    return NextResponse.json({ message: 'Gagal menambahkan kategori.' }, { status: 500 })
  }
}
