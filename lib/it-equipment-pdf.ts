// lib/it-equipment-pdf.ts
import 'server-only'
import { readFile } from 'fs/promises'
import path from 'path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import type { ItEquipmentRequest } from '@/lib/it-equipment-shared'

const COLOR_INK = rgb(0.08, 0.08, 0.12)
const COLOR_MUTED = rgb(0.35, 0.35, 0.4)
const COLOR_RED = rgb(0.82, 0.1, 0.1)
const COLOR_GREEN = rgb(0.05, 0.45, 0.25)
const COLOR_WHITE = rgb(1, 1, 1)

function formatDateId(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return String(dateStr)
  }
}

function parseDateParts(dateStr?: string | null): { dd: string; mm: string; yy: string; yyyy: string } | null {
  if (!dateStr) return null
  const s = String(dateStr).trim()
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return {
      yyyy: isoMatch[1],
      yy: isoMatch[1].slice(-2),
      mm: isoMatch[2],
      dd: isoMatch[3],
    }
  }
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    const yyyy = String(d.getFullYear())
    return {
      yyyy,
      yy: yyyy.slice(-2),
      mm: String(d.getMonth() + 1).padStart(2, '0'),
      dd: String(d.getDate()).padStart(2, '0'),
    }
  }
  return null
}

function safeText(val?: string | null): string {
  if (!val) return ''
  return String(val)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim()
}

/**
 * Mencetak PDF Resmi Izin Membawa Masuk Alat IT (ISMS-F-03-00-001)
 * dan Izin Membawa Keluar Alat IT (ISMS-F-03-00-002) menggunakan file template PDF asli PT. JAI.
 *
 * Alur Bertahap:
 * - Tahap 1 ([Membawa masuk] / [Pengajuan]): Diisi pemohon & disetujui di kotak kanan atas.
 *   Jika belum di-approve (status === 'pending'), kotak persetujuan atas tetap kosong.
 * - Tahap 2 ([Kembali]): Hanya terisi & tertandatangani setelah Tahap 1 di-approve DAN perangkat telah dikembalikan (status === 'returned').
 */
export async function buildItEquipmentPdf(
  req: ItEquipmentRequest,
  verifyUrl: string
): Promise<Uint8Array> {
  const isFormIn = req.form_type === 'in'
  const templateFile = isFormIn
    ? 'isms-f-010-004-equipment-in.pdf' // Kontrol No. : ISMS-F-03-00-001 (Membawa Masuk)
    : 'isms-f-03-00-002-equipment-out.pdf' // Kontrol No. : ISMS-F-03-00-002 (Membawa Keluar)

  const templatePath = path.join(process.cwd(), 'templates', templateFile)
  const templateBytes = await readFile(templatePath)

  const pdf = await PDFDocument.load(templateBytes)
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.getPage(0)

  const write = (
    val: string | null | undefined,
    x: number,
    y: number,
    size = 8.5,
    font = fontRegular,
    color = COLOR_INK,
    maxWidth?: number
  ) => {
    let txt = safeText(val)
    if (!txt) return
    if (maxWidth && font.widthOfTextAtSize(txt, size) > maxWidth) {
      while (txt.length > 3 && font.widthOfTextAtSize(txt + '...', size) > maxWidth) {
        txt = txt.slice(0, -1)
      }
      txt += '...'
    }
    page.drawText(txt, { x, y, size, font, color })
  }

  const writeCenter = (
    val: string | null | undefined,
    centerX: number,
    y: number,
    size = 8,
    font = fontRegular,
    color = COLOR_INK,
    maxWidth?: number
  ) => {
    let txt = safeText(val)
    if (!txt) return
    if (maxWidth && font.widthOfTextAtSize(txt, size) > maxWidth) {
      while (txt.length > 3 && font.widthOfTextAtSize(txt + '...', size) > maxWidth) {
        txt = txt.slice(0, -1)
      }
      txt += '...'
    }
    const w = font.widthOfTextAtSize(txt, size)
    page.drawText(txt, { x: centerX - w / 2, y, size, font, color })
  }

  const drawCheckmark = (x: number, y: number, scale = 1.0) => {
    page.drawLine({
      start: { x: x - 2 * scale, y: y + 1 * scale },
      end: { x: x + 0.5 * scale, y: y - 2 * scale },
      thickness: 1.4,
      color: COLOR_INK,
    })
    page.drawLine({
      start: { x: x + 0.5 * scale, y: y - 2 * scale },
      end: { x: x + 4.5 * scale, y: y + 4 * scale },
      thickness: 1.4,
      color: COLOR_INK,
    })
  }

  const stampQr = async (qrContent: string, x: number, y: number, size = 36) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(qrContent, {
        margin: 1,
        width: size * 3,
        errorCorrectionLevel: 'M',
      })
      const qrBase64 = qrDataUrl.split(',')[1]
      const qrImage = await pdf.embedPng(Buffer.from(qrBase64, 'base64'))
      page.drawImage(qrImage, { x, y, width: size, height: size })
    } catch (e) {
      console.error('[it-equipment-pdf] QR generation error:', e)
    }
  }

  const items = Array.isArray(req.items) ? req.items : []

  if (isFormIn) {
    // =========================================================================
    // FORM 1: ISMS-F-03-00-001 (Pengajuan ijin membawa masuk PC, USB memory, Kamera, dll.)
    // =========================================================================
    write(`No: ${req.request_no}`, 417.8, 707, 7.5, fontBold, COLOR_RED)

    // Bagian [Membawa masuk] (Kolom nilai mulai di x=162, lebar maks 245pt)
    write(formatDateId(req.request_date), 162, 686.0, 8.5, fontBold, COLOR_INK, 240)
    write(
      `${req.applicant_name}${req.applicant_nik ? ` (${req.applicant_nik})` : ''}`,
      162,
      663.7,
      8.5,
      fontBold,
      COLOR_INK,
      240
    )
    write(req.company_name || '-', 162, 642.6, 8.5, fontRegular, COLOR_INK, 240)
    write(
      `${req.department}${req.section ? ` / ${req.section}` : ''}`,
      162,
      621.4,
      8.5,
      fontRegular,
      COLOR_INK,
      240
    )
    write(req.location || '-', 162, 600.3, 8.5, fontRegular, COLOR_INK, 240)
    write(req.purpose || '-', 162, 579.2, 8.5, fontRegular, COLOR_INK, 240)
    write(formatDateId(req.date_in), 162, 558.1, 8.5, fontBold, COLOR_INK, 240)
    write(formatDateId(req.date_out_plan), 162, 537.0, 8.5, fontBold, COLOR_INK, 240)

    // Tabel "Alat yang dibawa masuk" (3 Kolom Perangkat: centerX = 225.0, 364.5, 503.9)
    const colCentersIn = [225.0, 364.5, 503.9]
    for (let idx = 0; idx < 3; idx++) {
      const it = items[idx]
      if (!it) continue
      const cx = colCentersIn[idx]
      // Baris 1: Tipe alat (y=484.0)
      writeCenter(it.equipment_type || 'PC / Laptop', cx, 484.0, 8, fontBold, COLOR_INK, 120)
      // Baris 2: No. identifikasi alat (y=455.6)
      writeCenter(it.id_no || '-', cx, 455.6, 8, fontRegular, COLOR_INK, 120)
      // Baris 3: Produsen / merk [ ... ] (y=418.2)
      writeCenter(it.brand || '-', cx, 418.2, 8, fontBold, COLOR_INK, 74)
      // Baris 4: Model [ ... ] (y=387.0)
      writeCenter(it.model || '-', cx, 387.0, 8, fontRegular, COLOR_INK, 74)
      // Baris 5: Serial No. [ ... ] (y=355.8)
      writeCenter(it.serial_no || '-', cx, 355.8, 7.5, fontRegular, COLOR_INK, 76)
    }

    // Kotak Persetujuan Tahap 1 (IAA / Manager Departemen): "Disetujui (diterima oleh)" (centerX=525, garis tanggal di y=600.1)
    if (req.status === 'approved_manager' || req.status === 'approved' || req.status === 'returned') {
      // Tutup teks "(Stamp / TTD)" di y=621.4 tanpa menyentuh garis tabel
      page.drawRectangle({ x: 488, y: 617, width: 74, height: 12, color: COLOR_WHITE })

      const qrSize = 36
      await stampQr(verifyUrl, 525 - qrSize / 2, 634, qrSize)
      writeCenter('E-SIGN VERIFIED', 525, 625, 5.5, fontBold, COLOR_RED)
      writeCenter(req.approved_by || 'Manager Dept / IAA', 525, 616, 6.5, fontBold, COLOR_INK, 82)

      // Tanggal persetujuan pada slot " / / " di y=600.1 (garis miring di x=509.3 & x=538.3)
      const appParts = parseDateParts(req.approved_at || req.request_date)
      if (appParts) {
        writeCenter(appParts.dd, 495, 600.1, 7.5, fontBold)
        writeCenter(appParts.mm, 523.8, 600.1, 7.5, fontBold)
        writeCenter(appParts.yy, 551, 600.1, 7.5, fontBold)
      }
    } else if (req.status === 'rejected') {
      page.drawRectangle({ x: 488, y: 617, width: 74, height: 12, color: COLOR_WHITE })
      writeCenter('DITOLAK', 525, 638, 8, fontBold, COLOR_RED)
      writeCenter(req.rejected_by || 'Manager Dept / IAA', 525, 626, 6.5, fontRegular, COLOR_MUTED, 82)
    }

    // Kotak Persetujuan Tahap 2 (IT / System Security Administrator Check)
    // HANYA terisi setelah Tahap 1 (IAA / Manager Departemen) selesai DAN Tahap 2 (IT) disetujui (status === 'approved' || status === 'returned')
    if (req.status === 'approved' || req.status === 'returned') {
      page.drawRectangle({ x: 488, y: 58, width: 74, height: 12, color: COLOR_WHITE })
      const qrRetSize = 28
      await stampQr(`${verifyUrl}&stage=it_check`, 525 - qrRetSize / 2, 72, qrRetSize)
      writeCenter('CHECKED BY SSA', 525, 64, 5.5, fontBold, COLOR_RED)
      writeCenter(
        req.it_checked_by || req.returned_checked_by || 'System Security Admin (IT)',
        525,
        56,
        6.5,
        fontBold,
        COLOR_INK,
        82
      )

      const itCheckParts = parseDateParts(req.it_checked_at || req.returned_at || req.approved_at || req.request_date)
      if (itCheckParts) {
        writeCenter(itCheckParts.dd, 495, 45.9, 7.5, fontBold)
        writeCenter(itCheckParts.mm, 523.8, 45.9, 7.5, fontBold)
        writeCenter(itCheckParts.yy, 551, 45.9, 7.5, fontBold)
      }
    }

    // Bagian [Kembali] (HANYA terisi jika perangkat telah dikembalikan: status === 'returned')
    if (req.status === 'returned') {
      const retParts = parseDateParts(req.returned_at || req.date_out_plan)
      if (retParts) {
        // "(tgl/bln/tahun) :   /   /" (garis miring di x=254.6 dan x=318.0, y=188.5)
        writeCenter(retParts.dd, 236, 188.5, 8.5, fontBold)
        writeCenter(retParts.mm, 286, 188.5, 8.5, fontBold)
        writeCenter(retParts.yyyy, 348, 188.5, 8.5, fontBold)
      }

      // Checkbox pengecheckan sebelum kembali (kotak di x=161.0, y=157.0 & y=142.2)
      if (req.return_check_items !== false) {
        drawCheckmark(166, 161)
      }
      if (req.return_check_confidential !== false) {
        drawCheckmark(166, 146)
      }

      // Tanda tangan pemohon saat kembali (centerX=525, y=144.3)
      page.drawRectangle({ x: 488, y: 140, width: 74, height: 12, color: COLOR_WHITE })
      writeCenter('DIKEMBALIKAN', 525, 160, 6, fontBold, COLOR_GREEN)
      writeCenter(req.applicant_name, 525, 148, 7, fontBold, COLOR_INK, 82)
    }
  } else {
    // =========================================================================
    // FORM 2: ISMS-F-03-00-002 (Pengajuan ijin membawa keluar PC, USB memory, Camera, dll.)
    // =========================================================================
    write(`No: ${req.request_no}`, 440.4, 715, 7.5, fontBold, COLOR_RED)

    // Bagian [Pengajuan] (Kolom nilai mulai di x=162)
    write(formatDateId(req.request_date), 162, 689.8, 8.5, fontBold, COLOR_INK, 240)
    write(
      `${req.applicant_name}${req.applicant_nik ? ` (${req.applicant_nik})` : ''}`,
      162,
      668.0,
      8.5,
      fontBold,
      COLOR_INK,
      180
    )
    // Paraf pemohon pada baris NAMA (x=352.1, y=668.2)
    page.drawRectangle({ x: 348, y: 665, width: 62, height: 11, color: COLOR_WHITE })
    write('[SIGNED]', 356, 668.0, 6.5, fontBold, COLOR_GREEN)

    write(req.section || '-', 162, 646.2, 8.5, fontRegular, COLOR_INK, 240)
    write(req.department || '-', 162, 624.3, 8.5, fontRegular, COLOR_INK, 240)
    write(req.location || '-', 162, 602.5, 8.5, fontRegular, COLOR_INK, 240)
    write(req.purpose || '-', 162, 580.6, 8.5, fontRegular, COLOR_INK, 240)
    write(req.purpose || 'Data Pekerjaan Internal PT. JAI', 162, 558.8, 8, fontRegular, COLOR_INK, 240)
    write(formatDateId(req.date_in), 162, 537.0, 8.5, fontBold, COLOR_INK, 240)
    write(formatDateId(req.date_out_plan), 162, 515.1, 8.5, fontBold, COLOR_INK, 240)

    // Tabel "Details dari PC, USB memory, camera, dll." (3 Kolom: centerX = 227.9, 367.3, 506.7)
    const colCentersOut = [227.9, 367.3, 506.7]
    for (let idx = 0; idx < 3; idx++) {
      const it = items[idx]
      if (!it) continue
      const cx = colCentersOut[idx]
      // Baris 1: ID No. atau Ctrl No. (y=461.0)
      writeCenter(
        `${it.id_no || '-'}${it.equipment_type ? ` (${it.equipment_type})` : ''}`,
        cx,
        461.0,
        7.5,
        fontBold,
        COLOR_INK,
        125
      )
      // Baris 2: Model [ ... ] (y=424.2)
      writeCenter(it.model || it.serial_no || '-', cx, 424.2, 8, fontRegular, COLOR_INK, 74)
      // Baris 3: Manufacturer [ ... ] (y=392.0)
      writeCenter(
        `${it.brand || '-'}${it.serial_no ? ` / ${it.serial_no}` : ''}`,
        cx,
        392.0,
        7.5,
        fontBold,
        COLOR_INK,
        74
      )
    }

    // Kotak Persetujuan Tahap 1 (IAA / Manager Departemen): "Disetujui oleh Mgr" (centerX=528, tanggal di y=602.5)
    if (req.status === 'approved_manager' || req.status === 'approved' || req.status === 'returned') {
      page.drawRectangle({ x: 492, y: 621, width: 72, height: 12, color: COLOR_WHITE })

      const qrSize = 36
      await stampQr(verifyUrl, 528 - qrSize / 2, 636, qrSize)
      writeCenter('E-SIGN VERIFIED', 528, 627, 5.5, fontBold, COLOR_RED)
      writeCenter(req.approved_by || 'Manager Dept / IAA', 528, 618, 6.5, fontBold, COLOR_INK, 82)

      const appParts = parseDateParts(req.approved_at || req.request_date)
      if (appParts) {
        writeCenter(appParts.dd, 498, 602.5, 7.5, fontBold)
        writeCenter(appParts.mm, 526.5, 602.5, 7.5, fontBold)
        writeCenter(appParts.yy, 553, 602.5, 7.5, fontBold)
      }
    } else if (req.status === 'rejected') {
      page.drawRectangle({ x: 492, y: 621, width: 72, height: 12, color: COLOR_WHITE })
      writeCenter('DITOLAK', 528, 640, 8, fontBold, COLOR_RED)
      writeCenter(req.rejected_by || 'Manager Dept / IAA', 528, 628, 6.5, fontRegular, COLOR_MUTED, 82)
    }

    // Kotak Persetujuan Tahap 2 (IT / PIC penyimpan record): HANYA terisi setelah Tahap 1 Manager/IAA selesai DAN Tahap 2 IT disetujui
    if (req.status === 'approved' || req.status === 'returned') {
      const itParts = parseDateParts(req.it_checked_at || req.returned_at || req.approved_at || req.request_date)
      const itBox = {
        cx: 289.0,
        s1: 272.9,
        s2: 301.9,
        label: req.it_checked_by || req.returned_checked_by || 'System Security Admin (IT)',
      }
      page.drawRectangle({ x: itBox.cx - 35, y: 176, width: 70, height: 12, color: COLOR_WHITE })
      const qrItSize = 24
      await stampQr(`${verifyUrl}&stage=it_check`, itBox.cx - qrItSize / 2, 192, qrItSize)
      writeCenter('CHECKED BY IT', itBox.cx, 184, 5.5, fontBold, COLOR_RED)
      writeCenter(itBox.label, itBox.cx, 175, 6.5, fontBold, COLOR_INK, 76)
      if (itParts) {
        writeCenter(itParts.dd, itBox.s1 - 12, 165.2, 7, fontBold)
        writeCenter(itParts.mm, (itBox.s1 + itBox.s2) / 2, 165.2, 7, fontBold)
        writeCenter(itParts.yy, itBox.s2 + 12, 165.2, 7, fontBold)
      }
    }

    // Bagian [KEMBALI] (HANYA terisi jika perangkat telah dikembalikan: status === 'returned')
    if (req.status === 'returned') {
      if (req.return_check_items !== false) {
        drawCheckmark(168, 301)
      }
      if (req.return_check_confidential !== false) {
        drawCheckmark(168, 286)
      }

      const retParts = parseDateParts(req.returned_at || req.date_out_plan)
      const boxes = [
        { cx: 408.5, s1: 392.4, s2: 421.4, label: req.approved_by || 'Manager Dept / IAA' },
        { cx: 528.0, s1: 511.9, s2: 541.0, label: req.applicant_name || 'PIC' },
      ]

      for (const b of boxes) {
        page.drawRectangle({ x: b.cx - 35, y: 176, width: 70, height: 12, color: COLOR_WHITE })
        writeCenter('VERIFIED', b.cx, 196, 6, fontBold, COLOR_RED)
        writeCenter(b.label, b.cx, 184, 6.5, fontBold, COLOR_INK, 76)
        if (retParts) {
          writeCenter(retParts.dd, b.s1 - 12, 165.2, 7, fontBold)
          writeCenter(retParts.mm, (b.s1 + b.s2) / 2, 165.2, 7, fontBold)
          writeCenter(retParts.yy, b.s2 + 12, 165.2, 7, fontBold)
        }
      }
    }
  }

  return await pdf.save()
}
