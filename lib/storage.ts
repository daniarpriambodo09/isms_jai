// lib/storage.ts
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

// Files live outside /public so they can only be reached through
// /api/files/serve (which PDFViewer.tsx fetches as a blob) — never
// as a directly downloadable static URL.
export const STORAGE_ROOT = path.join(process.cwd(), 'storage')

export async function saveDocumentFile(file: File): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer())
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const relativePath = `documents/${randomUUID()}-${safeName}`
  const fullPath = path.join(STORAGE_ROOT, relativePath)

  await mkdir(path.dirname(fullPath), { recursive: true })
  await writeFile(fullPath, bytes)

  return relativePath
}

export async function savePolicyImage(file: File): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer())
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const relativePath = `policy-images/${randomUUID()}-${safeName}`
  const fullPath = path.join(STORAGE_ROOT, relativePath)
  await mkdir(path.dirname(fullPath), { recursive: true })
  await writeFile(fullPath, bytes)
  return relativePath
}

export async function deleteDocumentFile(relativePath: string): Promise<void> {
  try {
    await unlink(path.join(STORAGE_ROOT, relativePath))
  } catch {
    // File already missing — nothing to clean up.
  }
}
