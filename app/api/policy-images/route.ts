import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { savePolicyImage, deleteDocumentFile } from '@/lib/storage'

type PolicyRow = { id: number; file_name: string; mime_type: string; file_path: string; display_order: number }

export async function GET() {
  try {
    const result = await query<PolicyRow>('SELECT id, file_name, mime_type, file_path, display_order FROM policy_images ORDER BY display_order ASC, id ASC')
    return NextResponse.json({ images: result.rows.map((row) => ({ ...row, url: `/isms-jai/api/files/serve?path=${encodeURIComponent(row.file_path)}` })) })
  } catch (error) {
    console.error('[policy-images/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat gambar policy.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!getAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    const form = await request.formData()
    const files = form.getAll('files').filter((file): file is File => file instanceof File && file.type.startsWith('image/'))
    if (!files.length) return NextResponse.json({ message: 'Minimal satu gambar wajib diunggah.' }, { status: 400 })
    const maxOrder = await query<{ max: number | null }>('SELECT MAX(display_order)::int AS max FROM policy_images')
    const start = (maxOrder.rows[0]?.max ?? -1) + 1
    const saved: PolicyRow[] = []
    for (const [index, file] of files.entries()) {
      const filePath = await savePolicyImage(file)
      const result = await query<PolicyRow>('INSERT INTO policy_images (file_name, mime_type, file_path, display_order) VALUES ($1, $2, $3, $4) RETURNING id, file_name, mime_type, file_path, display_order', [file.name, file.type, filePath, start + index])
      saved.push(result.rows[0])
    }
    return NextResponse.json({ images: saved }, { status: 201 })
  } catch (error) {
    console.error('[policy-images/POST]', error)
    return NextResponse.json({ message: 'Gagal menyimpan gambar policy.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!getAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  const { id } = await request.json() as { id?: number }
  if (!Number.isInteger(id)) return NextResponse.json({ message: 'ID gambar tidak valid.' }, { status: 400 })
  const result = await query<{ file_path: string }>('DELETE FROM policy_images WHERE id = $1 RETURNING file_path', [id])
  if (!result.rows[0]) return NextResponse.json({ message: 'Gambar tidak ditemukan.' }, { status: 404 })
  await deleteDocumentFile(result.rows[0].file_path)
  return NextResponse.json({ success: true })
}
