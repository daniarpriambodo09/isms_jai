// app/api/pdf-worker/route.ts
//
// Serves pdf.js's worker straight from node_modules, so it always matches the
// installed pdfjs-dist version. The "legacy" build, like the library itself
// (lib/pdfjs-loader.ts): it carries the polyfills older phones need.

import { readFile } from 'fs/promises'
import path from 'path'

let cached: Buffer | null = null

export async function GET() {
  cached ??= await readFile(path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs'))
  return new Response(new Uint8Array(cached), {
    headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  })
}
