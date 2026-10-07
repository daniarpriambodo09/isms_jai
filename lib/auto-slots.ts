// lib/auto-slots.ts
//
// Working Standard sheets all come from one template: a row of boxes headed
// "APPROVED 2 | APPROVED 1 | CHECKED | PREPARED" at the foot of the page. So
// the QR spots don't have to be placed by hand — the headings are found in
// the PDF's own text and each approver's QR goes in the box under the heading
// that matches their position. A position whose heading can't be found is
// simply left out (it can still be placed in "Atur Posisi QR").

import 'server-only'
import path from 'path'
import { readFile } from 'fs/promises'
import { STORAGE_ROOT } from '@/lib/storage'
import type { SignatureSlot } from '@/lib/procedure-approval'

// A heading or a position title reduced to what it stands for: "PREPARED",
// "CHECKED", "APPROVED", "APPROVED 1", … — null when it is neither.
export function signatureKey(text: string): string | null {
  const t = text.toUpperCase().replace(/\(.*?\)/g, ' ').replace(/[^A-Z0-9]+/g, ' ').trim()
  if (!t || t.length > 24) return null
  const number = t.match(/\b(\d)\b/)?.[1]
  const base = /^(PREPARED|PREPARE|DIBUAT)( BY| OLEH)?( \d)?$/.test(t) ? 'PREPARED'
    : /^(CHECKED|CHECK|DIPERIKSA)( BY| OLEH)?( \d)?$/.test(t) ? 'CHECKED'
      : /^(APPROVED|APPROVAL|APPROVE|DISETUJUI|MENYETUJUI)( BY| OLEH)?( \d)?$/.test(t) ? 'APPROVED'
        : null
  if (!base) return null
  return number ? `${base} ${number}` : base
}

// Which heading a position signs under: the same key, or — when only one of
// them carries a number — "APPROVED" for "APPROVED 1" and the other way round.
function headingFor(roleKey: string, headings: string[]): string | null {
  if (headings.includes(roleKey)) return roleKey
  if (/ 1$/.test(roleKey) && headings.includes(roleKey.slice(0, -2))) return roleKey.slice(0, -2)
  if (!/ \d$/.test(roleKey) && headings.includes(`${roleKey} 1`)) return `${roleKey} 1`
  return null
}

export type Heading = { key: string; page: number; pageW: number; pageH: number; cx: number; y: number; h: number }

// The widest a QR is drawn, in points, however roomy the box.
const QR_MAX = 46
const QR_MIN = 22
// Width of one signature box on the template, as a share of the page width —
// used when there is only one heading to measure from.
const DEFAULT_COLUMN = 0.0675

/** QR spots from the headings found on the pages (pure, for testing). */
export function slotsFromHeadings(headings: Heading[], roles: { code: string; title: string }[]): SignatureSlot[] {
  // The boxes sit in one row: take the row (page + baseline) with the most different headings.
  const rows = new Map<string, Heading[]>()
  for (const h of headings) {
    const id = `${h.page}:${Math.round(h.y * 100)}`
    if (!(rows.get(id) ?? []).some((other) => other.key === h.key)) rows.set(id, [...(rows.get(id) ?? []), h])
  }
  const row = [...rows.values()].sort((a, b) => b.length - a.length)[0]
  if (!row) return []

  const centres = row.map((h) => h.cx).sort((a, b) => a - b)
  const gaps = centres.slice(1).map((c, i) => c - centres[i]).filter((g) => g > 0.01)
  const column = gaps.length ? Math.min(...gaps) : DEFAULT_COLUMN

  const slots: SignatureSlot[] = []
  for (const role of roles) {
    const roleKey = signatureKey(role.title)
    const heading = roleKey ? row.find((h) => h.key === headingFor(roleKey, row.map((r) => r.key))) : undefined
    if (!heading) continue
    // Just under the heading row (its bottom line is about one text height below the baseline).
    const top = heading.y + (Math.max(heading.h * heading.pageH, 7) + 3) / heading.pageH
    const room = (0.985 - top) * heading.pageH
    const side = Math.min(QR_MAX, column * heading.pageW * 0.8, room)
    if (side < QR_MIN) continue
    const w = side / heading.pageW
    slots.push({ role_code: role.code, page: heading.page, x: Math.min(Math.max(heading.cx - w / 2, 0), 1 - w), y: top, w, h: side / heading.pageH, date: null })
  }
  return slots
}

/** Reads the stored PDF and returns a QR spot for each position whose box heading is found in it. */
export async function detectSignatureSlots(filePath: string, roles: { code: string; title: string }[]): Promise<SignatureSlot[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(await readFile(path.join(STORAGE_ROOT, filePath)))
  const doc = await pdfjs.getDocument({ data, disableFontFace: true, useSystemFonts: false, isEvalSupported: false, verbosity: 0 }).promise
  try {
    const headings: Heading[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      for (const item of content.items) {
        if (!('str' in item)) continue
        const key = signatureKey(item.str)
        if (!key) continue
        // Displayed-page coordinates (rotation applied), like the "Atur Posisi QR" editor uses.
        const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5])
        headings.push({ key, page: n - 1, pageW: viewport.width, pageH: viewport.height, cx: (x + item.width / 2) / viewport.width, y: y / viewport.height, h: item.height / viewport.height })
      }
    }
    return slotsFromHeadings(headings, roles)
  } finally {
    await doc.destroy().catch(() => {})
  }
}
