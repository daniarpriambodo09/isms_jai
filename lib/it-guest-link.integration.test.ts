// lib/it-guest-link.integration.test.ts
import fs from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import {
  formatGuestLinkCode,
  buildSuggestedNetworkConfig,
} from '@/lib/it-guest-link-shared'

const runDb = process.env.ISMS_DB_TESTS === '1'
if (runDb && fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(DB_[A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

let service: typeof import('@/lib/it-guest-link-service')

describe('IT Guest Access Link & Network Credentials (Unit)', () => {
  it('formats link code with Guest Name + Year + Month + 3-digit Monthly Sequence', () => {
    expect(formatGuestLinkCode('Budi Santoso', 2026, 1, 10)).toBe('BUDI-SANTOSO-2026-10-001')
    expect(formatGuestLinkCode('Andi Wijaya', 2027, 15, 3)).toBe('ANDI-WIJAYA-2027-03-015')
  })

  it('builds suggested network credentials (username, password, SSID, IP, subnet, gateway, DNS)', () => {
    const creds = buildSuggestedNetworkConfig({
      guest_name: 'Budi Santoso',
      seq_year: 2026,
      seq_month: 10,
      seq_no: 1,
    })
    expect(creds.network_username).toBe('guest.budi.202610.001')
    expect(creds.network_password).toBe('JAI-2026-001')
    expect(creds.network_ssid).toBe('JAI-CORP-GUEST')
    expect(creds.assigned_ip).toBe('192.168.50.50')
    expect(creds.subnet_mask).toBe('255.255.255.0')
    expect(creds.gateway).toBe('192.168.50.1')
  })
})

describe.skipIf(!runDb)('IT Guest Access Link & 2-Form Flow (Database Integration)', () => {
  beforeAll(async () => {
    service = await import('@/lib/it-guest-link-service')
  })

  it('generates separate links per person, resets sequence monthly, changes year annually, submits 2 forms, approves with username/IP, and deletes cleanly', async () => {
    const createdIds: number[] = []
    try {
      const oct2098 = new Date('2098-10-15T08:00:00Z')
      const nov2098 = new Date('2098-11-02T08:00:00Z')
      const jan2099 = new Date('2099-01-05T08:00:00Z')

      // 1. Generate 2 orang sekaligus di bulan Oktober 2098 -> harus terpisah (#001 dan #002)
      const batchOct = await service.createItGuestAccessLinks({
        guests: [
          { guest_name: 'Tamu Test Satu', company_name: 'PT. Vendor A', department: 'IT / Information Technology' },
          { guest_name: 'Tamu Test Dua', company_name: 'PT. Vendor A', department: 'IT / Information Technology' },
        ],
        is_walk_in: true,
        created_by: 'test-runner',
        reference_date: oct2098,
      })
      for (const l of batchOct) createdIds.push(l.id)

      expect(batchOct).toHaveLength(2)
      expect(batchOct[0].seq_year).toBe(2098)
      expect(batchOct[0].seq_month).toBe(10)
      expect(batchOct[0].seq_no).toBe(1)
      expect(batchOct[0].link_code).toBe('TAMU-TEST-SATU-2098-10-001')

      expect(batchOct[1].seq_no).toBe(2)
      expect(batchOct[1].link_code).toBe('TAMU-TEST-DUA-2098-10-002')

      // 2. Berganti bulan ke November 2098 -> nomor urut otomatis ke-reset kembali ke 1 (#001)!
      const batchNov = await service.createItGuestAccessLinks({
        guests: [{ guest_name: 'Tamu Test Tiga', company_name: 'PT. Vendor B' }],
        reference_date: nov2098,
      })
      for (const l of batchNov) createdIds.push(l.id)

      expect(batchNov[0].seq_year).toBe(2098)
      expect(batchNov[0].seq_month).toBe(11)
      expect(batchNov[0].seq_no).toBe(1)
      expect(batchNov[0].link_code).toBe('TAMU-TEST-TIGA-2098-11-001')

      // 3. Berganti tahun ke Januari 2099 -> tahun otomatis berganti ke 2099 & urutan #001!
      const batchNextYear = await service.createItGuestAccessLinks({
        guests: [{ guest_name: 'Tamu Tahun Baru', company_name: 'PT. Vendor C' }],
        reference_date: jan2099,
      })
      for (const l of batchNextYear) createdIds.push(l.id)

      expect(batchNextYear[0].seq_year).toBe(2099)
      expect(batchNextYear[0].seq_month).toBe(1)
      expect(batchNextYear[0].seq_no).toBe(1)
      expect(batchNextYear[0].link_code).toBe('TAMU-TAHUN-BARU-2099-01-001')

      // 4. Tamu mengisi 2 form sekaligus (Form Izin Masuk Alat IT + Form Network Internal)
      const submitted = await service.submitItGuestCombinedForms(batchOct[0].id, {
        guest_name: 'Tamu Test Satu',
        company_name: 'PT. Vendor A',
        department: 'IT / Information Technology',
        section: 'Infrastructure',
        location: 'Ruang Server / Meeting IT',
        purpose: 'Instalasi & Konfigurasi Sistem',
        date_in: '2098-10-15',
        date_out_plan: '2098-10-16',
        applicant_phone: '08123456789',
        applicant_email: 'tamu1@vendor.com',
        items: [
          {
            equipment_type: 'PC / Laptop',
            brand: 'Lenovo',
            model: 'ThinkPad X1',
            serial_no: 'SN-TEST-9981',
            id_no: 'NB-01',
          },
        ],
        connection_type: 'Wi-Fi Internal (Wireless)',
        device_type: 'Notebook / Laptop',
        mac_address: 'AA:BB:CC:DD:EE:FF',
        os_info: 'Windows 11 Pro 64-bit',
        antivirus_installed: 'Ya',
        antivirus_name: 'Windows Defender',
        antivirus_version: 'Latest',
        antivirus_updated: 'Ya',
        network_purpose: 'Akses jaringan internal & internet proyek',
      })

      expect(submitted.status).toBe('submitted')
      expect(submitted.equipment_request_id).toBeTruthy()
      expect(submitted.network_submission_id).toBeTruthy()
      expect(submitted.equipment_request?.request_no).toContain('IT-IN-')
      expect(submitted.network_submission?.form_code).toBe('ISMS-F-03-00-003')

      // 5. Admin IT melakukan Approve & memberikan Username Jaringan + IP Address + Subnet + Gateway + DNS
      const approved = await service.approveOrRejectItGuestLink(batchOct[0].id, {
        action: 'approve',
        approver_name: 'Admin IT Test',
        network_username: 'guest.tamu1.2098',
        network_password: 'Pass-2098-001',
        network_ssid: 'JAI-CORP-GUEST',
        ip_mode: 'static',
        assigned_ip: '192.168.50.101',
        subnet_mask: '255.255.255.0',
        gateway: '192.168.50.1',
        dns_primary: '192.168.1.10',
        dns_secondary: '8.8.8.8',
        approval_notes: 'Disetujui untuk akses jaringan internal',
      })

      expect(approved.status).toBe('approved')
      expect(approved.network_username).toBe('guest.tamu1.2098')
      expect(approved.assigned_ip).toBe('192.168.50.101')
      expect(approved.equipment_request?.status).toBe('approved')
      expect(approved.network_submission?.status).toBe('approved')
      expect(approved.network_submission?.form_data?.assigned_ip).toBe('192.168.50.101')
      expect(approved.network_submission?.form_data?.network_username).toBe('guest.tamu1.2098')

      // 6. Lookup by code returns the approved credentials
      const fetched = await service.getItGuestAccessLinkByCodeOrToken('TAMU-TEST-SATU-2098-10-001')
      expect(fetched?.status).toBe('approved')
      expect(fetched?.network_username).toBe('guest.tamu1.2098')
    } finally {
      // 7. Bersihkan seluruh data test menggunakan deleteItGuestAccessLink
      for (const id of createdIds) {
        await service.deleteItGuestAccessLink(id, true)
      }
    }
  })
})

