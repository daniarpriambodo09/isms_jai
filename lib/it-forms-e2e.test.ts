import { describe, it, expect, vi } from 'vitest'

// Mock 'server-only' so vitest can run server-side modules
vi.mock('server-only', () => ({}))

import { IT_FORM_DEFINITIONS } from './it-form-shared'
import { buildItFormPdf } from './it-form-pdf'
import { buildItEquipmentPdf } from './it-equipment-pdf'
import type { ItEquipmentRequest } from './it-equipment-shared'
import type { ItFormSubmission } from './it-form-service'

describe('IT Forms and E-Sign System Verification', () => {
  it('has all 7 IT form definitions configured', () => {
    expect(IT_FORM_DEFINITIONS.length).toBe(7)
    const codes = IT_FORM_DEFINITIONS.map(d => d.code)
    expect(codes).toContain('ISMS-F-010-001')
    expect(codes).toContain('ISMS-F-010-003')
    expect(codes).toContain('ISMS-F-010-006')
    expect(codes).toContain('ISMS-F-010-007')
    expect(codes).toContain('ISMS-F-03-00-003')
    expect(codes).toContain('ISMS-F-03-00-001')
    expect(codes).toContain('ISMS-F-02-00-002')
  })

  it('generates IT Equipment IN PDF (ISMS-F-03-00-001) successfully', async () => {
    const mockIn: ItEquipmentRequest = {
      id: 1,
      request_no: 'REQ-EQ-20261020-001',
      form_type: 'in',
      request_date: '2026-10-20',
      company_name: 'PT. Mitra Solusi',
      applicant_name: 'Budi Hartono',
      department: 'Engineering',
      location: 'Server Room',
      purpose: 'Pemeliharaan server dan switch',
      date_in: '2026-10-20',
      date_out_plan: '2026-10-25',
      agree_rules: true,
      items: [
        { equipment_type: 'Laptop / PC', brand: 'Dell', model: 'Latitude 5520', serial_no: 'DL889911', id_no: 'ID-001' },
        { equipment_type: 'Flashdisk / HDD', brand: 'Kingston', model: 'DataTraveler 32GB', serial_no: 'KT2233', id_no: 'ID-002' }
      ],
      status: 'approved',
      return_check_items: false,
      return_check_confidential: false,
      approved_by: 'IT Security Administrator',
      approved_title: 'System Security Administrator (IT)',
      approved_at: '2026-10-20T07:45:00Z',
      approval_code: 'ESIGN-EQ',
      token: 'tok-eq-in-123',
      created_at: '2026-10-20T07:00:00Z',
      updated_at: '2026-10-20T07:45:00Z'
    }

    const pdfBytes = await buildItEquipmentPdf(mockIn, 'https://isms.jai.co.id/api/it-equipment-requests/1/verify?t=tok-eq-in-123')
    expect(pdfBytes).toBeDefined()
    expect(pdfBytes.length).toBeGreaterThan(1000)
    // Check PDF magic bytes "%PDF-"
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString()
    expect(header).toBe('%PDF-')
  })

  it('generates IT Equipment OUT PDF (ISMS-F-03-00-002) successfully', async () => {
    const mockOut: ItEquipmentRequest = {
      id: 2,
      request_no: 'REQ-EQ-20261020-002',
      form_type: 'out',
      request_date: '2026-10-20',
      company_name: 'PT. JATIM AUTOCOMP INDONESIA',
      applicant_name: 'Siti Aminah',
      applicant_nik: 'JAI-12345',
      department: 'Quality Assurance',
      section: 'QA Testing',
      location: 'Plant Pasuruan',
      purpose: 'Pengujian QA di Plant Pasuruan',
      date_in: '2026-10-20',
      date_out_plan: '2026-10-22',
      agree_rules: true,
      items: [
        { equipment_type: 'Laptop / PC', brand: 'ThinkPad', model: 'T14s', serial_no: 'TP99881', id_no: 'ASSET-01' }
      ],
      status: 'approved',
      return_check_items: false,
      return_check_confidential: false,
      approved_by: 'IT Security Administrator',
      approved_title: 'System Security Administrator (IT)',
      approved_at: '2026-10-20T08:30:00Z',
      approval_code: 'ESIGN-EQ',
      token: 'tok-eq-out-456',
      created_at: '2026-10-20T08:00:00Z',
      updated_at: '2026-10-20T08:30:00Z'
    }

    const pdfBytes = await buildItEquipmentPdf(mockOut, 'https://isms.jai.co.id/api/it-equipment-requests/2/verify?t=tok-eq-out-456')
    expect(pdfBytes).toBeDefined()
    expect(pdfBytes.length).toBeGreaterThan(1000)
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString()
    expect(header).toBe('%PDF-')
  })

  it('generates IT Equipment OUT PDF (ISMS-F-03-00-002) returned / closed with all 3 return signatures', async () => {
    const mockReturnedOut: ItEquipmentRequest = {
      id: 3,
      request_no: 'REQ-EQ-20261020-003',
      form_type: 'out',
      request_date: '2026-10-20',
      company_name: 'PT. JATIM AUTOCOMP INDONESIA',
      applicant_name: 'Siti Aminah',
      applicant_nik: 'JAI-12345',
      department: 'Quality Assurance',
      section: 'QA Testing',
      location: 'Plant Pasuruan',
      purpose: 'Pengujian QA di Plant Pasuruan',
      date_in: '2026-10-20',
      date_out_plan: '2026-10-22',
      agree_rules: true,
      items: [
        { equipment_type: 'Laptop / PC', brand: 'ThinkPad', model: 'T14s', serial_no: 'TP99881', id_no: 'ASSET-01' }
      ],
      status: 'returned',
      return_check_items: true,
      return_check_confidential: true,
      approved_by: 'TEGUH SUNJOYO',
      approved_title: 'Manager Departemen / IAA',
      approved_at: '2026-10-20T08:30:00Z',
      it_checked_by: 'Budi Santoso',
      it_checked_title: 'System Security Administrator (IT)',
      it_checked_at: '2026-10-22T16:00:00Z',
      returned_at: '2026-10-22T16:00:00Z',
      returned_checked_by: 'Budi Santoso',
      returned_notes: 'Perangkat kembali utuh, diverifikasi bebas virus, dan disimpan oleh IT.',
      approval_code: 'ESIGN-EQ-003',
      token: 'tok-eq-out-ret-789',
      created_at: '2026-10-20T08:00:00Z',
      updated_at: '2026-10-22T16:00:00Z'
    }

    const pdfBytes = await buildItEquipmentPdf(mockReturnedOut, 'https://isms.jai.co.id/api/it-equipment-requests/3/verify?t=tok-eq-out-ret-789')
    expect(pdfBytes).toBeDefined()
    expect(pdfBytes.length).toBeGreaterThan(1000)
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString()
    expect(header).toBe('%PDF-')
  })

  const formCodes = [
    'ISMS-F-010-001',
    'ISMS-F-010-003',
    'ISMS-F-010-006',
    'ISMS-F-010-007',
    'ISMS-F-03-00-003',
    'ISMS-F-02-00-002'
  ]

  for (const formCode of formCodes) {
    it(`generates official stamped PDF for ${formCode} with E-Sign stamps & QR`, async () => {
      const mockSub: ItFormSubmission = {
        id: 100,
        request_no: `REQ-${formCode.slice(-6)}-20261020-1111`,
        form_code: formCode,
        form_name: 'Form ' + formCode,
        request_date: '2026-10-20',
        applicant_name: 'Fajar Nugraha',
        applicant_nik: 'NIK-09882',
        applicant_position: 'Supervisor IT',
        employee_status: 'TETAP',
        department: 'Information Technology',
        company_name: 'PT. JATIM AUTOCOMP INDONESIA',
        purpose: 'Pengajuan resmi kebutuhan operasional ISO 27001',
        form_data: {
          maker: 'Lenovo',
          model_type: 'ThinkPad L14 Gen 4',
          os_info: 'Windows 11 Enterprise 64-bit',
          software_list: ['MS Office 365', 'AutoCAD 2024', 'SAP GUI', '7-Zip'],
          jenis_pengadaan: 'baru',
          old_pc_name: 'PC-OLD-01',
          login_username: 'fajar.nugraha',
          function_purpose: 'Operasional Kantor & Programming',
          request_email: true,
          change_email: false,
          request_user_id: true,
          change_user_id: false,
          delete_email: true,
          delete_user_id: true,
          email_target: 'fajar.nugraha@jai.co.id',
          user_id_target: 'fnugraha',
          period_from: '2026-10-20',
          period_to: '2026-12-31',
          location: 'Gedung A Lantai 2',
          purpose_internet: true,
          purpose_email: true,
          purpose_web: true,
          antivirus_installed: true,
          antivirus_name: 'Trend Micro Apex One',
          antivirus_version: '14.0.11921',
          ip_mode: 'static',
          static_ip: '192.168.20.55',
          static_subnet: '255.255.255.0',
          static_gateway: '192.168.20.1',
          dns_priority: '192.168.1.1',
          dns_secondary: '1.1.1.1'
        },
        status: 'approved',
        current_step: 3,
        total_steps: 3,
        token: `token-verify-${formCode}`,
        notes: 'Semua persyaratan dipenuhi.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        signatures: [
          {
            id: 1,
            submission_id: 100,
            step_number: 1,
            slot_label: 'CEK IT',
            role_title: 'IT Section',
            approver_name: 'IT Security Specialist',
            approver_email: 'it.sec@jai.co.id',
            status: 'approved',
            verification_code: 'ESIGN-01',
            signed_at: '2026-10-20T08:15:00Z',
            signature_note: 'Verified OK',
            created_at: '2026-10-20T08:00:00Z',
            updated_at: '2026-10-20T08:15:00Z'
          },
          {
            id: 2,
            submission_id: 100,
            step_number: 2,
            slot_label: 'MENGETAHUI',
            role_title: 'IR / HR Section',
            approver_name: 'IR Supervisor',
            approver_email: 'ir@jai.co.id',
            status: 'approved',
            verification_code: 'ESIGN-02',
            signed_at: '2026-10-20T08:25:00Z',
            signature_note: 'Acknowledged',
            created_at: '2026-10-20T08:00:00Z',
            updated_at: '2026-10-20T08:25:00Z'
          },
          {
            id: 3,
            submission_id: 100,
            step_number: 3,
            slot_label: 'MENYETUJUI',
            role_title: 'Departemen Manager',
            approver_name: 'Bapak Manager Dept',
            approver_email: 'dept.mgr@jai.co.id',
            status: 'approved',
            verification_code: 'ESIGN-03',
            signed_at: '2026-10-20T08:35:00Z',
            signature_note: 'Approved',
            created_at: '2026-10-20T08:00:00Z',
            updated_at: '2026-10-20T08:35:00Z'
          }
        ]
      }

      const verifyUrl = `https://isms.jai.co.id/api/it-form-submissions/100/verify?token=${mockSub.token}`
      const pdfBytes = await buildItFormPdf(mockSub, verifyUrl)
      expect(pdfBytes).toBeDefined()
      expect(pdfBytes.length).toBeGreaterThan(1000)
      const header = Buffer.from(pdfBytes.slice(0, 5)).toString()
      expect(header).toBe('%PDF-')
    })
  }

  it('renders ISMS-F-03-00-003 with IAA Step 1 approval and IT Check Step 2 plus virus definition update', async () => {
    const mockSub: ItFormSubmission = {
      id: 200,
      request_no: 'ISMS-NET-2026-0001',
      form_code: 'ISMS-F-03-00-003',
      form_name: 'Company Network Connection Application Form',
      request_date: '2026-10-27',
      applicant_name: 'Budi Santoso',
      applicant_nik: null,
      applicant_position: null,
      employee_status: 'Permanent',
      department: 'Engineering Section',
      company_name: 'PT. Jatim Autocomp Indonesia',
      purpose: 'Koneksi laptop perbaikan mesin',
      form_data: {
        period_from: '2026-10-27',
        period_to: '2026-10-28',
        location: 'Ruang Server & Produksi',
        purpose_internet: true,
        purpose_email: false,
        purpose_web: true,
        antivirus_installed: true,
        antivirus_name: 'Trend Micro Apex One',
        antivirus_version: 'v14.0.1192',
        virus_definition_update: '2026-10-27',
        os_info: 'Windows 11 Pro 64-bit',
        mac_address: '00:1A:2B:3C:4D:5E',
        ip_mode: 'dhcp',
        assigned_ip: '192.168.10.150'
      },
      status: 'approved',
      current_step: 2,
      total_steps: 2,
      token: 'token-verify-net-003',
      notes: 'Disetujui untuk koneksi jaringan sementara.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      signatures: [
        {
          id: 201,
          submission_id: 200,
          step_number: 1,
          slot_label: 'APPROVAL',
          role_title: 'Information Assets Administrator',
          approver_name: 'TEGUH SUNJOYO',
          approver_email: 'teguh.sunjoyo@jai.co.id',
          status: 'approved',
          verification_code: 'ESIGN-IAA-01',
          signed_at: '2026-10-27T08:30:00Z',
          signature_note: 'Approved',
          created_at: '2026-10-27T08:00:00Z',
          updated_at: '2026-10-27T08:30:00Z'
        },
        {
          id: 202,
          submission_id: 200,
          step_number: 2,
          slot_label: 'IT SECTION CHECK',
          role_title: 'IT Section / System Security Admin',
          approver_name: 'IT Security Admin',
          approver_email: 'it.security@jai.co.id',
          status: 'approved',
          verification_code: 'ESIGN-IT-02',
          signed_at: '2026-10-27T09:00:00Z',
          signature_note: 'Security Check Verified OK',
          created_at: '2026-10-27T08:00:00Z',
          updated_at: '2026-10-27T09:00:00Z'
        }
      ]
    }

    const verifyUrl = `https://isms.jai.co.id/api/it-form-submissions/200/verify?token=${mockSub.token}`
    const pdfBytes = await buildItFormPdf(mockSub, verifyUrl)
    expect(pdfBytes).toBeDefined()
    expect(pdfBytes.length).toBeGreaterThan(1000)
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString()
    expect(header).toBe('%PDF-')
  })
})
