import { describe, it, expect } from 'vitest'
import {
  buildAccountCreatedEmail,
  buildItFormApprovalEmail,
  buildPhotoRequestAdminEmail,
  buildProcedureApprovalEmail,
  buildSpecialAreaApprovalEmail,
  buildVisitorApprovalEmail,
} from './email-templates'

describe('Account Created Welcome Email', () => {
  it('generates welcome email with credentials, role, and auto-login links', () => {
    const email = buildAccountCreatedEmail({
      email: 'user@example.com',
      username: 'johndoe',
      password: 'SecurePassword123!',
      role: 'it',
      loginUrl: 'http://localhost:3009/login',
      dashboardUrl: 'http://localhost:3009/persetujuan-saya',
    })

    expect(email.subject).toContain('Selamat Datang di Portal ISMS')
    expect(email.html).toContain('johndoe')
    expect(email.html).toContain('SecurePassword123!')
    expect(email.html).toContain('Administrator IT / Layanan IT')
    expect(email.html).toContain('http://localhost:3009/login')
    expect(email.html).toContain('http://localhost:3009/persetujuan-saya')
  })
})

describe('Auto-Login Buttons in Approval Emails', () => {
  it('IT form approval email features 2 auto-login action buttons', () => {
    const email = buildItFormApprovalEmail({
      approverName: 'Pak Budi',
      roleTitle: 'Section Head IT',
      requestNo: 'IT-REQ-2026-001',
      formCode: 'ISMS-F-03-00-003',
      formName: 'Formulir Hak Akses Jaringan & Server',
      applicantName: 'Ahmad Fauzi',
      department: 'Finance',
      employeeStatus: 'Permanen',
      requestDate: '2026-10-22',
      stepNumber: 1,
      totalSteps: 2,
      actionUrl: 'http://localhost:3009/api/auth/approver-token-login?token=abc123token&next=%2Fform-it-esign%3Ftoken%3Dabc123token',
      dashboardUrl: 'http://localhost:3009/api/auth/approver-token-login?token=abc123token&next=%2Fpersetujuan-saya',
    })

    expect(email.html).toContain('Buka di Dashboard Persetujuan Saya (Auto-Login)')
    expect(email.html).toContain('Buka &amp; Tanda Tangani di Halaman Formulir (Auto-Login)')
    expect(email.html).toContain('/api/auth/approver-token-login?token=abc123token')
  })

  it('Procedure approval email features auto-login in direct and dashboard links', () => {
    const email = buildProcedureApprovalEmail({
      approverName: 'Bapak Direktur',
      roleTitle: 'Information Security Manager',
      controlNo: 'ISMS-SOP-01',
      title: 'SOP Manajemen Akses Pengguna',
      revision: 0,
      effDate: '2026-10-22',
      note: null,
      stepNumber: 1,
      stepTotal: 2,
      chain: [],
      reviewUrl: 'http://localhost:3009/api/auth/approver-token-login?token=xyzToken&next=%2Fpengesahan%3Ftoken%3DxyzToken',
      dashboardUrl: 'http://localhost:3009/api/auth/approver-token-login?token=xyzToken&next=%2Fpersetujuan-saya',
    })

    expect(email.html).toContain('REVIEW &amp; SETUJUI DOKUMEN (AUTO-LOGIN)')
    expect(email.html).toContain('Buka via Dashboard')
    expect(email.html).toContain('(Auto-Login)')
    expect(email.html).toContain('/api/auth/approver-token-login?token=xyzToken')
  })

  it('Special Area approval email features direct and dashboard auto-login buttons', () => {
    const email = buildSpecialAreaApprovalEmail({
      approverName: 'Bapak Hendra',
      approverSalutation: 'Bpk',
      requesterName: 'Budi Santoso',
      orgCompany: 'PT Vendor Jaya',
      department: 'Production',
      fromAt: '2026-10-22T08:00:00Z',
      toAt: '2026-10-22T17:00:00Z',
      area: 'Server Room',
      purpose: 'Maintenance rack switch',
      idCardNo: 'CARD-001',
      approveUrl: 'http://localhost:3009/api/auth/approver-token-login?token=tokenSA&next=%2Fpersetujuan-area-special%3Ftoken%3DtokenSA',
      rejectUrl: 'http://localhost:3009/api/auth/approver-token-login?token=tokenSA&next=%2Fpersetujuan-area-special%3Ftoken%3DtokenSA',
      dashboardUrl: 'http://localhost:3009/api/auth/approver-token-login?token=tokenSA&next=%2Fpersetujuan-saya',
    })

    expect(email.html).toContain('Buka di Dashboard Persetujuan Saya (Auto-Login)')
    expect(email.html).toContain('Menyetujui (Auto-Login)')
    expect(email.html).toContain('/api/auth/approver-token-login?token=tokenSA')
  })

  it('Visitor Photo/Video approval email features direct and dashboard auto-login buttons', () => {
    const email = buildVisitorApprovalEmail({
      approverName: 'Bpk. General Manager',
      dept: 'IT Department',
      requesterName: 'Vendor Camera Crew',
      deptOrCompany: 'PT Media Visual',
      picJai: 'Hendri IT',
      fromAt: '2026-10-22T09:00:00Z',
      toAt: '2026-10-22T12:00:00Z',
      location: 'Factory Floor 1',
      objective: 'Dokumentasi Audit',
      approveUrl: 'http://localhost:3009/api/auth/approver-token-login?token=tokenPhoto&next=%2Fkonfirmasi-approval%3Ftoken%3DtokenPhoto',
      rejectUrl: 'http://localhost:3009/api/auth/approver-token-login?token=tokenPhoto&next=%2Fkonfirmasi-approval%3Ftoken%3DtokenPhoto',
      dashboardUrl: 'http://localhost:3009/api/auth/approver-token-login?token=tokenPhoto&next=%2Fpersetujuan-saya',
    })

    expect(email.html).toContain('Buka di Dashboard Persetujuan Saya (Auto-Login)')
    expect(email.html).toContain('Menyetujui (Auto-Login)')
    expect(email.html).toContain('/api/auth/approver-token-login?token=tokenPhoto')
  })

  it('Internal Photo/Video admin email features direct and dashboard auto-login buttons', () => {
    const email = buildPhotoRequestAdminEmail({
      requesterName: 'Ahmad Staff',
      nik: '123456',
      deptOrCompany: 'PGA - IR',
      fromAt: '2026-10-23T08:00:00Z',
      toAt: '2026-10-23T10:00:00Z',
      location: 'Area Produksi 1',
      objective: 'Foto Layout Mesin',
      cameraControlNo: 'CAM-01',
      photoIdNo: 'ID-02',
      picApprove: 'Teguh Sunjoyo',
      reviewUrl: 'http://localhost:3009/kelola-permintaan-foto-video?status=pending&type=internal',
      pendingCount: 1,
      approveUrl: 'http://localhost:3009/api/auth/approver-token-login?token=tokenInternal&next=%2Fkonfirmasi-approval%3Ftoken%3DtokenInternal%26action%3Dapprove',
      rejectUrl: 'http://localhost:3009/api/auth/approver-token-login?token=tokenInternal&next=%2Fkonfirmasi-approval%3Ftoken%3DtokenInternal%26action%3Dreject',
      dashboardUrl: 'http://localhost:3009/api/auth/approver-token-login?token=tokenInternal&next=%2Fpersetujuan-saya',
    })

    expect(email.html).toContain('Buka di Dashboard Persetujuan Saya (Auto-Login)')
    expect(email.html).toContain('Menyetujui (Auto-Login)')
    expect(email.html).toContain('Tolak')
    expect(email.html).toContain('/api/auth/approver-token-login?token=tokenInternal')
  })
})
