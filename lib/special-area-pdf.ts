// lib/special-area-pdf.ts
//
// E-sign PDF for "Pengajuan Ijin Masuk Area Special Security": the data is
// written ON TOP OF the official blank form (templates/isms-f-006-001-
// special-area.pdf, ISMS-F-006-001) — Japanese labels, logo and borders stay
// the template's own. Coordinates were measured from the template's text and
// path layers (PDF user space, page 612x792). The page holds two identical
// copies; only the top one is used, cropped just above the dashed cut line,
// with a strip added underneath for the verification footnote.
//
// Like the Visitor photo/video form, the pre-printed approver name
// ("TEGUH SUNJOYO (Information Assets Administrator)") is covered and replaced
// with whoever actually decided, and the QR (the signature) is only drawn for
// an approval.

import 'server-only'
import path from 'path'
import { readFile } from 'fs/promises'
import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import type { SpecialAreaRequest } from '@/lib/special-area-shared'

const PAGE_W = 612
const FULL_H = 792
const CROP_BOTTOM = 401 // dashed cut line sits at ~399.5
const FOOT = 26 // footnote strip under the form
const INK = rgb(0.07, 0.07, 0.07)
const WHITE = rgb(1, 1, 1)
const CRIMSON = rgb(0.72, 0.13, 0.12)
const GREY = rgb(0.4, 0.4, 0.4)

// Right-hand column (between its border lines at ~466.9 and ~560.5)
const RC_X = 469
const RC_W = 89
const RC_CX = 513.7

const safe = (v: string) => v.replace(/[^\x20-\x7E -ÿ–—‘’“”…]/g, '?')

function parts(value: string) {
  const d = new Date(value)
  const tz = { timeZone: 'Asia/Jakarta' }
  const get = (o: Intl.DateTimeFormatOptions) => d.toLocaleString('en-GB', { ...tz, ...o })
  return {
    dd: get({ day: '2-digit' }),
    mm: get({ month: '2-digit' }),
    yy: get({ year: '2-digit' }),
    time: get({ hour: '2-digit', minute: '2-digit', hour12: false }),
    long: d.toLocaleDateString('id-ID', { ...tz, day: 'numeric', month: 'long', year: 'numeric' }),
  }
}

function fit(font: PDFFont, value: string, maxWidth: number, size: number, min = 6.5) {
  let s = size
  const text = safe(value)
  while (s > min && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.5
  if (font.widthOfTextAtSize(text, s) <= maxWidth) return { text, size: s }
  let t = text
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, s) > maxWidth) t = t.slice(0, -1)
  return { text: `${t}…`, size: s }
}

function wrap(font: PDFFont, value: string, maxWidth: number, size: number) {
  const lines: string[] = []
  let cur = ''
  for (const w of safe(value).split(/\s+/).filter(Boolean)) {
    const c = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(c, size) > maxWidth && cur) { lines.push(cur); cur = w } else cur = c
  }
  if (cur) lines.push(cur)
  return lines
}

export async function buildSpecialAreaPdf(req: SpecialAreaRequest, verifyUrl: string): Promise<Uint8Array> {
  const template = await PDFDocument.load(await readFile(path.join(process.cwd(), 'templates', 'isms-f-006-001-special-area.pdf')))
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const cropH = FULL_H - CROP_BOTTOM
  const embedded = await pdf.embedPage(template.getPages()[0], { left: 0, bottom: CROP_BOTTOM, right: PAGE_W, top: FULL_H })
  const page = pdf.addPage([PAGE_W, cropH + FOOT])
  page.drawPage(embedded, { x: 0, y: FOOT, width: PAGE_W, height: cropH })

  const Y = (abs: number) => abs - CROP_BOTTOM + FOOT
  const text = (v: string, x: number, yAbs: number, size = 9.5, f: PDFFont = bold, color = INK) =>
    page.drawText(safe(v), { x, y: Y(yAbs), size, font: f, color })
  const centered = (v: string, cx: number, yAbs: number, size = 9.5, f: PDFFont = bold, color = INK) =>
    text(v, cx - f.widthOfTextAtSize(safe(v), size) / 2, yAbs, size, f, color)
  const cover = (x: number, yBottomAbs: number, w: number, h: number) =>
    page.drawRectangle({ x, y: Y(yBottomAbs), width: w, height: h, color: WHITE })

  // ── Left table: value column starts right after the colon (x≈218–233) ──
  const VX = 240
  const VW = 460 - VX
  const submitted = parts(req.submitted_at)
  text(submitted.long, VX, 652, 9.5, font)                                          // TANGGAL PENGAJUAN
  const put = (value: string, yAbs: number) => { const f = fit(bold, value, VW, 9.5); text(f.text, VX, yAbs, f.size) }
  put(req.requester_name, 623.5)                                                    // NAMA
  put(req.org_company, 595)                                                         // ORGANISASI/PERUSAHAAN
  put(req.department || '-', 566.5)                                                 // DEPARTEMEN

  // TANGGAL KELUAR/MASUK — digits around the printed "/" and "/20" (size 11.8)
  const from = parts(req.from_at)
  const to = parts(req.to_at)
  const SEG = 11
  const rightAt = (v: string, x: number, yAbs: number) => text(v, x - bold.widthOfTextAtSize(v, SEG), yAbs, SEG)
  rightAt(from.dd, 270, 531); centered(from.mm, 287.5, 531, SEG); text(from.yy, 316, 531, SEG)
  rightAt(to.dd, 385, 531.5); centered(to.mm, 402.3, 531.5, SEG); text(to.yy, 430.8, 531.5, SEG)
  text(from.time, 284, 511.1, 9.5)                                                  // JAM dari
  text(to.time, 407, 511.1, 9.5)                                                    // JAM sampai

  put(req.area, 481)                                                                // AREA SPECIAL SECURITY
  put(req.purpose, 452.5)                                                           // TUJUAN

  // ── Right column ──
  if (req.id_card_no) { const f = fit(bold, req.id_card_no, RC_W - 6, 10); centered(f.text, RC_CX, 624, f.size) }  // ID Card No.

  const decided = req.decided_at ? parts(req.decided_at) : null
  if (decided) {                                                                    // TANGGAL (persetujuan)
    const S = 10.3
    text(decided.dd, 492.5 - bold.widthOfTextAtSize(decided.dd, S), 582.1, S)
    centered(decided.mm, 508.8, 582.1, S)
    text(decided.yy, 534, 582.1, S)
  }

  if (req.status === 'rejected') {
    cover(RC_X, 542.6, RC_W, 27.8)                                                  // "MENYETUJUI" no longer true
    centered('DITOLAK', RC_CX, 553, 11, bold, CRIMSON)
  }

  if (req.status === 'approved' && req.verification_code) {                         // QR = signature
    const qr = await pdf.embedPng(Buffer.from((await QRCode.toDataURL(verifyUrl, { margin: 1, width: 300 })).split(',')[1], 'base64'))
    const size = 50
    page.drawImage(qr, { x: RC_CX - size / 2, y: Y(513.3 - size / 2), width: size, height: size })
  }

  // Approver name + title replace the pre-printed "TEGUH SUNJOYO (Information Assets Administrator)"
  if (req.approver_name) {
    cover(RC_X, 471.4, RC_W, 12.8)
    const n = fit(bold, req.approver_name.toUpperCase(), RC_W - 4, 8.5)
    centered(n.text, RC_CX, 475.5, n.size)
    cover(RC_X, 443, RC_W, 27.2)
    if (req.approver_title) {
      const lines = wrap(font, `(${req.approver_title})`, RC_W - 4, 7.5).slice(0, 3)
      const top = 462 + ((lines.length - 1) * 4.5) - 4.5
      lines.forEach((line, i) => centered(line, RC_CX, top - i * 9, 7.5, font))
    }
  }

  // ── Footnote strip ──
  if (req.verification_code) {
    page.drawText(safe(`Kode Verifikasi: ${req.verification_code}  ·  Status: ${req.status === 'approved' ? 'DISETUJUI' : req.status === 'rejected' ? 'DITOLAK' : 'MENUNGGU'}`), { x: 46, y: 14, size: 7, font: bold, color: GREY })
    page.drawText(safe(`Verifikasi keaslian: ${verifyUrl}`), { x: 46, y: 5, size: 6.3, font, color: GREY })
  }

  return pdf.save()
}
