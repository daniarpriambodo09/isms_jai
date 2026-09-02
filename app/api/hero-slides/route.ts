import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { saveHeroSlideFile } from '@/lib/storage'

type MediaType = 'video' | 'image'
type SlideRow = {
  id: number
  media_type: MediaType
  file_path: string
  title: string
  description: string | null
  cta_label: string | null
  cta_href: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const MEDIA_TYPES: MediaType[] = ['video', 'image']
const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm']
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_VIDEO_SIZE = 100 * 1024 * 1024
const MAX_IMAGE_SIZE = 15 * 1024 * 1024

function isMediaType(value: string): value is MediaType {
  return (MEDIA_TYPES as string[]).includes(value)
}

const SELECT_COLUMNS = `id, media_type, file_path, title, description, cta_label, cta_href, sort_order, is_active, created_at, updated_at`

export async function GET(request: NextRequest) {
  const includeInactive = request.nextUrl.searchParams.get('all') === '1' && Boolean(getAdminFromRequest(request))

  try {
    const result = await query<SlideRow>(
      `SELECT ${SELECT_COLUMNS} FROM hero_slides
       ${includeInactive ? '' : 'WHERE is_active = true'}
       ORDER BY sort_order ASC, id ASC`
    )
    return NextResponse.json({ slides: result.rows })
  } catch (error) {
    console.error('[hero-slides/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat hero slides.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!getAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const form = await request.formData()
    const mediaTypeRaw = form.get('mediaType')
    const title = form.get('title')
    const description = form.get('description')
    const ctaLabel = form.get('ctaLabel')
    const ctaHref = form.get('ctaHref')
    const file = form.get('file')

    if (typeof mediaTypeRaw !== 'string' || !isMediaType(mediaTypeRaw)) {
      return NextResponse.json({ message: 'Tipe media tidak valid.' }, { status: 400 })
    }
    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ message: 'Judul wajib diisi.' }, { status: 400 })
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ message: 'File wajib diunggah.' }, { status: 400 })
    }

    const allowedTypes = mediaTypeRaw === 'video' ? VIDEO_MIME_TYPES : IMAGE_MIME_TYPES
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ message: mediaTypeRaw === 'video' ? 'File harus berupa MP4 atau WebM.' : 'File harus berupa JPG, PNG, atau WebP.' }, { status: 400 })
    }
    const maxSize = mediaTypeRaw === 'video' ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
    if (file.size > maxSize) {
      return NextResponse.json({ message: `Ukuran file maksimal ${maxSize / (1024 * 1024)} MB.` }, { status: 400 })
    }

    const filePath = await saveHeroSlideFile(file)
    const nextOrder = await query<{ next: number }>('SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM hero_slides')

    const result = await query<SlideRow>(
      `INSERT INTO hero_slides (media_type, file_path, title, description, cta_label, cta_href, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${SELECT_COLUMNS}`,
      [
        mediaTypeRaw,
        filePath,
        title.trim(),
        typeof description === 'string' && description.trim() ? description.trim() : null,
        typeof ctaLabel === 'string' && ctaLabel.trim() ? ctaLabel.trim() : null,
        typeof ctaHref === 'string' && ctaHref.trim() ? ctaHref.trim() : null,
        nextOrder.rows[0].next,
      ]
    )
    return NextResponse.json({ slide: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[hero-slides/POST]', error)
    return NextResponse.json({ message: 'Gagal menyimpan hero slide.' }, { status: 500 })
  }
}
