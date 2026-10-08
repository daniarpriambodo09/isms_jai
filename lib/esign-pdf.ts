// lib/esign-pdf.ts
//
// Builds the e-sign certificate PDF for a decided Visitor Ijin Foto/Video
// request by overlaying data ON TOP OF the actual official YAZAKI blank
// form (templates/isms-f-010-008-visitor.pdf, form ISMS-F-010-008) — not a
// from-scratch recreation. The template's own content (Kanji subtitles,
// logo, borders, "CONFIDENTIAL" box) is embedded and drawn completely
// unchanged; every coordinate below was measured directly off that PDF's
// text layer (see the coordinate-extraction notes in git history for this
// file) so each value lands exactly where a person would otherwise
// handwrite it.
//
// The template's page holds two stacked copies of the same blank form; only
// the TOP copy is used here.
//
// Two intentional deviations from "don't touch the template at all":
// 1. The template has "TEGUH SUNJOYO (Information Assets Administrator)"
//    printed as static ink in the signature area (baked in when he was the
//    standing approver). Since the actual approver can now be someone else,
//    that name/title is covered with a white rectangle and replaced with
//    whoever is actually recorded as having decided the request. The cover
//    stays strictly INSIDE the name cell — the ruled line between the
//    signature cell (QR) and the name cell is the template's own and must
//    stay visible.
// 2. "MENYETUJUI, 撮影・録音許可" ("approving, permission to record") only
//    reads correctly when the request was actually approved, so it's left
//    as the template's own untouched text for an approval. Only a
//    REJECTED outcome gets that area covered and replaced with an
//    explicit DITOLAK line — printing "approving" text unchanged on a
//    rejection would misrepresent it, which is worse than a table line
//    being 2pt off. (An earlier pass at this covered part of the left
//    table's own column by mistake — that was a wrong x-coordinate for
//    the right column's border, since fixed; this isn't the same bug
//    recurring.)
//
// Every Kanji line the above two don't touch, every border, and the logo
// is the template's own embedded page content, untouched.

import 'server-only'
import { APP_TIME_ZONE } from '@/lib/config'
import path from 'path'
import { readFile } from 'fs/promises'
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'

export type EsignRequestData = {
  id: number
  requesterName: string
  deptOrCompany: string
  dept: string | null
  fromAt: string
  toAt: string
  location: string
  objective: string
  status: 'approved' | 'rejected'
  decidedAt: string
  approverFullName: string
  approverTitle: string | null
  verificationCode: string
  submittedAt: string
  /** PIC Pendamping picked by Lobby / Pos Security ("Nama (Dept)"), if any. */
  escort?: string | null
  cameraSerialNo: string | null
}

const TEXT = rgb(0.07, 0.07, 0.07)
const WHITE = rgb(1, 1, 1)
const CRIMSON = rgb(0.72, 0.13, 0.12)

// Full page is 595.2 x 841.8 with the form printed twice, stacked. Using
// only the top copy — cropped a bit above the exact midpoint (450.7, the
// table's own bottom border) so the dashed cut-line between the two
// copies falls outside this crop entirely, leaving clean margin for our
// footer instead of a line running through it.
const PAGE_W = 595.2
const FULL_H = 841.8
const CROP_BOTTOM = 433
const HALF_H = CROP_BOTTOM // the y-offset subtracted from every absolute
// coordinate measured on the source PDF to land in the embedded page's
// own (0,0)-origin coordinate space.

// Height of the strip added under the form when a PIC Pendamping is printed
// (the verification footnote moves down into it — see buildEsignPdf).
const ESCORT_STRIP = 12

function fmtFreeDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { timeZone: APP_TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtTime(value: string) {
  return new Date(value).toLocaleTimeString('id-ID', { timeZone: APP_TIME_ZONE, hour: '2-digit', minute: '2-digit' })
}

function dmy(value: string) {
  const d = new Date(value)
  return { dd: String(d.getDate()).padStart(2, '0'), mm: String(d.getMonth() + 1).padStart(2, '0'), yy: String(d.getFullYear()).slice(-2) }
}

function wrapToWidth(font: PDFFont, value: string, maxWidth: number, size: number): string[] {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

// Shrinks font size until the text fits maxWidth on one line (down to a
// floor), rather than letting it run past the row's fixed-height cell.
function fitOneLine(font: PDFFont, value: string, maxWidth: number, startSize: number, minSize = 6.5): { text: string; size: number } {
  let size = startSize
  while (size > minSize && font.widthOfTextAtSize(value, size) > maxWidth) size -= 0.5
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return { text: value, size }
  // Still too long even at the floor size — truncate with an ellipsis.
  let text = value
  while (text.length > 1 && font.widthOfTextAtSize(`${text}…`, size) > maxWidth) text = text.slice(0, -1)
  return { text: `${text}…`, size }
}

export async function buildEsignPdf(data: EsignRequestData, verifyUrl: string): Promise<Uint8Array> {
  const templateBytes = await readFile(path.join(process.cwd(), 'templates', 'isms-f-010-008-visitor.pdf'))
  const templateDoc = await PDFDocument.load(templateBytes)
  const [templatePage] = templateDoc.getPages()

  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // The form has no PIC Pendamping field and only one free line (between the
  // table and the frame), which the verification footnote uses. With a PIC
  // Pendamping that line is theirs — written like the rows above, no line or
  // box added — and the footnote goes into a strip added under the frame.
  const escort = data.escort?.trim() || null
  const extra = escort ? ESCORT_STRIP : 0
  const toLocal = (y: number) => y - HALF_H + extra

  const cropHeight = FULL_H - CROP_BOTTOM
  const embeddedTemplate = await pdf.embedPage(templatePage, { left: 0, bottom: CROP_BOTTOM, right: PAGE_W, top: FULL_H })
  const page: PDFPage = pdf.addPage([PAGE_W, cropHeight + extra])
  page.drawPage(embeddedTemplate, { x: 0, y: extra, width: PAGE_W, height: cropHeight })

  const text = (value: string, x: number, yAbs: number, opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb> } = {}) => {
    page.drawText(value, { x, y: toLocal(yAbs), size: opts.size ?? 9.5, font: opts.f ?? font, color: opts.color ?? TEXT })
  }
  const coverWhite = (x: number, yAbsTop: number, w: number, h: number) => {
    page.drawRectangle({ x, y: toLocal(yAbsTop) - h, width: w, height: h, color: WHITE, borderWidth: 0 })
  }

  // ---------- Left-hand table (measured colon x = 198.7 for every simple row) ----------
  const COLON_X = 198.7
  const VALUE_X = COLON_X + 16

  text(fmtFreeDate(data.submittedAt), VALUE_X, 678.4)                                   // TANGGAL (Tanggal Pengajuan)
  text(data.requesterName, VALUE_X, 647.5, { f: bold })                                 // NAMA
  text(data.deptOrCompany, VALUE_X, 616.8, { f: bold })                                 // NAMA ORGANISASI/PERUSAHAAN
  text(data.dept ?? '-', VALUE_X, 586.0, { f: bold })                                   // DEPARTEMEN

  // TANGGAL PENGAMBILAN — segmented DD / MM /20 YY on both sides of "~".
  // The template prints "/" and "/20" here at size 12.8, measured directly
  // off the PDF's text layer — our digits are set to the same size so
  // "26" doesn't look like a mismatched afterthought next to a much
  // larger pre-printed "/20".
  const DATE_SEG_SIZE = 11.5
  const fromDmy = dmy(data.fromAt)
  const toDmy = dmy(data.toAt)
  text(fromDmy.dd, 240, 547.7, { f: bold, size: DATE_SEG_SIZE })
  text(fromDmy.mm, 266, 547.7, { f: bold, size: DATE_SEG_SIZE })
  text(fromDmy.yy, 306, 547.7, { f: bold, size: DATE_SEG_SIZE })
  text(toDmy.dd, 362, 548.5, { f: bold, size: DATE_SEG_SIZE })
  text(toDmy.mm, 389, 548.5, { f: bold, size: DATE_SEG_SIZE })
  text(toDmy.yy, 429, 548.5, { f: bold, size: DATE_SEG_SIZE })
  text(fmtTime(data.fromAt), 270, 526.5, { f: bold })
  text(fmtTime(data.toAt), 403, 526.5, { f: bold })

  text(data.location, VALUE_X, 493.5, { f: bold })                                      // LOKASI PENGAMBILAN

  // TUJUAN PENGAMBILAN — the row is a fixed single-line height, and the
  // right-hand box sits beside it (starts at x=430), so text must stay
  // within the left column's own width, not the full page — otherwise it
  // runs straight into the signature box.
  const LEFT_COL_RIGHT_EDGE = 424
  const tujuanFit = fitOneLine(bold, data.objective || '-', LEFT_COL_RIGHT_EDGE - VALUE_X, 9.5)
  text(tujuanFit.text, VALUE_X, 462.7, { f: bold, size: tujuanFit.size })

  // ---------- Right-hand box ----------
  // Ruled lines of this column, measured by scanning the rendered template
  // for dark pixels (0.1pt steps) — not eyeballed off a grid:
  //   vertical borders   x = 462.8–464.2 (left) and 562.8–563.5 (right)
  //   horizontal lines   y = 590.7–591.3  above "MENYETUJUI"
  //                      y = 559.8–560.5  below it / top of the signature cell
  //                      y = 498.2–498.9  between signature cell and name cell
  //                      y = 452.0–452.7  bottom border
  // Everything drawn or covered below stays at least 1pt inside those lines,
  // so no cover rectangle touches a border and the QR never sits on one.
  const RIGHT_COL_X = 466
  const RIGHT_COL_W = 95
  const HEADER_CELL = { top: 589.7, bottom: 561.5 }   // "MENYETUJUI, 撮影・録音許可"
  const SIGN_CELL = { top: 559.8, bottom: 498.9 }     // blank cell for the signature (QR)
  const NAME_CELL = { top: 497.2, bottom: 453.7 }     // approver's name + title

  // Serial No. Kamera — centered in its blank cell (no ruled line/colon on
  // the template; the whole cell is the fill-in area).
  const serial = data.cameraSerialNo || '-'
  const serialWidth = bold.widthOfTextAtSize(serial, 9.5)
  text(serial, RIGHT_COL_X + (RIGHT_COL_W - serialWidth) / 2, 647, { f: bold })

  // TANGGAL (persetujuan) — segmented DD / MM /20 YY. Template prints
  // "/" and "/20" here at size 11.2 (measured); matched below so "26"
  // reads as part of the same date, not a smaller mismatched digit stuck
  // on afterward.
  const APPROVAL_DATE_SIZE = 10.5
  const decidedDmy = dmy(data.decidedAt)
  text(decidedDmy.dd, 471, 603.0, { f: bold, size: APPROVAL_DATE_SIZE })
  text(decidedDmy.mm, 502, 603.0, { f: bold, size: APPROVAL_DATE_SIZE })
  text(decidedDmy.yy, 538, 603.0, { f: bold, size: APPROVAL_DATE_SIZE })

  // "MENYETUJUI, 撮影・録音許可" already reads correctly for an approval, so
  // it's left as the template's own untouched content there — only a
  // REJECTED outcome needs covering and replacing, since printing
  // "approving" text unchanged on a rejection would misrepresent it.
  const isApproved = data.status === 'approved'
  if (!isApproved) {
    coverWhite(RIGHT_COL_X, HEADER_CELL.top, RIGHT_COL_W, HEADER_CELL.top - HEADER_CELL.bottom)
    const statusLabel = 'DITOLAK'
    const statusWidth = bold.widthOfTextAtSize(statusLabel, 11)
    text(statusLabel, RIGHT_COL_X + (RIGHT_COL_W - statusWidth) / 2, (HEADER_CELL.top + HEADER_CELL.bottom) / 2 - 11 * 0.36, { f: bold, size: 11, color: CRIMSON })
  }

  // QR (the "signature") only makes sense for an approval — a rejection
  // never had anything to sign, so its e-sign area stays blank rather than
  // printing a barcode that would visually suggest something was approved.
  if (isApproved) {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 300 })
    const qrImage = await pdf.embedPng(Buffer.from(qrDataUrl.split(',')[1], 'base64'))
    // Centered in the signature cell, clear of the lines above and below it.
    const qrSize = 50
    const qrX = RIGHT_COL_X + (RIGHT_COL_W - qrSize) / 2
    const qrTop = (SIGN_CELL.top + SIGN_CELL.bottom) / 2 + qrSize / 2
    page.drawImage(qrImage, { x: qrX, y: toLocal(qrTop) - qrSize, width: qrSize, height: qrSize })
  }

  // "TEGUH SUNJOYO" and "(Information Assets Administrator)" are static
  // ink naming the approver at the time this template was printed — cover
  // and replace with whoever actually decided this request (see file
  // header comment). The cover is the name cell's interior only, so the
  // ruled line under the QR and the bottom border stay intact.
  coverWhite(RIGHT_COL_X, NAME_CELL.top, RIGHT_COL_W, NAME_CELL.top - NAME_CELL.bottom)

  const centeredAt = (value: string, size: number, yAbs: number, f = font) => {
    const w = f.widthOfTextAtSize(value, size)
    text(value, RIGHT_COL_X + Math.max(2, (RIGHT_COL_W - w) / 2), yAbs, { f, size })
  }

  // Name (up to 2 lines) and title (up to 2 lines, in parentheses like the
  // template's own "(Information Assets Administrator)") form one block,
  // centered vertically in the name cell however many lines it takes.
  const NAME_SIZE = 8.5
  const NAME_LEADING = 9.5
  const TITLE_GAP = 3
  const ASCENT = 0.74 // baseline sits this fraction of the font size below a line's top
  const nameLines = wrapToWidth(bold, data.approverFullName, RIGHT_COL_W - 8, NAME_SIZE).slice(0, 2)
  // A long title shrinks a little before it is ever cut off at two lines.
  let TITLE_SIZE = 7.5
  const wrapTitle = () => (data.approverTitle ? wrapToWidth(font, `(${data.approverTitle})`, RIGHT_COL_W - 8, TITLE_SIZE) : [])
  while (TITLE_SIZE > 6 && wrapTitle().length > 2) TITLE_SIZE -= 0.5
  const titleLines = wrapTitle().slice(0, 2)
  const TITLE_LEADING = TITLE_SIZE + 1
  const blockHeight = nameLines.length * NAME_LEADING + (titleLines.length ? TITLE_GAP + titleLines.length * TITLE_LEADING : 0)

  let lineTop = (NAME_CELL.top + NAME_CELL.bottom) / 2 + blockHeight / 2
  for (const line of nameLines) {
    centeredAt(line, NAME_SIZE, lineTop - NAME_SIZE * ASCENT, bold)
    lineTop -= NAME_LEADING
  }
  lineTop -= TITLE_GAP
  for (const line of titleLines) {
    centeredAt(line, TITLE_SIZE, lineTop - TITLE_SIZE * ASCENT)
    lineTop -= TITLE_LEADING
  }

  // ---------- Verification footnote, printed in the margin below the form ----------
  // The only free strip is between the table's bottom border (y = 451.6)
  // and the page frame's bottom line (y = 437.7) — 13.9pt, enough for ONE
  // line. Two stacked lines used to touch the table above and run through
  // the frame below, so code and link now share a single line, centered in
  // that strip; a very long link shrinks instead of leaving the frame.
  const FOOT_SIZE = 6.5
  const FOOT_X = 34
  const FOOT_RIGHT = 560
  const stripMiddle = toLocal((451.6 + 437.7) / 2)
  if (escort) {
    const size = 9
    const value = fitOneLine(bold, escort, 470 - VALUE_X, size)
    page.drawText('PIC PENDAMPING', { x: 34.5, y: stripMiddle - 8.5 * 0.36, size: 8.5, font: bold, color: TEXT })
    page.drawText(':', { x: COLON_X, y: stripMiddle - size * 0.36, size: 10, font: bold, color: TEXT })
    page.drawText(value.text, { x: VALUE_X, y: stripMiddle - value.size * 0.36, size: value.size, font: bold, color: TEXT })
  }
  // Below the frame (its bottom line sits at 437.7) when the line above is taken.
  const footBaseline = escort ? (toLocal(437.7) - FOOT_SIZE) / 2 : stripMiddle - FOOT_SIZE * 0.36
  const codeLabel = `Kode Verifikasi: ${data.verificationCode}`
  page.drawText(codeLabel, { x: FOOT_X, y: footBaseline, size: FOOT_SIZE, font: bold, color: rgb(0.35, 0.35, 0.35) })
  const linkX = FOOT_X + bold.widthOfTextAtSize(codeLabel, FOOT_SIZE) + 12
  const link = fitOneLine(font, `Verifikasi keaslian: ${verifyUrl}`, FOOT_RIGHT - linkX, FOOT_SIZE, 4.5)
  page.drawText(link.text, { x: linkX, y: footBaseline, size: link.size, font, color: rgb(0.45, 0.45, 0.45) })

  return pdf.save()
}
