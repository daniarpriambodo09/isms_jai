// lib/procedure-esign-pdf.ts
//
// "PDF bertanda tangan" for a Prosedur ISMS document: the original uploaded
// PDF, untouched, followed by one appended "Lembar Pengesahan" page laid out
// like the CATATAN PENGESAHAN table on the paper documents —
// Unit Kerja (Jabatan) | NAMA | Tanda Tangan | TANGGAL — where each approver's
// signature cell holds their own QR code (pointing at /verifikasi-pengesahan).
//
// The original pages are never drawn over, except for a one-line footer in
// the bottom margin once the document is fully approved; stamping into the
// document's own signature table isn't attempted since every procedure has
// a different layout.

import 'server-only'
import path from 'path'
import { readFile } from 'fs/promises'
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import { STORAGE_ROOT } from '@/lib/storage'

export type SheetStep = {
  roleTitle: string
  name: string
  status: 'waiting' | 'pending' | 'approved' | 'rejected' | 'cancelled'
  decidedAt: string | null
  verificationCode: string | null
  note: string | null
}

export type SheetData = {
  controlNo: string
  title: string
  revision: number
  effDate: string
  filePath: string
  status: 'none' | 'pending' | 'approved' | 'rejected'
  steps: SheetStep[]
  verifyBase: string // .../verifikasi-pengesahan?code=
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
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTime(value: string) {
  return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
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

  // 2) Lembar Pengesahan.
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
  centered('Catatan Pengesahan Prosedur ISMS - PT. Jatim Autocomp Indonesia', MARGIN, W - 2 * MARGIN, y, 9, font, MUTED)
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
      : data.status === 'rejected' ? { label: 'DITOLAK - lihat catatan di bawah', color: RED }
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
      const label = step.status === 'rejected' ? 'DITOLAK' : step.status === 'pending' ? 'Menunggu' : 'Antri'
      centered(label, colX[2], cols[2].w, mid - 3, step.status === 'rejected' ? 10 : 9, step.status === 'rejected' ? bold : italic, step.status === 'rejected' ? RED : MUTED)
      if (step.status === 'rejected' && step.note) {
        wrap(font, `Alasan: ${step.note}`, cols[2].w - 10, 6.5).slice(0, 4).forEach((line, i) => centered(line, colX[2], cols[2].w, mid - 16 - i * 8, 6.5, font, RED))
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
  text(`Dibuat otomatis oleh Portal ISMS pada ${new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}`, MARGIN, MARGIN - 10, 7, italic, MUTED)
  const pageLabel = `Hal. ${originalPages + 1} / ${originalPages + 1}`
  text(pageLabel, W - MARGIN - font.widthOfTextAtSize(pageLabel, 7), MARGIN - 10, 7, font, MUTED)

  // 3) Once fully approved, a quiet line in the bottom margin of every original page.
  if (data.status === 'approved') {
    const stamp = `Disahkan secara elektronik via Portal ISMS - lihat Lembar Pengesahan (hal. ${originalPages + 1})`
    pdf.getPages().slice(0, originalPages).forEach((p) => {
      p.drawText(stamp, { x: 18, y: 8, size: 6.5, font: italic, color: GREEN })
    })
  }

  return pdf.save()
}
