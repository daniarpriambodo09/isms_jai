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
//    whoever is actually recorded as having decided the request.
// 2. "MENYETUJUI, 撮影・録音許可" ("approving, permission to record") only
//    reads correctly when the request was actually approved — printing it
//    unconditionally on a REJECTED certificate makes a rejection look like
//    an approval, which is worse than a table line being 2pt off. So it's
//    covered and replaced with an explicit DISETUJUI/DITOLAK line. (An
//    earlier pass tried this and covered part of the left table's own
//    column by mistake — that was a wrong x-coordinate for the right
//    column's border, since fixed; this isn't the same bug recurring.)
//
// Every Kanji line the above two don't touch, every border, and the logo
// is the template's own embedded page content, untouched.

import 'server-only'
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
  cameraSerialNo: string | null
}

const TEXT = rgb(0.07, 0.07, 0.07)
const WHITE = rgb(1, 1, 1)
const GREEN = rgb(0.1, 0.42, 0.22)
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

function toLocal(y: number) {
  return y - HALF_H
}

function fmtFreeDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtTime(value: string) {
  return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
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

  const cropHeight = FULL_H - CROP_BOTTOM
  const embeddedTemplate = await pdf.embedPage(templatePage, { left: 0, bottom: CROP_BOTTOM, right: PAGE_W, top: FULL_H })
  const page: PDFPage = pdf.addPage([PAGE_W, cropHeight])
  page.drawPage(embeddedTemplate, { x: 0, y: 0, width: PAGE_W, height: cropHeight })

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
  // The column's actual border lines are at x≈462 (left) and x≈561
  // (right) — measured with a 1pt grid rendered directly over the
  // template, not eyeballed off a coarse one. (An earlier pass had this
  // at x=430, ~30pt too far left, which is why every white cover
  // rectangle kept visibly bleeding into the left table's own cells no
  // matter how it was resized — the fix was never the rectangle's size,
  // it was this constant.) Kept a couple points inside those lines so a
  // cover rectangle never touches, let alone erases, the border itself.
  const RIGHT_COL_X = 465
  const RIGHT_COL_W = 92

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

  // "MENYETUJUI, 撮影・録音許可" reads correctly only for an approval — cover
  // it and print the actual outcome instead (see file header).
  coverWhite(RIGHT_COL_X, 595, RIGHT_COL_W, 35)
  const isApproved = data.status === 'approved'
  const statusLabel = isApproved ? 'DISETUJUI' : 'DITOLAK'
  const statusColor = isApproved ? GREEN : CRIMSON
  const statusWidth = bold.widthOfTextAtSize(statusLabel, 11)
  text(statusLabel, RIGHT_COL_X + (RIGHT_COL_W - statusWidth) / 2, 578, { f: bold, size: 11, color: statusColor })

  // QR (the "signature") only makes sense for an approval — a rejection
  // never had anything to sign, so its e-sign area stays blank rather than
  // printing a barcode that would visually suggest something was approved.
  if (isApproved) {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 300 })
    const qrImage = await pdf.embedPng(Buffer.from(qrDataUrl.split(',')[1], 'base64'))
    const qrSize = 44
    const qrX = RIGHT_COL_X + (RIGHT_COL_W - qrSize) / 2
    const qrYAbs = 553 // top edge, measured down from here
    page.drawImage(qrImage, { x: qrX, y: toLocal(qrYAbs) - qrSize, width: qrSize, height: qrSize })
  }

  // "TEGUH SUNJOYO" and "(Information Assets Administrator)" are static
  // ink naming the approver at the time this template was printed — cover
  // and replace with whoever actually decided this request (see file
  // header comment). One cover for the whole name+title zone (instead of
  // two fixed-height ones) since a long name now wraps onto a second
  // line rather than overflowing past the column's own border — how many
  // lines it takes shifts where the title starts, so the covered area and
  // the title's position both need to flex with it.
  coverWhite(RIGHT_COL_X, 505, RIGHT_COL_W, 52)

  const centeredAt = (value: string, size: number, yAbs: number, f = font) => {
    const w = f.widthOfTextAtSize(value, size)
    text(value, RIGHT_COL_X + Math.max(2, (RIGHT_COL_W - w) / 2), yAbs, { f, size })
  }

  const NAME_SIZE = 8.5
  const nameLines = wrapToWidth(bold, data.approverFullName, RIGHT_COL_W - 6, NAME_SIZE).slice(0, 2)
  nameLines.forEach((line, i) => centeredAt(line, NAME_SIZE, 500 - i * 9, bold))

  if (data.approverTitle) {
    // Matches the template's own convention — "(Information Assets
    // Administrator)" was printed in parentheses under TEGUH SUNJOYO.
    const titleTop = 500 - nameLines.length * 9 - 6
    const titleLines = wrapToWidth(font, `(${data.approverTitle})`, RIGHT_COL_W - 6, 7.5).slice(0, 2)
    titleLines.forEach((line, i) => centeredAt(line, 7.5, titleTop - i * 9.5))
  }

  // ---------- Verification footnote, printed in the margin below the form ----------
  // Sits just under the table's own bottom border, in the blank margin
  // left after cropping out the dashed cut-line and the template's
  // second (identical, unused) copy.
  const footY = toLocal(450.7) - 4
  page.drawText(`Kode Verifikasi: ${data.verificationCode}`, {
    x: 30, y: footY, size: 7, font: bold, color: rgb(0.35, 0.35, 0.35),
  })
  page.drawText(`Verifikasi keaslian: ${verifyUrl}`, {
    x: 30, y: footY - 9, size: 6.5, font, color: rgb(0.45, 0.45, 0.45),
  })

  return pdf.save()
}
