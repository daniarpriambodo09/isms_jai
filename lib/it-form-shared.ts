// lib/it-form-shared.ts

export interface ItFormApprover {
  id: number
  form_code: string
  form_name: string
  slot_number: number
  slot_label: string
  role_title: string
  person_name: string
  salutation: string
  initials: string
  email: string | null
  department: string | null
  sections?: string[] | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ItFormSubmission {
  id: number
  request_no: string
  form_code: string
  form_name: string
  request_date: string
  applicant_name: string
  applicant_nik: string | null
  applicant_position: string | null
  employee_status: string
  department: string
  company_name: string | null
  purpose: string | null
  form_data: Record<string, any>
  status: 'pending' | 'approved' | 'rejected'
  current_step: number
  total_steps: number
  token: string
  notes: string | null
  created_at: string
  updated_at: string
  signatures?: ItFormSignature[]
}

export interface ItFormSignature {
  id: number
  submission_id: number
  step_number: number
  slot_label: string
  role_title: string
  approver_name: string
  approver_email: string | null
  status: 'waiting' | 'pending' | 'approved' | 'rejected'
  verification_code: string | null
  signed_at: string | null
  signature_note: string | null
  created_at: string
  updated_at: string
}

export interface ItFormDefinition {
  code: string
  name: string
  jpName: string
  category: string
  description: string
  badge: string
}

export const IT_FORM_DEFINITIONS: ItFormDefinition[] = [
  {
    code: 'ISMS-F-010-001',
    name: 'Form Pengadaan Baru atau Pembaharuan PC/Laptop',
    jpName: '【記録】新規パソコン追加購入及び新規パソコンとの変更購入',
    category: 'Pengadaan Hardware IT',
    description: 'Form permohonan pengadaan atau pembaharuan unit PC/Laptop kerja beserta lisensi software wajib.',
    badge: 'Confidential',
  },
  {
    code: 'ISMS-F-010-003',
    name: 'Form Pengadaan Baru atau Pembaharuan Software',
    jpName: '【記録】新規ソフトウェア購入及び新規バージョンとの変更購入',
    category: 'Pengadaan Software IT',
    description: 'Form permohonan pembelian lisensi software baru atau pembaharuan versi software pada komputer.',
    badge: 'Confidential',
  },
  {
    code: 'ISMS-F-010-006',
    name: 'Pengajuan / Perubahan Email Address / Login User ID',
    jpName: '【記録】Eメールアドレス及びユーザIDの申請及び変更',
    category: 'Akun & Akses IT',
    description: 'Form permohonan pembuatan baru atau perubahan email dan user ID login karyawan.',
    badge: 'Confidential',
  },
  {
    code: 'ISMS-F-010-007',
    name: 'Request Penghapusan E-mail Address / Login User ID',
    jpName: '【記録】Eメールアドレス及びユーザID削除依頼書',
    category: 'Akun & Akses IT',
    description: 'Form permohonan penonaktifan atau penghapusan email dan user ID login karyawan.',
    badge: 'Confidential',
  },
  {
    code: 'ISMS-F-03-00-003',
    name: 'Company Network Connection Application Form',
    jpName: '【記録】会社ネットワーク接続許可申請書',
    category: 'Jaringan & Server IT',
    description: 'Form izin penyambungan perangkat ke jaringan internal perusahaan (DHCP/Static IP).',
    badge: 'Confidential',
  },
  {
    code: 'ISMS-F-03-00-001',
    name: 'Izin Membawa Masuk PC, USB & Alat IT (001 - Tamu/Vendor)',
    jpName: '【記録】持込許可申請書',
    category: 'Perangkat & Alat IT',
    description: 'Form permohonan izin membawa masuk perangkat IT tamu / affiliate / vendor ke area PT. JAI (Step 1: IT Security Admin).',
    badge: 'Security',
  },
  {
    code: 'ISMS-F-03-00-002',
    name: 'Izin Membawa Keluar PC, USB & Alat IT (002 - Karyawan PT. JAI)',
    jpName: '【記録】持出許可申請書',
    category: 'Perangkat & Alat IT',
    description: 'Form izin membawa keluar perangkat IT kantor oleh karyawan PT. JAI (Step 1: Departemen Manager, Step 2: IT Security Admin).',
    badge: 'Security',
  },
  {
    code: 'ISMS-F-02-00-002',
    name: 'Pengajuan Registrasi Finger Print Special Security Area',
    jpName: '【記録】特別セキュリティ区画指紋入退システム申請書',
    category: 'Global & Special Security Area',
    description: 'Form pendaftaran / perubahan akses sidik jari masuk dan keluar area khusus berkeamanan tinggi (Special Security Area) dengan pengesahan IAA (Teguh Sunjoyo).',
    badge: 'Global Security',
  },
]

export const FINGERPRINT_FORM_DEFINITION: ItFormDefinition = {
  code: 'ISMS-F-02-00-002',
  name: 'Pengajuan Registrasi Finger Print Special Security Area',
  jpName: '【記録】特別セキュリティ区画指紋入退システム申請書',
  category: 'Special Security Area',
  description: 'Form pendaftaran dan otorisasi akses sidik jari (fingerprint) masuk dan keluar kawasan berkeamanan khusus (Special Security Area) dengan pengesahan IAA (Teguh Sunjoyo).',
  badge: 'Special Security',
}

export const IT_SERVICE_FORM_DEFINITIONS: ItFormDefinition[] = IT_FORM_DEFINITIONS.filter(
  (d) => d.code !== 'ISMS-F-02-00-002' && d.code !== 'ISMS-F-03-00-001'
)
