// lib/auto-slots.ts
//
// Working Standard sheets all come from one template: a row of boxes headed
// "APPROVED 2 | APPROVED 1 | CHECKED | PREPARED" at the foot of the page. So
// the QR spots don't have to be placed by hand — the headings are found in
// the PDF's own text and each approver's QR goes in the box under the heading
// that matches their position. A position whose heading can't be found is
// simply left out (it can still be placed in "Atur Posisi QR").
//
// Under each box the template prints the signer's initials (TWC, MRA, …).
// Those cells are found the same way, so the signed PDF can print the
// initials of the approvers actually chosen for the document.

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

// The boxes sit in one row: the row (page + baseline) with the most different
// headings, and the width of one box (the gap between neighbouring headings).
export function signatureRow(headings: Heading[]): { row: Heading[]; column: number } {
  const rows = new Map<string, Heading[]>()
  for (const h of headings) {
    const id = `${h.page}:${Math.round(h.y * 100)}`
    if (!(rows.get(id) ?? []).some((other) => other.key === h.key)) rows.set(id, [...(rows.get(id) ?? []), h])
  }
  const row = [...rows.values()].sort((a, b) => b.length - a.length)[0] ?? []
  const centres = row.map((h) => h.cx).sort((a, b) => a - b)
  const gaps = centres.slice(1).map((c, i) => c - centres[i]).filter((g) => g > 0.01)
  return { row, column: gaps.length ? Math.min(...gaps) : DEFAULT_COLUMN }
}

/** The position that signs under a heading (null = nobody chosen for that box). */
export function roleForHeading<T extends { title: string }>(heading: Heading, row: Heading[], roles: T[]): T | null {
  const keys = row.map((h) => h.key)
  return roles.find((role) => { const key = signatureKey(role.title); return !!key && headingFor(key, keys) === heading.key }) ?? null
}

/** QR spots from the headings found on the pages (pure, for testing). */
export function slotsFromHeadings(headings: Heading[], roles: { code: string; title: string }[]): SignatureSlot[] {
  const { row, column } = signatureRow(headings)
  if (!row.length) return []

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

/** One piece of text of the PDF, placed like a Heading (displayed-page fractions). */
export type TextItem = { str: string; page: number; pageW: number; pageH: number; cx: number; y: number; h: number }

/** The cell under a signature box where the signer's initials are printed. */
export type InitialsCell = { key: string; page: number; pageW: number; pageH: number; cx: number; baseline: number; h: number; column: number }

// Distance from a box heading to the initials under it on the template (points) —
// used when a sheet has the row but nothing printed in it yet.
const TEMPLATE_INITIALS_DROP = 73

/**
 * Where the initials go under each heading of the signature row (pure, for
 * testing): the short all-capitals text printed below the heading in the same
 * column — on the same page, or at the top of the next one when the sheet was
 * exported with that row pushed over. A box with nothing printed there takes
 * the same offset as its neighbours.
 */
export function initialsCells(items: TextItem[], headings: Heading[]): InitialsCell[] {
  const { row, column } = signatureRow(headings)
  const found = row.map((heading) => {
    let best: { item: TextItem; distance: number } | null = null
    for (const item of items) {
      const text = item.str.trim()
      if (!/^[A-Z][A-Z0-9]{1,3}$/.test(text) || signatureKey(text)) continue
      if (Math.abs(item.cx - heading.cx) > column * 0.45) continue
      const distance = item.page === heading.page && item.y > heading.y + 0.02 && item.y - heading.y < 0.3 ? item.y - heading.y
        : item.page === heading.page + 1 && item.y < 0.25 ? 1 + item.y
          : null
      if (distance !== null && (!best || distance < best.distance)) best = { item, distance }
    }
    return { heading, item: best ? best.item : null }
  })
  const sample = found.find((f) => f.item)
  return found.flatMap(({ heading, item }): InitialsCell[] => {
    if (item) return [{ key: heading.key, page: item.page, pageW: item.pageW, pageH: item.pageH, cx: heading.cx, baseline: item.y, h: item.h, column }]
    // Nothing printed under this box: where its neighbours have theirs, or the template's place.
    if (sample?.item) {
      const s = sample.item
      return [{ key: heading.key, page: heading.page + (s.page - sample.heading.page), pageW: s.pageW, pageH: s.pageH, cx: heading.cx, baseline: s.y, h: s.h, column }]
    }
    const baseline = heading.y + TEMPLATE_INITIALS_DROP / heading.pageH
    return baseline < 0.975 ? [{ key: heading.key, page: heading.page, pageW: heading.pageW, pageH: heading.pageH, cx: heading.cx, baseline, h: heading.h, column }] : []
  })
}

async function readText(filePath: string): Promise<TextItem[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(await readFile(path.join(STORAGE_ROOT, filePath)))
  const doc = await pdfjs.getDocument({ data, disableFontFace: true, useSystemFonts: false, isEvalSupported: false, verbosity: 0 }).promise
  try {
    const items: TextItem[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue
        // Displayed-page coordinates (rotation applied), like the "Atur Posisi QR" editor uses.
        const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5])
        items.push({ str: item.str, page: n - 1, pageW: viewport.width, pageH: viewport.height, cx: (x + item.width / 2) / viewport.width, y: y / viewport.height, h: item.height / viewport.height })
      }
    }
    return items
  } finally {
    await doc.destroy().catch(() => {})
  }
}

const headingsOf = (items: TextItem[]): Heading[] =>
  items.flatMap((item) => { const key = signatureKey(item.str); return key ? [{ key, page: item.page, pageW: item.pageW, pageH: item.pageH, cx: item.cx, y: item.y, h: item.h }] : [] })

/** Reads the stored PDF and returns a QR spot for each position whose box heading is found in it. */
export async function detectSignatureSlots(filePath: string, roles: { code: string; title: string }[]): Promise<SignatureSlot[]> {
  return slotsFromHeadings(headingsOf(await readText(filePath)), roles)
}

/**
 * What to print in the initials row of the stored PDF: for every box of the
 * signature row, its cell and the initials of the position chosen for it —
 * or null when no position signs in that box (the cell is then left blank,
 * instead of showing whoever was typed on the sheet).
 */
export async function detectInitials<T extends { title: string }>(filePath: string, roles: T[], initialsOf: (role: T) => string): Promise<(InitialsCell & { text: string | null })[]> {
  const items = await readText(filePath)
  const headings = headingsOf(items)
  const { row } = signatureRow(headings)
  return initialsCells(items, headings).map((cell) => {
    const heading = row.find((h) => h.key === cell.key)
    const role = heading ? roleForHeading(heading, row, roles) : null
    return { ...cell, text: role ? initialsOf(role) || null : null }
  })
}
