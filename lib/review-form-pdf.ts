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

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
// 2025-01-23 → 23-Jan-25, the way the paper form is filled.
export function formatFormDate(value: string | null) {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}-${MONTHS_SHORT[Number(m[2]) - 1]}-${m[1].slice(2)}` : ''
}

function wrap(font: PDFFont, value: string, size: number, widths: number[]): string[] {
  const lines: string[] = []
  let current = ''
  for (const word of value.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word
    const max = widths[Math.min(lines.length, widths.length - 1)]
    if (current && font.widthOfTextAtSize(candidate, size) > max) { lines.push(current); current = word } else current = candidate
  }
  if (current) lines.push(current)
  return lines
}

export async function buildReviewFormPdf(data: ReviewFormData): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(await readFile(path.join(process.cwd(), 'templates', 'isms-f-001-001-review.pdf')))
  const page = pdf.getPage(0)
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  const cover = (x: number, y: number, w: number, h: number) => page.drawRectangle({ x, y, width: w, height: h, color: WHITE, borderWidth: 0 })
  // Shrinks to fit one line of `maxWidth`, then cuts with an ellipsis.
  const write = (value: string, x: number, y: number, maxWidth: number, size = 10.5) => {
    if (!value) return
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

  // ── detail revisi: a full line, then a short one beside the signature table ──
  const detail = wrap(font, data.detailRevisi, 9.5, [486, 228])
  write(detail[0] ?? '', 56, ROW.detail1, 486, 9.5)
  write(detail.slice(1).join(' '), 56, ROW.detail2, 228, 9.5)

  pdf.setTitle(`Form Review & Revisi Dokumen ISMS — ${data.formNo}`)
  return pdf.save()
}
