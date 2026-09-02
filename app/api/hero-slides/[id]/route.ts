import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { deleteDocumentFile, saveHeroSlideFile } from '@/lib/storage'

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

// PUT supports two shapes:
// - multipart/form-data: full edit (title/description/cta/mediaType/isActive + optional file replace)
// - application/json { sortOrder }: lightweight reorder swap from the admin list's up/down buttons
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID slide tidak valid.' }, { status: 400 })
  if (!getAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const contentType = request.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('application/json')) {
      const body = await request.json() as { sortOrder?: number }
      if (typeof body.sortOrder !== 'number') return NextResponse.json({ message: 'sortOrder wajib diisi.' }, { status: 400 })
      const result = await query<SlideRow>(
        `UPDATE hero_slides SET sort_order = $1, updated_at = now() WHERE id = $2 RETURNING ${SELECT_COLUMNS}`,
        [body.sortOrder, id]
      )
      if (result.rows.length === 0) return NextResponse.json({ message: 'Slide tidak ditemukan.' }, { status: 404 })
      return NextResponse.json({ slide: result.rows[0] })
    }

    const form = await request.formData()
    const mediaTypeRaw = form.get('mediaType')
    const title = form.get('title')
    const description = form.get('description')
    const ctaLabel = form.get('ctaLabel')
    const ctaHref = form.get('ctaHref')
    const isActiveRaw = form.get('isActive')
    const file = form.get('file')

    if (typeof mediaTypeRaw !== 'string' || !isMediaType(mediaTypeRaw)) {
      return NextResponse.json({ message: 'Tipe media tidak valid.' }, { status: 400 })
    }
    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ message: 'Judul wajib diisi.' }, { status: 400 })
    }

    const existing = await query<{ file_path: string }>('SELECT file_path FROM hero_slides WHERE id = $1', [id])
    if (existing.rows.length === 0) return NextResponse.json({ message: 'Slide tidak ditemukan.' }, { status: 404 })

    const replacement = file instanceof File && file.size > 0
    let newFilePath: string | null = null
    if (replacement) {
      const allowedTypes = mediaTypeRaw === 'video' ? VIDEO_MIME_TYPES : IMAGE_MIME_TYPES
      if (!allowedTypes.includes((file as File).type)) {
        return NextResponse.json({ message: mediaTypeRaw === 'video' ? 'File harus berupa MP4 atau WebM.' : 'File harus berupa JPG, PNG, atau WebP.' }, { status: 400 })
      }
      const maxSize = mediaTypeRaw === 'video' ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
      if ((file as File).size > maxSize) {
        return NextResponse.json({ message: `Ukuran file maksimal ${maxSize / (1024 * 1024)} MB.` }, { status: 400 })
      }
      newFilePath = await saveHeroSlideFile(file as File)
    }

    const result = await query<SlideRow>(
      `UPDATE hero_slides
       SET media_type = $1, title = $2, description = $3, cta_label = $4, cta_href = $5,
           is_active = $6, file_path = COALESCE($7, file_path), updated_at = now()
       WHERE id = $8
       RETURNING ${SELECT_COLUMNS}`,
      [
        mediaTypeRaw,
        title.trim(),
        typeof description === 'string' && description.trim() ? description.trim() : null,
        typeof ctaLabel === 'string' && ctaLabel.trim() ? ctaLabel.trim() : null,
        typeof ctaHref === 'string' && ctaHref.trim() ? ctaHref.trim() : null,
        isActiveRaw !== 'false',
        newFilePath,
        id,
      ]
    )

    if (newFilePath) await deleteDocumentFile(existing.rows[0].file_path)
    return NextResponse.json({ slide: result.rows[0] })
  } catch (error) {
    console.error('[hero-slides/PUT]', error)
    return NextResponse.json({ message: 'Gagal memperbarui hero slide.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID slide tidak valid.' }, { status: 400 })
  if (!getAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const result = await query<{ file_path: string }>('DELETE FROM hero_slides WHERE id = $1 RETURNING file_path', [id])
    if (result.rows.length === 0) return NextResponse.json({ message: 'Slide tidak ditemukan.' }, { status: 404 })
    await deleteDocumentFile(result.rows[0].file_path)
    return NextResponse.json({ message: 'Slide dihapus.' })
  } catch (error) {
    console.error('[hero-slides/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus hero slide.' }, { status: 500 })
  }
}
