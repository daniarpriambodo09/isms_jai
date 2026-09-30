// lib/special-area-shared.ts
// Client-safe constants for "Pengajuan Ijin Masuk Area Special Security"
// (form ISMS-F-006-001).

// Special (red) areas from the Diagram Security Area PT. JAI (ISMS-B-003).
export const SPECIAL_AREAS = [
  'Server Room',
  'Finance Room',
  'Accounting Room',
  'HR/IR Room',
  'Office EXIM',
  'Office MTC Server',
  'Office QSA - Administration',
  'Document Room EXIM',
  'Document Room FA',
  'Gudang IT & Document Room IR',
  'Training Office',
] as const

export type SpecialAreaStatus = 'pending' | 'approved' | 'rejected'

export type SpecialAreaRequest = {
  id: number
  requester_name: string
  org_company: string
  department: string | null
  from_at: string
  to_at: string
  area: string
  purpose: string
  id_card_no: string | null
  status: SpecialAreaStatus
  submitted_at: string
  submitted_by: string | null
  approver_name: string | null
  approver_title: string | null
  notified_at: string | null
  email_error: string | null
  decided_at: string | null
  decision_note: string | null
  verification_code: string | null
}
