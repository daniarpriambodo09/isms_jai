'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Laptop,
  HardDrive,
  Camera,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Building,
  User,
  Calendar,
  Download,
  Copy,
  Check,
  Search,
  X,
  Phone,
  Mail,
  MapPin,
  Info,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react'
import {
  EQUIPMENT_TYPES,
  DEFAULT_DEPARTMENTS,
  type ItEquipmentItem,
  type ItEquipmentRequest,
} from '@/lib/it-equipment-shared'
import { API_BASE_PATH } from '@/lib/config'
import { downloadExcel } from '@/lib/excel-export'
import { useAuth } from '@/context/AuthContext'

const inputClass =
  'h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15'
const labelClass = 'mb-1.5 block text-xs font-semibold text-muted-foreground'

function FormContent() {
  const { adminUser } = useAuth()
  const searchParams = useSearchParams()
  const tokenQuery = searchParams.get('token')

  const [formType, setFormType] = useState<'in' | 'out'>('in')
  const [applicantName, setApplicantName] = useState('')
  const [applicantNik, setApplicantNik] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [department, setDepartment] = useState('')
  const [section, setSection] = useState('')
  const [isCustomDept, setIsCustomDept] = useState(false)
  const [customDeptText, setCustomDeptText] = useState('')
  const [location, setLocation] = useState('')
  const [purpose, setPurpose] = useState('')
  const [dateIn, setDateIn] = useState('')
  const [dateOutPlan, setDateOutPlan] = useState('')
  const [applicantPhone, setApplicantPhone] = useState('')
  const [applicantEmail, setApplicantEmail] = useState('')
  const [agreeRules, setAgreeRules] = useState(true)

  const [availableDepartments, setAvailableDepartments] = useState<string[]>([])
  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { departments: [] }))
      .then((data: { departments: Array<{ id: number; name: string }> }) => {
        if (Array.isArray(data.departments) && data.departments.length > 0) {
          setAvailableDepartments(data.departments.map((d) => d.name))
        }
      })
      .catch(() => {})
  }, [])

  const [items, setItems] = useState<ItEquipmentItem[]>([
    {
      equipment_type: 'PC / Laptop',
      brand: '',
      model: '',
      serial_no: '',
      id_no: '',
    },
  ])

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [submittedReq, setSubmittedReq] = useState<ItEquipmentRequest | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Status search modal/bar state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')

  // Default date in to tomorrow (H-1)
  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const yyyy = tomorrow.getFullYear()
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const dd = String(tomorrow.getDate()).padStart(2, '0')
    const formatted = `${yyyy}-${mm}-${dd}`
    setDateIn(formatted)
    setDateOutPlan(formatted)
  }, [])

  // If token is provided in URL, fetch request status
  useEffect(() => {
    if (!tokenQuery) return
    setLoading(true)
    fetch(`${API_BASE_PATH}/api/it-equipment-requests?token=${encodeURIComponent(tokenQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.request) {
          setSubmittedReq(data.request)
        }
      })
      .catch((err) => console.error('Error fetching request tracking:', err))
      .finally(() => setLoading(false))
  }, [tokenQuery])

  const handleAddItem = (type: string = 'USB Memory / Flashdisk') => {
    setItems((prev) => [
      ...prev,
      {
        equipment_type: type,
        brand: '',
        model: '',
        serial_no: '',
        id_no: '',
      },
    ])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleItemChange = (index: number, field: keyof ItEquipmentItem, value: string) => {
    setItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, [field]: value } : it))
    )
  }

  const handleSearchStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchInput.trim()) return
    setSearchLoading(true)
    setSearchError('')
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-equipment-requests?token=${encodeURIComponent(searchInput.trim())}`)
      const data = await res.json()
      if (!res.ok || !data.request) {
        throw new Error('Pengajuan dengan token tersebut tidak ditemukan.')
      }
      setSubmittedReq(data.request)
      setSearchOpen(false)
    } catch (err: any) {
      setSearchError(err.message || 'Gagal mencari status pengajuan.')
    } finally {
      setSearchLoading(false)
    }
  }

  const [exportingExcel, setExportingExcel] = useState(false)
  const handleExportEquipmentExcel = async () => {
    setExportingExcel(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-equipment-requests`)
      if (!res.ok) {
        if (res.status === 401) {
          alert('Silakan login sebagai Admin IT / Security untuk mengunduh rekap Excel izin barang masuk/keluar.')
          return
        }
        throw new Error('Gagal memuat data pengajuan.')
      }
      const data = await res.json()
      const reqs: ItEquipmentRequest[] = data.requests || []
      if (!reqs.length) {
        alert('Belum ada data izin barang masuk/keluar untuk diexport.')
        return
      }
      const filename = `rekap-izin-masuk-keluar-alat-it-${new Date().toISOString().slice(0, 10)}`
      const headers = [
        'No',
        'No. Pengajuan',
        'Tipe Izin',
        'Tanggal Masuk',
        'Rencana Keluar',
        'Nama Tamu / Pembawa',
        'Perusahaan / Instansi',
        'Departemen Pembawa',
        'Seksi',
        'Lokasi Akses',
        'Tujuan Kunjungan',
        'Jumlah Alat',
        'Rincian Alat (Merk - Model - S/N)',
        'Status Approval',
        'Tanggal ACC',
        'Catatan IT',
      ]
      const rows = reqs.map((r, idx) => {
        const itemSummary = (r.items || [])
          .map((it, i) => `[${i + 1}] ${it.equipment_type} ${it.brand} ${it.model || ''} (S/N: ${it.serial_no || '-'})`)
          .join('; ')
        const statusLabel =
          r.status === 'approved'
            ? 'Disetujui (Aktif)'
            : r.status === 'returned'
            ? 'Sudah Keluar / Dikembalikan'
            : r.status === 'rejected'
            ? 'Ditolak'
            : 'Menunggu ACC'
        return [
          idx + 1,
          r.request_no,
          r.form_type === 'in' ? 'Izin Masuk' : 'Izin Keluar',
          r.date_in,
          r.date_out_plan,
          r.applicant_name,
          r.company_name,
          r.department,
          r.section || '-',
          r.location,
          r.purpose,
          (r.items || []).length,
          itemSummary || '-',
          statusLabel,
          r.approved_at || '-',
          r.approval_notes || '-',
        ]
      })
      downloadExcel(filename, headers, rows, 'Izin Masuk Keluar Alat')
    } catch (err: any) {
      alert(err.message || 'Gagal export data Excel.')
    } finally {
      setExportingExcel(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    const finalCompanyName = formType === 'out' ? 'PT. Jatim Autocomp Indonesia' : companyName.trim()
    if (formType === 'out' && !applicantNik.trim()) {
      setErrorMsg('NIK / Nomor Karyawan wajib diisi.')
      return
    }
    if (formType === 'in' && !companyName.trim()) {
      setErrorMsg('Nama Perusahaan / Instansi wajib diisi.')
      return
    }
    if (!applicantName.trim() || !department.trim() || !location.trim() || !purpose.trim() || !dateIn || !dateOutPlan) {
      setErrorMsg('Mohon lengkapi seluruh field formulir yang bertanda bintang (*).')
      return
    }
    if (!section.trim()) {
      setErrorMsg('Seksi / Bagian pembawa device wajib diisi.')
      return
    }

    // Validate equipment rows
    for (let i = 0; i < items.length; i++) {
      if (!items[i].brand.trim() || !items[i].serial_no.trim() || !items[i].id_no?.trim()) {
        setErrorMsg(`Alat #${i + 1}: Merk, Serial Number, dan No. Identifikasi Alat / Asset Tag wajib diisi.`)
        return
      }
    }

    if (!agreeRules) {
      setErrorMsg('Anda harus menyetujui pernyataan kepatuhan ISMS.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-equipment-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_type: formType,
          applicant_name: applicantName.trim(),
          applicant_nik: formType === 'out' ? applicantNik.trim() : null,
          company_name: finalCompanyName,
          department: department.trim(),
          section: section.trim(),
          location: location.trim(),
          purpose: purpose.trim(),
          date_in: dateIn,
          date_out_plan: dateOutPlan,
          items,
          applicant_phone: applicantPhone.trim() || null,
          applicant_email: applicantEmail.trim() || null,
          agree_rules: agreeRules,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim pengajuan')
      }

      setSubmittedReq(data.request)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat menyimpan formulir.')
    } finally {
      setLoading(false)
    }
  }

  const copyTrackingLink = () => {
    if (!submittedReq?.token) return
    const url = `${window.location.origin}/ijin-masuk-alat-it?token=${submittedReq.token}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  // ── Success / Status Tracking View ──
  if (submittedReq) {
    const isApproved = submittedReq.status === 'approved'
    const isReturned = submittedReq.status === 'returned'
    const isRejected = submittedReq.status === 'rejected'
    const isPending = submittedReq.status === 'pending'

    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        {/* Receipt Card */}
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-primary" />

          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-7 items-center overflow-hidden rounded-full bg-white px-2.5 shadow-xs border border-border">
                <img
                  src={`${API_BASE_PATH}/images/yazaki-logo.jpg`}
                  alt="Yazaki PT. Jatim Autocomp Indonesia"
                  className="h-3.5 w-auto object-contain"
                />
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border border-red-500/30 bg-red-50 text-red-600">
                CONFIDENTIAL
              </span>
            </div>

            {/* Status Pill in theme tones */}
            <div className="mb-4">
              {isApproved && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#dff5e6] text-[#1a6e3a] font-semibold text-sm">
                  <CheckCircle2 className="size-4 text-[#1a6e3a]" />
                  DISETUJUI OLEH IT (ACC VALID)
                </div>
              )}
              {isReturned && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 text-primary font-semibold text-sm">
                  <CheckCircle2 className="size-4 text-primary" />
                  SELESAI (SUDAH DIKEMBALIKAN & DICHECK)
                </div>
              )}
              {isRejected && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#fdecec] text-[#b3413a] font-semibold text-sm">
                  <XCircle className="size-4 text-[#b3413a]" />
                  PENGAJUAN DITOLAK
                </div>
              )}
              {isPending && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#fff3d6] text-[#8a6100] font-semibold text-sm">
                  <Clock className="size-4 text-[#8a6100]" />
                  MENUNGGU PERSETUJUAN (MGR / IAA & CHECK BY IT)
                </div>
              )}
            </div>

            <h2 className="font-display text-2xl font-semibold text-foreground">
              {submittedReq.form_type === 'out'
                ? 'Pengajuan Ijin Membawa Keluar Alat IT'
                : 'Pengajuan Ijin Membawa Masuk Alat IT'}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Kontrol No. : {submittedReq.form_type === 'out' ? 'ISMS-F-03-00-002' : 'ISMS-F-03-00-001'} · PT. JAI
            </p>

            {/* Registration Code Ticket Box */}
            <div className="w-full mt-6 p-4 rounded-xl bg-secondary/50 border border-border text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-mono-label text-[10px] text-muted-foreground uppercase">
                  Nomor Registrasi Pengajuan
                </p>
                <div className="text-base font-mono font-bold text-foreground tracking-wide mt-0.5">
                  {submittedReq.request_no}
                </div>
              </div>

              {submittedReq.approval_code && (
                <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-border pt-2 sm:pt-0 sm:pl-4">
                  <p className="font-mono-label text-[10px] text-[#1a6e3a] uppercase">
                    Kode ACC E-Sign
                  </p>
                  <div className="text-base font-mono font-bold text-[#1a6e3a]">
                    {submittedReq.approval_code}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stepper Timeline */}
          <div className="mt-6 pt-5 border-t border-dashed border-border">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="space-y-1">
                <div className="size-6 mx-auto rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-[10px]">
                  <Check className="size-3.5" />
                </div>
                <div className="font-semibold text-foreground text-[11px]">Diajukan</div>
                <div className="text-[10px] text-muted-foreground">{submittedReq.request_date}</div>
              </div>

              <div className="space-y-1">
                <div
                  className={`size-6 mx-auto rounded-full flex items-center justify-center font-bold text-[10px] ${
                    isApproved || isReturned
                      ? 'bg-primary text-primary-foreground'
                      : isRejected
                      ? 'bg-destructive text-destructive-foreground'
                      : 'bg-secondary text-foreground'
                  }`}
                >
                  {isApproved || isReturned ? (
                    <Check className="size-3.5" />
                  ) : isRejected ? (
                    <X className="size-3.5" />
                  ) : (
                    '2'
                  )}
                </div>
                <div className="font-semibold text-foreground text-[11px]">Persetujuan (ACC IT)</div>
                <div className="text-[10px] text-muted-foreground">
                  {submittedReq.approved_by || (isPending ? 'Menunggu' : '-')}
                </div>
              </div>

              <div className="space-y-1">
                <div
                  className={`size-6 mx-auto rounded-full flex items-center justify-center font-bold text-[10px] ${
                    isReturned ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {isReturned ? <Check className="size-3.5" /> : '3'}
                </div>
                <div className="font-semibold text-foreground text-[11px]">Pemeriksaan Kembali</div>
                <div className="text-[10px] text-muted-foreground">{isReturned ? 'Selesai' : 'Saat Pulang'}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Details Card */}
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary">
              <User className="size-3.5" />
            </span>
            <p className="portal-eyebrow">
              {submittedReq.form_type === 'out' ? 'Informasi Karyawan & Jadwal' : 'Informasi Tamu & Jadwal'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-secondary/30 border border-border">
              <span className="text-muted-foreground block text-[11px]">
                {submittedReq.form_type === 'out' ? 'Nama Pemohon' : 'Nama Tamu'}
              </span>
              <span className="font-semibold text-foreground text-sm mt-0.5 block">
                {submittedReq.applicant_name}
                {submittedReq.applicant_nik ? ` (${submittedReq.applicant_nik})` : ''}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-secondary/30 border border-border">
              <span className="text-muted-foreground block text-[11px]">
                {submittedReq.form_type === 'out' ? 'Perusahaan / NIK' : 'Perusahaan / Instansi'}
              </span>
              <span className="font-semibold text-foreground text-sm mt-0.5 block">
                {submittedReq.form_type === 'out'
                  ? (submittedReq.applicant_nik ? `PT. JAI (NIK: ${submittedReq.applicant_nik})` : submittedReq.company_name)
                  : submittedReq.company_name}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-secondary/30 border border-border">
              <span className="text-muted-foreground block text-[11px]">Departemen / Seksi</span>
              <span className="font-medium text-foreground mt-0.5 block">
                {submittedReq.department}{submittedReq.section ? ` / ${submittedReq.section}` : ''}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-secondary/30 border border-border">
              <span className="text-muted-foreground block text-[11px]">
                {submittedReq.form_type === 'out' ? 'Lokasi / Tujuan' : 'Lokasi / Ruangan'}
              </span>
              <span className="font-medium text-foreground mt-0.5 block">{submittedReq.location}</span>
            </div>

            <div className="p-3 rounded-xl bg-secondary/30 border border-border">
              <span className="text-muted-foreground block text-[11px]">
                {submittedReq.form_type === 'out' ? 'Tanggal Keluar' : 'Tanggal Masuk'}
              </span>
              <span className="font-semibold text-primary mt-0.5 block">{submittedReq.date_in}</span>
            </div>

            <div className="p-3 rounded-xl bg-secondary/30 border border-border">
              <span className="text-muted-foreground block text-[11px]">Rencana Kembali</span>
              <span className="font-semibold text-primary mt-0.5 block">{submittedReq.date_out_plan}</span>
            </div>

            <div className="col-span-2 p-3 rounded-xl bg-secondary/30 border border-border">
              <span className="text-muted-foreground block text-[11px]">
                {submittedReq.form_type === 'out' ? 'Tujuan Membawa Keluar Alat' : 'Tujuan Membawa Masuk Alat'}
              </span>
              <span className="font-medium text-foreground mt-0.5 block">{submittedReq.purpose}</span>
            </div>
          </div>

          {/* List of Equipment */}
          <div>
            <p className="portal-eyebrow mb-2">Daftar Perangkat yang Diajukan ({submittedReq.items.length})</p>
            <div className="space-y-2">
              {submittedReq.items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-secondary/30 border border-border flex items-start justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-foreground flex items-center gap-2">
                      <span className="size-4.5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      {it.equipment_type}
                    </div>
                    <div className="text-muted-foreground mt-1 pl-6">
                      Merk: <span className="font-medium text-foreground">{it.brand || '-'}</span> | Model:{' '}
                      <span className="font-medium text-foreground">{it.model || '-'}</span>
                    </div>
                    <div className="text-muted-foreground font-mono text-[11px] mt-0.5 pl-6">
                      S/N: <span className="text-foreground">{it.serial_no || '-'}</span>{' '}
                      {it.id_no ? `| ID Tag: ${it.id_no}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* IT Approval Box */}
          {isApproved && (
            <div className="p-4 bg-[#dff5e6] border border-[#a3e3b7] rounded-xl space-y-1 text-xs text-[#1a6e3a]">
              <div className="font-bold flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[#1a6e3a]" />
                Persetujuan & E-Sign Resmi (Manager / IAA & IT Check)
              </div>
              <div>
                Petugas ACC: <span className="font-semibold">{submittedReq.approved_by}</span> (
                {submittedReq.approved_title || 'Approver'})
              </div>
              <div className="text-[11px] opacity-80">
                Waktu ACC: {submittedReq.approved_at ? new Date(submittedReq.approved_at).toLocaleString('id-ID') : '-'}
              </div>
              {submittedReq.approval_notes && (
                <div className="italic pt-1">
                  Catatan: &quot;{submittedReq.approval_notes}&quot;
                </div>
              )}
            </div>
          )}

          {isRejected && (
            <div className="p-4 bg-[#fdecec] border border-[#f5b8b5] rounded-xl space-y-1 text-xs text-[#b3413a]">
              <div className="font-bold flex items-center gap-2">
                <XCircle className="size-4 text-[#b3413a]" />
                Pengajuan Ditolak
              </div>
              <div>Alasan: &quot;{submittedReq.rejection_reason}&quot;</div>
            </div>
          )}

          {isPending && (
            <div className="p-4 bg-[#fff3d6] border border-[#fde2a6] rounded-xl text-xs text-[#8a6100] flex items-start gap-3">
              <Clock className="size-4 shrink-0 mt-0.5" />
              <div>
                Pengajuan Anda sedang diproses untuk persetujuan Manager Departemen terkait / IAA dan verifikasi (Check by IT). Harap simpan tautan status ini.
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <a
              href={`${API_BASE_PATH}/api/it-equipment-requests/${submittedReq.id}/pdf?token=${submittedReq.token}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-semibold text-xs transition shadow-sm"
            >
              <Download className="size-4" /> Unduh Dokumen Form (PDF)
            </a>

            <button
              type="button"
              onClick={copyTrackingLink}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition border border-border"
            >
              {copiedLink ? <Check className="size-4 text-[#1a6e3a]" /> : <Copy className="size-4" />}
              {copiedLink ? 'Link Tersalin!' : 'Salin Link Status'}
            </button>
          </div>
        </section>

        <div className="text-center pb-8">
          <button
            type="button"
            onClick={() => {
              setSubmittedReq(null)
              setIsCustomDept(false)
              setCustomDeptText('')
              window.history.replaceState({}, '', '/ijin-masuk-alat-it')
            }}
            className="text-xs text-primary hover:underline transition"
          >
            ← Isi formulir pengajuan baru untuk tamu lain
          </button>
        </div>
      </div>
    )
  }

  // ── Registration Form View ──
  return (
    <div className="mx-auto w-full max-w-3xl flex flex-col gap-6">
      {/* Top Banner & Quick Status Lookup */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <Link
          href="/form-aplikasi"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition font-medium"
        >
          ← Kembali ke Form Aplikasi
        </Link>
        <div className="flex items-center gap-3">
          {adminUser && (
            <>
              <button
                type="button"
                onClick={handleExportEquipmentExcel}
                disabled={exportingExcel}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white transition shadow-2xs disabled:opacity-50 cursor-pointer"
                title="Export rekap data izin barang masuk/keluar ke Excel (.xlsx)"
              >
                <Download className="size-3.5" />
                <span>{exportingExcel ? 'Mengunduh...' : 'Export Excel'}</span>
              </button>
              <Link
                href="/kelola-izin-alat-it"
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary transition hover:bg-primary hover:text-primary-foreground shadow-2xs"
              >
                <Laptop className="size-3.5" />
                <span>Kelola Izin Alat IT (Admin)</span>
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-primary hover:underline font-semibold transition"
          >
            <Search className="size-3.5" /> Sudah pernah mengajukan? Cek Status di Sini
          </button>
        </div>
      </div>

      {searchOpen && (
        <form
          onSubmit={handleSearchStatus}
          className="p-4 rounded-2xl border border-primary/30 bg-primary/5 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5 text-primary">
              <Search className="size-3.5" /> Lacak Status Pengajuan Alat
            </span>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Tutup
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Masukkan Token Rahasia atau Link Status Anda..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={searchLoading}
              className="px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold rounded-xl transition shrink-0"
            >
              {searchLoading ? 'Mencari...' : 'Periksa'}
            </button>
          </div>
          {searchError && <p className="text-xs text-destructive">{searchError}</p>}
        </form>
      )}

      {/* Main Card Header - Themed to warm cream & crisp card */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-primary" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 items-center overflow-hidden rounded-full bg-white px-3 shadow-xs border border-border">
              <img
                src={`${API_BASE_PATH}/images/yazaki-logo.jpg`}
                alt="Yazaki PT. Jatim Autocomp Indonesia"
                className="h-4.5 w-auto object-contain"
              />
            </span>
            <div>
              <div className="text-[11px] font-bold text-[#c7161e] tracking-wider">YAZAKI GROUP</div>
              <div className="text-xs text-muted-foreground">PT. Jatim Autocomp Indonesia</div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border border-red-500/30 bg-red-50 text-red-600">
              CONFIDENTIAL
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-secondary border border-border text-foreground">
              {formType === 'in' ? 'ISMS-F-03-00-001' : 'ISMS-F-03-00-002'}
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-mono-label text-[10px] font-semibold text-primary mb-2">
              <Laptop className="size-3.5" />
              Sistem Registrasi & E-Sign IT (H-1)
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold leading-tight text-foreground">
              {formType === 'in'
                ? 'Ijin Membawa Masuk PC, USB & Alat IT'
                : 'Ijin Membawa Keluar PC, USB & Alat IT'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              {formType === 'in'
                ? 'Wajib diisi oleh affiliate Yazaki / rekanan / tamu (H-1) sebelum membawa masuk device ke area PT. JAI untuk verifikasi dan persetujuan (ACC) dari divisi IT PT. JAI.'
                : 'Khusus karyawan PT. JAI yang membawa perangkat IT inventaris kantor keluar dari area PT. JAI (H-1) untuk mendapatkan persetujuan dari Manager Departemen dan divisi IT PT. JAI.'}
            </p>
          </div>

          {/* Segmented Switcher in Theme */}
          <div className="inline-flex rounded-full border border-border bg-secondary/50 p-1 shadow-xs self-start md:self-end">
            <button
              type="button"
              onClick={() => setFormType('in')}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                formType === 'in'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Membawa Masuk (Affiliate Yazaki / 001)
            </button>
            <button
              type="button"
              onClick={() => setFormType('out')}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                formType === 'out'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Membawa Keluar (Karyawan PT. JAI / 002)
            </button>
          </div>
        </div>
      </section>

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMsg && (
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-2xl text-destructive text-xs flex items-center gap-2.5">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Section 1: Data Tamu & Perusahaan */}
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary">
              <User className="size-3.5" />
            </span>
            <p className="portal-eyebrow">
              {formType === 'out'
                ? '1. Informasi Karyawan PT. JAI (Pemohon)'
                : '1. Informasi Affiliate Yazaki / Tamu Pemohon'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                {formType === 'out' ? 'Nama Lengkap Karyawan PT. JAI' : 'Nama Lengkap Tamu / Affiliate'}{' '}
                <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                placeholder={formType === 'out' ? 'Contoh: Budi Santoso (Karyawan JAI)' : 'Contoh: Budi Santoso'}
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                className={inputClass}
              />
            </div>

            {formType === 'out' ? (
              <div>
                <label className={labelClass}>
                  NIK / Nomor Karyawan PT. JAI <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 123456 / NIK Karyawan"
                  value={applicantNik}
                  onChange={(e) => setApplicantNik(e.target.value)}
                  className={`${inputClass} font-mono`}
                />
              </div>
            ) : (
              <div>
                <label className={labelClass}>
                  Nama Perusahaan / Affiliate Yazaki <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT. EDS Manufacturing Indonesia / Yazaki Parts"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label className={labelClass}>
                {formType === 'out' ? 'Departemen Karyawan' : 'Departemen JAI Yang Dikunjungi'}{' '}
                <span className="text-destructive">*</span>
              </label>
              {!isCustomDept ? (
                <div className="space-y-1.5">
                  <select
                    required
                    value={department}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomDept(true)
                        setDepartment('')
                      } else {
                        setDepartment(e.target.value)
                      }
                    }}
                    className={inputClass}
                  >
                    <option value="">
                      {formType === 'out'
                        ? '-- Pilih Departemen Karyawan --'
                        : '-- Pilih Departemen JAI Yang Dikunjungi --'}
                    </option>
                    {(availableDepartments.length > 0 ? availableDepartments : DEFAULT_DEPARTMENTS).map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                    <option value="__custom__">Lainnya (Ketik Manual)...</option>
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder={
                      formType === 'out'
                        ? 'Ketik nama departemen karyawan...'
                        : 'Ketik nama departemen JAI yang dikunjungi...'
                    }
                    value={customDeptText}
                    onChange={(e) => {
                      setCustomDeptText(e.target.value)
                      setDepartment(e.target.value)
                    }}
                    className={inputClass}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomDept(false)
                      setCustomDeptText('')
                      setDepartment('')
                    }}
                    className="px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-xl whitespace-nowrap bg-secondary/50"
                  >
                    Pilih Daftar
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>
                {formType === 'out' ? 'Seksi / Bagian Karyawan' : 'Seksi / Bagian Yang Dikunjungi'}{' '}
                <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Network & Infra / IT Support / QA Line 1"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                {formType === 'out'
                  ? 'Lokasi / Tempat Tujuan Membawa Alat (Di Luar JAI)'
                  : 'Lokasi / Ruangan Tujuan di PT. JAI'}{' '}
                <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                placeholder={
                  formType === 'out'
                    ? 'Contoh: Work From Home (WFH) / Plant Pasuruan / Site Vendor / Perjalanan Dinas'
                    : 'Contoh: Gedung A Lt. 2 / Server Room / Meeting Room 3'
                }
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                {formType === 'out'
                  ? 'No. Telepon / WhatsApp Karyawan (Konfirmasi ACC)'
                  : 'No. Telepon / WhatsApp (Konfirmasi ACC)'}
              </label>
              <input
                type="tel"
                placeholder="Contoh: 081234567890"
                value={applicantPhone}
                onChange={(e) => setApplicantPhone(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        {/* Section 2: Jadwal & Tujuan */}
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary">
              <Calendar className="size-3.5" />
            </span>
            <p className="portal-eyebrow">
              {formType === 'out'
                ? '2. Jadwal & Keperluan Membawa Alat Keluar PT. JAI'
                : '2. Jadwal & Keperluan Masuk PT. JAI'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-secondary/50 border border-border text-xs text-foreground flex items-center gap-2.5">
            <Info className="size-4 shrink-0 text-primary" />
            <span>
              <strong>Aturan Pengajuan H-1:</strong>{' '}
              {formType === 'out'
                ? 'Disarankan mengisi formulir minimal 1 hari sebelum membawa alat IT keluar dari area PT. JAI agar Manager Departemen dan tim IT dapat menyetujui serta memeriksa fisik perangkat sebelum melewati pos Security.'
                : 'Disarankan mengisi formulir minimal 1 hari sebelum membawa masuk perangkat ke area PT. JAI agar Manager Departemen terkait dan tim IT dapat memverifikasi serta menyetujui (ACC) sebelum Anda tiba di pos Security.'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                {formType === 'out' ? 'Tanggal Keluar dari JAI' : 'Tanggal Masuk ke JAI'}{' '}
                <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                required
                value={dateIn}
                onChange={(e) => setDateIn(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                {formType === 'out'
                  ? 'Tanggal Rencana Kembali / Masuk Lagi ke JAI'
                  : 'Tanggal Rencana Selesai / Keluar dari JAI'}{' '}
                <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                required
                value={dateOutPlan}
                onChange={(e) => setDateOutPlan(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>
                {formType === 'out'
                  ? 'Tujuan / Keperluan Membawa Alat Keluar PT. JAI'
                  : 'Tujuan Membawa Masuk Alat ke PT. JAI'}{' '}
                <span className="text-destructive">*</span>
              </label>
              <textarea
                required
                rows={2}
                placeholder={
                  formType === 'out'
                    ? 'Jelaskan keperluan membawa alat IT keluar PT. JAI (misal: Work From Home / WFH, Kunjungan Kerja ke Vendor, Support Operasional Plant Pasuruan, Perjalanan Dinas)...'
                    : 'Jelaskan kebutuhan pengoperasian alat di PT. JAI (misal: Maintenance server CCTV, Presentasi demo software ke QA, Setting controller PLC)...'
                }
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full rounded-xl border border-input bg-card p-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15"
              />
            </div>
          </div>
        </section>

        {/* Section 3: Daftar Alat */}
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary">
                <Laptop className="size-3.5" />
              </span>
              <p className="portal-eyebrow">
                {formType === 'out'
                  ? '3. Alat IT PT. JAI yang Dibawa Keluar (Laptop, Flashdisk, Kamera, dll.)'
                  : '3. Alat yang Dibawa Masuk ke PT. JAI (PC, Flashdisk, Kamera, dll.)'}
              </p>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleAddItem('PC / Laptop')}
                className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary transition"
              >
                + Laptop
              </button>
              <button
                type="button"
                onClick={() => handleAddItem('USB Memory / Flashdisk')}
                className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary transition"
              >
                + Flashdisk
              </button>
              <button
                type="button"
                onClick={() => handleAddItem('Kamera')}
                className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary transition"
              >
                + Kamera
              </button>
            </div>
          </div>

          {/* List Repeater */}
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-border bg-secondary/20 space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-2">
                    <span className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    Alat #{idx + 1}
                  </span>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded-lg transition"
                      title="Hapus baris alat ini"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className={labelClass}>
                      Tipe Perangkat <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={item.equipment_type}
                      onChange={(e) => handleItemChange(idx, 'equipment_type', e.target.value)}
                      className={inputClass}
                    >
                      {EQUIPMENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>
                      Produsen / Merk <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Lenovo / Dell / SanDisk"
                      value={item.brand}
                      onChange={(e) => handleItemChange(idx, 'brand', e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Model / Tipe Perangkat</label>
                    <input
                      type="text"
                      placeholder="Contoh: ThinkPad L14 / EOS 3000D"
                      value={item.model}
                      onChange={(e) => handleItemChange(idx, 'model', e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Serial Number (S/N) <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: PF3XXXXX / No S/N"
                      value={item.serial_no}
                      onChange={(e) => handleItemChange(idx, 'serial_no', e.target.value)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelClass}>
                      No. Identifikasi Alat / Asset Tag <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: AST-0192 / No. Identifikasi Asset Inventaris"
                      value={item.id_no || ''}
                      onChange={(e) => handleItemChange(idx, 'id_no', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleAddItem()}
            className="w-full py-2.5 rounded-xl border border-dashed border-border hover:border-primary hover:bg-secondary/40 text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Plus className="size-4" /> Tambah Baris Alat Lainnya
          </button>
        </section>

        {/* Section 4: Rules & Security Notice */}
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <span className="grid size-7 place-items-center rounded-full bg-accent/20 text-accent-foreground">
              <ShieldAlert className="size-3.5 text-accent" />
            </span>
            <p className="portal-eyebrow">
              {formType === 'out'
                ? '4. Ketentuan Keamanan ISMS (Khusus Karyawan PT. JAI Pembawa Alat Keluar)'
                : '4. Ketentuan Keamanan ISMS (Wajib Dipatuhi Visitor / Affiliate Yazaki)'}
            </p>
          </div>

          {formType === 'out' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-1">
                <div className="font-semibold text-foreground">(1) Kerahasiaan Data Perusahaan:</div>
                <p className="text-[11px]">
                  Dilarang memindahkan, menyalin, atau mendistribusikan data rahasia PT. JAI ke pihak ketiga atau perangkat pribadi tanpa persetujuan resmi.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-1">
                <div className="font-semibold text-foreground">(2) Keamanan Koneksi Jaringan Luar:</div>
                <p className="text-[11px]">
                  Wajib menggunakan VPN resmi PT. JAI saat terkoneksi ke sistem internal dan hindari penggunaan Wi-Fi publik tanpa proteksi keamanan.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-1 sm:col-span-2">
                <div className="font-semibold text-foreground">(3) Tanggung Jawab Fisik Perangkat:</div>
                <p className="text-[11px]">
                  Karyawan pemohon bertanggung jawab penuh menjaga keutuhan, keamanan, dan kondisi fisik perangkat dari risiko kehilangan, tertinggal, atau kerusakan selama di luar area PT. JAI.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-1 sm:col-span-2">
                <div className="font-semibold text-foreground">(4) Pemeriksaan Security Saat Keluar & Masuk Kembali:</div>
                <p className="text-[11px]">
                  Petugas Security dan tim IT berhak memeriksa fisik perangkat saat dibawa keluar gerbang dan saat dikembalikan/masuk kembali ke area PT. JAI.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-1">
                <div className="font-semibold text-foreground">(1) Transfer Data:</div>
                <p className="text-[11px]">
                  Mintakan persetujuan dari pihak terkait PT. JAI bila akan memasukkan/mentransfer data ke PC.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-1">
                <div className="font-semibold text-foreground">(2) Koneksi Network:</div>
                <p className="text-[11px]">
                  Bila akan menyambungkan PC ke network, mohon diisi form pengajuan penyambungan network terpisah.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-1 sm:col-span-2">
                <div className="font-semibold text-foreground">(3) Larangan Jaringan Internal:</div>
                <p className="text-[11px]">
                  *Visitor selain dari Yazaki group <strong>tidak diizinkan</strong> melakukan penyambungan PC ke
                  network internal perusahaan.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-1 sm:col-span-2">
                <div className="font-semibold text-foreground">(4) Pemeriksaan Saat Masuk & Keluar Kantor:</div>
                <p className="text-[11px]">
                  Saat memasuki area kantor dan saat keluar kantor, Security & IT berhak memeriksa bahwa seluruh alat yang dibawa sama dengan yang diajukan dan tidak membawa informasi rahasia tidak terkait.
                </p>
              </div>
            </div>
          )}

          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-secondary/40 border border-border cursor-pointer transition hover:bg-secondary/60">
            <input
              type="checkbox"
              required
              checked={agreeRules}
              onChange={(e) => setAgreeRules(e.target.checked)}
              className="mt-0.5 size-4 rounded text-primary focus:ring-ring border-input"
            />
            <span className="text-xs font-medium text-foreground">
              {formType === 'out'
                ? 'Saya sebagai karyawan PT. JAI telah membaca, memahami, dan bertanggung jawab penuh mematuhi seluruh ketentuan keamanan informasi (ISMS) selama membawa alat keluar kantor.'
                : 'Saya telah membaca, memahami, dan menyatakan bersedia mematuhi seluruh ketentuan keamanan informasi (ISMS) PT. Jatim Autocomp Indonesia.'}
            </span>
          </label>
        </section>

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-xl bg-primary hover:opacity-95 disabled:opacity-50 text-primary-foreground font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin size-4 border-2 border-white border-t-transparent rounded-full" />
                {formType === 'out'
                  ? 'Mengirim Pengajuan Bawa Keluar Alat...'
                  : 'Mengirim Pengajuan Bawa Masuk Alat...'}
              </>
            ) : (
              <>
                {formType === 'out'
                  ? 'Kirim Pengajuan Izin Membawa Keluar Alat'
                  : 'Kirim Pengajuan Izin Membawa Masuk Alat'}{' '}
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
          <p className="text-[11px] text-muted-foreground text-center mt-2.5">
            {formType === 'out'
              ? 'Setelah dikirim, pengajuan bawa keluar wajib disetujui Manager Departemen yang bersangkutan dan dilakukan pemeriksaan fisik perangkat oleh tim IT & Security PT. JAI.'
              : 'Setelah dikirim, pengajuan bawa masuk disetujui Manager dari Departemen yang bersangkutan / IAA, setelah itu dilakukan check by IT.'}
          </p>
        </div>
      </form>
    </div>
  )
}

export default function VisitorItEquipmentFormPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-96 flex items-center justify-center p-6">
          <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      }
    >
      <FormContent />
    </Suspense>
  )
}
