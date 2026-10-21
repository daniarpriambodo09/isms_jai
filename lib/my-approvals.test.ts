import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock 'server-only' so vitest can run server-side modules
vi.mock('server-only', () => ({}))

// Mock database query
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

// Mock ensureItFormTables
vi.mock('@/lib/it-form-service', () => ({
  ensureItFormTables: vi.fn().mockResolvedValue(undefined),
}))

// Mock auth
vi.mock('@/lib/auth', () => ({
  getSessionFromRequest: vi.fn(),
}))

import { query } from '@/lib/db'
import {
  listMyApprovals,
  listMyApprovalMessages,
  listMyHistory,
  sessionOwnsStep,
} from './my-approvals'
import { getSessionFromRequest } from '@/lib/auth'

describe('Unified MyApprovals System (Procedure, IT Forms, Special Area, Photo/Video)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sessionOwnsStep', () => {
    it('returns true when session account email matches approver email (case-insensitive and trimmed)', async () => {
      vi.mocked(getSessionFromRequest).mockReturnValue({ sub: 1, role: 'approver' } as any)
      vi.mocked(query).mockResolvedValueOnce({
        rows: [{ id: 1, username: 'tsu', role: 'approver', email: 'teguh.sunjoyo@jai.co.id' }],
      } as any)

      const req = {} as any
      const owns = await sessionOwnsStep(req, '  TEGUH.SUNJOYO@JAI.CO.ID  ')
      expect(owns).toBe(true)
    })

    it('returns false when emails differ or null', async () => {
      vi.mocked(getSessionFromRequest).mockReturnValue({ sub: 1, role: 'approver' } as any)
      vi.mocked(query).mockResolvedValueOnce({
        rows: [{ id: 1, username: 'tsu', role: 'approver', email: 'teguh.sunjoyo@jai.co.id' }],
      } as any)

      const req = {} as any
      expect(await sessionOwnsStep(req, 'other@jai.co.id')).toBe(false)
      expect(await sessionOwnsStep(req, null)).toBe(false)
    })
  })

  describe('listMyApprovals', () => {
    it('aggregates pending, queued, and recent items across all 4 workflows for an approver', async () => {
      const email = 'teguh.sunjoyo@jai.co.id'

      // Mock queries:
      // 1. Procedure approvals query
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 101,
            token: 'tok-proc-1',
            status: 'pending',
            role_code: 'DIR',
            role_title: 'Direktur',
            notified_at: '2026-10-20T08:00:00Z',
            decided_at: null,
            approval_code: '123456',
            approval_code_attempts: 0,
            approver_name: 'Teguh Sunjoyo',
            document_id: 11,
            control_no: 'ISMS-PRO-01',
            title: 'Prosedur Keamanan Informasi',
            revision: 2,
            kind: 'procedure',
            file_path: '/files/pro1.pdf',
            note: null,
            uploaded_at: '2026-10-20T07:00:00Z',
            elf_date: '2026-10-20',
            review_form_path: null,
            review_roles: null,
            qr_placed: true,
          },
        ],
      } as any)

      // 2. IT form signatures query
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            sig_id: 201,
            step_number: 2,
            slot_label: 'DIR_APPROVER',
            role_title: 'Direktur Terkait',
            approver_name: 'Teguh Sunjoyo',
            approver_email: email,
            sig_status: 'pending',
            verification_code: 'ESIGN-IT-001',
            signature_note: null,
            sub_id: 21,
            request_no: 'REQ-IT-2026-001',
            form_code: 'ISMS-F-03-00-003',
            form_name: 'Formulir Hak Akses Pengguna',
            applicant_name: 'Budi Hartono',
            department: 'Production',
            submission_status: 'pending',
            current_step: 2,
            total_steps: 3,
            token: 'tok-it-sub-21',
            notes: 'Akses ERP baru',
            submitted_at: '2026-10-20T08:30:00Z',
            decided_at: null,
          },
        ],
      } as any)

      // 3. Special area requests query
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 301,
            token: 'tok-sa-301',
            status: 'pending',
            approver_name: 'Teguh Sunjoyo',
            approver_title: 'Kepala Divisi',
            area: 'Server Room Data Center',
            requester_name: 'Vendor IT Solution',
            org_company: 'PT Global Tech',
            department: 'External',
            purpose: 'Maintenance Rak Server',
            verification_code: 'SA-0301',
            decision_note: null,
            submitted_at: '2026-10-20T09:00:00Z',
            decided_at: null,
            from_at: '2026-10-21T08:00:00Z',
            to_at: '2026-10-21T17:00:00Z',
          },
        ],
      } as any)

      // 4. Photo video requests query
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 401,
            approval_token: 'tok-pv-401',
            status: 'pending',
            location: 'Area Produksi Plant 2',
            requester_name: 'Tim Dokumentasi Audit',
            dept_or_company: 'Auditor Eksternal',
            dept: 'Audit',
            objective: 'Dokumentasi Sertifikasi ISO 27001',
            request_type: 'visitor',
            verification_code: 'PV-0401',
            submitted_at: '2026-10-20T09:30:00Z',
            decided_at: null,
            from_at: '2026-10-22T08:00:00Z',
            to_at: '2026-10-22T12:00:00Z',
            pic_name: 'TSU',
            pic_full_name: 'Teguh Sunjoyo',
            pic_email: email,
            pic_title: 'Dept Head ISMS',
          },
        ],
      } as any)

      const result = await listMyApprovals(email)

      // All 4 items should be aggregated in pending:
      expect(result.pending.length).toBe(4)

      const categories = result.pending.map((p) => p.category)
      expect(categories).toContain('procedure')
      expect(categories).toContain('it_form')
      expect(categories).toContain('special_area')
      expect(categories).toContain('photo_video')

      // Verify actionUrls and details
      const itItem = result.pending.find((p) => p.category === 'it_form')
      expect(itItem?.actionUrl).toBe('/isms-jai/form-it-esign?token=tok-it-sub-21')
      expect(itItem?.applicantName).toBe('Budi Hartono')
      expect(itItem?.department).toBe('Production')

      const saItem = result.pending.find((p) => p.category === 'special_area')
      expect(saItem?.actionUrl).toBe('/isms-jai/persetujuan-area-special?token=tok-sa-301')
      expect(saItem?.applicantName).toBe('Vendor IT Solution')

      const pvItem = result.pending.find((p) => p.category === 'photo_video')
      expect(pvItem?.actionUrl).toBe('/isms-jai/konfirmasi-approval?token=tok-pv-401')
      expect(pvItem?.applicantName).toBe('Tim Dokumentasi Audit')
    })
  })

  describe('listMyApprovalMessages', () => {
    it('returns notifications for active pending approvals from all workflows', async () => {
      const email = 'teguh.sunjoyo@jai.co.id'

      // Mock procedure query
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            control_no: 'ISMS-PRO-01',
            title: 'Prosedur Keamanan Informasi',
            role_title: 'Direktur',
            notified_at: '2026-10-20T08:00:00Z',
            approval_code: '654321',
            approval_code_attempts: 0,
            token: 'tok-p1',
          },
        ],
      } as any)

      // Mock IT form signatures
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            sig_id: 22,
            request_no: 'REQ-IT-002',
            form_name: 'Formulir Hak Akses',
            form_code: 'ISMS-F-03-00-003',
            role_title: 'IT Security Administrator',
            applicant_name: 'Siti Rahma',
            department: 'HRD',
            submitted_at: '2026-10-20T08:15:00Z',
            token: 'tok-it-22',
          },
        ],
      } as any)

      // Mock Special Area
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 33,
            area: 'Server Room',
            requester_name: 'Agus',
            org_company: 'PT Network Solusi',
            department: null,
            approver_title: 'IT Manager',
            token: 'tok-sa-33',
            submitted_at: '2026-10-20T08:30:00Z',
          },
        ],
      } as any)

      // Mock Photo Video
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 44,
            location: 'Warehouse',
            requester_name: 'Dani',
            dept_or_company: 'Logistik',
            pic_title: 'PIC Lapangan',
            pic_name: 'TSU',
            approval_token: 'tok-pv-44',
            submitted_at: '2026-10-20T08:45:00Z',
          },
        ],
      } as any)

      const messages = await listMyApprovalMessages(email)
      expect(messages.length).toBe(4)

      const itMsg = messages.find((m) => m.category === 'it_form')
      expect(itMsg?.actionUrl).toBe('/form-it-esign?token=tok-it-22')
      expect(itMsg?.applicantName).toBe('Siti Rahma')

      const procMsg = messages.find((m) => m.category === 'procedure')
      expect(procMsg?.code).toBe('654321')
    })
  })

  describe('listMyHistory', () => {
    it('aggregates history from all workflows and filters by search query and outcome', async () => {
      const email = 'teguh.sunjoyo@jai.co.id'

      // Mock procedure history
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            status: 'approved',
            decided_at: '2026-10-19T10:00:00Z',
            role_title: 'Direktur',
            role_kind: 'procedure',
            verification_code: 'CODE-123',
            decision_note: null,
            token: 'tok-h1',
            step_revision: 1,
            document_id: 10,
            control_no: 'ISMS-DOC-001',
            title: 'Kebijakan Keamanan',
            revision: 1,
            kind: 'policy',
            qr_placed: true,
          },
        ],
      } as any)

      // Mock IT form history
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            sig_id: 2,
            step_number: 1,
            role_title: 'Atasan Langsung',
            verification_code: 'ESIGN-002',
            signature_note: 'Disetujui',
            decided_at: '2026-10-19T11:00:00Z',
            sub_id: 20,
            request_no: 'REQ-IT-HIST-01',
            form_code: 'ISMS-F-02-00-002',
            form_name: 'Izin Membawa Laptop Keluar',
            applicant_name: 'Ahmad Faiz',
            token: 'tok-it-h2',
            status: 'approved',
          },
        ],
      } as any)

      // Mock Special Area history
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            area: 'MDF Room',
            requester_name: 'Bambang',
            approver_title: 'IT Security',
            status: 'rejected',
            verification_code: null,
            decision_note: 'Jadwal bentrok dengan maintenance internal',
            token: 'tok-sa-h3',
            decided_at: '2026-10-19T12:00:00Z',
          },
        ],
      } as any)

      // Mock Photo Video history
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 4,
            location: 'Lobby Utama',
            requester_name: 'Humas JAI',
            pic_title: 'PIC Security',
            status: 'approved',
            verification_code: 'PV-VERIF-004',
            approval_token: 'tok-pv-h4',
            decided_at: '2026-10-19T13:00:00Z',
          },
        ],
      } as any)

      // Test 1: all history without filters
      const historyAll = await listMyHistory(email, {})
      expect(historyAll.total).toBe(4)
      expect(historyAll.items.length).toBe(4)

      // Test 2: filter by outcome 'approved'
      // Need to re-mock the 4 queries
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            status: 'approved',
            decided_at: '2026-10-19T10:00:00Z',
            role_title: 'Direktur',
            role_kind: 'procedure',
            verification_code: 'CODE-123',
            decision_note: null,
            token: 'tok-h1',
            step_revision: 1,
            document_id: 10,
            control_no: 'ISMS-DOC-001',
            title: 'Kebijakan Keamanan',
            revision: 1,
            kind: 'policy',
            qr_placed: true,
          },
        ],
      } as any)
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            sig_id: 2,
            step_number: 1,
            role_title: 'Atasan Langsung',
            verification_code: 'ESIGN-002',
            signature_note: 'Disetujui',
            decided_at: '2026-10-19T11:00:00Z',
            sub_id: 20,
            request_no: 'REQ-IT-HIST-01',
            form_code: 'ISMS-F-02-00-002',
            form_name: 'Izin Membawa Laptop Keluar',
            applicant_name: 'Ahmad Faiz',
            token: 'tok-it-h2',
            status: 'approved',
          },
        ],
      } as any)
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            area: 'MDF Room',
            requester_name: 'Bambang',
            approver_title: 'IT Security',
            status: 'rejected',
            verification_code: null,
            decision_note: 'Jadwal bentrok dengan maintenance internal',
            token: 'tok-sa-h3',
            decided_at: '2026-10-19T12:00:00Z',
          },
        ],
      } as any)
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 4,
            location: 'Lobby Utama',
            requester_name: 'Humas JAI',
            pic_title: 'PIC Security',
            status: 'approved',
            verification_code: 'PV-VERIF-004',
            approval_token: 'tok-pv-h4',
            decided_at: '2026-10-19T13:00:00Z',
          },
        ],
      } as any)

      const historyApproved = await listMyHistory(email, { outcome: 'approved' })
      expect(historyApproved.total).toBe(3)
      expect(historyApproved.items.every((i) => i.outcome === 'approved')).toBe(true)

      // Test 3: filter by search term 'Ahmad' (matches IT Form applicant)
      vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any)
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            sig_id: 2,
            step_number: 1,
            role_title: 'Atasan Langsung',
            verification_code: 'ESIGN-002',
            signature_note: 'Disetujui',
            decided_at: '2026-10-19T11:00:00Z',
            sub_id: 20,
            request_no: 'REQ-IT-HIST-01',
            form_code: 'ISMS-F-02-00-002',
            form_name: 'Izin Membawa Laptop Keluar',
            applicant_name: 'Ahmad Faiz',
            token: 'tok-it-h2',
            status: 'approved',
          },
        ],
      } as any)
      vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any)
      vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any)

      const historySearch = await listMyHistory(email, { q: 'ahmad' })
      expect(historySearch.total).toBe(1)
      expect(historySearch.items[0].applicantName).toBe('Ahmad Faiz')
      expect(historySearch.items[0].category).toBe('it_form')
    })
  })
})
