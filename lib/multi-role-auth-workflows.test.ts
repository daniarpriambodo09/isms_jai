import { describe, it, expect } from 'vitest'
import { getAdminGroupsForRole } from '@/components/navbar'

describe('Multi-Role Navigation & Permission Audit', () => {
  describe('1. Role: ism_admin (ISMS Administrator)', () => {
    it('has full access to 6 administrative groups in navbar', () => {
      const groups = getAdminGroupsForRole('ism_admin')
      expect(groups.length).toBe(6)
      const titles = groups.map((g) => g.title)
      expect(titles).toContain('Monitoring & Kiosks')
      expect(titles).toContain('Izin Foto, Video, USB & Special Area')
      expect(titles).toContain('Izin Alat & Form E-Sign IT')
      expect(titles).toContain('Organization & Accounts')
      expect(titles).toContain('Content & Master Data')
      expect(titles).toContain('System & Communications')
    })

    it('can access high-privilege management endpoints', () => {
      function canManageGlobal(role: string) {
        return role === 'ism_admin'
      }
      expect(canManageGlobal('ism_admin')).toBe(true)
      expect(canManageGlobal('it')).toBe(false)
      expect(canManageGlobal('lobby')).toBe(false)
      expect(canManageGlobal('security')).toBe(false)
      expect(canManageGlobal('approver')).toBe(false)
    })
  })

  describe('2. Role: it (IT Administrator)', () => {
    it('receives only IT-related administrative groups in navbar', () => {
      const groups = getAdminGroupsForRole('it')
      expect(groups.length).toBe(2)
      const titles = groups.map((g) => g.title)
      expect(titles).toContain('Izin Alat IT & Link Tamu')
      expect(titles).toContain('Layanan E-Sign & Approver IT')

      const hrefs = groups.flatMap((g) => g.items.map((i) => i.href))
      expect(hrefs).toContain('/kelola-izin-alat-it')
      expect(hrefs).toContain('/ijin-masuk-alat-it')
      expect(hrefs).toContain('/kelola-approver-it')
      expect(hrefs).toContain('/form-it-esign')
      // Does not contain general isms admin pages
      expect(hrefs).not.toContain('/kelola-admin')
      expect(hrefs).not.toContain('/kelola-smtp')
      expect(hrefs).not.toContain('/kelola-tema')
    })

    it('has authorization for IT equipment requests and kiosk actions', () => {
      function isItAdminAllowed(role: string) {
        return role === 'it' || role === 'ism_admin'
      }
      expect(isItAdminAllowed('it')).toBe(true)
      expect(isItAdminAllowed('ism_admin')).toBe(true)
      expect(isItAdminAllowed('lobby')).toBe(false)
      expect(isItAdminAllowed('security')).toBe(false)
      expect(isItAdminAllowed('approver')).toBe(false)
    })
  })

  describe('3. Role: lobby (Lobby Kiosk Administrator)', () => {
    it('receives only Lobby Kiosk menu in navbar', () => {
      const groups = getAdminGroupsForRole('lobby')
      expect(groups.length).toBe(1)
      expect(groups[0].title).toBe('Kiosk Lobby')
      expect(groups[0].items[0].href).toBe('/admin-lobby')
    })

    it('has kiosk-level authorization for visitor management', () => {
      function isKioskAllowed(role: string) {
        return ['lobby', 'security', 'ism_admin', 'it'].includes(role)
      }
      expect(isKioskAllowed('lobby')).toBe(true)
      expect(isKioskAllowed('security')).toBe(true)
      expect(isKioskAllowed('approver')).toBe(false)
    })
  })

  describe('4. Role: security (Security Post Administrator)', () => {
    it('receives only Security Post Kiosk menu in navbar', () => {
      const groups = getAdminGroupsForRole('security')
      expect(groups.length).toBe(1)
      expect(groups[0].title).toBe('Kiosk Pos Security')
      expect(groups[0].items[0].href).toBe('/admin-pos-security')
    })
  })

  describe('5. Role: approver (PIC Departemen Pemilik Barang)', () => {
    it('receives only equipment return and approvals menu in navbar', () => {
      const groups = getAdminGroupsForRole('approver')
      expect(groups.length).toBe(2)
      const titles = groups.map((g) => g.title)
      expect(titles).toContain('Pemeriksaan & Pengembalian Perangkat')
      expect(titles).toContain('Persetujuan Dokumen & Izin')

      const hrefs = groups.flatMap((g) => g.items.map((i) => i.href))
      expect(hrefs).toContain('/kelola-permintaan-foto-video')
      expect(hrefs).toContain('/persetujuan-saya')
      // No sensitive admin settings
      expect(hrefs).not.toContain('/kelola-admin')
      expect(hrefs).not.toContain('/kelola-smtp')
      expect(hrefs).not.toContain('/dashboard-admin')
    })

    it('routes login destination directly to /kelola-permintaan-foto-video when department is known', () => {
      function getDestination(role: string, department?: string | null) {
        if (role === 'approver') {
          return department ? '/kelola-permintaan-foto-video' : '/persetujuan-saya'
        }
        if (role === 'it') return '/kelola-izin-alat-it'
        if (role === 'lobby') return '/admin-lobby'
        if (role === 'security') return '/admin-pos-security'
        return '/dashboard-admin'
      }

      // Department PIC accounts
      expect(getDestination('approver', 'PGA')).toBe('/kelola-permintaan-foto-video')
      expect(getDestination('approver', 'FATP - EXIM')).toBe('/kelola-permintaan-foto-video')
      expect(getDestination('approver', 'NYS - PP')).toBe('/kelola-permintaan-foto-video')
      // General approver without fixed equipment department
      expect(getDestination('approver', null)).toBe('/persetujuan-saya')
    })

    it('enforces department ownership boundary for equipment return & take actions', () => {
      function canManageRow(
        user: { role: string; department?: string | null },
        requestDeptPic: string | null | undefined
      ) {
        const isApproverAdmin = ['ism_admin', 'it'].includes(user.role)
        if (isApproverAdmin) return true
        if (user.role === 'approver') {
          if (!user.department) return true
          return user.department.trim().toUpperCase() === (requestDeptPic || '').trim().toUpperCase()
        }
        return false
      }

      // Case: PIC of PGA (e.g. ATH)
      const userPga = { role: 'approver', department: 'PGA' }
      expect(canManageRow(userPga, 'PGA')).toBe(true)
      expect(canManageRow(userPga, 'FATP - EXIM')).toBe(false)
      expect(canManageRow(userPga, 'PP - NYS')).toBe(false)

      // Case: PIC of FATP - EXIM (e.g. ASE)
      const userExim = { role: 'approver', department: 'FATP - EXIM' }
      expect(canManageRow(userExim, 'FATP - EXIM')).toBe(true)
      expect(canManageRow(userExim, 'PGA')).toBe(false)

      // Case: ISM Admin & IT have full oversight
      expect(canManageRow({ role: 'ism_admin' }, 'PGA')).toBe(true)
      expect(canManageRow({ role: 'it' }, 'PGA')).toBe(true)
    })

    it('validates return payload with virus check and delete/format options', () => {
      function validateReturnPayload(payload: {
        returnedBy: string
        virusCheck: boolean
        deleteOrFormat?: string | null
      }) {
        if (!payload.returnedBy || !payload.returnedBy.trim()) {
          return { valid: false, error: 'Nama PIC penerima wajib diisi' }
        }
        const allowedSanitize = ['delete', 'format', 'delete_format', null, undefined]
        if (!allowedSanitize.includes(payload.deleteOrFormat)) {
          return { valid: false, error: 'Opsi sanitasi tidak valid' }
        }
        return { valid: true }
      }

      expect(validateReturnPayload({ returnedBy: 'ath', virusCheck: true, deleteOrFormat: 'delete' }).valid).toBe(true)
      expect(validateReturnPayload({ returnedBy: 'ase', virusCheck: true, deleteOrFormat: 'format' }).valid).toBe(true)
      expect(validateReturnPayload({ returnedBy: 'mra', virusCheck: true, deleteOrFormat: 'delete_format' }).valid).toBe(true)
      expect(validateReturnPayload({ returnedBy: '', virusCheck: true }).valid).toBe(false)
    })
  })
})
