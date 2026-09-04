import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'

type Category = 'form-aplikasi' | 'kontrol-cs'
type GroupHeaderRow = { id: number; category: Category; sort_order: number; label: string; control_no_prefix: string | null }

function isCategory(value: string): value is Category { return value === 'form-aplikasi' || value === 'kontrol-cs' }

async function getCategory(params: Promise<{ category: string }>) {
  const { category } = await params
  return isCategory(category) ? category : null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const category = await getCategory(params)
  if (!category) return NextResponse.json({ message: 'Kategori dokumen tidak valid.' }, { status: 400 })

  try {
    const result = await query<GroupHeaderRow>(
      `SELECT id, category, sort_order, label, control_no_prefix
       FROM form_cs_group_headers
       WHERE category = $1
       ORDER BY sort_order ASC, id ASC`,
      [category]
    )
    return NextResponse.json({ groupHeaders: result.rows })
  } catch (error) {
    console.error('[form-cs/group-headers/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat baris grup.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const category = await getCategory(params)
  if (!category) return NextResponse.json({ message: 'Kategori dokumen tidak valid.' }, { status: 400 })
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json()
    const label = typeof body.label === 'string' ? body.label.trim() : ''
    const sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0
    const controlNoPrefix = typeof body.controlNoPrefix === 'string' && body.controlNoPrefix.trim() ? body.controlNoPrefix.trim() : null
    if (!label) return NextResponse.json({ message: 'Label baris grup wajib diisi.' }, { status: 400 })

    const result = await query<GroupHeaderRow>(
      `INSERT INTO form_cs_group_headers (category, sort_order, label, control_no_prefix)
       VALUES ($1, $2, $3, $4)
       RETURNING id, category, sort_order, label, control_no_prefix`,
      [category, sortOrder, label, controlNoPrefix]
    )
    return NextResponse.json({ groupHeader: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[form-cs/group-headers/POST]', error)
    return NextResponse.json({ message: 'Gagal menyimpan baris grup.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const category = await getCategory(params)
  if (!category) return NextResponse.json({ message: 'Kategori dokumen tidak valid.' }, { status: 400 })
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json()
    const id = Number(body.id)
    const label = typeof body.label === 'string' ? body.label.trim() : ''
    const sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0
    const controlNoPrefix = typeof body.controlNoPrefix === 'string' && body.controlNoPrefix.trim() ? body.controlNoPrefix.trim() : null
    if (!Number.isInteger(id)) return NextResponse.json({ message: 'ID baris grup tidak valid.' }, { status: 400 })
    if (!label) return NextResponse.json({ message: 'Label baris grup wajib diisi.' }, { status: 400 })

    const result = await query<GroupHeaderRow>(
      `UPDATE form_cs_group_headers
       SET label = $1, sort_order = $2, control_no_prefix = $3
       WHERE id = $4 AND category = $5
       RETURNING id, category, sort_order, label, control_no_prefix`,
      [label, sortOrder, controlNoPrefix, id, category]
    )
    if (result.rows.length === 0) return NextResponse.json({ message: 'Baris grup tidak ditemukan.' }, { status: 404 })
    return NextResponse.json({ groupHeader: result.rows[0] })
  } catch (error) {
    console.error('[form-cs/group-headers/PUT]', error)
    return NextResponse.json({ message: 'Gagal memperbarui baris grup.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const category = await getCategory(params)
  if (!category) return NextResponse.json({ message: 'Kategori dokumen tidak valid.' }, { status: 400 })
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id || !/^\d+$/.test(id)) return NextResponse.json({ message: 'ID baris grup tidak valid.' }, { status: 400 })
    const result = await query('DELETE FROM form_cs_group_headers WHERE id = $1 AND category = $2 RETURNING id', [id, category])
    if (result.rows.length === 0) return NextResponse.json({ message: 'Baris grup tidak ditemukan.' }, { status: 404 })
    return NextResponse.json({ message: 'Baris grup dihapus.' })
  } catch (error) {
    console.error('[form-cs/group-headers/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus baris grup.' }, { status: 500 })
  }
}
