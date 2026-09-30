// app/api/pdf-worker/route.ts
//
// Serves pdf.js's worker straight from node_modules, so it always matches the
// installed pdfjs-dist version (used by the "Atur Posisi QR" editor).

import { readFile } from 'fs/promises'
import path from 'path'

let cached: Buffer | null = null

export async function GET() {
  cached ??= await readFile(path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'))
  return new Response(new Uint8Array(cached), {
    headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  })
}
