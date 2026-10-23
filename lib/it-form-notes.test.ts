import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { buildItFormPdf } from './it-form-pdf'
import type { ItFormSubmission } from './it-form-service'

describe('IT Form Notes Formatting & Ruled Underlines Stamping', () => {
  const baseSub: ItFormSubmission = {
    id: 99,
    request_no: 'REQ-010003-20261023-9999',
    form_code: 'ISMS-F-010-003',
    form_name: 'Formulir Pengadaan Software',
    request_date: '2026-10-23',
    applicant_name: 'Budi Santoso',
    applicant_nik: 'NIK-12345',
    applicant_position: 'Staff IT',
    employee_status: 'TETAP',
    department: 'Information Technology',
    company_name: 'PT. JATIM AUTOCOMP INDONESIA',
    purpose: 'Kebutuhan Project & Desain',
    form_data: {
      software_list: ['SolidWorks 2024', 'AutoCAD 2024'],
      jenis_pengadaan: 'baru',
      maker: 'Dell',
      model_type: 'Precision 3660',
      serial_no: 'SN998877',
      asset_no: 'AST-2024-001',
      os_info: 'Windows 11 Pro',
      pc_name: 'PC-DESAIN-01',
      login_username: 'budi.s',
      function_purpose: 'Desain 3D CAD'
    },
    status: 'pending',
    current_step: 1,
    total_steps: 2,
    token: 'test-token-notes',
    notes: '',
    created_at: '2026-10-23T07:00:00Z',
    updated_at: '2026-10-23T07:00:00Z',
    signatures: []
  }

  it('renders neatly with multi-preset concatenated notes across ruled lines', async () => {
    const subWithPresets: ItFormSubmission = {
      ...baseSub,
      notes: 'Karyawan Baru Masuk Kerja. Penggantian Unit Lama Rusak/Usang. Kebutuhan Project & Desain. Audit Keamanan & Penertiban Akses'
    }
    const pdfBytes = await buildItFormPdf(subWithPresets, 'http://localhost:3009/form-it-esign?token=test-token-notes')
    expect(pdfBytes).toBeDefined()
    expect(pdfBytes.length).toBeGreaterThan(1000)
    expect(Buffer.from(pdfBytes.slice(0, 5)).toString()).toBe('%PDF-')
  })

  it('renders neatly for ISMS-F-010-001 with 4-line ruled space', async () => {
    const subPc: ItFormSubmission = {
      ...baseSub,
      form_code: 'ISMS-F-010-001',
      form_name: 'Formulir Pengadaan PC / Laptop',
      notes: '1. Penggantian PC rusak di jalur produksi.\n2. Butuh spesifikasi dengan RAM 16GB dan SSD 512GB.\n3. Disetujui oleh Section Head.'
    }
    const pdfBytes = await buildItFormPdf(subPc, 'http://localhost:3009/form-it-esign?token=test-token-notes')
    expect(pdfBytes).toBeDefined()
    expect(pdfBytes.length).toBeGreaterThan(1000)
  })

  it('renders neatly for ISMS-F-010-006 with dual copy (Top & Bottom)', async () => {
    const subEmail: ItFormSubmission = {
      ...baseSub,
      form_code: 'ISMS-F-010-006',
      form_name: 'Formulir Pembuatan Email & User ID',
      notes: 'Karyawan baru departemen Produksi butuh email dan login domain Windows'
    }
    const pdfBytes = await buildItFormPdf(subEmail, 'http://localhost:3009/form-it-esign?token=test-token-notes')
    expect(pdfBytes).toBeDefined()
    expect(pdfBytes.length).toBeGreaterThan(1000)
  })

  it('handles empty or null notes without throwing errors', async () => {
    const subNull: ItFormSubmission = {
      ...baseSub,
      notes: null
    }
    const pdfBytes = await buildItFormPdf(subNull, 'http://localhost:3009/form-it-esign?token=test-token-notes')
    expect(pdfBytes).toBeDefined()
    expect(pdfBytes.length).toBeGreaterThan(1000)
  })
})
