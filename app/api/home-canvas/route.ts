// app/api/home-canvas/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { saveHomeCanvasFile } from '@/lib/storage'

type Asset = { src: string; name: string }
type HomeLayout = { image: Asset | null; pdf: Asset | null }
type CanvasRow = { blocks: unknown; updated_at: string }
function normalizeLayout(value: unknown): HomeLayout {
  const asset = (candidate: unknown): Asset | null => { if (!candidate || typeof candidate !== 'object') return null; const item = candidate as Record<string, unknown>; return typeof item.src === 'string' && typeof item.name === 'string' ? { src: item.src, name: item.name } : null }
  if (value && typeof value === 'object' && !Array.isArray(value)) { const record = value as Record<string, unknown>; return { image: asset(record.image), pdf: asset(record.pdf) } }
  if (Array.isArray(value)) { const blocks = value as Array<{ type?: string; src?: string; name?: string }>; const find = (type: string) => { const block = blocks.find((item) => item?.type === type); return block?.src && block.name ? { src: block.src, name: block.name } : null }; return { image: find('image'), pdf: find('pdf') } }
  return { image: null, pdf: null }
}

export async function GET() {
  try {
    const result = await query<CanvasRow>('SELECT blocks, updated_at FROM home_canvas WHERE id = 1')
    return NextResponse.json({ layout: normalizeLayout(result.rows[0]?.blocks), updatedAt: result.rows[0]?.updated_at ?? null })
  } catch (error) {
    console.error('[home-canvas/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat layout home.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const admin = getAdminFromRequest(request)
  if (!admin) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    const body = await request.json() as { layout?: unknown }
    const layout = normalizeLayout(body.layout)
    const result = await query<CanvasRow>(
      `INSERT INTO home_canvas (id, blocks, updated_by) VALUES (1, $1::jsonb, $2)
       ON CONFLICT (id) DO UPDATE SET blocks = EXCLUDED.blocks, updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING blocks, updated_at`,
      [JSON.stringify(layout), admin.sub]
    )
    return NextResponse.json({ layout: normalizeLayout(result.rows[0].blocks), updatedAt: result.rows[0].updated_at })
  } catch (error) {
    console.error('[home-canvas/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan layout home.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!getAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || !(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type))) return NextResponse.json({ message: 'File harus berupa PDF, JPG, PNG, atau WebP.' }, { status: 400 })
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ message: 'Ukuran file maksimal 15 MB.' }, { status: 400 })
    const filePath = await saveHomeCanvasFile(file)
    return NextResponse.json({ filePath, url: `/isms-jai/api/files/serve?path=${encodeURIComponent(filePath)}`, name: file.name }, { status: 201 })
  } catch (error) {
    console.error('[home-canvas/POST]', error)
    return NextResponse.json({ message: 'Gagal mengunggah aset.' }, { status: 500 })
  }
}