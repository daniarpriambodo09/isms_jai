// lib/review-form-pdf.ts
//
// The filled "Form Review & Revisi Dokumen ISMS" as a PDF: the official form
// (templates/isms-f-001-001-review.pdf, ISMS-F-001-001) with the values
// written where a person would write them by hand — like lib/esign-pdf.ts
// does for the Ijin Foto/Video form.
//
// The template is a copy that was already filled in once, so its own values
// (a date, a month and year, a title, three ticks) are covered in white first.
// Every coordinate was read off the template's text layer and ruled lines;
// covers stay inside the cells, so no line of the form is erased.
//
// The three signature boxes are left as printed here: the approvers' QR and
// date are added by the e-sign engine (REVIEW_SIGN_SLOTS says where).

import 'server-only'
import path from 'path'
import { readFile } from 'fs/promises'
import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib'
import { REVIEW_MONTHS, type ReviewBox, type ReviewFormData } from '@/lib/review-form'

const PAGE_W = 595.2
const PAGE_H = 841.68
const INK = rgb(0.08, 0.08, 0.1)
const WHITE = rgb(1, 1, 1)

// Baselines of the form's rows (PDF points, bottom-left origin).
const VALUE_X = 251.4
const ROW = {
  formNo: 710.2, reviewRequested: 690.2, revisionDone: 670.3, approvalDone: 650.4, effective: 630.5,
  docControlNo: 491.4, docTitle: 471.5, docTitle2: 451.6, oldRevision: 431.7,
  month: 322.4, year: 302.5, withdrawn: 302.5,
  standards: 272.7, regulation: 252.8, request: 232.9,
  detail1: 180.6, detail2: 160.6,
}
// Tick boxes: bottom-left corner of the 12pt square = (x, label baseline − 1.3).
const BOX_SIZE = 12.2
const LEVEL_BASELINE = { 1: 590.3, 2: 570.4, 3: 550.5, 4: 530.5 } as const
const TYPE_BASELINE = { flow: 590.3, form: 570.4, checksheet: 550.5, lain: 530.5 } as const
const RESULT_BASELINE = { relevan: 341.9, revisi: 321.9, ditarik: 302.0 } as const
const X_LEVEL = 252.5
const X_TYPE = 400.1
const X_REASON = 57.1
const REASON_BASELINE = { new: 361.8, periodic: 341.9, standards: 272.2, regulation: 252.3, request: 232.4 }

// The signature table: three boxes between x = 294.1 … 541.9, y = 58.4 … 156.2.
const SIGN_BOX_X: Record<ReviewBox, [number, number]> = { approval: [294.1, 376.6], checked: [376.6, 459.3], prepared: [459.3, 541.9] }
const QR_SIZE = 56
const QR_TOP = 136 // just under the box's heading
const DATE_Y = [60.5, 74.5] // the "/ /" line at the bottom of the box
const DATE_INSET = 4 // the date box starts this far inside the signature box
// The form's two date slashes sit 27.1 and 51.4 pt from each box's left edge
// (321.2 / 345.5, 403.9 / 428.1, 486.4 / 510.7). Given from the date box's
// left edge, for the e-sign engine to write "dd / mm / yy" around them.
export const REVIEW_DATE_SLASHES: [number, number] = [27.1 - DATE_INSET, 51.4 - DATE_INSET]

/** Where each box's QR and date go, as the e-sign engine stores them: fractions of the page, top-left origin. */
export const REVIEW_SIGN_SLOTS: Record<ReviewBox, { page: number; x: number; y: number; w: number; h: number; date: { x: number; y: number; w: number; h: number } }> =
  Object.fromEntries((Object.keys(SIGN_BOX_X) as ReviewBox[]).map((box) => {
    const [left, right] = SIGN_BOX_X[box]
    const qrLeft = (left + right) / 2 - QR_SIZE / 2
    return [box, {
      page: 0,
      x: qrLeft / PAGE_W, y: (PAGE_H - QR_TOP) / PAGE_H, w: QR_SIZE / PAGE_W, h: QR_SIZE / PAGE_H,
      date: { x: (left + DATE_INSET) / PAGE_W, y: (PAGE_H - DATE_Y[1]) / PAGE_H, w: (right - left - 2 * DATE_INSET) / PAGE_W, h: (DATE_Y[1] - DATE_Y[0]) / PAGE_H },
    }]
  })) as never

// Where the form prints each box's heading (centre and baseline, as fractions
// of the page) — an uploaded form is matched to the template by these.
export const REVIEW_BOX_HEADINGS: Record<ReviewBox, { key: string; cx: number; y: number }> = {
  approval: { key: 'APPROVED', cx: 0.56224, y: 0.82942 },
  checked: { key: 'CHECKED', cx: 0.70096, y: 0.82942 },
  prepared: { key: 'PREPARED', cx: 0.83994, y: 0.82942 },
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
// 2025-01-23 → 23-Jan-25, the way the paper form is filled.
export function formatFormDate(value: string | null) {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}-${MONTHS_SHORT[Number(m[2]) - 1]}-${m[1].slice(2)}` : ''
}

// The built-in PDF font only has Latin-1 plus a few typographic signs: anything
// else pasted into a field (an emoji, an arrow, a non-Latin letter) would make
// drawing fail, so it is shown as "?".
function printable(value: string) {
  return value.replace(/[^\x20-\x7E -ÿ–—‘’“”…•]/g, '?')
}

function wrap(font: PDFFont, value: string, size: number, widths: number[]): string[] {
  const lines: string[] = []
  let current = ''
  const widthOf = (text: string) => font.widthOfTextAtSize(text, size)
  const maxAt = () => widths[Math.min(lines.length, widths.length - 1)]
  for (let word of value.split(/\s+/).filter(Boolean)) {
    // A "word" wider than a whole line (a long link, a code) is cut across lines.
    while (widthOf(word) > maxAt()) {
      if (current) { lines.push(current); current = '' }
      let cut = word.length - 1
      while (cut > 1 && widthOf(word.slice(0, cut)) > maxAt()) cut--
      lines.push(word.slice(0, cut))
      word = word.slice(cut)
    }
    const candidate = current ? `${current} ${word}` : word
    if (current && widthOf(candidate) > maxAt()) { lines.push(current); current = word } else current = candidate
  }
  if (current) lines.push(current)
  return lines
}

// Where "Detail revisi" is written: line 1 spans the form, the rest stay left of the signature table.
const DETAIL_X = 56
const DETAIL_WIDTHS = [486, 226]
const DETAIL_FLOOR = 60 // lowest baseline above the form's frame (its bottom line is at ~48)
const DETAIL_GAP = 3 // extra room under the second dotted line, so the continuation doesn't sit on it
const DETAIL_MORE = '… (lanjut di lampiran)'

/** Lines, type size and line spacing that put the text in the space the form has for it. */
export function layoutDetail(font: PDFFont, value: string): { lines: string[]; size: number; leading: number; overflow: boolean } {
  const text = printable(value.trim())
  const capacity = (leading: number) => 2 + Math.floor((ROW.detail2 - DETAIL_GAP - DETAIL_FLOOR) / leading)
  for (const size of [9.5, 9, 8.5, 8, 7.5, 7]) {
    const leading = size + 1.8
    const lines = text ? wrap(font, text, size, DETAIL_WIDTHS) : []
    if (lines.length <= capacity(leading)) return { lines, size, leading, overflow: false }
  }
  // Too long even in small type: as much as fits at a readable size, then the pointer.
  const size = 8
  const leading = size + 1.8
  const lines = wrap(font, text, size, DETAIL_WIDTHS).slice(0, capacity(leading))
  let last = lines[lines.length - 1] ?? ''
  const width = DETAIL_WIDTHS[1]
  while (last.length > 1 && font.widthOfTextAtSize(`${last} ${DETAIL_MORE}`, size) > width) last = last.replace(/\s*\S+$/, '')
  lines[lines.length - 1] = `${last} ${DETAIL_MORE}`
  return { lines, size, leading, overflow: true }
}

// The attached page for a "Detail revisi" too long for the form: the whole text, under the form's number.
async function addDetailPage(pdf: PDFDocument, font: PDFFont, data: ReviewFormData) {
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const MARGIN = 56
  const WIDTH = PAGE_W - 2 * MARGIN
  const SIZE = 10
  const LEADING = 14.5
  const lines = wrap(font, printable(data.detailRevisi.trim()), SIZE, [WIDTH])
  let page = pdf.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - 70
  const heading = (continued: boolean) => {
    page.drawText(`Lampiran Form Review & Revisi Dokumen ISMS${continued ? ' (lanjutan)' : ''}`, { x: MARGIN, y, size: 12, font: bold, color: INK })
    y -= 17
    page.drawText(printable(`Kontrol No. Form: ${data.formNo}   ·   ${[data.docControlNo, data.docTitle].filter(Boolean).join(' — ')}`).slice(0, 120), { x: MARGIN, y, size: 8.5, font, color: INK })
    y -= 10
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.8, color: INK })
    y -= 22
    page.drawText('DETAIL REVISI', { x: MARGIN, y, size: 10.5, font: bold, color: INK })
    y -= 18
  }
  heading(false)
  for (const line of lines) {
    if (y < 60) { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - 70; heading(true) }
    page.drawText(line, { x: MARGIN, y, size: SIZE, font, color: INK })
    y -= LEADING
  }
}

export async function buildReviewFormPdf(data: ReviewFormData): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(await readFile(path.join(process.cwd(), 'templates', 'isms-f-001-001-review.pdf')))
  const page = pdf.getPage(0)
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  const cover = (x: number, y: number, w: number, h: number) => page.drawRectangle({ x, y, width: w, height: h, color: WHITE, borderWidth: 0 })
  // Shrinks to fit one line of `maxWidth`, then cuts with an ellipsis.
  const write = (value: string, x: number, y: number, maxWidth: number, size = 10.5) => {
    if (!value) return
    value = printable(value)
    let s = size
    while (s > 7 && font.widthOfTextAtSize(value, s) > maxWidth) s -= 0.5
    let shown = value
    while (shown.length > 1 && font.widthOfTextAtSize(shown, s) > maxWidth) shown = `${shown.slice(0, -2)}…`
    page.drawText(shown, { x, y, size: s, font, color: INK })
  }
  const boxInside = (x: number, baseline: number) => cover(x + 1.1, baseline - 0.2, BOX_SIZE - 2.3, BOX_SIZE - 2.3)
  const tick = (x: number, baseline: number) => {
    const bx = x + 2.6, by = baseline + 4.2
    page.drawLine({ start: { x: bx, y: by }, end: { x: bx + 2.6, y: by - 2.8 }, thickness: 1.3, color: INK })
    page.drawLine({ start: { x: bx + 2.6, y: by - 2.8 }, end: { x: bx + 7.2, y: by + 4 }, thickness: 1.3, color: INK })
  }

  // ── the template's own filled-in values ──
  cover(VALUE_X - 1, 687.6, 60, 11.5)                // "23-Jan-25"
  cover(VALUE_X - 1, 468.4, 224, 11.5)               // the title
  cover(137.5, 319.8, 42, 11.5)                      // "Januari"
  cover(137.5, 299.9, 32, 11.5)                      // "2025"
  boxInside(X_LEVEL, LEVEL_BASELINE[3])              // ✓ Level 3
  boxInside(X_REASON, REASON_BASELINE.periodic)      // ✓ Review berkala
  boxInside(X_LEVEL, RESULT_BASELINE.revisi)         // ✓ Tidak relevan dan perlu revisi
  // The signature boxes keep the form's grey "IAA" / "SSA" and "/  /": an
  // unsigned box looks like the paper form; the QR and the date are written
  // over them when the approver signs (lib/procedure-esign-pdf.ts).

  // ── header block ──
  const lineWidth = 285
  write(data.formNo, VALUE_X, ROW.formNo, lineWidth)
  write(formatFormDate(data.reviewRequestedAt), VALUE_X, ROW.reviewRequested, lineWidth)
  write(formatFormDate(data.revisionDoneAt), VALUE_X, ROW.revisionDone, lineWidth)
  write(formatFormDate(data.approvalDoneAt), VALUE_X, ROW.approvalDone, lineWidth)
  write(formatFormDate(data.effectiveAt), VALUE_X, ROW.effective, lineWidth)

  if (data.level) tick(X_LEVEL, LEVEL_BASELINE[data.level])
  if (data.docType) tick(X_TYPE, TYPE_BASELINE[data.docType])

  // ── the document under review ──
  write(data.docControlNo, VALUE_X, ROW.docControlNo, lineWidth)
  const titleLines = wrap(font, data.docTitle, 10.5, [lineWidth, lineWidth])
  if (titleLines.length <= 1) write(data.docTitle, VALUE_X, ROW.docTitle, lineWidth)
  else {
    write(titleLines[0], VALUE_X, ROW.docTitle, lineWidth)
    write(titleLines.slice(1).join(' '), VALUE_X, ROW.docTitle2, lineWidth)
  }
  write(data.oldRevision, VALUE_X, ROW.oldRevision, lineWidth)

  // ── detail review ──
  if (data.reasonNew) tick(X_REASON, REASON_BASELINE.new)
  if (data.reasonPeriodic) {
    tick(X_REASON, REASON_BASELINE.periodic)
    write(data.periodMonth ? REVIEW_MONTHS[data.periodMonth - 1] : '', 138.5, ROW.month, 100)
    write(data.periodYear ? String(data.periodYear) : '', 138.5, ROW.year, 100)
  }
  for (const [key, value, y] of [['standards', data.standardsChange, ROW.standards], ['regulation', data.regulationChange, ROW.regulation], ['request', data.requestFrom, ROW.request]] as const) {
    if (!value) continue
    tick(X_REASON, REASON_BASELINE[key])
    write(value, 240, y, 300, 10)
  }
  if (data.result) tick(X_LEVEL, RESULT_BASELINE[data.result])
  if (data.result === 'ditarik') write(formatFormDate(data.withdrawnFrom), 420, ROW.withdrawn, 100)

  // ── detail revisi ──
  // The form has two dotted lines: a full one, then a short one beside the
  // signature table. A longer text carries on under the second line, in the
  // blank space left of the signature boxes (nothing is drawn there, so the
  // form's layout stays as printed), in smaller type when that makes it fit.
  // What still doesn't fit ends with a pointer to the attached page, which
  // carries the whole text.
  const detail = layoutDetail(font, data.detailRevisi)
  detail.lines.forEach((line, i) => {
    const y = i === 0 ? ROW.detail1 : i === 1 ? ROW.detail2 : ROW.detail2 - DETAIL_GAP - (i - 1) * detail.leading
    page.drawText(line, { x: DETAIL_X, y, size: detail.size, font, color: INK })
  })
  if (detail.overflow) await addDetailPage(pdf, font, data)

  pdf.setTitle(`Form Review & Revisi Dokumen ISMS — ${data.formNo}`)
  return pdf.save()
}
