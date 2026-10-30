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
  if (!dateStr || dateStr === 'null' || dateStr === 'undefined' || dateStr === 'Invalid Date') return '-'
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) {
      return dateStr
    }
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function parseDateParts(dateStr?: string | null): { dd: string; mm: string; yy: string } | null {
  if (!dateStr || dateStr === 'null' || dateStr === 'undefined' || dateStr === 'Invalid Date') return null
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return null
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yy = String(d.getFullYear()).slice(-2)
    return { dd, mm, yy }
  } catch {
    return null
  }
}

function formatDeptSection(dept?: string | null, section?: string | null): string {
  if (!dept) return '-'
  if (section && section !== '-' && !dept.toLowerCase().includes(section.toLowerCase())) {
    return `${dept} / ${section}`
  }
  return dept
}

function safeText(val?: string | null): string {
  if (!val) return ''
  return val.replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
}

/**
 * Splits and word-wraps text across available horizontal ruled lines.
 * Preserves user newlines and breaks long text across multiple lines naturally.
 */
function wrapTextToRuledLines(
  text: string | null | undefined,
  font: any,
  fontSize: number,
  maxWidth: number,
  maxLines: number
): string[] {
  if (!text || !text.trim()) return []
  // Split on newlines first so user paragraphs/bullet points are preserved
  const paragraphs = text.trim().split(/\r?\n/)
  const result: string[] = []

  for (let p = 0; p < paragraphs.length; p++) {
    const para = safeText(paragraphs[p]).trim()
    if (!para) continue
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue

    let curLine = ''
    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      const candidate = curLine ? `${curLine} ${word}` : word

      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        curLine = candidate
      } else {
        if (curLine) {
          result.push(curLine)
          curLine = ''
        }
        if (result.length >= maxLines) break

        if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
          curLine = word
        } else {
          let remWord = word
          while (remWord && result.length < maxLines) {
            let chunk = ''
            for (let c = 0; c < remWord.length; c++) {
              if (font.widthOfTextAtSize(chunk + remWord[c], fontSize) <= maxWidth) {
                chunk += remWord[c]
              } else {
                break
              }
            }
            if (!chunk) chunk = remWord[0]
            remWord = remWord.slice(chunk.length)
            if (remWord && result.length + 1 < maxLines) {
              result.push(chunk)
            } else {
              curLine = chunk
              break
            }
          }
        }
        if (result.length >= maxLines) break
      }
    }

    if (curLine) {
      result.push(curLine)
      curLine = ''
    }
    if (result.length >= maxLines) break
  }

  if (result.length > maxLines) {
    result.length = maxLines
  }
  return result
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
  if (sub.form_code === 'ISMS-F-03-00-001' || sub.form_code === 'ISMS-F-03-00-002') {
    try {
      const { query } = await import('@/lib/db')
      const { buildItEquipmentPdf } = await import('@/lib/it-equipment-pdf')
      const eqId = sub.form_data?.equipment_request_id
      if (eqId) {
        const eqRes = await query<any>(`SELECT * FROM it_equipment_requests WHERE id = $1 LIMIT 1`, [eqId])
        if (eqRes.rowCount && eqRes.rowCount > 0) {
          return await buildItEquipmentPdf(eqRes.rows[0], verifyUrl)
        }
      }
    } catch (pdfErr) {
      console.error('[buildItFormPdf] Error generating equipment PDF:', pdfErr)
    }
  }
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
    if (sub.form_code === 'ISMS-F-02-00-002') {
      return stampFingerprintTemplate(sub, templateBytes, verifyUrl)
    }
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

  const writeCenter = (
    val: string,
    centerX: number,
    y: number,
    size = 8.5,
    font = fontRegular,
    color = COLOR_INK
  ) => {
    if (!val) return
    const textW = font.widthOfTextAtSize(safeText(val), size)
    page.drawText(safeText(val), { x: centerX - textW / 2, y, size, font, color })
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

  const stampSlashedDate = (
    dateStr: string | null | undefined,
    slashX1: number,
    slashX2: number,
    baselineY: number,
    size = 8,
    font = fontBold,
    color = COLOR_INK
  ) => {
    const parts = parseDateParts(dateStr)
    if (!parts) return
    const ddW = font.widthOfTextAtSize(parts.dd, size)
    write(parts.dd, slashX1 - 2.5 - ddW, baselineY, size, font, color)
    writeCenter(parts.mm, (slashX1 + 4 + slashX2) / 2, baselineY, size, font, color)
    write(parts.yy, slashX2 + 4 + 2.5, baselineY, size, font, color)
  }

  const stampRuledNotes = (
    noteText: string | null | undefined,
    linesY: number[],
    startX = 70,
    maxWidth = 470,
    fontSize = 8,
    font = fontRegular,
    color = COLOR_INK,
    yOffset = 3.5
  ) => {
    if (!noteText) return
    const lines = wrapTextToRuledLines(noteText, font, fontSize, maxWidth, linesY.length)
    for (let i = 0; i < lines.length && i < linesY.length; i++) {
      page.drawText(safeText(lines[i]), {
        x: startX,
        y: linesY[i] + yOffset,
        size: fontSize,
        font,
        color,
      })
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
    write(formatDeptSection(sub.department, formData.section), 215, 377, 9)
    write(formData.login_username || '-', 215, 347, 9)
    write(formData.function_purpose || sub.purpose || '-', 215, 317, 9)

    if (sub.notes) {
      stampRuledNotes(sub.notes, [280.4, 265.4, 250.4, 235.4], 70, 470, 8, fontRegular, COLOR_INK, 3.5)
    }

    // Signature boxes: IT Section Check (centerX=411.0) & Manager (centerX=510.5)
    // Manager approves first (Step 1), then IT Section checks (Step 2)
    const sigMgr = signatures.find((s) =>
      s.slot_label.toUpperCase().includes('MGR') ||
      s.role_title.toUpperCase().includes('MANAGER')
    ) || signatures.find((s) => s.step_number === 1) || signatures[0]

    const sigIt = signatures.find((s) =>
      s.slot_label.toUpperCase().includes('IT') ||
      s.role_title.toUpperCase().includes('IT')
    ) || signatures.find((s) => s.step_number === 2) || signatures[1]

    if (sigIt && sigIt.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=${sigIt.step_number}&code=${sigIt.verification_code || ''}`
      const qrSize = 38
      await stampQr(qrUrl, 411.0 - qrSize / 2, 120, qrSize)
      writeCenter('E-SIGN VERIFIED', 411.0, 109, 6.5, fontBold, COLOR_RED)
      writeCenter(sigIt.approver_name.slice(0, 18), 411.0, 99, 7.5, fontBold, COLOR_INK)
      stampSlashedDate(sigIt.signed_at, 401.3, 420.5, 83.0, 8, fontBold)
    }

    if (sigMgr && sigMgr.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=${sigMgr.step_number}&code=${sigMgr.verification_code || ''}`
      const qrSize = 38
      await stampQr(qrUrl, 510.5 - qrSize / 2, 120, qrSize)
      writeCenter('E-SIGN VERIFIED', 510.5, 109, 6.5, fontBold, COLOR_RED)
      writeCenter(sigMgr.approver_name.slice(0, 18), 510.5, 99, 7.5, fontBold, COLOR_INK)
      stampSlashedDate(sigMgr.signed_at, 499.9, 519.1, 83.0, 8, fontBold)
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
    write(formatDeptSection(sub.department, formData.section), 215, 317, 9)
    write(formData.login_username || '-', 215, 287, 9)
    write(formData.function_purpose || sub.purpose || '-', 215, 257, 9)

    if (sub.notes) {
      stampRuledNotes(sub.notes, [220.64, 205.64, 190.64], 70, 470, 8, fontRegular, COLOR_INK, 3.5)
    }

    // Signature boxes: IT Section Check (centerX=411.0) & Manager (centerX=510.5)
    // Manager approves first (Step 1), then IT Section checks (Step 2)
    const sigMgr = signatures.find((s) =>
      s.slot_label.toUpperCase().includes('MGR') ||
      s.role_title.toUpperCase().includes('MANAGER')
    ) || signatures.find((s) => s.step_number === 1) || signatures[0]

    const sigIt = signatures.find((s) =>
      s.slot_label.toUpperCase().includes('IT') ||
      s.role_title.toUpperCase().includes('IT')
    ) || signatures.find((s) => s.step_number === 2) || signatures[1]

    if (sigIt && sigIt.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=${sigIt.step_number}&code=${sigIt.verification_code || ''}`
      const qrSize = 38
      await stampQr(qrUrl, 411.0 - qrSize / 2, 90, qrSize)
      writeCenter('E-SIGN VERIFIED', 411.0, 79, 6.5, fontBold, COLOR_RED)
      writeCenter(sigIt.approver_name.slice(0, 18), 411.0, 69, 7.5, fontBold, COLOR_INK)
      stampSlashedDate(sigIt.signed_at, 401.3, 420.5, 53.2, 8, fontBold)
    }

    if (sigMgr && sigMgr.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=${sigMgr.step_number}&code=${sigMgr.verification_code || ''}`
      const qrSize = 38
      await stampQr(qrUrl, 510.5 - qrSize / 2, 90, qrSize)
      writeCenter('E-SIGN VERIFIED', 510.5, 79, 6.5, fontBold, COLOR_RED)
      writeCenter(sigMgr.approver_name.slice(0, 18), 510.5, 69, 7.5, fontBold, COLOR_INK)
      stampSlashedDate(sigMgr.signed_at, 499.9, 519.1, 53.2, 8, fontBold)
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
      write(formatDeptSection(sub.department, formData.section), 145, 614 + d, 9)

      // Perihal checkboxes
      if (formData.request_email) tick(408, 652 + d)
      if (formData.change_email) tick(408, 637 + d)
      if (formData.request_user_id) tick(408, 622 + d)
      if (formData.change_user_id) tick(408, 606 + d)

      // Target details
      const detailStr = `Email: ${formData.email_target || '-'} | ID: ${formData.user_id_target || '-'}`
      write(detailStr.slice(0, 48), 400, 590 + d, 7.5, fontBold)

      if (sub.notes) {
        stampRuledNotes(sub.notes, [581.96 + d, 566.60 + d, 551.24 + d], 64, 480, 8, fontRegular, COLOR_INK, 3.5)
      }

      // Stamped signatures for both copies (Top & Bottom):
      // Col 1: IT SPV / SSA Check (centerX=128.0)
      // Col 2: IR / HR Mengetahui (centerX=298.0)
      // Col 3: Dept Mgr Menyetujui (centerX=467.0)
      // Note: Approval sequence is Step 1 = Dept Mgr, Step 2 = IR/HR, Step 3 = IT SPV
      const sigIt = signatures.find((s) =>
        s.slot_label.toUpperCase().includes('CHECK') ||
        s.slot_label.toUpperCase().includes('CEK') ||
        s.role_title.toUpperCase().includes('IT') ||
        s.role_title.toUpperCase().includes('SECURITY')
      ) || signatures.find((s) => s.step_number === 3) || signatures[0]

      const sigHr = signatures.find((s) =>
        s.slot_label.toUpperCase().includes('MENGETAHUI') ||
        s.role_title.toUpperCase().includes('HR') ||
        s.role_title.toUpperCase().includes('IR')
      ) || signatures.find((s) => s.step_number === 2) || signatures[1]

      const sigMgr = signatures.find((s) =>
        s.slot_label.toUpperCase().includes('MENYETUJUI') ||
        s.role_title.toUpperCase().includes('MGR') ||
        s.role_title.toUpperCase().includes('MANAGER')
      ) || signatures.find((s) => s.step_number === 1) || signatures[2]

      const qrSize = 34

      if (sigIt && sigIt.status === 'approved') {
        const qrUrl = `${verifyUrl}&step=${sigIt.step_number}&code=${sigIt.verification_code || ''}`
        await stampQr(qrUrl, 128.0 - qrSize / 2, 486 + d, qrSize)
        writeCenter(sigIt.approver_name.slice(0, 16), 128.0, 477 + d, 7, fontBold)
        writeCenter(formatDateId(sigIt.signed_at), 128.0, 469 + d, 6, fontRegular, COLOR_MUTED)
      }

      if (sigHr && sigHr.status === 'approved') {
        const qrUrl = `${verifyUrl}&step=${sigHr.step_number}&code=${sigHr.verification_code || ''}`
        await stampQr(qrUrl, 298.0 - qrSize / 2, 486 + d, qrSize)
        writeCenter(sigHr.approver_name.slice(0, 16), 298.0, 477 + d, 7, fontBold)
        writeCenter(formatDateId(sigHr.signed_at), 298.0, 469 + d, 6, fontRegular, COLOR_MUTED)
      }

      if (sigMgr && sigMgr.status === 'approved') {
        const qrUrl = `${verifyUrl}&step=${sigMgr.step_number}&code=${sigMgr.verification_code || ''}`
        await stampQr(qrUrl, 467.0 - qrSize / 2, 486 + d, qrSize)
        writeCenter(sigMgr.approver_name.slice(0, 16), 467.0, 477 + d, 7, fontBold)
        writeCenter(formatDateId(sigMgr.signed_at), 467.0, 469 + d, 6, fontRegular, COLOR_MUTED)
      }
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
      write(formatDeptSection(sub.department, formData.section), 145, 614 + d, 9)

      if (formData.delete_email) tick(408, 652 + d)
      if (formData.delete_user_id) tick(408, 622 + d)

      const detailStr = `Email: ${formData.email_target || '-'} | ID: ${formData.user_id_target || '-'}`
      write(detailStr.slice(0, 48), 400, 595 + d, 7.5, fontBold)

      if (sub.notes) {
        stampRuledNotes(sub.notes, [581.96 + d, 566.60 + d, 551.24 + d], 64, 480, 8, fontRegular, COLOR_INK, 3.5)
      }

      // Stamped signatures for both copies:
      // Col 1: DIREQUESTKAN OLEH - IR/HR (centerX=128.0)
      // Col 2: MENGETAHUI - Dept Manager (centerX=298.0)
      // Col 3: MENYETUJUI - IT SPV / SSA (centerX=467.0)
      const sig1 = signatures.find((s) => s.step_number === 1) || signatures[0]
      const sig2 = signatures.find((s) => s.step_number === 2) || signatures[1]
      const sig3 = signatures.find((s) => s.step_number === 3) || signatures[2]
      const qrSize = 34

      if (sig1 && sig1.status === 'approved') {
        const qrUrl = `${verifyUrl}&step=1&code=${sig1.verification_code || ''}`
        await stampQr(qrUrl, 128.0 - qrSize / 2, 486 + d, qrSize)
        writeCenter(sig1.approver_name.slice(0, 16), 128.0, 477 + d, 7, fontBold)
        writeCenter(formatDateId(sig1.signed_at), 128.0, 469 + d, 6, fontRegular, COLOR_MUTED)
      }

      if (sig2 && sig2.status === 'approved') {
        const qrUrl = `${verifyUrl}&step=2&code=${sig2.verification_code || ''}`
        await stampQr(qrUrl, 298.0 - qrSize / 2, 486 + d, qrSize)
        writeCenter(sig2.approver_name.slice(0, 16), 298.0, 477 + d, 7, fontBold)
        writeCenter(formatDateId(sig2.signed_at), 298.0, 469 + d, 6, fontRegular, COLOR_MUTED)
      }

      if (sig3 && sig3.status === 'approved') {
        const qrUrl = `${verifyUrl}&step=3&code=${sig3.verification_code || ''}`
        await stampQr(qrUrl, 467.0 - qrSize / 2, 486 + d, qrSize)
        writeCenter(sig3.approver_name.slice(0, 16), 467.0, 477 + d, 7, fontBold)
        writeCenter(formatDateId(sig3.signed_at), 467.0, 469 + d, 6, fontRegular, COLOR_MUTED)
      }
    }
  }

  // -------------------------------------------------------------
  // FORM 5: ISMS-F-03-00-003 (Company Network Connection)
  // -------------------------------------------------------------
  else if (sub.form_code === 'ISMS-F-03-00-003') {
    write(`No: ${sub.request_no}`, 430, 740, 7.5, fontBold, COLOR_RED)
    write(formatDateId(sub.request_date), 225, 685, 9, fontBold)
    write(sub.applicant_name, 225, 655, 9, fontBold)
    write(sub.company_name || 'PT. Jatim Autocomp Indonesia', 225, 625, 9)
    write(formatDeptSection(sub.department, formData.section), 225, 595, 9)

    // Connection Periode: isi tepat pada slot "FROM: dd / mm /20yy ~ TO: dd / mm /20yy"
    const rawFrom = formData.period_from || formData.start_date || sub.request_date
    const rawTo = formData.period_to || formData.end_date || rawFrom
    const fromParts = parseDateParts(rawFrom)
    const toParts = parseDateParts(rawTo)

    if (fromParts) {
      writeCenter(fromParts.dd, 255.0, 556.0, 8.5, fontBold)
      writeCenter(fromParts.mm, 281.5, 556.0, 8.5, fontBold)
      write(fromParts.yy, 310.5, 556.0, 8.5, fontBold)
    }
    if (toParts) {
      writeCenter(toParts.dd, 374.5, 556.4, 8.5, fontBold)
      writeCenter(toParts.mm, 401.0, 556.4, 8.5, fontBold)
      write(toParts.yy, 430.0, 556.4, 8.5, fontBold)
    }

    write(formData.location || '-', 225, 535, 9)

    // Purpose checkboxes (kotak □ berada pada x=228.7)
    const hasAnyPurposeFlag =
      Boolean(formData.purpose_internet) ||
      Boolean(formData.purpose_email) ||
      Boolean(formData.purpose_web) ||
      Boolean(formData.purpose_ftp) ||
      Boolean(formData.purpose_others)

    if (formData.purpose_internet || !hasAnyPurposeFlag) tick(229, 511)
    if (formData.purpose_email) tick(229, 496)
    if (formData.purpose_web) tick(229, 481)
    if (formData.purpose_ftp) tick(229, 466)
    const othersText =
      typeof formData.purpose_others === 'string' && formData.purpose_others.trim()
        ? formData.purpose_others.trim()
        : !hasAnyPurposeFlag && sub.purpose
        ? sub.purpose.trim()
        : ''
    if (othersText) {
      tick(229, 451)
      write(othersText.slice(0, 26), 325, 451.5, 8)
    }

    // IT Check items:
    // 1. IS ANTI-VIRUS INSTALLED? ("YES" di x=405.7, "NO" di x=481.2, y=353.3)
    const avInstalled =
      formData.antivirus_installed !== false &&
      String(formData.antivirus_installed).toLowerCase() !== 'tidak' &&
      String(formData.antivirus_installed).toLowerCase() !== 'no'
    if (avInstalled) {
      tick(392, 355) // Tepat di sebelah kiri kata YES agar tidak menabrak huruf Y
    } else {
      tick(468, 355) // Tepat di sebelah kiri kata NO
    }

    // 2. ANTI-VIRUS SOFTWARE NAME?
    write(formData.antivirus_name || 'Windows Security / Defender', 355, 311, 8.5)

    // 3. SOFTWARE VERSION & VIRUS DEFINITION LAST UPDATE? (tanda "/" tercetak di x=456.9, y=277.3)
    let swVersion = String(formData.antivirus_version || 'Terbaru').trim()
    let defUpdate = String(formData.virus_definition_update || '').trim()
    if (!defUpdate && swVersion.includes('/')) {
      const parts = swVersion.split('/')
      swVersion = parts[0].trim()
      defUpdate = parts.slice(1).join('/').trim()
    }
    if (!defUpdate) {
      const avUpd = String(formData.antivirus_updated || 'Ya').toLowerCase()
      defUpdate = avUpd === 'tidak' || avUpd === 'no' ? 'Belum Update' : formatDateId(sub.request_date)
    }
    write(swVersion.slice(0, 18), 355, 280, 8)
    write(defUpdate.slice(0, 16), 466, 280, 8)

    // 4. OPERATING SYSTEM INFORMATION
    const macPart = formData.mac_address ? ` | MAC: ${formData.mac_address}` : ''
    const osWithMac = `${formData.os_info || 'Windows 11 Pro 64-bit'}${macPart}`
    write(osWithMac.slice(0, 48), 355, 250, formData.mac_address ? 7.5 : 8.5)

    // 5. NETWORK SETTING INFORMATION BEFORE CONNECTION ("DHCP" di x=387.6, "STATIC" di x=476.3, y=217.6)
    if (formData.ip_mode === 'static') {
      tick(463, 219) // Tepat di sebelah kiri STATIC
    } else {
      tick(374, 219) // Tepat di sebelah kiri DHCP agar tidak menabrak huruf D
    }

    // IP Address (assigned by IT during IT Check or static)
    const effectiveIp = formData.assigned_ip || formData.static_ip || formData.ip_address || ''
    if (effectiveIp) {
      write(effectiveIp, 225, 196.8, 8.5, fontBold)
    }

    if (formData.static_subnet) {
      write(formData.static_subnet, 225, 181.8, 8.5)
    }
    if (formData.static_gateway) {
      write(formData.static_gateway, 225, 166.8, 8.5)
    }
    if (formData.dns_priority) {
      write(formData.dns_priority, 225, 151.8, 8.5)
    }
    if (formData.dns_secondary) {
      write(formData.dns_secondary, 225, 136.8, 8.5)
    }

    // Always stamp MAC Address prominently in the OTHERS (proxy, etc.) line
    if (formData.mac_address) {
      write(`MAC: ${formData.mac_address}`, 225, 121.8, 8, fontBold)
    }

    // Selalu tutup tulisan bawaan template "TEGUH SUNJOYO" pada y=77.4 (di bawah garis y=85)
    // tanpa menyentuh garis tabel horizontal (y=85) agar tidak muncul sebelum di-approve IAA!
    page.drawRectangle({
      x: 465,
      y: 73.5,
      width: 90,
      height: 10.5,
      color: rgb(1, 1, 1),
    })

    // Approvals: IT SECTION CHECK (centerX=411.5) & APPROVAL IAA (centerX=510.5)
    // Area kotak tanda tangan berada di antara y=86 s/d y=175
    const sigIt = signatures.find(
      (s) =>
        s.slot_label.toUpperCase().includes('CHECK') ||
        s.slot_label.toUpperCase().includes('CEK') ||
        s.role_title.toUpperCase().includes('IT SECTION') ||
        s.role_title.toUpperCase().includes('SECURITY')
    )

    const sigIaa = signatures.find(
      (s) =>
        s.id !== sigIt?.id &&
        (s.slot_label.toUpperCase().includes('APPROV') ||
          s.slot_label.toUpperCase().includes('SETUJU') ||
          s.role_title.toUpperCase().includes('INFORMATION') ||
          s.role_title.toUpperCase().includes('IAA') ||
          s.approver_name.toUpperCase().includes('TEGUH'))
    )

    const qrSize = 36

    if (sigIt && sigIt.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=${sigIt.step_number}&code=${sigIt.verification_code || ''}`
      await stampQr(qrUrl, 411.5 - qrSize / 2, 127, qrSize)
      writeCenter('E-SIGN VERIFIED', 411.5, 116, 6, fontBold, COLOR_RED)
      writeCenter(sigIt.approver_name.slice(0, 18), 411.5, 105, 7, fontBold, COLOR_INK)
      writeCenter(formatDateId(sigIt.signed_at), 411.5, 94, 6, fontRegular, COLOR_MUTED)
    }

    if (sigIaa && sigIaa.status === 'approved') {
      const qrUrl = `${verifyUrl}&step=${sigIaa.step_number}&code=${sigIaa.verification_code || ''}`
      await stampQr(qrUrl, 510.5 - qrSize / 2, 127, qrSize)
      writeCenter('E-SIGN VERIFIED', 510.5, 116, 6, fontBold, COLOR_RED)
      writeCenter(sigIaa.approver_name.slice(0, 18), 510.5, 105, 7, fontBold, COLOR_INK)
      writeCenter(formatDateId(sigIaa.signed_at), 510.5, 94, 6, fontRegular, COLOR_MUTED)
    }
  }

  return pdf.save()
}

/**
 * Stamps fingerprint data onto a single-copy extracted PDF page (612x396 with 0,0 origin).
 * Guarantees 100% viewer compatibility without double copies or MediaBox offset bugs.
 */
async function stampFingerprintTemplate(
  sub: ItFormSubmission,
  templateBytes: Buffer,
  verifyUrl: string
): Promise<Uint8Array> {
  const srcPdf = await PDFDocument.load(templateBytes)
  const dstPdf = await PDFDocument.create()

  // Extract only the top single copy of the form [left=0, bottom=396, right=612, top=792]
  const [embeddedTop] = await dstPdf.embedPages(
    [srcPdf.getPage(0)],
    [{ left: 0, bottom: 396, right: 612, top: 792 }]
  )
  const page = dstPdf.addPage([612, 396])
  page.drawPage(embeddedTop, { x: 0, y: 0, width: 612, height: 396 })

  const fontRegular = await dstPdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await dstPdf.embedFont(StandardFonts.HelveticaBold)
  const fontOblique = await dstPdf.embedFont(StandardFonts.HelveticaOblique)

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

  const writeCenter = (
    val: string,
    centerX: number,
    y: number,
    size = 8.5,
    font = fontRegular,
    color = COLOR_INK
  ) => {
    if (!val) return
    const textW = font.widthOfTextAtSize(safeText(val), size)
    page.drawText(safeText(val), { x: centerX - textW / 2, y, size, font, color })
  }

  const stampQr = async (
    qrContent: string,
    x: number,
    y: number,
    size = 40
  ) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(qrContent, {
        margin: 1,
        width: size * 2,
        errorCorrectionLevel: 'M',
      })
      const qrBase64 = qrDataUrl.split(',')[1]
      const qrImage = await dstPdf.embedPng(Buffer.from(qrBase64, 'base64'))
      page.drawImage(qrImage, { x, y, width: size, height: size })
    } catch (e) {
      console.error('Failed to stamp QR code:', e)
    }
  }

  const CENTER_COL2 = 412.6 // Center of "Tanda tangan" column
  const CENTER_COL3 = 513.8 // Center of "MENYETUJUI" and "Kode ID" column

  // Coordinates shifted down by 396 for the single-form page:
  // No. Reg: y = 701 - 396 = 305 (x = 443)
  write(`No. Reg : ${sub.request_no}`, 443, 305, 7.5, fontBold, COLOR_RED)

  // Tanggal Pengajuan: y = 655 - 396 = 259 (x = 232)
  write(formatDateId(sub.request_date), 232, 259, 8.5, fontBold)

  // Kode ID: y = 630 - 396 = 234 (centered in Col 3)
  const kodeIdVal = (formData.fingerprint_id?.trim() || sub.applicant_nik || '-').toUpperCase()
  writeCenter(kodeIdVal, CENTER_COL3, 234, 8.5, fontBold)

  // Data Pemohon
  write(sub.applicant_name, 232, 230, 8.5, fontBold) // y = 626 - 396 = 230
  write(sub.applicant_nik || '-', 232, 201, 8.5, fontBold) // y = 597 - 396 = 201

  // Tanggal Menyetujui (/ /20): y = 582.1 - 396 = 186.1
  const sig = signatures.find((s) => s.step_number === 1) || signatures[0]
  const effDate = sig?.signed_at ? new Date(sig.signed_at) : sub.request_date ? new Date(sub.request_date) : null
  if (effDate && !Number.isNaN(effDate.getTime())) {
    const dd = String(effDate.getDate()).padStart(2, '0')
    const mm = String(effDate.getMonth() + 1).padStart(2, '0')
    const yy = String(effDate.getFullYear()).slice(-2)
    write(dd, 480, 186.1, 8, fontBold)
    write(mm, 506, 186.1, 8, fontBold)
    write(yy, 536, 186.1, 8, fontBold)
  }

  // Department & Section combined: y = 568 - 396 = 172
  const deptFull = formatDeptSection(sub.department, formData.section)
  write(deptFull.slice(0, 44), 232, 172, 8.5, fontBold)

  // Area Special Security: y = 540 - 396 = 144
  const areaText = formData.area_special_security || sub.purpose || 'Ruang Server / Server Room'
  write(areaText.slice(0, 40), 232, 144, 8, fontBold)

  // Tanggal Penghapusan Akses: y = 432.2 - 396 = 36.2
  const rawDel = formData.access_deletion_date
  const delDateStr = rawDel && rawDel !== 'Invalid Date' && rawDel !== 'null' && rawDel !== 'undefined'
    ? formatDateId(rawDel)
    : 'Sesuai Masa Penugasan'
  write(delDateStr, 280, 36.2, 8, fontBold)

  // =============================================================
  // COLUMN 2: PARAF / TANDA TANGAN PEMOHON (KOMITMEN AREA SPECIAL)
  // Perfectly centered at CENTER_COL2 = 412.6
  // =============================================================
  writeCenter('PARAF PEMOHON', CENTER_COL2, 97, 7, fontBold, rgb(0.08, 0.52, 0.25))

  // Applicant Name with clean signature underline
  const appName = sub.applicant_name || 'Pemohon'
  writeCenter(appName, CENTER_COL2, 79, 9.5, fontBold, COLOR_INK)
  const nameW = fontBold.widthOfTextAtSize(safeText(appName), 9.5)
  const lineHalfW = Math.min(Math.max(nameW / 2 + 10, 28), 50)
  page.drawLine({
    start: { x: CENTER_COL2 - lineHalfW, y: 74 },
    end: { x: CENTER_COL2 + lineHalfW, y: 74 },
    thickness: 0.75,
    color: COLOR_LINE,
  })

  // NIK & Tanggal Pengajuan (safely padded above the 45pt bottom border)
  writeCenter(`NIK: ${sub.applicant_nik || '-'}`, CENTER_COL2, 62, 7, fontRegular, COLOR_MUTED)
  writeCenter(`Tgl: ${formatDateId(sub.request_date)}`, CENTER_COL2, 52, 6.5, fontRegular, COLOR_MUTED)

  // =============================================================
  // COLUMN 3: MENYETUJUI / E-SIGN VERIFIED (IAA)
  // Perfectly centered at CENTER_COL3 = 513.8
  // =============================================================
  // Cover pre-printed "Teguh Sunjoyo" so actual approver name replaces it cleanly
  page.drawRectangle({
    x: 468,
    y: 83,
    width: 92,
    height: 17,
    color: rgb(1, 1, 1),
  })

  if (sig && sig.status === 'approved') {
    const qrUrl = `${verifyUrl}&step=1&code=${sig.verification_code || ''}`
    const qrSize = 38
    const qrX = CENTER_COL3 - qrSize / 2 // 513.8 - 19 = 494.8

    writeCenter('E-SIGN VERIFIED', CENTER_COL3, 140, 6.5, fontBold, COLOR_RED)
    await stampQr(qrUrl, qrX, 98, qrSize)
    writeCenter(sig.approver_name || 'Teguh Sunjoyo', CENTER_COL3, 87, 7.5, fontBold)
  } else {
    writeCenter('[ MENUNGGU PERSETUJUAN ]', CENTER_COL3, 105, 6.5, fontOblique, COLOR_MUTED)
    writeCenter('Teguh Sunjoyo (IAA)', CENTER_COL3, 87, 7, fontRegular, COLOR_MUTED)
  }

  return dstPdf.save()
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
  const formData = (typeof sub.form_data === 'string' ? JSON.parse(sub.form_data) : sub.form_data) || {}

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
  try {
    const logoBytes = await readFile(path.join(process.cwd(), 'public', 'images', 'yazaki-logo.jpg'))
    const logoImg = await pdf.embedJpg(logoBytes)
    const logoH = 26
    const logoW = (logoImg.width / logoImg.height) * logoH
    page.drawImage(logoImg, { x: leftX, y: y - 10, width: logoW, height: logoH })
  } catch {
    text('YAZAKI', leftX, y, 16, fontBold, COLOR_RED)
    text('PT. JATIM AUTOCOMP INDONESIA', leftX, y - 9, 7.5, fontBold, COLOR_INK)
  }

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
  text(`Departemen: ${formatDeptSection(sub.department, formData.section)}`, leftX + 8, y - 62, 8.5)
  text(`Tanggal Pengajuan: ${formatDateId(sub.request_date)}`, leftX + 8, y - 78, 8.5)

  y -= 118
  if (sub.notes) {
    text('Catatan:', leftX, y, 8, fontBold, COLOR_INK)
    const noteLines = wrapTextToRuledLines(sub.notes, fontRegular, 8, W - 60, 4)
    for (let i = 0; i < noteLines.length; i++) {
      text(noteLines[i], leftX + 45, y - i * 11, 8, fontRegular, COLOR_INK)
    }
    y -= Math.max(0, (noteLines.length - 1) * 11)
  } else {
    text('Catatan: -', leftX, y, 8, fontOblique, COLOR_MUTED)
  }

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
