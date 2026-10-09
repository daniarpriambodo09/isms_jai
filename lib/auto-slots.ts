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

/** A QR spot (and its date box) as drawn on a template, with the box heading it belongs under. */
export type TemplateSpot = { role_code: string; heading: { key: string; cx: number; y: number }; slot: Omit<SignatureSlot, 'role_code'> }

/**
 * QR spots for a sheet made from a known form (pure, for testing): each spot
 * of the template, moved by as much as its box heading sits away from where
 * the template prints it. A heading that isn't found — or is found far from
 * the template's place, so the file is some other layout — gives no spot.
 */
export function slotsOnTemplate(headings: Heading[], spots: TemplateSpot[]): SignatureSlot[] {
  const { row } = signatureRow(headings)
  const keys = row.map((h) => h.key)
  return spots.flatMap((spot): SignatureSlot[] => {
    const heading = row.find((h) => h.key === headingFor(spot.heading.key, keys))
    if (!heading) return []
    const dx = heading.cx - spot.heading.cx
    const dy = heading.y - spot.heading.y
    if (Math.abs(dx) > 0.12 || Math.abs(dy) > 0.2) return []
    const { slot } = spot
    if (slot.x + dx < 0 || slot.x + slot.w + dx > 1 || slot.y + dy < 0 || slot.y + slot.h + dy > 1) return []
    return [{ ...slot, role_code: spot.role_code, page: heading.page, x: slot.x + dx, y: slot.y + dy, date: slot.date ? { ...slot.date, x: slot.date.x + dx, y: slot.date.y + dy } : null }]
  })
}

/** Reads the stored PDF and returns the template's spots moved onto its boxes. */
export async function detectTemplateSlots(filePath: string, spots: TemplateSpot[]): Promise<SignatureSlot[]> {
  return slotsOnTemplate(headingsOf(await readText(filePath)), spots)
}

// ─── The Form Review's signature boxes, measured on the file itself ───
// Copies of the form differ (A4 or Letter, other column widths, the table a
// little higher or lower), so the boxes are measured on the uploaded file:
// each box from its heading (Approval / Checked / Prepared) and the two "/"
// of its date line, the box width from the gap between the headings. The QR
// and the date box are then laid out in it the way the form's template does
// (lib/review-form-pdf.ts), scaled to that box.

export type ReviewBoxName = 'approval' | 'checked' | 'prepared'
const REVIEW_HEADING: Record<ReviewBoxName, RegExp> = { approval: /^approval$/i, checked: /^checked$/i, prepared: /^prepared$/i }
// The template's box, in points: its width, heading baseline → date baseline,
// heading baseline → QR top, QR size, date baseline → date box top, date box
// height, and the date box's inset from the box sides.
const T = { col: 82.5, rows: 80, qrTop: 7.6, qr: 56, dateTop: 10.9, dateH: 14, inset: 4 }

export type ReviewFormLayout = {
  slots: Partial<Record<ReviewBoxName, Omit<SignatureSlot, 'role_code'>>>
  /** Where the form's two date slashes are, in points from the date box's left edge. */
  dateSlashes: [number, number] | null
}

/** The boxes of a Form Review found in its text (pure, for testing). Null when no heading is found. */
export function reviewFormLayout(items: TextItem[]): ReviewFormLayout | null {
  const headings = (Object.keys(REVIEW_HEADING) as ReviewBoxName[]).flatMap((box) => {
    const item = items.find((i) => REVIEW_HEADING[box].test(i.str.trim()))
    return item ? [{ box, item }] : []
  })
  if (!headings.length) return null
  const page = headings[0].item.page
  const row = headings.filter((h) => h.item.page === page && Math.abs(h.item.y - headings[0].item.y) < 0.01)
  const { pageW: P, pageH: H } = row[0].item
  const centres = row.map((h) => h.item.cx).sort((a, b) => a - b)
  const gaps = centres.slice(1).map((c, i) => c - centres[i]).filter((g) => g > 0.02)
  const col = (gaps.length ? Math.min(...gaps) : T.col / 595.2) * P // points
  const sx = col / T.col
  let dateSlashes: [number, number] | null = null
  const slots: ReviewFormLayout['slots'] = {}
  for (const { box, item: head } of row) {
    // the two "/" of this box's date line: under the heading, inside the column
    const slashes = items
      .filter((i) => i.page === page && i.str.trim() === '/' && Math.abs(i.cx - head.cx) * P < col / 2 && i.y > head.y + 0.01 && i.y - head.y < 0.25)
      .sort((a, b) => a.y - b.y || a.cx - b.cx)
    const line = slashes.filter((i) => Math.abs(i.y - (slashes[0]?.y ?? 0)) < 0.004).slice(0, 2).sort((a, b) => a.cx - b.cx)
    const headY = head.y * H
    const dateY = line.length ? line[0].y * H : headY + T.rows * sx
    const sy = (dateY - headY) / T.rows
    const qr = T.qr * Math.min(sx, sy)
    const qrTop = headY + T.qrTop * sy
    const left = head.cx * P - col / 2
    const date = { x: left + T.inset * sx, y: dateY - T.dateTop * sy, w: col - 2 * T.inset * sx, h: T.dateH * sy }
    if (line.length === 2 && !dateSlashes) dateSlashes = line.map((i) => (i.cx - (i.w ?? 0) / 2) * P - date.x) as [number, number]
    slots[box] = {
      page,
      x: (head.cx * P - qr / 2) / P, y: qrTop / H, w: qr / P, h: qr / H,
      date: { x: date.x / P, y: date.y / H, w: date.w / P, h: date.h / H },
    }
  }
  return { slots, dateSlashes }
}

/** Measures the Form Review's boxes on the stored file. */
export async function detectReviewFormLayout(filePath: string): Promise<ReviewFormLayout | null> {
  return reviewFormLayout(await readText(filePath))
}

/** One piece of text of the PDF, placed like a Heading (displayed-page fractions). */
export type TextItem = { str: string; page: number; pageW: number; pageH: number; cx: number; y: number; h: number; w?: number }

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
        items.push({ str: item.str, page: n - 1, pageW: viewport.width, pageH: viewport.height, cx: (x + item.width / 2) / viewport.width, y: y / viewport.height, h: item.height / viewport.height, w: item.width / viewport.width })
      }
    }
    return items
  } finally {
    await doc.destroy().catch(() => {})
  }
}

const headingsOf = (items: TextItem[]): Heading[] =>
  items.flatMap((item) => { const key = signatureKey(item.str); return key ? [{ key, page: item.page, pageW: item.pageW, pageH: item.pageH, cx: item.cx, y: item.y, h: item.h }] : [] })

// ─── "Eff. Date" in the document header ───
// The ISMS header box reads Doc. No. / Tanggal / Revisi / Eff. Date, each with
// its value to the right. The Eff. Date is left empty on the sheet: the
// document takes effect when its last approver signs, so the signed PDF
// writes that date there (app/api/prosedur-isms/[id]/pdf).

/** Where the effective date goes: an empty value cell beside an "Eff. Date" label (displayed-page fractions). */
export type EffDateCell = { page: number; cx: number; baseline: number; h: number; width: number }

// Only the header's own label: "Tanggal efektif" on the Form Review is the
// reviewed document's date, written by whoever fills the form in.
const EFF_DATE_LABEL = /^eff(ective)?\.?\s*date\s*:?$/i

/** The empty "Eff. Date" cells of a sheet (pure, for testing). A cell that already shows a date is left out. */
export function effDateCells(items: TextItem[]): EffDateCell[] {
  const cells: EffDateCell[] = []
  for (const label of items.filter((item) => EFF_DATE_LABEL.test(item.str.trim()))) {
    const right = label.cx + (label.w ?? 0) / 2
    const sameRow = (item: TextItem, ref: TextItem) => item.page === ref.page && Math.abs(item.y - ref.y) < Math.max(ref.h * 0.6, 0.006)
    // something already written to the right of the label (not just a colon): keep it
    if (items.some((item) => item !== label && sameRow(item, label) && item.cx > right && item.cx - right < 0.35 && item.str.trim().replace(/:/g, ''))) continue
    // The value column: where the rows above it (Doc. No., Tanggal, Revisi) have their values.
    const siblings = items.filter((item) => item !== label && item.page === label.page && Math.abs(item.cx - label.cx) < 0.05 && label.y - item.y > 0.005 && label.y - item.y < 0.12)
    const values = siblings.flatMap((sibling) => items.filter((item) => item !== sibling && sameRow(item, sibling) && item.cx > sibling.cx + (sibling.w ?? 0) / 2 && item.str.trim().replace(/:/g, '')).map((item) => item.cx))
    const sorted = values.sort((a, b) => a - b)
    const cx = sorted.length ? sorted[Math.floor(sorted.length / 2)] : Math.min(right + 0.07, 0.95)
    const width = Math.max(0.06, Math.min(2 * (cx - right) - 0.01, 2 * (0.985 - cx)))
    cells.push({ page: label.page, cx, baseline: label.y, h: label.h, width })
  }
  return cells
}

/** Reads the stored PDF and returns its empty "Eff. Date" cells. */
export async function detectEffDateCells(filePath: string): Promise<EffDateCell[]> {
  return effDateCells(await readText(filePath))
}

// ─── Default spot ───
// A Working Standard whose sheet has no signature boxes the portal can read
// still gets every QR automatically: in a row at the bottom right of the last
// page, each with its approval date under it — above the e-sign footer line.

const DEFAULT_QR = 44 // points
const DEFAULT_GAP = 8
const DEFAULT_DATE_H = 10
const DEFAULT_MARGIN = { right: 28, bottom: 22 }

/** The default spots for these positions on a page of this size (pure, for testing). Rightmost = last position. */
export function defaultSlots(codes: string[], page: number, pageW: number, pageH: number): SignatureSlot[] {
  return codes.map((code, i) => {
    const fromRight = codes.length - 1 - i
    const left = pageW - DEFAULT_MARGIN.right - DEFAULT_QR - fromRight * (DEFAULT_QR + DEFAULT_GAP)
    const top = pageH - DEFAULT_MARGIN.bottom - DEFAULT_DATE_H - 2 - DEFAULT_QR
    return {
      role_code: code, page,
      x: Math.max(left, 0) / pageW, y: top / pageH, w: DEFAULT_QR / pageW, h: DEFAULT_QR / pageH,
      date: { x: Math.max(left, 0) / pageW, y: (top + DEFAULT_QR + 2) / pageH, w: DEFAULT_QR / pageW, h: DEFAULT_DATE_H / pageH },
    }
  })
}

/** Default spots on the stored PDF's last page (its displayed size). */
export async function detectDefaultSlots(filePath: string, codes: string[]): Promise<SignatureSlot[]> {
  if (!codes.length) return []
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(await readFile(path.join(STORAGE_ROOT, filePath)))
  const doc = await pdfjs.getDocument({ data, disableFontFace: true, useSystemFonts: false, isEvalSupported: false, verbosity: 0 }).promise
  try {
    const last = await doc.getPage(doc.numPages)
    const viewport = last.getViewport({ scale: 1 })
    return defaultSlots(codes, doc.numPages - 1, viewport.width, viewport.height)
  } finally {
    await doc.destroy().catch(() => {})
  }
}

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
