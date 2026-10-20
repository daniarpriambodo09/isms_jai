// lib/it-form-pdf.ts
import 'server-only'
import { readFile } from 'fs/promises'
import path from 'path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import type { ItFormSubmission } from '@/lib/it-form-service'

const COLOR_INK = rgb(0.1, 0.1, 0.1)
const COLOR_MUTED = rgb(0.35, 0.35, 0.35)
const COLOR_RED = rgb(0.85, 0.1, 0.1)
const COLOR_LINE = rgb(0.15, 0.15, 0.15)
const COLOR_LIGHT_BG = rgb(0.96, 0.97, 0.99)
const COLOR_APPROVED_BG = rgb(0.93, 0.98, 0.94)

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

const TEMPLATE_MAP: Record<string, string> = {
  'ISMS-F-010-001': 'isms-f-010-001-pc.pdf',
  'ISMS-F-010-003': 'isms-f-010-003-software.pdf',
  'ISMS-F-010-006': 'isms-f-010-006-email.pdf',
  'ISMS-F-010-007': 'isms-f-010-007-delete.pdf',
  'ISMS-F-03-00-003': 'isms-f-03-00-003-network.pdf',
  'ISMS-F-02-00-002': 'isms-f-02-00-002-fingerprint.pdf',
}

export async function buildItFormPdf(
  sub: ItFormSubmission,
  verifyUrl: string
): Promise<Uint8Array> {
  const templateFileName = TEMPLATE_MAP[sub.form_code]
  let templateBytes: Buffer | null = null

  if (templateFileName) {
    try {
      const templatePath = path.join(process.cwd(), 'templates', templateFileName)
      templateBytes = await readFile(templatePath)
    } catch (err) {
      console.warn(`Template ${templateFileName} not found, falling back to dynamic rendering:`, err)
    }
  }

  if (templateBytes) {
    return stampOnTemplate(sub, templateBytes, verifyUrl)
  }

  // Fallback: render programmatically
  return renderDynamicPdf(sub, verifyUrl)
}

/**
 * Stamps user submission data directly onto the official Yazaki ISMS PDF template.
 */
async function stampOnTemplate(
  sub: ItFormSubmission,
  templateBytes: Buffer,
  verifyUrl: string
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes)
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fontOblique = await pdf.embedFont(StandardFonts.HelveticaOblique)

  const page = pdf.getPage(0)
  const formData = sub.form_data || {}
  const signatures = sub.signatures || []

  const write = (
    val: string,
    x: number,
    y: number,
    size = 9,
    font = fontRegular,
    color = COLOR_INK
  ) => {
    if (!val) return
    page.drawText(safeText(val), { x, y, size, font, color })
  }

  const tick = (x: number, y: number) => {
    page.drawLine({
      start: { x: x + 1, y: y + 2.5 },
      end: { x: x + 3.8, y: y - 2.8 },
      thickness: 1.5,
      color: COLOR_INK,
    })
    page.drawLine({
      start: { x: x + 3.8, y: y - 2.8 },
      end: { x: x + 9, y: y + 6 },
      thickness: 1.5,
      color: COLOR_INK,
    })
  }

  const stampQr = async (
    qrContent: string,
    x: number,
    y: number,
    size = 42
  ) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(qrContent, {
        margin: 1,
        width: size * 2,
        errorCorrectionLevel: 'M',
      })
      const qrBase64 = qrDataUrl.split(',')[1]
      const qrImage = await pdf.embedPng(Buffer.from(qrBase64, 'base64'))
      page.drawImage(qrImage, { x, y, width: size, height: size })
    } catch (e) {
      console.error('Failed to stamp QR code:', e)
    }
  }

  // -------------------------------------------------------------
  // FORM 1: ISMS-F-010-001 (Pengadaan PC / Laptop)
  // -------------------------------------------------------------
  if (sub.form_code === 'ISMS-F-010-001') {
    write(`No. Pengajuan: ${sub.request_no}`, 430, 746, 7.5, fontBold, COLOR_RED)
    write(formatDateId(sub.request_date), 215, 695, 9, fontBold)
    write(`${sub.applicant_name} ${sub.applicant_nik ? `(${sub.applicant_nik})` : ''}`, 215, 665, 9, fontBold)

    write(formData.maker || '-', 215, 605, 9)
    write(formData.model_type || '-', 215, 575, 9)
    write(formData.os_info || 'Windows 11 Pro 64-bit', 215, 545, 9)

    // Software List (1 to 10)
    const swList: string[] = Array.isArray(formData.software_list)
      ? formData.software_list
      : typeof formData.software_list === 'string'
      ? formData.software_list.split('\n')
      : []

    const col1Y = [521, 506, 491, 476, 461]
    const col2Y = [521, 506, 491, 476, 461]

    for (let i = 0; i < 5; i++) {
      if (swList[i]) write(swList[i].slice(0, 26), 235, col1Y[i], 8)
    }
    for (let i = 5; i < 10; i++) {
      if (swList[i]) write(swList[i].slice(0, 26), 400, col2Y[i - 5], 8)
    }

    // Jenis Pengadaan
    if (formData.jenis_pengadaan === 'baru') {
      tick(221, 442)
    } else {
      tick(221, 427)
    }

    write(formData.old_pc_name || '-', 215, 407, 9)
    write(sub.department || '-', 215, 377, 9)
    write(formData.login_username || '-', 215, 347, 9)
    write(formData.function_purpose || sub.purpose || '-', 215, 317, 9)

    if (sub.notes) {
      write(sub.notes.slice(0, 95), 70, 280, 8, fontOblique, COLOR_MUTED)
    }

    // Signature boxes: IT Section Check (x=345..445, y=95..175) & Manager (x=450..550, y=95..175)
    const sigIt = signatures.find((s) => s.step_number === 1) || signatures[0]
    const sigMgr = signatures.find((s) => s.step_number === 2) || signatures[1]

    if (sigIt && sigIt.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=${sigIt.step_number}&code=${sigIt.verification_code || ''}`
      await stampQr(qrUrl, 356, 118, 42)
      write('E-SIGN VERIFIED', 350, 110, 6.5, fontBold, COLOR_RED)
      write(sigIt.approver_name.slice(0, 18), 350, 102, 7.5, fontBold)
      write(formatDateId(sigIt.signed_at), 350, 94, 6.5, fontRegular, COLOR_MUTED)
    }

    if (sigMgr && sigMgr.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=${sigMgr.step_number}&code=${sigMgr.verification_code || ''}`
      await stampQr(qrUrl, 460, 118, 42)
      write('E-SIGN VERIFIED', 454, 110, 6.5, fontBold, COLOR_RED)
      write(sigMgr.approver_name.slice(0, 18), 454, 102, 7.5, fontBold)
      write(formatDateId(sigMgr.signed_at), 454, 94, 6.5, fontRegular, COLOR_MUTED)
    }
  }

  // -------------------------------------------------------------
  // FORM 2: ISMS-F-010-003 (Pengadaan Software)
  // -------------------------------------------------------------
  else if (sub.form_code === 'ISMS-F-010-003') {
    write(`No. Pengajuan: ${sub.request_no}`, 430, 746, 7.5, fontBold, COLOR_RED)
    write(formatDateId(sub.request_date), 215, 695, 9, fontBold)
    write(`${sub.applicant_name} ${sub.applicant_nik ? `(${sub.applicant_nik})` : ''}`, 215, 665, 9, fontBold)

    // Software List (1 to 10)
    const swList: string[] = Array.isArray(formData.software_list)
      ? formData.software_list
      : typeof formData.software_list === 'string'
      ? formData.software_list.split('\n')
      : []

    const col1Y = [641, 626, 611, 596, 581]
    const col2Y = [641, 626, 611, 596, 581]

    for (let i = 0; i < 5; i++) {
      if (swList[i]) write(swList[i].slice(0, 26), 235, col1Y[i], 8)
    }
    for (let i = 5; i < 10; i++) {
      if (swList[i]) write(swList[i].slice(0, 26), 400, col2Y[i - 5], 8)
    }

    // Jenis Pengadaan
    if (formData.jenis_pengadaan === 'baru') {
      tick(221, 563)
    } else {
      tick(221, 548)
    }

    // Informasi PC Tujuan
    write(formData.asset_no || '-', 215, 497, 9)
    write(formData.maker || '-', 215, 467, 9)
    write(formData.model_type || '-', 215, 437, 9)
    write(formData.serial_no || '-', 215, 407, 9)
    write(formData.os_info || '-', 215, 377, 9)
    write(formData.pc_name || '-', 215, 347, 9)
    write(sub.department || '-', 215, 317, 9)
    write(formData.login_username || '-', 215, 287, 9)
    write(formData.function_purpose || sub.purpose || '-', 215, 257, 9)

    if (sub.notes) {
      write(sub.notes.slice(0, 95), 70, 220, 8, fontOblique, COLOR_MUTED)
    }

    // Signature boxes: IT Section Check & Manager
    const sigIt = signatures.find((s) => s.step_number === 1) || signatures[0]
    const sigMgr = signatures.find((s) => s.step_number === 2) || signatures[1]

    if (sigIt && sigIt.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=${sigIt.step_number}&code=${sigIt.verification_code || ''}`
      await stampQr(qrUrl, 356, 102, 42)
      write('E-SIGN VERIFIED', 350, 94, 6.5, fontBold, COLOR_RED)
      write(sigIt.approver_name.slice(0, 18), 350, 86, 7.5, fontBold)
    }

    if (sigMgr && sigMgr.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=${sigMgr.step_number}&code=${sigMgr.verification_code || ''}`
      await stampQr(qrUrl, 460, 102, 42)
      write('E-SIGN VERIFIED', 454, 94, 6.5, fontBold, COLOR_RED)
      write(sigMgr.approver_name.slice(0, 18), 454, 86, 7.5, fontBold)
    }
  }

  // -------------------------------------------------------------
  // FORM 3: ISMS-F-010-006 (Email & User ID)
  // Has two copies on one page (Top copy & Bottom copy, delta = -418)
  // -------------------------------------------------------------
  else if (sub.form_code === 'ISMS-F-010-006') {
    const deltas = [0, -418]

    for (const d of deltas) {
      write(`No. ${sub.request_no}`, 440, 756 + d, 7.5, fontBold, COLOR_RED)
      write(formatDateId(sub.request_date), 145, 706 + d, 9, fontBold)
      write(sub.applicant_position || '-', 400, 706 + d, 9)

      write(sub.applicant_name, 145, 676 + d, 9, fontBold)

      // Status Karyawan
      const st = String(sub.employee_status).toUpperCase()
      if (st.includes('TETAP')) {
        tick(492, 684 + d)
      } else if (st.includes('KONTRAK')) {
        tick(442, 684 + d)
      } else {
        tick(399, 684 + d)
        write(st.slice(0, 18), 455, 667 + d, 8)
      }

      write(sub.applicant_nik || '-', 145, 644 + d, 9, fontBold)
      write(sub.department, 145, 614 + d, 9)

      // Perihal checkboxes
      if (formData.request_email) tick(408, 652 + d)
      if (formData.change_email) tick(408, 637 + d)
      if (formData.request_user_id) tick(408, 622 + d)
      if (formData.change_user_id) tick(408, 606 + d)

      // Target details
      const detailStr = `Email: ${formData.email_target || '-'} | ID: ${formData.user_id_target || '-'}`
      write(detailStr.slice(0, 48), 400, 590 + d, 7.5, fontBold)

      if (sub.notes) {
        write(sub.notes.slice(0, 95), 65, 574 + d, 7.5, fontOblique, COLOR_MUTED)
      }
    }

    // Top Signatures (y=440..525): 1: IT SPV, 2: IR/HR, 3: Dept Mgr
    const sig1 = signatures.find((s) => s.step_number === 1) || signatures[0]
    const sig2 = signatures.find((s) => s.step_number === 2) || signatures[1]
    const sig3 = signatures.find((s) => s.step_number === 3) || signatures[2]

    if (sig1 && sig1.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=1&code=${sig1.verification_code || ''}`
      await stampQr(qrUrl, 52, 455, 38)
      write(sig1.approver_name.slice(0, 16), 94, 478, 7.5, fontBold)
      write(formatDateId(sig1.signed_at), 94, 466, 6.5, fontRegular, COLOR_MUTED)
    }

    if (sig2 && sig2.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=2&code=${sig2.verification_code || ''}`
      await stampQr(qrUrl, 218, 455, 38)
      write(sig2.approver_name.slice(0, 16), 260, 478, 7.5, fontBold)
      write(formatDateId(sig2.signed_at), 260, 466, 6.5, fontRegular, COLOR_MUTED)
    }

    if (sig3 && sig3.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=3&code=${sig3.verification_code || ''}`
      await stampQr(qrUrl, 388, 455, 38)
      write(sig3.approver_name.slice(0, 16), 430, 478, 7.5, fontBold)
      write(formatDateId(sig3.signed_at), 430, 466, 6.5, fontRegular, COLOR_MUTED)
    }
  }

  // -------------------------------------------------------------
  // FORM 4: ISMS-F-010-007 (Delete Email & User ID)
  // Dual copy layout (Top & Bottom, delta = -418)
  // -------------------------------------------------------------
  else if (sub.form_code === 'ISMS-F-010-007') {
    const deltas = [0, -418]

    for (const d of deltas) {
      write(`No. ${sub.request_no}`, 440, 756 + d, 7.5, fontBold, COLOR_RED)
      write(formatDateId(sub.request_date), 145, 706 + d, 9, fontBold)
      write(sub.applicant_position || '-', 400, 706 + d, 9)

      write(sub.applicant_name, 145, 676 + d, 9, fontBold)

      const st = String(sub.employee_status).toUpperCase()
      if (st.includes('TETAP')) {
        tick(492, 684 + d)
      } else if (st.includes('KONTRAK')) {
        tick(442, 684 + d)
      } else {
        tick(399, 684 + d)
        write(st.slice(0, 18), 455, 667 + d, 8)
      }

      write(sub.applicant_nik || '-', 145, 644 + d, 9, fontBold)
      write(sub.department, 145, 614 + d, 9)

      if (formData.delete_email) tick(408, 652 + d)
      if (formData.delete_user_id) tick(408, 622 + d)

      const detailStr = `Email: ${formData.email_target || '-'} | ID: ${formData.user_id_target || '-'}`
      write(detailStr.slice(0, 48), 400, 595 + d, 7.5, fontBold)

      if (sub.notes) {
        write(sub.notes.slice(0, 95), 65, 574 + d, 7.5, fontOblique, COLOR_MUTED)
      }
    }

    const sig1 = signatures.find((s) => s.step_number === 1) || signatures[0]
    const sig2 = signatures.find((s) => s.step_number === 2) || signatures[1]
    const sig3 = signatures.find((s) => s.step_number === 3) || signatures[2]

    if (sig1 && sig1.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=1&code=${sig1.verification_code || ''}`
      await stampQr(qrUrl, 52, 455, 38)
      write(sig1.approver_name.slice(0, 16), 94, 478, 7.5, fontBold)
      write(formatDateId(sig1.signed_at), 94, 466, 6.5, fontRegular, COLOR_MUTED)
    }

    if (sig2 && sig2.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=2&code=${sig2.verification_code || ''}`
      await stampQr(qrUrl, 218, 455, 38)
      write(sig2.approver_name.slice(0, 16), 260, 478, 7.5, fontBold)
      write(formatDateId(sig2.signed_at), 260, 466, 6.5, fontRegular, COLOR_MUTED)
    }

    if (sig3 && sig3.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=3&code=${sig3.verification_code || ''}`
      await stampQr(qrUrl, 388, 455, 38)
      write(sig3.approver_name.slice(0, 16), 430, 478, 7.5, fontBold)
      write(formatDateId(sig3.signed_at), 430, 466, 6.5, fontRegular, COLOR_MUTED)
    }
  }

  // -------------------------------------------------------------
  // FORM 5: ISMS-F-03-00-003 (Company Network Connection)
  // -------------------------------------------------------------
  else if (sub.form_code === 'ISMS-F-03-00-003') {
    write(`No: ${sub.request_no}`, 430, 740, 7.5, fontBold, COLOR_RED)
    write(formatDateId(sub.request_date), 225, 685, 9, fontBold)
    write(`${sub.applicant_name} ${sub.applicant_nik ? `(${sub.applicant_nik})` : ''}`, 225, 655, 9, fontBold)
    write(sub.company_name || 'PT. Jatim Autocomp Indonesia', 225, 625, 9)
    write(sub.department, 225, 595, 9)

    // Connection Periode
    write(formatDateId(formData.period_from), 245, 565, 8.5)
    write(formatDateId(formData.period_to), 370, 565, 8.5)

    write(formData.location || '-', 225, 535, 9)

    // Purpose checkboxes
    if (formData.purpose_internet) tick(231, 512)
    if (formData.purpose_email) tick(231, 497)
    if (formData.purpose_web) tick(231, 482)
    if (formData.purpose_ftp) tick(231, 467)
    if (formData.purpose_others) {
      tick(231, 452)
      write(formData.purpose_others.slice(0, 24), 330, 452, 8)
    }

    // IT Check items
    if (formData.antivirus_installed !== false) {
      tick(408, 355) // YES
    } else {
      tick(483, 355) // NO
    }

    write(formData.antivirus_name || 'Windows Defender', 355, 312, 8.5)
    write(formData.antivirus_version || 'Latest Definition', 355, 282, 8.5)
    write(formData.os_info || 'Windows 11 Pro 64-bit', 355, 252, 8.5)

    if (formData.ip_mode === 'static') {
      tick(478, 220) // STATIC
      write(formData.static_ip || '-', 225, 197, 8.5, fontBold)
      write(formData.static_subnet || '255.255.255.0', 225, 184, 8.5)
      write(formData.static_gateway || '-', 225, 167, 8.5)
      write(formData.dns_priority || '-', 225, 152, 8.5)
      write(formData.dns_secondary || '-', 225, 137, 8.5)
    } else {
      tick(390, 220) // DHCP
    }

    // Approvals: IT Check (x=360..455) & IAA Approval (x=465..555)
    const sig1 = signatures.find((s) => s.step_number === 1) || signatures[0]
    const sig2 = signatures.find((s) => s.step_number === 2) || signatures[1]

    if (sig1 && sig1.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=1&code=${sig1.verification_code || ''}`
      await stampQr(qrUrl, 380, 118, 42)
      write(sig1.approver_name.slice(0, 18), 375, 108, 7.5, fontBold)
      write(formatDateId(sig1.signed_at), 375, 98, 6.5, fontRegular, COLOR_MUTED)
    }

    if (sig2 && sig2.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=2&code=${sig2.verification_code || ''}`
      await stampQr(qrUrl, 480, 118, 42)
      write(sig2.approver_name.slice(0, 18), 475, 108, 7.5, fontBold)
      write(formatDateId(sig2.signed_at), 475, 98, 6.5, fontRegular, COLOR_MUTED)
    }
  }

  // -------------------------------------------------------------
  // FORM 6: ISMS-F-02-00-002 (Fingerprint Special Security Area)
  // Dual-copy layout on single page (Top copy & Bottom copy, delta = -385.6)
  // -------------------------------------------------------------
  else if (sub.form_code === 'ISMS-F-02-00-002') {
    const deltas = [0, -385.6]

    for (const d of deltas) {
      write(`No. ${sub.request_no}`, 440, 689.3 + d, 7.5, fontBold, COLOR_RED)
      write(formatDateId(sub.request_date), 232, 655 + d, 8.5, fontBold)
      if (formData.fingerprint_id) {
        write(formData.fingerprint_id, 495, 638 + d, 8.5, fontBold)
      }
      write(sub.applicant_name, 232, 626 + d, 8.5, fontBold)
      write(sub.applicant_nik || '-', 232, 597 + d, 8.5, fontBold)
      write(sub.department, 232, 568 + d, 8.5, fontBold)

      const areaText = formData.area_special_security || sub.purpose || 'Ruang Server / Server Room'
      write(areaText.slice(0, 40), 232, 540 + d, 8, fontBold)

      const delDateStr = formData.access_deletion_date
        ? (formatDateId(formData.access_deletion_date) || formData.access_deletion_date)
        : 'Sesuai Masa Penugasan'
      write(delDateStr, 280, 432.2 + d, 8, fontBold)

      // Signature box (Information Assets Administrator - Teguh Sunjoyo)
      const sig = signatures.find((s) => s.step_number === 1) || signatures[0]
      if (sig && sig.status === 'approved') {
        const qrUrl = `${verifyUrl}&step=1&code=${sig.verification_code || ''}`
        await stampQr(qrUrl, 395, 460 + d, 42)
        write('E-SIGN VERIFIED', 445, 492 + d, 6.5, fontBold, COLOR_RED)
        write(sig.approver_name || 'Teguh Sunjoyo', 445, 480 + d, 8, fontBold)
        write('IAA Administrator', 445, 471 + d, 6.5, fontRegular, COLOR_MUTED)
        write(formatDateId(sig.signed_at), 445, 462 + d, 6.5, fontRegular, COLOR_MUTED)
      } else {
        write('[ PENDING APPROVAL ]', 415, 485 + d, 7, fontOblique, COLOR_MUTED)
        write('Teguh Sunjoyo (IAA)', 415, 473 + d, 7, fontRegular, COLOR_MUTED)
      }
    }
  }

  return pdf.save()
}

/**
 * Fallback renderer if template PDF file is not found.
 */
async function renderDynamicPdf(
  sub: ItFormSubmission,
  verifyUrl: string
): Promise<Uint8Array> {
  const PAGE_W = 595.28
  const PAGE_H = 841.89
  const MARGIN_X = 36

  const pdf = await PDFDocument.create()
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fontOblique = await pdf.embedFont(StandardFonts.HelveticaOblique)

  const page = pdf.addPage([PAGE_W, PAGE_H])
  const W = PAGE_W - 2 * MARGIN_X
  const leftX = MARGIN_X

  const text = (
    val: string,
    x: number,
    y: number,
    size = 8.5,
    font = fontRegular,
    color = COLOR_INK
  ) => {
    page.drawText(safeText(val), { x, y, size, font, color })
  }

  const line = (x1: number, y1: number, x2: number, y2: number, thickness = 0.8, color = COLOR_LINE) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color })
  }

  const rect = (x: number, y: number, w: number, h: number, strokeColor = COLOR_LINE, fillColor?: any, borderWidth = 0.8) => {
    page.drawRectangle({ x, y, width: w, height: h, borderColor: strokeColor, color: fillColor, borderWidth })
  }

  let y = PAGE_H - 35
  text('YAZAKI', leftX, y, 16, fontBold, COLOR_RED)
  text('PT. JATIM AUTOCOMP INDONESIA', leftX, y - 9, 7.5, fontBold, COLOR_INK)

  rect(PAGE_W - MARGIN_X - 95, y - 10, 95, 24, COLOR_RED, undefined, 1.2)
  text('CONFIDENTIAL', PAGE_W - MARGIN_X - 86, y - 3, 10, fontBold, COLOR_RED)

  y -= 32
  text(sub.form_name, leftX, y, 12, fontBold, COLOR_INK)
  y -= 14
  text(`Kontrol No. : ${sub.form_code}`, leftX, y, 8, fontBold, COLOR_INK)
  text(`No. Pengajuan : ${sub.request_no}`, PAGE_W - MARGIN_X - 145, y, 8, fontBold, COLOR_RED)

  y -= 25
  rect(leftX, y - 100, W, 100, COLOR_LINE, undefined, 1)
  text('DATA PEMOHON', leftX + 8, y - 14, 8, fontBold)
  text(`Nama Pemohon: ${sub.applicant_name}`, leftX + 8, y - 30, 8.5)
  text(`NIK: ${sub.applicant_nik || '-'}`, leftX + 8, y - 46, 8.5)
  text(`Departemen: ${sub.department}`, leftX + 8, y - 62, 8.5)
  text(`Tanggal Pengajuan: ${formatDateId(sub.request_date)}`, leftX + 8, y - 78, 8.5)

  y -= 120
  text(`Catatan: ${sub.notes || '-'}`, leftX, y, 8, fontOblique, COLOR_MUTED)

  // Approver Signatures
  y -= 30
  const signatures = sub.signatures || []
  const slotW = W / (signatures.length || 1)
  const slotH = 90
  rect(leftX, y - slotH, W, slotH, COLOR_LINE, undefined, 1)

  for (let i = 0; i < signatures.length; i++) {
    const curX = leftX + i * slotW
    const sig = signatures[i]
    if (i > 0) line(curX, y, curX, y - slotH, 1, COLOR_LINE)
    text(sig.slot_label, curX + 6, y - 14, 7.5, fontBold)
    text(sig.role_title.slice(0, 24), curX + 6, y - 24, 6.5, fontRegular, COLOR_MUTED)

    if (sig.status === 'approved') {
      try {
        const qrUrl = `${verifyUrl}&step=${sig.step_number}&code=${sig.verification_code || ''}`
        const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 70 })
        const qrBase64 = qrDataUrl.split(',')[1]
        const qrImg = await pdf.embedPng(Buffer.from(qrBase64, 'base64'))
        page.drawImage(qrImg, { x: curX + 6, y: y - slotH + 16, width: 36, height: 36 })
        text(sig.approver_name.slice(0, 16), curX + 46, y - 48, 7.5, fontBold)
        text(formatDateId(sig.signed_at), curX + 46, y - 58, 6.5, fontRegular, COLOR_MUTED)
      } catch (e) {
        text('APPROVED', curX + 10, y - 50, 8, fontBold, COLOR_RED)
      }
    } else {
      text('MENUNGGU APPROVAL', curX + 6, y - 50, 7, fontBold, COLOR_RED)
    }
  }

  return pdf.save()
}
