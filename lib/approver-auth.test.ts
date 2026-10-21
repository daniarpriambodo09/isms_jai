import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock 'server-only'
vi.mock('server-only', () => ({}))

// Mock database query
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

import { query } from '@/lib/db'
import { findApproverEmailByToken, findAdminByEmail } from './approver-auth'

describe('Approver Auth System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findApproverEmailByToken', () => {
    it('returns null if token is empty or whitespace', async () => {
      expect(await findApproverEmailByToken('')).toBeNull()
      expect(await findApproverEmailByToken('   ')).toBeNull()
    })

    it('finds approver email from procedure_approvals', async () => {
      vi.mocked(query).mockResolvedValueOnce({
        rows: [{ approver_email: 'approver.doc@jai.co.id' }],
      } as any)

      const result = await findApproverEmailByToken('proc-token-123')
      expect(result).toBe('approver.doc@jai.co.id')
    })

    it('falls back to it_form_submissions if not in procedure_approvals', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [] } as any) // procedure_approvals
        .mockResolvedValueOnce({ rows: [{ approver_email: 'it.lead@jai.co.id' }] } as any) // it_form_submissions

      const result = await findApproverEmailByToken('it-token-456')
      expect(result).toBe('it.lead@jai.co.id')
    })

    it('falls back to special_area_requests', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [] } as any) // procedure_approvals
        .mockResolvedValueOnce({ rows: [] } as any) // it_form_submissions
        .mockResolvedValueOnce({ rows: [] } as any) // it_form_signatures
        .mockResolvedValueOnce({ rows: [{ approver_email: 'iaa@jai.co.id' }] } as any) // special_area_requests

      const result = await findApproverEmailByToken('sa-token-789')
      expect(result).toBe('iaa@jai.co.id')
    })

    it('falls back to photo_video_requests', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [] } as any) // procedure_approvals
        .mockResolvedValueOnce({ rows: [] } as any) // it_form_submissions
        .mockResolvedValueOnce({ rows: [] } as any) // it_form_signatures
        .mockResolvedValueOnce({ rows: [] } as any) // special_area_requests
        .mockResolvedValueOnce({ rows: [{ email: 'pic.photo@jai.co.id' }] } as any) // photo_video_requests

      const result = await findApproverEmailByToken('pv-token-999')
      expect(result).toBe('pic.photo@jai.co.id')
    })

    it('returns null if token not found anywhere', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)

      const result = await findApproverEmailByToken('unknown-token')
      expect(result).toBeNull()
    })
  })

  describe('findAdminByEmail', () => {
    it('returns null if email is empty', async () => {
      expect(await findAdminByEmail('')).toBeNull()
      expect(await findAdminByEmail('   ')).toBeNull()
    })

    it('finds matching admin account case-insensitively', async () => {
      vi.mocked(query).mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            username: 'budi.santoso',
            email: 'budi.santoso@jai.co.id',
            role: 'approver',
          },
        ],
      } as any)

      const admin = await findAdminByEmail('  BUDI.SANTOSO@JAI.CO.ID  ')
      expect(admin).not.toBeNull()
      expect(admin?.username).toBe('budi.santoso')
      expect(admin?.role).toBe('approver')
    })

    it('returns null if no admin account has this email', async () => {
      vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any)

      const admin = await findAdminByEmail('unregistered@jai.co.id')
      expect(admin).toBeNull()
    })
  })
})
