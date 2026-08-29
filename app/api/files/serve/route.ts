// app/api/files/serve/route.ts

// app/api/files/serve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { STORAGE_ROOT } from '@/lib/storage'

export async function GET(request: NextRequest) {
  const relativePath = request.nextUrl.searchParams.get('path')
  if (!relativePath) {
    return NextResponse.json({ message: 'Parameter path wajib diisi.' }, { status: 400 })
  }

  // Resolve and make sure the result stays inside STORAGE_ROOT — blocks
  // path traversal via "..", absolute paths, etc.
  const fullPath = path.resolve(STORAGE_ROOT, relativePath)
  if (!fullPath.startsWith(`${path.resolve(STORAGE_ROOT)}${path.sep}`)) {
    return NextResponse.json({ message: 'Path tidak valid.' }, { status: 400 })
  }

  try {
    const fileBuffer = await readFile(fullPath)
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': relativePath.endsWith('.pdf') ? 'application/pdf' : ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp' }[path.extname(relativePath).slice(1).toLowerCase()] ?? 'application/octet-stream'),
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    })
  } catch {
    return NextResponse.json({ message: 'File tidak ditemukan.' }, { status: 404 })
  }
}
