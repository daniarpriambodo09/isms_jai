// lib/procedure-esign-pdf.ts
//
// "PDF bertanda tangan" for a Prosedur ISMS document: the original uploaded
// PDF with each approver's QR (pointing at /verifikasi-pengesahan) stamped
// into the document's own Tanda Tangan cell(s) set in the "Atur Posisi QR"
// editor, and the approval date into the TANGGAL cell of the same row. No
// page is appended; once fully approved, a one-line footer goes in the
// bottom margin of every page.
//
// Only if the original file can't be read (e.g. encrypted) does it fall back
// to a generated "Lembar Pengesahan" page (Unit Kerja | NAMA | Tanda Tangan |
// TANGGAL), so the result is never empty.

import 'server-only'
import { APP_TIME_ZONE } from '@/lib/config'
import path from 'path'
import { readFile } from 'fs/promises'
import { PDFDocument, PDFFont, PDFPage, StandardFonts, degrees, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import { STORAGE_ROOT } from '@/lib/storage'

export type SheetStep = {
  roleCode: string
  roleTitle: string
  name: string
  status: 'waiting' | 'pending' | 'approved' | 'rejected' | 'cancelled'
  decidedAt: string | null
  verificationCode: string | null
  note: string | null
}

export type SheetData = {
  /** Register name printed on the fallback sheet ("Prosedur ISMS" when omitted). */
  kindLabel?: string
  controlNo: string
  title: string
  revision: number
  effDate: string
  filePath: string
  status: 'none' | 'pending' | 'approved' | 'rejected'
  steps: SheetStep[]
  verifyBase: string // .../verifikasi-pengesahan?code=
  // Per-role QR spots on the original pages (fractions of the displayed page,
  // top-left origin) — set in the "Atur Posisi QR" editor or auto-detected.
  slots?: { role_code: string; page: number; x: number; y: number; w: number; h: number; date?: { x: number; y: number; w: number; h: number } | null }[]
  /**
   * The form prints "/  /" for the date (Form Review): where its two slashes
   * sit, in points from the date box's left edge. The approval date is then
   * written around them as "07 / 10 / 26" instead of "07 Okt 2026".
   */
  dateSlashes?: [number, number] | null
}

// The approval date as the paper forms take it: day / month / two-digit year (WIB).
function dateParts(value: string) {
  const d = new Date(value)
  const part = (options: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-GB', { timeZone: APP_TIME_ZONE, ...options })
  return { dd: part({ day: '2-digit' }), mm: part({ month: '2-digit' }), yy: part({ year: '2-digit' }) }
}

// Writes the date on a form's own "/  /" line: the box is cleared (it lies
// inside the cell, no ruled line is touched), then day, month and year go
// before, between and after two slashes drawn at the form's positions — so it
// reads the same whether or not the stored file still shows the placeholders.
function drawSlashDate(page: PDFPage, box: { x: number; y: number; w: number; h: number }, slashes: [number, number], value: string, f: PDFFont) {
  const a = displayedToPdf(page, box.x, box.y)
  const b = displayedToPdf(page, box.x + box.w, box.y + box.h)
  const left = Math.min(a.x, b.x), bottom = Math.min(a.y, b.y)
  const width = Math.abs(b.x - a.x), height = Math.abs(b.y - a.y)
  page.drawRectangle({ x: left, y: bottom, width, height, color: rgb(1, 1, 1), borderWidth: 0 })
  const size = Math.min(9.5, height * 0.72)
  const baseline = bottom + (height - size * 0.72) / 2
  const slashW = f.widthOfTextAtSize('/', size)
  const gap = 2.2
  const { dd, mm, yy } = dateParts(value)
  const [s1, s2] = [left + slashes[0], left + slashes[1]]
  const put = (text: string, x: number) => page.drawText(text, { x, y: baseline, size, font: f, color: INK })
  put('/', s1)
  put('/', s2)
  put(dd, s1 - gap - f.widthOfTextAtSize(dd, size))
  put(mm, (s1 + slashW + s2) / 2 - f.widthOfTextAtSize(mm, size) / 2)
  put(yy, s2 + slashW + gap)
}

// Maps a point given as fractions of the page AS DISPLAYED (so /Rotate is
// already applied, like the pdf.js editor sees it) to PDF user space.
function displayedToPdf(page: PDFPage, u: number, v: number) {
  const cb = page.getCropBox()
  const rotation = ((page.getRotation().angle % 360) + 360) % 360
  switch (rotation) {
    case 90: return { x: cb.x + v * cb.width, y: cb.y + u * cb.height }
    case 180: return { x: cb.x + (1 - u) * cb.width, y: cb.y + v * cb.height }
    case 270: return { x: cb.x + (1 - v) * cb.width, y: cb.y + (1 - u) * cb.height }
    default: return { x: cb.x + u * cb.width, y: cb.y + (1 - v) * cb.height }
  }
}

// Draws one line of text centred in a box given in displayed-page fractions,
// sized to fit, and rotated with the page so it reads upright on screen.
function drawDisplayedText(page: PDFPage, box: { x: number; y: number; w: number; h: number }, value: string, f: PDFFont) {
  const label = safe(value)
  const cb = page.getCropBox()
  const rotation = ((page.getRotation().angle % 360) + 360) % 360
  const sideways = rotation === 90 || rotation === 270
  const dispW = sideways ? cb.height : cb.width
  const dispH = sideways ? cb.width : cb.height
  const boxW = box.w * dispW
  const boxH = box.h * dispH
  const size = Math.max(4, Math.min(9, boxH * 0.45, (boxW * 0.92) / Math.max(f.widthOfTextAtSize(label, 1), 1)))
  const textW = f.widthOfTextAtSize(label, size)
  // Baseline start, in displayed fractions: horizontally centred, the
  // cap height roughly centred on the box's middle.
  const u = box.x + (boxW - textW) / 2 / dispW
  const v = box.y + (boxH / 2 + size * 0.35) / dispH
  const at = displayedToPdf(page, u, v)
  page.drawText(label, { x: at.x, y: at.y, size, font: f, color: INK, rotate: degrees(rotation) })
}

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 40
const INK = rgb(0.1, 0.12, 0.14)
const MUTED = rgb(0.4, 0.44, 0.48)
const LINE = rgb(0.55, 0.58, 0.6)
const HEAD_BG = rgb(0.85, 0.92, 0.83) // the pale green header of the paper tables
const GREEN = rgb(0.1, 0.43, 0.23)
const RED = rgb(0.72, 0.13, 0.12)
const AMBER = rgb(0.62, 0.42, 0.02)

// Standard fonts only speak WinAnsi — anything else would throw mid-render.
function safe(value: string) {
  return value.replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, '?')
}

function wrap(font: PDFFont, value: string, maxWidth: number, size: number): string[] {
  const words = safe(value).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current)
      current = word
    } else current = candidate
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['-']
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { timeZone: APP_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTime(value: string) {
  return new Date(value).toLocaleTimeString('id-ID', { timeZone: APP_TIME_ZONE, hour: '2-digit', minute: '2-digit' })
}

export async function buildProcedureSignedPdf(data: SheetData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique)

  // 1) Original document pages, as uploaded.
  let originalPages = 0
  let mergeError = false
  try {
    const source = await PDFDocument.load(await readFile(path.join(STORAGE_ROOT, data.filePath)), { ignoreEncryption: true })
    const copied = await pdf.copyPages(source, source.getPageIndices())
    copied.forEach((page) => pdf.addPage(page))
    originalPages = copied.length
  } catch (error) {
    console.error('[procedure-esign-pdf] could not merge original PDF', error)
    mergeError = true
  }

  // 2) Lembar Pengesahan — only as a fallback when the original file could
  //    not be read (e.g. encrypted), so the PDF is never empty. Normally the
  //    signatures live on the document itself (step 3) and no page is added.
  if (mergeError) {
    const page: PDFPage = pdf.addPage(A4)
    const [W, H] = A4
    let y = H - MARGIN

    const text = (value: string, x: number, yPos: number, size = 9, f: PDFFont = font, color = INK) =>
      page.drawText(safe(value), { x, y: yPos, size, font: f, color })
    const centered = (value: string, x: number, width: number, yPos: number, size = 9, f: PDFFont = font, color = INK) =>
      text(value, x + (width - f.widthOfTextAtSize(safe(value), size)) / 2, yPos, size, f, color)
    const box = (x: number, yTop: number, w: number, h: number, fill?: ReturnType<typeof rgb>) =>
      page.drawRectangle({ x, y: yTop - h, width: w, height: h, borderColor: LINE, borderWidth: 0.7, color: fill })

    // Header: logo, CONFIDENTIAL, title
    try {
      const logo = await pdf.embedJpg(await readFile(path.join(process.cwd(), 'public', 'images', 'yazaki-logo.jpg')))
      const logoH = 28
      page.drawImage(logo, { x: MARGIN, y: y - logoH, width: (logo.width / logo.height) * logoH, height: logoH })
    } catch { /* logo is decoration only */ }
    page.drawRectangle({ x: W - MARGIN - 96, y: y - 24, width: 96, height: 22, borderColor: RED, borderWidth: 1.2 })
    centered('CONFIDENTIAL', W - MARGIN - 96, 96, y - 17, 9.5, bold, RED)
    y -= 52
    centered('LEMBAR PENGESAHAN ELEKTRONIK', MARGIN, W - 2 * MARGIN, y, 14, bold)
    y -= 15
    centered(`Catatan Pengesahan ${data.kindLabel ?? 'Prosedur ISMS'} - PT. Jatim Autocomp Indonesia`, MARGIN, W - 2 * MARGIN, y, 9, font, MUTED)
    y -= 22

    // Document info
    const labelW = 110
    const infoW = W - 2 * MARGIN
    const infoRows: [string, string][] = [
      ['No. Kontrol', data.controlNo],
      ['Nama Dokumen', data.title],
      ['Revisi', String(data.revision)],
      ['Eff Date', fmtDate(data.effDate)],
    ]
    for (const [label, value] of infoRows) {
      const lines = wrap(bold, value, infoW - labelW - 16, 9.5)
      const rowH = 10 + lines.length * 12
      box(MARGIN, y, labelW, rowH, rgb(0.96, 0.97, 0.97))
      box(MARGIN + labelW, y, infoW - labelW, rowH)
      text(label, MARGIN + 8, y - 15, 9, font, MUTED)
      lines.forEach((line, i) => text(line, MARGIN + labelW + 8, y - 15 - i * 12, 9.5, bold))
      y -= rowH
    }
    y -= 14

    // Overall status ribbon
    const approvedCount = data.steps.filter((s) => s.status === 'approved').length
    const ribbon =
      data.status === 'approved' ? { label: 'DISAHKAN - seluruh approver telah menyetujui', color: GREEN }
        : data.status === 'rejected' ? { label: 'PERLU REVISI - lihat catatan di bawah', color: RED }
          : data.status === 'pending' ? { label: `MENUNGGU PENGESAHAN - ${approvedCount} dari ${data.steps.length} approver`, color: AMBER }
            : { label: 'DOKUMEN INI TIDAK MEMERLUKAN PENGESAHAN', color: MUTED }
    page.drawRectangle({ x: MARGIN, y: y - 22, width: infoW, height: 22, color: ribbon.color })
    centered(ribbon.label, MARGIN, infoW, y - 15, 9.5, bold, rgb(1, 1, 1))
    y -= 36

    // CATATAN PENGESAHAN table
    text('CATATAN PENGESAHAN :', MARGIN, y, 10, bold)
    y -= 10
    const cols = [
      { title: 'Unit Kerja (Jabatan)', w: 165 },
      { title: 'N A M A', w: 125 },
      { title: 'Tanda Tangan', w: 120 },
      { title: 'T A N G G A L', w: infoW - 165 - 125 - 120 },
    ]
    const colX = cols.reduce<number[]>((acc, col, i) => [...acc, i === 0 ? MARGIN : acc[i - 1] + cols[i - 1].w], [])
    const headH = 22
    cols.forEach((col, i) => {
      box(colX[i], y, col.w, headH, HEAD_BG)
      centered(col.title, colX[i], col.w, y - 14.5, 9, bold)
    })
    y -= headH

    const ROW_H = 104
    const QR = 70
    for (const step of data.steps) {
      cols.forEach((col, i) => box(colX[i], y, col.w, ROW_H))
      const mid = y - ROW_H / 2

      const roleLines = wrap(font, step.roleTitle, cols[0].w - 14, 9)
      roleLines.forEach((line, i) => text(line, colX[0] + 7, mid + 4 - (i - (roleLines.length - 1) / 2) * 11, 9))

      const nameLines = wrap(bold, step.name, cols[1].w - 12, 9.5)
      nameLines.forEach((line, i) => centered(line, colX[1], cols[1].w, mid - 3 - (i - (nameLines.length - 1) / 2) * 12, 9.5, bold))

      if (step.status === 'approved' && step.verificationCode) {
        const dataUrl = await QRCode.toDataURL(`${data.verifyBase}${step.verificationCode}`, { margin: 1, width: 320, errorCorrectionLevel: 'M' })
        const img = await pdf.embedPng(Buffer.from(dataUrl.split(',')[1], 'base64'))
        page.drawImage(img, { x: colX[2] + (cols[2].w - QR) / 2, y: y - 8 - QR, width: QR, height: QR })
        centered(step.verificationCode, colX[2], cols[2].w, y - 8 - QR - 10, 6.5, font, MUTED)
        centered('Disetujui secara elektronik', colX[2], cols[2].w, y - 8 - QR - 19, 6, italic, GREEN)
      } else {
        const label = step.status === 'rejected' ? 'MINTA REVISI' : step.status === 'pending' ? 'Menunggu' : 'Antri'
        centered(label, colX[2], cols[2].w, mid - 3, step.status === 'rejected' ? 10 : 9, step.status === 'rejected' ? bold : italic, step.status === 'rejected' ? RED : MUTED)
        if (step.status === 'rejected' && step.note) {
          wrap(font, `Catatan: ${step.note}`, cols[2].w - 10, 6.5).slice(0, 4).forEach((line, i) => centered(line, colX[2], cols[2].w, mid - 16 - i * 8, 6.5, font, RED))
        }
      }

      if (step.decidedAt) {
        centered(fmtDate(step.decidedAt), colX[3], cols[3].w, mid + 2, 9.5, bold)
        centered(fmtTime(step.decidedAt), colX[3], cols[3].w, mid - 11, 8, font, MUTED)
      } else {
        centered('-', colX[3], cols[3].w, mid - 3, 9.5, font, MUTED)
      }
      y -= ROW_H
    }
    if (data.steps.length === 0) {
      cols.forEach((col, i) => box(colX[i], y, col.w, 30))
      cols.forEach((col, i) => centered('-', colX[i], col.w, y - 19, 9, font, MUTED))
      y -= 30
    }

    // Notes
    y -= 18
    const notes = [
      'Tanda tangan pada lembar ini berupa QR code elektronik yang diterbitkan Portal ISMS saat approver menekan "Setujui" dari link pengesahan pribadinya.',
      'Pindai QR untuk memverifikasi keaslian: nama penyetuju, jabatan, dokumen, revisi, dan tanggal persetujuan.',
      mergeError ? 'Catatan: file dokumen asli tidak dapat digabungkan ke PDF ini (mungkin terenkripsi) - lihat file aslinya di Portal ISMS.' : `Lembar ini melekat pada ${originalPages} halaman dokumen asli sebelumnya.`,
    ]
    for (const note of notes) {
      const lines = wrap(font, note, infoW - 12, 8)
      text('-', MARGIN, y, 8, font, MUTED)
      lines.forEach((line, i) => text(line, MARGIN + 10, y - i * 10.5, 8, font, MUTED))
      y -= lines.length * 10.5 + 4
    }
    text(`Dibuat otomatis oleh Portal ISMS pada ${new Date().toLocaleString('id-ID', { timeZone: APP_TIME_ZONE, dateStyle: 'long', timeStyle: 'short' })}`, MARGIN, MARGIN - 10, 7, italic, MUTED)
    const pageLabel = `Hal. ${originalPages + 1} / ${originalPages + 1}`
    text(pageLabel, W - MARGIN - font.widthOfTextAtSize(pageLabel, 7), MARGIN - 10, 7, font, MUTED)
  }

  // 3) Each approver's QR stamped straight into their own signature column on
  //    the original document, where a spot has been set for their role.
  for (const step of data.steps) {
    if (step.status !== 'approved' || !step.verificationCode) continue
    // Every placement of this role (an approver may sign in several spots).
    const placements = (data.slots ?? []).filter((s) => s.role_code === step.roleCode && s.page < originalPages)
    if (placements.length === 0) continue
    const dataUrl = await QRCode.toDataURL(`${data.verifyBase}${step.verificationCode}`, { margin: 1, width: 320, errorCorrectionLevel: 'M' })
    const img = await pdf.embedPng(Buffer.from(dataUrl.split(',')[1], 'base64'))
    for (const slot of placements) {
      const target = pdf.getPage(slot.page)
      const a = displayedToPdf(target, slot.x, slot.y)
      const b = displayedToPdf(target, slot.x + slot.w, slot.y + slot.h)
      const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x)
      const bottom = Math.min(a.y, b.y), top = Math.max(a.y, b.y)
      const upright = (((target.getRotation().angle % 360) + 360) % 360) === 0
      // Leave room for the code line under the QR when the box is tall enough.
      const labelH = upright && top - bottom > 46 ? 7 : 0
      const size = Math.max(12, Math.min(right - left, top - bottom - labelH) * 0.94)
      const qrX = left + (right - left - size) / 2
      const qrY = bottom + labelH + (top - bottom - labelH - size) / 2
      target.drawImage(img, { x: qrX, y: qrY, width: size, height: size })
      if (labelH) {
        const label = step.verificationCode
        const fs = Math.min(5.5, (right - left) / (label.length * 0.55))
        target.drawText(label, { x: left + (right - left - font.widthOfTextAtSize(label, fs)) / 2, y: bottom + 1.5, size: fs, font, color: MUTED })
      }
      // Approval date in the same row's TANGGAL cell, when a box is set for it.
      if (slot.date && step.decidedAt) {
        if (data.dateSlashes && upright) drawSlashDate(target, slot.date, data.dateSlashes, step.decidedAt, font)
        else drawDisplayedText(target, slot.date, fmtDate(step.decidedAt), font)
      }
    }
  }
  // 4) Once fully approved, a quiet line in the bottom margin of every original page.
  if (data.status === 'approved') {
    const stamp = 'Disahkan secara elektronik via Portal ISMS - pindai QR tanda tangan untuk verifikasi'
    pdf.getPages().slice(0, originalPages).forEach((p) => {
      p.drawText(stamp, { x: 18, y: 8, size: 6.5, font: italic, color: GREEN })
    })
  }

  return pdf.save()
}
