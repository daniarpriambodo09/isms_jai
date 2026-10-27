// lib/it-equipment-pdf.ts
import 'server-only'
import { readFile } from 'fs/promises'
import path from 'path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import type { ItEquipmentRequest } from '@/lib/it-equipment-shared'

const PAGE_W = 595.28 // A4 width (points)
const PAGE_H = 841.89 // A4 height (points)
const MARGIN_X = 40

const COLOR_INK = rgb(0.1, 0.1, 0.1)
const COLOR_MUTED = rgb(0.35, 0.35, 0.35)
const COLOR_RED = rgb(0.85, 0.1, 0.1)
const COLOR_BLUE = rgb(0.08, 0.35, 0.75)
const COLOR_LINE = rgb(0.2, 0.2, 0.2)
const COLOR_LIGHT_BG = rgb(0.96, 0.97, 0.99)
const COLOR_WHITE = rgb(1, 1, 1)

function formatDateId(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function safeText(val?: string | null): string {
  if (!val) return ''
  return val.replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
}

export async function buildItEquipmentPdf(
  req: ItEquipmentRequest,
  verifyUrl: string
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const page = pdf.addPage([PAGE_W, PAGE_H])
  const W = PAGE_W - 2 * MARGIN_X
  const leftX = MARGIN_X

  // Helper drawing functions
  const text = (
    val: string,
    x: number,
    y: number,
    size = 9,
    font = fontRegular,
    color = COLOR_INK
  ) => {
    page.drawText(safeText(val), { x, y, size, font, color })
  }

  const line = (x1: number, y1: number, x2: number, y2: number, thickness = 0.8, color = COLOR_LINE) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness,
      color,
    })
  }

  const rect = (x: number, y: number, w: number, h: number, strokeColor = COLOR_LINE, fillColor?: any, borderWidth = 0.8) => {
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      borderColor: strokeColor,
      color: fillColor,
      borderWidth,
    })
  }

  let curY = PAGE_H - 45

  // 1. Header: Official Yazaki Logo Image
  try {
    const logoBytes = await readFile(path.join(process.cwd(), 'public', 'images', 'yazaki-logo.jpg'))
    const logoImg = await pdf.embedJpg(logoBytes)
    const logoH = 28
    const logoW = (logoImg.width / logoImg.height) * logoH
    page.drawImage(logoImg, { x: leftX, y: curY - 11, width: logoW, height: logoH })
  } catch (err) {
    text('YAZAKI', leftX, curY + 4, 15, fontBold, COLOR_RED)
    text('PT. JATIM AUTOCOMP INDONESIA', leftX, curY - 7, 7.5, fontBold, COLOR_MUTED)
  }

  // Confidential badge
  const confW = 86
  const confH = 22
  rect(leftX + W - confW, curY - 5, confW, confH, COLOR_RED, undefined, 1.5)
  page.drawText('CONFIDENTIAL', {
    x: leftX + W - confW + 8,
    y: curY + 1,
    size: 9.5,
    font: fontBold,
    color: COLOR_RED,
  })

  curY -= 32

  // Title
  const isFormIn = req.form_type === 'in'
  const title = isFormIn
    ? 'Pengajuan ijin membawa masuk PC, USB memory, Kamera, dll.'
    : 'Pengajuan ijin membawa keluar PC, USB memory, Camera, dll.'
  text(title, leftX, curY, 13, fontBold, COLOR_INK)

  curY -= 16

  // Section: [Membawa Masuk] / [Membawa Keluar] & Control Number
  const controlNo = isFormIn ? 'ISMS-F-03-00-001' : 'ISMS-F-03-00-002'
  const subSection = isFormIn ? '[Membawa masuk]' : '[Membawa keluar]'
  text(subSection, leftX, curY, 10, fontBold, COLOR_INK)
  const ctrlText = `Kontrol No. : ${controlNo}`
  text(ctrlText, leftX + W - fontBold.widthOfTextAtSize(ctrlText, 9), curY, 9, fontBold, COLOR_INK)

  curY -= 12
  text('Mohon untuk diisi kolom bergaris tebal di bawah ini.', leftX, curY, 8, fontRegular, COLOR_MUTED)

  curY -= 8

  // Main Info Table with Approval Box on Right
  const tableTopY = curY
  const appBoxW = 105
  const leftTableW = W - appBoxW
  const rowH = 17.5
  const numRows = 7
  const leftTableH = rowH * numRows

  // Left Table Outer & Inner Borders
  rect(leftX, tableTopY - leftTableH, leftTableW, leftTableH, COLOR_LINE, COLOR_WHITE, 1.2)

  const colLabelW = 120
  // Vertical column divider
  line(leftX + colLabelW, tableTopY, leftX + colLabelW, tableTopY - leftTableH, 1)

  const rowsData = [
    { label: 'TANGGAL PENGAJUAN', value: formatDateId(req.request_date) },
    {
      label: isFormIn ? 'N A M A (PEMOHON)' : 'N A M A (KARYAWAN)',
      value: `${req.applicant_name}${req.applicant_nik ? ` (${req.applicant_nik})` : ''}`,
    },
    {
      label: isFormIn ? 'PERUSAHAAN / AFFILIATE' : 'PERUSAHAAN / NIK',
      value: isFormIn
        ? req.company_name
        : req.applicant_nik
        ? `PT. JAI (NIK: ${req.applicant_nik})`
        : req.company_name || 'PT. Jatim Autocomp Indonesia',
    },
    {
      label: isFormIn ? 'DEPARTEMEN / SEKSI DIKUNJUNGI' : 'DEPARTEMEN / SEKSI KARYAWAN',
      value: `${req.department}${req.section ? ` / ${req.section}` : ''}`,
    },
    { label: isFormIn ? 'LOKASI KANTOR / AREA' : 'LOKASI / TEMPAT TUJUAN', value: req.location },
    { label: isFormIn ? 'TUJUAN MEMBAWA MASUK' : 'TUJUAN MEMBAWA KELUAR', value: req.purpose },
    {
      label: isFormIn ? 'TGL MASUK - RENCANA KELUAR' : 'TGL KELUAR - RENCANA KEMBALI',
      value: `${formatDateId(req.date_in)} s/d ${formatDateId(req.date_out_plan)}`,
    },
  ]

  for (let i = 0; i < numRows; i++) {
    const rowY = tableTopY - (i + 1) * rowH
    if (i < numRows - 1) {
      line(leftX, rowY, leftX + leftTableW, rowY, 0.7)
    }
    const r = rowsData[i]
    text(r.label, leftX + 8, rowY + 5.5, 7.5, fontBold, COLOR_INK)

    // Fit value text
    let valStr = r.value || '-'
    if (fontRegular.widthOfTextAtSize(valStr, 8.5) > leftTableW - colLabelW - 14) {
      while (valStr.length > 5 && fontRegular.widthOfTextAtSize(valStr + '...', 8.5) > leftTableW - colLabelW - 14) {
        valStr = valStr.slice(0, -1)
      }
      valStr += '...'
    }
    text(valStr, leftX + colLabelW + 8, rowY + 5.5, 8.5, fontRegular, COLOR_INK)
  }

  // Right Approval Box
  const appBoxX = leftX + leftTableW
  rect(appBoxX, tableTopY - leftTableH, appBoxW, leftTableH, COLOR_LINE, COLOR_WHITE, 1.2)
  rect(appBoxX, tableTopY - 20, appBoxW, 20, COLOR_LINE, COLOR_LIGHT_BG, 1)
  const appTitle = isFormIn ? 'Disetujui (diterima oleh)' : 'Disetujui oleh Mgr'
  const appTitleW = fontBold.widthOfTextAtSize(appTitle, 8)
  text(appTitle, appBoxX + (appBoxW - appTitleW) / 2, tableTopY - 14, 8, fontBold, COLOR_INK)

  // If approved, draw QR code and E-Sign Stamp
  if (req.status === 'approved' || req.status === 'returned') {
    try {
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        margin: 1,
        width: 140,
        errorCorrectionLevel: 'M',
      })
      const qrBase64 = qrDataUrl.split(',')[1]
      const qrImage = await pdf.embedPng(Buffer.from(qrBase64, 'base64'))

      const qrSize = 52
      const qrX = appBoxX + (appBoxW - qrSize) / 2
      const qrY = tableTopY - 20 - qrSize - 4
      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      })

      const signer = req.approved_by || 'IT Administrator'
      const signerW = fontBold.widthOfTextAtSize(signer, 7.5)
      text(signer, appBoxX + (appBoxW - signerW) / 2, tableTopY - 84, 7.5, fontBold, COLOR_BLUE)

      const stampDate = formatDateId(req.approved_at)
      const dateW = fontRegular.widthOfTextAtSize(stampDate, 7)
      text(stampDate, appBoxX + (appBoxW - dateW) / 2, tableTopY - 95, 7, fontRegular, COLOR_MUTED)

      const codeStr = `[ACC: ${req.approval_code || 'VERIFIED'}]`
      const codeW = fontBold.widthOfTextAtSize(codeStr, 6.5)
      text(codeStr, appBoxX + (appBoxW - codeW) / 2, tableTopY - 106, 6.5, fontBold, COLOR_RED)
    } catch (e) {
      text('(E-Sign Validated)', appBoxX + 12, tableTopY - 55, 8, fontBold, COLOR_BLUE)
    }
  } else if (req.status === 'rejected') {
    text('DITOLAK (REJECTED)', appBoxX + 8, tableTopY - 55, 7.5, fontBold, COLOR_RED)
    text(req.rejected_by || 'IT Administrator', appBoxX + 8, tableTopY - 70, 7, fontRegular, COLOR_MUTED)
  } else {
    text('(Menunggu Persetujuan)', appBoxX + 8, tableTopY - 55, 7, fontRegular, COLOR_MUTED)
    text('Mgr / IAA / IT Check', appBoxX + 12, tableTopY - 70, 7, fontRegular, COLOR_MUTED)
  }

  curY = tableTopY - leftTableH - 18

  // 2. Equipment Section: [Alat yang dibawa masuk] / [Alat yang dibawa keluar]
  const equipHeading = isFormIn ? 'Alat yang dibawa masuk' : 'Alat yang dibawa keluar'
  text(equipHeading, leftX, curY, 9.5, fontBold, COLOR_INK)
  curY -= 8

  // Equipment Table Layout (matches the official form columns)
  const itemsTableTop = curY
  const items = Array.isArray(req.items) && req.items.length > 0 ? req.items : []
  const maxTableItems = Math.max(3, items.length)

  // Column widths: Type (110), ID (85), Brand (105), Model (105), Serial (rest)
  const colW1 = 110
  const colW2 = 80
  const colW3 = 105
  const colW4 = 105
  const colW5 = W - (colW1 + colW2 + colW3 + colW4)

  const headerH = 22
  rect(leftX, itemsTableTop - headerH, W, headerH, COLOR_LINE, COLOR_LIGHT_BG, 1)

  // Draw Header column text
  text('Tipe alat (PC, USB, dll.)', leftX + 6, itemsTableTop - 14, 7.5, fontBold)
  text('No. Identifikasi', leftX + colW1 + 6, itemsTableTop - 14, 7.5, fontBold)
  text('Produsen / Merk', leftX + colW1 + colW2 + 6, itemsTableTop - 14, 7.5, fontBold)
  text('Model', leftX + colW1 + colW2 + colW3 + 6, itemsTableTop - 14, 7.5, fontBold)
  text('Serial Number', leftX + colW1 + colW2 + colW3 + colW4 + 6, itemsTableTop - 14, 7.5, fontBold)

  // Vertical header dividers
  let accumX = leftX + colW1
  line(accumX, itemsTableTop, accumX, itemsTableTop - headerH, 0.8)
  accumX += colW2
  line(accumX, itemsTableTop, accumX, itemsTableTop - headerH, 0.8)
  accumX += colW3
  line(accumX, itemsTableTop, accumX, itemsTableTop - headerH, 0.8)
  accumX += colW4
  line(accumX, itemsTableTop, accumX, itemsTableTop - headerH, 0.8)

  let tableRowY = itemsTableTop - headerH
  const itemRowH = 21

  for (let idx = 0; idx < maxTableItems; idx++) {
    const item = items[idx]
    rect(leftX, tableRowY - itemRowH, W, itemRowH, COLOR_LINE, idx % 2 === 1 ? COLOR_LIGHT_BG : COLOR_WHITE, 0.8)

    accumX = leftX + colW1
    line(accumX, tableRowY, accumX, tableRowY - itemRowH, 0.6)
    accumX += colW2
    line(accumX, tableRowY, accumX, tableRowY - itemRowH, 0.6)
    accumX += colW3
    line(accumX, tableRowY, accumX, tableRowY - itemRowH, 0.6)
    accumX += colW4
    line(accumX, tableRowY, accumX, tableRowY - itemRowH, 0.6)

    if (item) {
      text(item.equipment_type || '-', leftX + 6, tableRowY - 14, 8, fontBold)
      text(item.id_no || '-', leftX + colW1 + 6, tableRowY - 14, 7.5, fontRegular)
      text(item.brand || '-', leftX + colW1 + colW2 + 6, tableRowY - 14, 8, fontRegular)
      text(item.model || '-', leftX + colW1 + colW2 + colW3 + 6, tableRowY - 14, 8, fontRegular)
      text(item.serial_no || '-', leftX + colW1 + colW2 + colW3 + colW4 + 6, tableRowY - 14, 8, fontRegular)
    } else {
      text('-', leftX + 6, tableRowY - 14, 8, fontRegular, COLOR_MUTED)
    }

    tableRowY -= itemRowH
  }

  curY = tableRowY - 14

  // 3. Notice / Rules Box (from official ISMS form)
  if (isFormIn) {
    text('[Perhatian kepada Visitor / Affiliate Yazaki yang membawa PC dan semacamnya]', leftX, curY, 8.5, fontBold, COLOR_RED)
    curY -= 11
    text('(1) Mintakan persetujuan dari pihak terkait bila akan memasukkan/mentransfer data ke PC.', leftX, curY, 7.5, fontRegular)
    curY -= 10
    text('(2) Bila akan menyambungkan PC ke network, mohon diisi form pengajuan penyambungan network.', leftX, curY, 7.5, fontRegular)
    curY -= 10
    text('*Visitor selain dari Yazaki group tidak diijinkan penyambungan PC ke network.', leftX, curY, 7.5, fontBold, COLOR_MUTED)
  } else {
    text('[Perhatian kepada Karyawan PT. JAI yang membawa keluar alat IT inventaris perusahaan]', leftX, curY, 8.5, fontBold, COLOR_RED)
    curY -= 11
    text('(1) Dilarang mentransfer, menyalin, atau memberikan data rahasia perusahaan kepada pihak luar.', leftX, curY, 7.5, fontRegular)
    curY -= 10
    text('(2) Gunakan koneksi aman/VPN dan hindari menyambungkan perangkat ke Wi-Fi publik tanpa proteksi.', leftX, curY, 7.5, fontRegular)
    curY -= 10
    text('*Karyawan bertanggung jawab penuh atas keamanan fisik perangkat selama berada di luar PT. JAI.', leftX, curY, 7.5, fontBold, COLOR_MUTED)
  }

  curY -= 14

  // Dashed Cut Line / Divider
  for (let dx = leftX; dx < leftX + W; dx += 8) {
    line(dx, curY, dx + 4, curY, 1, COLOR_MUTED)
  }

  curY -= 14

  // 4. Return Section: [Kembali]
  text('[Kembali]', leftX, curY, 9.5, fontBold, COLOR_INK)
  curY -= 10
  text(
    isFormIn
      ? 'Mohon untuk diisi kolom di bawah ini saat pengembalian / selesai kunjungan di PT. JAI.'
      : 'Mohon untuk diisi kolom di bawah ini saat perangkat dikembalikan / masuk kembali ke area PT. JAI.',
    leftX,
    curY,
    7.5,
    fontRegular,
    COLOR_MUTED
  )

  curY -= 8

  // Return Table and Security Check box
  const returnTableTop = curY
  const retRightBoxW = 120
  const retLeftBoxW = W - retRightBoxW
  const retH = 68

  rect(leftX, returnTableTop - retH, retLeftBoxW, retH, COLOR_LINE, COLOR_WHITE, 1)

  // Tanggal kembali header row
  rect(leftX, returnTableTop - 20, retLeftBoxW, 20, COLOR_LINE, COLOR_LIGHT_BG, 0.8)
  text('Tanggal kembali (tgl/bln/tahun) :', leftX + 8, returnTableTop - 14, 8, fontBold)
  text(req.returned_at ? formatDateId(req.returned_at) : '/       /', leftX + 160, returnTableTop - 14, 8.5, fontBold)

  // Checkboxes
  const cb1Checked = req.return_check_items ? '[X]' : '[  ]'
  const cb2Checked = req.return_check_confidential ? '[X]' : '[  ]'

  text('Pengecheckan sebelum kembali:', leftX + 8, returnTableTop - 34, 7.5, fontBold)
  text(`${cb1Checked}  PC, flashdisk, camera, dll. sama dengan yang diajukan.`, leftX + 140, returnTableTop - 34, 7.5, fontRegular)
  text(
    isFormIn
      ? `${cb2Checked}  Tidak membawa pulang informasi rahasia tidak terkait.`
      : `${cb2Checked}  Kondisi fisik perangkat utuh & tidak ada kebocoran data rahasia.`,
    leftX + 140,
    returnTableTop - 49,
    7.5,
    fontRegular
  )

  if (req.returned_notes) {
    text(`Catatan: ${req.returned_notes}`, leftX + 140, returnTableTop - 61, 7, fontRegular, COLOR_MUTED)
  }

  // System security administrator Check Box
  const retRightX = leftX + retLeftBoxW
  rect(retRightX, returnTableTop - retH, retRightBoxW, retH, COLOR_LINE, COLOR_WHITE, 1)
  rect(retRightX, returnTableTop - 18, retRightBoxW, 18, COLOR_LINE, COLOR_LIGHT_BG, 0.8)
  const secTitle = 'System Security Check'
  const secTitleW = fontBold.widthOfTextAtSize(secTitle, 7.5)
  text(secTitle, retRightX + (retRightBoxW - secTitleW) / 2, returnTableTop - 13, 7.5, fontBold)

  if (req.status === 'returned') {
    text('SUDAH DICHECK', retRightX + 22, returnTableTop - 34, 7.5, fontBold, COLOR_BLUE)
    text(req.returned_checked_by || 'Security / IT', retRightX + 14, returnTableTop - 46, 7, fontRegular)
    text(formatDateId(req.returned_at), retRightX + 34, returnTableTop - 58, 7, fontRegular, COLOR_MUTED)
  } else {
    text('(Stamp / TTD)', retRightX + 30, returnTableTop - 38, 7, fontRegular, COLOR_MUTED)
    text('/        /', retRightX + 44, returnTableTop - 54, 7.5, fontRegular, COLOR_MUTED)
  }

  // 5. Footer strip with verification link and QR security
  const footerY = 25
  line(leftX, footerY + 12, leftX + W, footerY + 12, 0.5, COLOR_MUTED)
  text(`No. Pengajuan: ${req.request_no}`, leftX, footerY + 2, 7, fontBold, COLOR_INK)
  text(`Verifikasi Digital E-Sign: ${verifyUrl}`, leftX + 140, footerY + 2, 6.5, fontRegular, COLOR_MUTED)
  text('ISMS JAI Security Management', leftX + W - 110, footerY + 2, 6.5, fontBold, COLOR_RED)

  return await pdf.save()
}
