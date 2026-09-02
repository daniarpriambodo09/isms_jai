// app/api/files/serve/route.ts

// app/api/files/serve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { createReadStream } from 'fs'
import { Readable } from 'stream'
import path from 'path'
import { STORAGE_ROOT } from '@/lib/storage'

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp',
  mp4: 'video/mp4',
  webm: 'video/webm',
}

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

  const contentType = CONTENT_TYPES[path.extname(relativePath).slice(1).toLowerCase()] ?? 'application/octet-stream'

  try {
    const stats = await stat(fullPath)

    // Range requests let <video> seek/buffer instead of pulling the whole file up front.
    const range = request.headers.get('range')
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range)
      const start = match?.[1] ? parseInt(match[1], 10) : 0
      const end = match?.[2] ? parseInt(match[2], 10) : stats.size - 1
      const chunkSize = end - start + 1

      const stream = createReadStream(fullPath, { start, end })
      return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Disposition': 'inline',
          'Cache-Control': 'private, max-age=0, must-revalidate',
        },
      })
    }

    const fileBuffer = await readFile(fullPath)
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stats.size),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    })
  } catch {
    return NextResponse.json({ message: 'File tidak ditemukan.' }, { status: 404 })
  }
}
