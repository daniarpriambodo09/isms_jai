// lib/pdfjs-loader.ts
//
// The one place pdf.js is loaded on the client (PDF viewer on phones, QR
// placement, revision notes). It uses pdf.js's "legacy" build, which brings
// its own polyfills, and is compiled by our build for the browsers listed in
// package.json "browserslist" — so it also runs on older phones.
//
// The worker is the exception: it is served as-is from node_modules
// (/api/pdf-worker) and uses syntax (class static blocks) that Safari before
// 16.4 can't parse. Those browsers get the worker bundled into the page
// instead (pdf.js then parses on the main thread — slower, but it works).

import { API_BASE_PATH } from '@/lib/config'

// Can this browser parse the worker file as shipped?
function parsesModernSyntax() {
  try {
    // eslint-disable-next-line no-new-func
    new Function('class A { static { } }')
    return true
  } catch {
    return false
  }
}

// structuredClone for the browsers without one (Safari before 15.4). pdf.js
// passes its messages through it when the worker runs on the main thread, so
// typed arrays, buffers, maps and sets must survive — which rules out the
// JSON round-trip. Buffers named in `transfer` are handed over, not copied.
function cloneDeep<T>(value: T, options?: { transfer?: unknown[] } | null): T {
  const transfer = new Set(options?.transfer ?? [])
  const seen = new Map<object, unknown>()
  const copy = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v
    if (seen.has(v)) return seen.get(v)
    const keep = (out: unknown) => { seen.set(v, out); return out }
    if (v instanceof Date) return keep(new Date(v.getTime()))
    if (v instanceof RegExp) return keep(new RegExp(v.source, v.flags))
    if (v instanceof ArrayBuffer) return keep(transfer.has(v) ? v : v.slice(0))
    if (ArrayBuffer.isView(v)) {
      const buffer = copy(v.buffer) as ArrayBuffer
      if (v instanceof DataView) return keep(new DataView(buffer, v.byteOffset, v.byteLength))
      const typed = v as unknown as { constructor: new (b: ArrayBuffer, o: number, l: number) => unknown; length: number }
      return keep(new typed.constructor(buffer, v.byteOffset, typed.length))
    }
    if (v instanceof Map) { const out = new Map(); seen.set(v, out); v.forEach((val, key) => out.set(copy(key), copy(val))); return out }
    if (v instanceof Set) { const out = new Set(); seen.set(v, out); v.forEach((val) => out.add(copy(val))); return out }
    if (Array.isArray(v)) { const out: unknown[] = []; seen.set(v, out); for (const item of v) out.push(copy(item)); return out }
    if (v instanceof Error) return keep(Object.assign(new (v.constructor as ErrorConstructor)(v.message), { name: v.name, stack: v.stack }))
    const proto = Object.getPrototypeOf(v)
    // Blobs, images, bitmaps, DOM objects…: nothing to copy by hand — pass them through.
    if (proto !== Object.prototype && proto !== null) return v
    const out: Record<string, unknown> = {}
    seen.set(v, out)
    for (const key of Object.keys(v)) out[key] = copy((v as Record<string, unknown>)[key])
    return out
  }
  return copy(value) as T
}

let loading: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null

export function loadPdfJs() {
  loading ??= (async () => {
    if (typeof globalThis.structuredClone !== 'function') (globalThis as { structuredClone: unknown }).structuredClone = cloneDeep
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    if (parsesModernSyntax()) {
      pdfjs.GlobalWorkerOptions.workerSrc = `${API_BASE_PATH}/api/pdf-worker`
    } else {
      // pdf.js picks this up (globalThis.pdfjsWorker) and skips the Worker.
      const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
      ;(globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = worker
    }
    return pdfjs
  })().catch((error) => { loading = null; throw error })
  return loading
}
