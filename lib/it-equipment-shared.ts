// lib/it-equipment-shared.ts
// Shared types and helpers for IT equipment requests (ISMS-F-03-00-001 & ISMS-F-03-00-002)

export type ItEquipmentItem = {
  id?: string
  equipment_type: string // e.g. 'PC / Laptop', 'USB Memory / Flashdisk', 'Kamera', 'External HDD', 'Tablet', 'Lainnya'
  id_no?: string // No. / Nama Identifikasi alat (wajib diisi)
  brand: string // Produsen / Merk
  model: string // Model
  serial_no: string // Serial Number
}

export type ItEquipmentRequest = {
  id: number
  request_no: string
  form_type: 'in' | 'out'
  request_date: string
  applicant_name: string
  applicant_nik?: string | null
  company_name: string
  department: string
  section?: string | null
  location: string
  purpose: string
  date_in: string
  date_out_plan: string
  items: ItEquipmentItem[]
  applicant_phone?: string | null
  applicant_email?: string | null
  agree_rules: boolean
  status: 'pending' | 'approved_manager' | 'approved' | 'rejected' | 'returned'
  token?: string | null
  approval_code?: string | null
  approved_by?: string | null
  approved_title?: string | null
  approved_at?: string | null
  approval_notes?: string | null
  it_checked_by?: string | null
  it_checked_title?: string | null
  it_checked_at?: string | null
  it_check_notes?: string | null
  rejected_by?: string | null
  rejected_at?: string | null
  rejection_reason?: string | null
  returned_at?: string | null
  returned_checked_by?: string | null
  returned_notes?: string | null
  return_check_items: boolean
  return_check_confidential: boolean
  created_at: string
  updated_at: string
}

export const EQUIPMENT_TYPES = [
  'PC / Laptop',
  'USB Memory / Flashdisk',
  'Kamera',
  'Smart Device (Tablet / HP Khusus)',
  'External Harddisk / SSD',
  'Tablet / iPad',
  'Smartphone Khusus Uji',
  'Alat Ukur / Tester Elektronik',
  'Lainnya',
] as const

export const DEFAULT_DEPARTMENTS = [
  'IT / Information Technology',
  'Production / Assembly',
  'Production Engineering (PE)',
  'Quality Assurance (QA)',
  'Maintenance / Facility',
  'General Affairs (GA) / Security',
  'Purchasing / SCM',
  'HRD / Human Resources',
  'Finance & Accounting',
  'Management Information System (MIS)',
] as const
