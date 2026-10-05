// app/api/files/serve/route.ts
//
// Serves uploaded files from storage/. The portal's documents are meant to be
// readable without logging in, so anonymous visitors may fetch a file only
// while it is PUBLISHED — referenced by a document/slide/image row the portal
// shows. Anything else in storage (files of deleted records, inactive hero
// slides, uploads not saved yet, stray files) needs an admin session, even
// with the exact path.
import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { createReadStream } from 'fs'
import path from 'path'
import { STORAGE_ROOT } from '@/lib/storage'
import { getAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'

// A procedure, working standard or TMMIN standard (all in procedure_documents) is published
// only once every approver has approved it (or it needs no approval) and the
// admin hasn't hidden it (public_visible). Until then only admins and the
// approvers — with the token from their email link — can open the file; the
// same token also opens the document's earlier versions (revision history).
async function isPublishedFile(relativePath: string, approvalToken: string) {
  try {
    const result = await query<{ published: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM procedure_documents WHERE file_path = $1 AND approval_status IN ('approved', 'none') AND public_visible
         UNION ALL SELECT 1 FROM procedure_documents d JOIN procedure_approvals a ON a.document_id = d.id
           WHERE d.file_path = $1 AND $2 <> '' AND a.token = $2 AND a.status <> 'cancelled'
         UNION ALL SELECT 1 FROM procedure_document_versions v JOIN procedure_approvals a ON a.document_id = v.document_id
           WHERE v.file_path = $1 AND $2 <> '' AND a.token = $2 AND a.status <> 'cancelled'
         UNION ALL SELECT 1 FROM documents WHERE file_path = $1
         UNION ALL SELECT 1 FROM education_documents WHERE file_path = $1
         UNION ALL SELECT 1 FROM form_cs_documents WHERE file_path = $1
         UNION ALL SELECT 1 FROM schedule_documents WHERE file_path = $1
         UNION ALL SELECT 1 FROM policy_images WHERE file_path = $1
         UNION ALL SELECT 1 FROM hero_slides WHERE file_path = $1 AND is_active
         UNION ALL SELECT 1 FROM home_canvas WHERE position($1 in blocks::text) > 0
       ) AS published`,
      [relativePath, approvalToken]
    )
    return result.rows[0]?.published === true
  } catch (error) {
    console.error('[files/serve] publish check failed', error)
    return false
  }
}

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
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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

  // Same 404 as a missing file, so the response never confirms that an
  // unpublished file exists.
  const normalized = relativePath.replace(/\\/g, '/')
  const approvalToken = (request.nextUrl.searchParams.get('token') ?? '').slice(0, 100)
  if (!getAdminFromRequest(request) && !(await isPublishedFile(normalized, approvalToken))) {
    return NextResponse.json({ message: 'File tidak ditemukan.' }, { status: 404 })
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
      const webStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk) => {
            try {
              controller.enqueue(chunk)
              if (controller.desiredSize !== null && controller.desiredSize <= 0) {
                stream.pause()
              }
            } catch {
              stream.destroy()
            }
          })
          stream.on('end', () => {
            try {
              controller.close()
            } catch {}
          })
          stream.on('error', (err) => { 
            try {
              controller.error(err)
            } catch {}
          })
        },
        pull() {
          stream.resume()
        },
        cancel() {
          stream.destroy()
        },
      })

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Disposition': 'inline',
          'Cache-Control': 'private, max-age=0, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
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
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ message: 'File tidak ditemukan.' }, { status: 404 })
  }
}
