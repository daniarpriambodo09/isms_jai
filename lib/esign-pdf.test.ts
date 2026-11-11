import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { buildEsignPdf, type EsignRequestData } from './esign-pdf'
import { PDFDocument } from 'pdf-lib'

describe('Esign PDF Generator (Visitor & Internal Karyawan)', () => {
  const baseData: EsignRequestData = {
    id: 1,
    requesterName: 'Ahmad Dahlan',
    deptOrCompany: 'PT. Vendor Indonesia',
    dept: 'Vendor Services',
    fromAt: '2026-11-15T08:00:00Z',
    toAt: '2026-11-15T17:00:00Z',
    location: 'Genba Produksi 2',
    objective: 'Dokumentasi Mesin Baru',
    status: 'approved',
    decidedAt: '2026-11-14T10:00:00Z',
    approverFullName: 'Teguh Sunjoyo',
    approverTitle: 'Information Assets Administrator',
    verificationCode: 'JAI-1-ABCD1234',
    submittedAt: '2026-11-13T09:00:00Z',
    cameraSerialNo: 'SN-CANON-9988',
    cameraControlNo: null,
  }

  it('generates cropped visitor photo/video e-sign PDF', async () => {
    const pdfBytes = await buildEsignPdf(
      { ...baseData, requestType: 'visitor' },
      'http://localhost:3009/isms-jai/verifikasi/1?code=JAI-1-ABCD1234'
    )
    expect(pdfBytes).toBeDefined()
    expect(pdfBytes.length).toBeGreaterThan(1000)
    expect(Buffer.from(pdfBytes.slice(0, 5)).toString()).toBe('%PDF-')

    const doc = await PDFDocument.load(pdfBytes)
    expect(doc.getPageCount()).toBe(1)
    const page = doc.getPage(0)
    const { width, height } = page.getSize()
    expect(Math.round(width)).toBe(595)
    // Cropped top copy height ~409
    expect(Math.round(height)).toBe(409)
  })

  it('generates cropped internal employee (karyawan) photo/video e-sign PDF', async () => {
    const pdfBytes = await buildEsignPdf(
      {
        ...baseData,
        requestType: 'internal',
        nik: 'NIK-445566',
        requesterName: 'Naufal Aqil',
        dept: 'Information Technology',
        cameraControlNo: 'CAM-01',
        cameraSerialNo: null,
      },
      'http://localhost:3009/isms-jai/verifikasi/1?code=JAI-1-ABCD1234'
    )
    expect(pdfBytes).toBeDefined()
    expect(pdfBytes.length).toBeGreaterThan(1000)
    expect(Buffer.from(pdfBytes.slice(0, 5)).toString()).toBe('%PDF-')

    const doc = await PDFDocument.load(pdfBytes)
    expect(doc.getPageCount()).toBe(1)
    const page = doc.getPage(0)
    const { width, height } = page.getSize()
    expect(Math.round(width)).toBe(595)
    expect(Math.round(height)).toBe(409)
  })
})
