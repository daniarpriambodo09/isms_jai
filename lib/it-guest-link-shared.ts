// lib/it-guest-link-shared.ts
import type { ItEquipmentRequest } from '@/lib/it-equipment-shared'
import type { ItFormSubmission } from '@/lib/it-form-shared'

export type ItGuestLinkStatus = 'link_created' | 'submitted' | 'approved' | 'rejected'

export interface ItGuestAccessLink {
  id: number
  link_code: string
  token: string
  seq_year: number
  seq_month: number
  seq_no: number
  guest_name: string
  company_name: string | null
  department: string | null
  visit_date: string | null
  visit_end_date: string | null
  is_walk_in: boolean
  status: ItGuestLinkStatus
  equipment_request_id: number | null
  network_submission_id: number | null
  network_username: string | null
  network_password: string | null
  network_ssid: string | null
  ip_mode: 'dhcp' | 'static'
  assigned_ip: string | null
  subnet_mask: string | null
  gateway: string | null
  dns_primary: string | null
  dns_secondary: string | null
  approved_by: string | null
  approved_at: string | null
  approval_notes: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejection_reason: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  equipment_request?: ItEquipmentRequest | null
  network_submission?: ItFormSubmission | null
}

/**
 * Mengubah nama tamu menjadi slug huruf kapital yang aman untuk URL
 * Contoh: "Budi Santoso, S.Kom" -> "BUDI-SANTOSO-S-KOM"
 */
export function slugifyGuestName(name: string): string {
  const cleaned = (name || 'GUEST')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36)
    .replace(/-+$/g, '')
  return cleaned || 'GUEST'
}

/**
 * Membangun kode link yang memuat NAMA TAMU + TAHUN + BULAN + NOMOR URUTAN BULANAN
 * - Tahun otomatis berganti setiap pergantian tahun (misal 2026 -> 2027)
 * - Bulan dalam format 2 digit (01 s/d 12)
 * - Nomor urut otomatis ke-reset ke 001 setiap pergantian bulan
 * Contoh: "BUDI-SANTOSO-2026-10-001" atau "GUEST-2026-10-001"
 */
export function formatGuestLinkCode(
  guestName: string,
  year: number,
  seqNo: number,
  month: number = new Date().getMonth() + 1
): string {
  const nameSlug = slugifyGuestName(guestName)
  const monthStr = String(month).padStart(2, '0')
  const seqStr = String(seqNo).padStart(3, '0')
  return `${nameSlug}-${year}-${monthStr}-${seqStr}`
}

/**
 * Membuat rekomendasi otomatis Username Jaringan Internal & IP Address untuk Tamu
 */
export function buildSuggestedNetworkConfig(link: {
  guest_name: string
  seq_year: number
  seq_month: number
  seq_no: number
}) {
  const firstWord = (link.guest_name || 'guest')
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') || 'guest'
  const seqPad = String(link.seq_no).padStart(3, '0')
  const monthPad = String(link.seq_month).padStart(2, '0')
  const hostOctet = ((link.seq_no - 1) % 199) + 50 // range .50 - .248

  return {
    network_username: `guest.${firstWord}.${link.seq_year}${monthPad}.${seqPad}`,
    network_password: `JAI-${link.seq_year}-${seqPad}`,
    network_ssid: 'JAI-CORP-GUEST',
    ip_mode: 'dhcp' as const,
    assigned_ip: `192.168.50.${hostOctet}`,
    subnet_mask: '255.255.255.0',
    gateway: '192.168.50.1',
    dns_primary: '192.168.1.10',
    dns_secondary: '8.8.8.8',
  }
}

