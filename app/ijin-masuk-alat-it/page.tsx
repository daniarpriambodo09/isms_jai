'use client'

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Laptop,
  HardDrive,
  Camera,
  Plus,
  Minus,
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
  Link2,
  RefreshCw,
  Eye,
  ExternalLink,
} from 'lucide-react'
import {
  EQUIPMENT_TYPES,
  DEFAULT_DEPARTMENTS,
  type ItEquipmentItem,
  type ItEquipmentRequest,
} from '@/lib/it-equipment-shared'
import { API_BASE_PATH } from '@/lib/config'
import { copyText } from '@/lib/clipboard'
import { downloadExcel } from '@/lib/excel-export'
import { useAuth } from '@/context/AuthContext'
import { GuestLinkGeneratorModal } from '@/components/it/GuestLinkGeneratorModal'
import { NetworkPassCard } from '@/components/it/NetworkPassCard'

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
  const [guestLinkModalOpen, setGuestLinkModalOpen] = useState(false)
  const [guestLinkCount, setGuestLinkCount] = useState<number>(1)

  // ── History & Transparency State ──
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form')
  const [historyList, setHistoryList] = useState<ItEquipmentRequest[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyFilterType, setHistoryFilterType] = useState<'all' | 'in' | 'out'>('all')
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>('all')
  const [historySearch, setHistorySearch] = useState<string>('')
  const [historyCopiedId, setHistoryCopiedId] = useState<number | null>(null)

  const fetchHistory = useCallback(
    async (
      typeFilter = historyFilterType,
      statusFilter = historyFilterStatus,
      searchVal = historySearch
    ) => {
      setHistoryLoading(true)
      try {
        const params = new URLSearchParams()
        if (typeFilter && typeFilter !== 'all') params.set('form_type', typeFilter)
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
        if (searchVal && searchVal.trim()) params.set('q', searchVal.trim())

        const res = await fetch(`${API_BASE_PATH}/api/it-equipment-requests?${params.toString()}`)
        const data = await res.json()
        if (data.requests) {
          setHistoryList(data.requests)
        }
      } catch (err) {
        console.error('Failed to load IT equipment history:', err)
      } finally {
        setHistoryLoading(false)
      }
    },
    [historyFilterType, historyFilterStatus, historySearch]
  )

  // Initial load to populate counts
  useEffect(() => {
    fetchHistory('all', 'all', '')
  }, [])

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory()
    }
  }, [activeTab, fetchHistory])

  const historyCounts = useMemo(() => {
    const all = historyList.length
    const pending = historyList.filter(
      (r) => r.status === 'pending' || r.status === 'approved_manager'
    ).length
    const approved = historyList.filter((r) => r.status === 'approved').length
    const returned = historyList.filter((r) => r.status === 'returned').length
    const rejected = historyList.filter((r) => r.status === 'rejected').length
    return { all, pending, approved, returned, rejected }
  }, [historyList])

  const handleViewRequestFromHistory = (req: ItEquipmentRequest) => {
    setSubmittedReq(req)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
        throw new Error('Pengajuan dengan nomor atau token tersebut tidak ditemukan. Pastikan nomor pengajuan Anda sudah benar.')
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

  const handleExportSingleExcel = (req: ItEquipmentRequest) => {
    const headers = [
      'No',
      'No. Pengajuan',
      'Jenis Formulir',
      'Nama Pembawa / Pemohon',
      'NIK Karyawan',
      'Instansi / Perusahaan',
      'Departemen',
      'Seksi / Bagian',
      'Lokasi Kerja / Kunjungan',
      'Keperluan / Tujuan',
      'Tanggal Masuk / Bawa',
      'Rencana Keluar / Kembali',
      'Status Approval',
      'Alat Ke-',
      'Jenis Perangkat',
      'Nama / Identifikasi Alat',
      'Produsen / Merk',
      'Model / Tipe',
      'Serial Number (S/N)',
      'Waktu Pengajuan',
    ]

    const items = Array.isArray(req.items) ? req.items : []
    const rows = (items.length > 0 ? items : [{ id: '1', equipment_type: '-', id_no: '-', brand: '-', model: '-', serial_no: '-' }]).map((it, idx) => [
      idx + 1,
      req.request_no,
      req.form_type === 'out' ? 'ISMS-F-03-00-002 (Membawa Keluar PT. JAI)' : 'ISMS-F-03-00-001 (Membawa Masuk Tamu)',
      req.applicant_name,
      req.applicant_nik || '-',
      req.company_name,
      req.department,
      req.section || '-',
      req.location,
      req.purpose,
      req.date_in,
      req.date_out_plan,
      req.status === 'approved' ? 'Disetujui (Aktif)' : req.status === 'rejected' ? 'Ditolak' : req.status === 'returned' ? 'Dikembalikan' : req.status === 'approved_manager' ? 'Disetujui Manager (Menunggu IT)' : 'Menunggu Persetujuan',
      idx + 1,
      it.equipment_type || '-',
      it.id_no || '-',
      it.brand || '-',
      it.model || '-',
      it.serial_no || '-',
      req.created_at ? new Date(req.created_at).toLocaleString('id-ID') : '-',
    ])

    downloadExcel(`Form-Alat-IT-${req.request_no}`, headers, rows, 'Pengajuan Alat')
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
        setErrorMsg(`Alat #${i + 1}: Produsen/Merk, Serial Number, dan No. / Nama Identifikasi Alat wajib diisi.`)
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

  const copyTrackingLink = async () => {
    if (!submittedReq?.token) return
    const url = `${window.location.origin}/ijin-masuk-alat-it?token=${submittedReq.token}`
    const ok = await copyText(url)
    if (ok) {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    }
  }

  // ── Success / Status Tracking View ──
  if (submittedReq) {
    const isApprovedManager = submittedReq.status === 'approved_manager'
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
                  {submittedReq.form_type === 'out'
                    ? 'IZIN AKTIF · SEDANG DIBAWA KELUAR (BELUM CLOSED)'
                    : 'DISETUJUI LENGKAP (IAA / MGR DEPT & CHECK BY IT)'}
                </div>
              )}
              {isApprovedManager && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/15 text-blue-700 font-semibold text-sm">
                  <Clock className="size-4 text-blue-700" />
                  TAHAP 1 DISETUJUI IAA / MGR DEPT &middot; MENUNGGU VERIFIKASI IT
                </div>
              )}
              {isReturned && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 text-primary font-semibold text-sm">
                  <CheckCircle2 className="size-4 text-primary" />
                  {submittedReq.form_type === 'out'
                    ? 'CLOSED / SELESAI · PERANGKAT TELAH KEMBALI & DITANDATANGANI LENGKAP'
                    : 'SELESAI (SUDAH DIKEMBALIKAN & DICHECK)'}
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
                  TAHAP 1: MENUNGGU PERSETUJUAN IAA / MANAGER DEPARTEMEN
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

          {/* Stepper Timeline (1. Diajukan -> 2. IAA/Mgr Dept -> 3. Check IT -> 4. Kembali) */}
          <div className="mt-6 pt-5 border-t border-dashed border-border">
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="space-y-1">
                <div className="size-6 mx-auto rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-[10px]">
                  <Check className="size-3.5" />
                </div>
                <div className="font-semibold text-foreground text-[11px]">1. Diajukan</div>
                <div className="text-[10px] text-muted-foreground">{submittedReq.request_date}</div>
              </div>

              <div className="space-y-1">
                <div
                  className={`size-6 mx-auto rounded-full flex items-center justify-center font-bold text-[10px] ${
                    isApprovedManager || isApproved || isReturned
                      ? 'bg-primary text-primary-foreground'
                      : isRejected
                      ? 'bg-destructive text-destructive-foreground'
                      : 'bg-secondary text-foreground'
                  }`}
                >
                  {isApprovedManager || isApproved || isReturned ? (
                    <Check className="size-3.5" />
                  ) : isRejected ? (
                    <X className="size-3.5" />
                  ) : (
                    '2'
                  )}
                </div>
                <div className="font-semibold text-foreground text-[11px]">2. IAA / Mgr Dept</div>
                <div className="text-[10px] text-muted-foreground">
                  {submittedReq.approved_by || (isPending ? 'Menunggu' : '-')}
                </div>
              </div>

              <div className="space-y-1">
                <div
                  className={`size-6 mx-auto rounded-full flex items-center justify-center font-bold text-[10px] ${
                    isApproved || isReturned
                      ? 'bg-primary text-primary-foreground'
                      : isRejected
                      ? 'bg-destructive text-destructive-foreground'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {isApproved || isReturned ? (
                    <Check className="size-3.5" />
                  ) : isRejected ? (
                    <X className="size-3.5" />
                  ) : (
                    '3'
                  )}
                </div>
                <div className="font-semibold text-foreground text-[11px]">3. Check IT (SSA)</div>
                <div className="text-[10px] text-muted-foreground">
                  {submittedReq.it_checked_by ||
                    (isApprovedManager ? 'Menunggu IT' : isPending ? 'Terkunci' : '-')}
                </div>
              </div>

              <div className="space-y-1">
                <div
                  className={`size-6 mx-auto rounded-full flex items-center justify-center font-bold text-[10px] ${
                    isReturned ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {isReturned ? <Check className="size-3.5" /> : '4'}
                </div>
                <div className="font-semibold text-foreground text-[11px]">4. Kembali</div>
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
              onClick={() => handleExportSingleExcel(submittedReq)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-emerald-600 bg-white dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold text-xs hover:bg-emerald-50 dark:hover:bg-emerald-900 transition shadow-2xs cursor-pointer"
            >
              <Download className="size-4 text-emerald-600" /> Unduh Data (Excel)
            </button>

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

        {/* Slip Parameter Jaringan & Internet Resmi PT. JAI */}
        {isApproved && submittedReq.form_type === 'in' && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              Slip Parameter Jaringan &amp; Internet Tamu PT. JAI
            </h3>
            <NetworkPassCard
              data={{
                recipientName: submittedReq.applicant_name,
                companyOrDept: `${submittedReq.company_name} · ${submittedReq.department}`,
                requestNoOrCode: submittedReq.request_no,
                ssid: submittedReq.network_ssid || 'JAI-CORP-GUEST',
                networkUsername: submittedReq.network_username,
                networkPassword: submittedReq.network_password,
                ipMode: submittedReq.ip_mode || 'static',
                assignedIp:
                  submittedReq.assigned_ip ||
                  `192.168.50.${(submittedReq.id % 150) + 50}`,
                subnetMask: submittedReq.subnet_mask || '255.255.255.0',
                gateway: submittedReq.gateway || '192.168.50.1',
                dnsPrimary: submittedReq.dns_primary || '192.168.1.10',
                dnsSecondary: submittedReq.dns_secondary || '8.8.8.8',
                validFrom: submittedReq.date_in,
                validUntil: submittedReq.date_out_plan,
                approvedBy:
                  submittedReq.it_checked_by ||
                  submittedReq.approved_by ||
                  'System Security Admin (IT)',
                approvedAt: submittedReq.it_checked_at || submittedReq.approved_at,
                directLink: typeof window !== 'undefined' ? window.location.href : undefined,
              }}
            />
          </section>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4 pb-8 text-xs">
          <button
            type="button"
            onClick={() => {
              setSubmittedReq(null)
              setActiveTab('history')
              fetchHistory()
              window.history.replaceState({}, '', '/ijin-masuk-alat-it')
            }}
            className="inline-flex items-center gap-1.5 font-bold text-foreground hover:text-primary transition cursor-pointer"
          >
            <Clock className="size-3.5" />
            <span>← Kembali ke Riwayat Pengajuan</span>
          </button>
          <span className="text-muted-foreground">&bull;</span>
          <button
            type="button"
            onClick={() => {
              setSubmittedReq(null)
              setActiveTab('form')
              setIsCustomDept(false)
              setCustomDeptText('')
              window.history.replaceState({}, '', '/ijin-masuk-alat-it')
            }}
            className="text-primary hover:underline transition font-semibold cursor-pointer"
          >
            + Isi formulir pengajuan baru
          </button>
        </div>
      </div>
    )
  }

  // ── Registration Form View ──
  return (
    <div className="mx-auto w-full max-w-4xl flex flex-col gap-6 pb-16">
      {/* Top Banner & Quick Status Lookup */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <Link
          href="/form-aplikasi"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition font-medium"
        >
          &larr; Kembali ke Form Aplikasi
        </Link>
        <div className="flex flex-wrap items-center gap-2.5">
          {adminUser && (
            <Link
              href="/kelola-izin-alat-it"
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-primary-foreground shadow-2xs"
            >
              <Laptop className="size-3.5" />
              <span>Kelola Izin Alat IT (Admin)</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-primary hover:underline font-semibold transition cursor-pointer"
          >
            <Search className="size-3.5" /> Sudah pernah mengajukan? Cek Status di Sini
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Form vs History) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
              activeTab === 'form'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/80'
            }`}
          >
            <FileText className="size-4" />
            <span>Isi Formulir Izin Alat</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('history')
              fetchHistory()
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/80'
            }`}
          >
            <Clock className="size-4" />
            <span>Riwayat Pengajuan (History)</span>
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === 'history'
                  ? 'bg-white/20 text-white'
                  : 'bg-secondary text-foreground'
              }`}
            >
              {historyCounts.all}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportEquipmentExcel}
            disabled={exportingExcel}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-foreground px-3.5 py-2 text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Download rekap data seluruh izin barang masuk/keluar ke Excel (.xlsx)"
          >
            <Download className="size-3.5 text-primary" />
            <span>{exportingExcel ? 'Mengunduh...' : 'Export Excel'}</span>
          </button>
          {activeTab === 'history' && (
            <button
              type="button"
              onClick={() => fetchHistory()}
              disabled={historyLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${historyLoading ? 'animate-spin text-primary' : ''}`} />
              <span className="hidden sm:inline">Refresh Data</span>
            </button>
          )}
        </div>
      </div>

      {searchOpen && (
        <form
          onSubmit={handleSearchStatus}
          className="p-4 rounded-2xl border border-primary/30 bg-primary/5 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5 text-primary">
              <Search className="size-3.5" /> Lacak Status Pengajuan Alat
            </span>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Tutup
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Masukkan Nomor Pengajuan (contoh: IT-OUT-20261030-003) atau Token Tracking..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={searchLoading}
              className="px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold rounded-xl transition shrink-0 cursor-pointer"
            >
              {searchLoading ? 'Mencari...' : 'Periksa'}
            </button>
          </div>
          {searchError && <p className="text-xs text-destructive">{searchError}</p>}
        </form>
      )}

      {activeTab === 'form' && (
        <>
          {/* Main Card Header */}
          <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-primary" />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Laptop className="size-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="portal-eyebrow">SISTEM REGISTRASI &amp; E-SIGN IT (H-1)</span>
                <span className="text-muted-foreground/40">&bull;</span>
                <span className="rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
                  {formType === 'in' ? 'ISMS-F-03-00-001' : 'ISMS-F-03-00-002'}
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {formType === 'in'
                  ? 'Izin Membawa Masuk PC, USB & Alat IT'
                  : 'Izin Membawa Keluar PC, USB & Alat IT'}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
                {formType === 'in'
                  ? 'Wajib diisi oleh affiliate Yazaki / rekanan / tamu (H-1) sebelum membawa masuk perangkat ke area PT. JAI untuk verifikasi dan persetujuan divisi IT.'
                  : 'Khusus karyawan PT. JAI yang membawa perangkat IT inventaris kantor keluar dari area PT. JAI (H-1) dengan persetujuan Manager Departemen dan divisi IT.'}
              </p>
            </div>
          </div>

          {/* Responsive Segmented Switcher & Generate Link Tamu */}
          <div className="flex flex-col items-stretch lg:items-end gap-2.5 shrink-0">
            <div className="grid grid-cols-2 rounded-xl border border-border bg-secondary/50 p-1 shadow-2xs sm:inline-flex self-stretch lg:self-end shrink-0">
              <button
                type="button"
                onClick={() => setFormType('in')}
                className={`rounded-lg px-3.5 py-2 text-left transition-colors cursor-pointer ${
                  formType === 'in'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="block text-xs font-bold">Membawa Masuk (001)</span>
                <span className={`block text-[10px] ${formType === 'in' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  Affiliate Yazaki / Tamu
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFormType('out')}
                className={`rounded-lg px-3.5 py-2 text-left transition-colors cursor-pointer ${
                  formType === 'out'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="block text-xs font-bold">Membawa Keluar (002)</span>
                <span className={`block text-[10px] ${formType === 'out' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  Karyawan PT. JAI
                </span>
              </button>
            </div>

            {/* Kontrol Generate Link Tamu (HANYA untuk Membawa Masuk 001 Tamu / Afiliasi) */}
            {formType === 'in' ? (
              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 rounded-xl border border-primary/25 bg-primary/5 p-1.5 pl-3">
                <label htmlFor="header-guest-link-count" className="text-[11px] font-bold text-foreground whitespace-nowrap">
                  Jumlah Link:
                </label>
                <div className="inline-flex items-center rounded-lg border border-border bg-card">
                  <button
                    type="button"
                    onClick={() => setGuestLinkCount((c) => Math.max(1, c - 1))}
                    aria-label="Kurangi jumlah link"
                    className="px-2 py-1 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <Minus className="size-3" aria-hidden="true" />
                  </button>
                  <input
                    id="header-guest-link-count"
                    type="number"
                    min={1}
                    max={50}
                    value={guestLinkCount}
                    onChange={(e) =>
                      setGuestLinkCount(Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)))
                    }
                    className="w-10 bg-transparent text-center font-mono text-xs font-bold text-foreground outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setGuestLinkCount((c) => Math.min(50, c + 1))}
                    aria-label="Tambah jumlah link"
                    className="px-2 py-1 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <Plus className="size-3" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setGuestLinkModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-2xs transition hover:bg-primary/90 cursor-pointer"
                >
                  <Link2 className="size-3.5" aria-hidden="true" />
                  <span>Generate {guestLinkCount} Link Tamu (Alat IT + Network)</span>
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/40 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground self-stretch sm:self-auto justify-center">
                <span>Formulir Khusus Internal Karyawan PT. JAI (Pengajuan langsung tanpa link tamu)</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Unified Document Form Sheet */}
      <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="divide-y divide-border p-6 sm:p-8 [&>section+section]:pt-8 space-y-8">
          {errorMsg && (
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-xs flex items-center gap-2.5">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Data Tamu & Perusahaan */}
          <section className="space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <span className="grid size-7 place-items-center rounded-lg font-mono text-xs font-bold bg-primary text-primary-foreground">
                01
              </span>
              <div>
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                  {formType === 'out'
                    ? 'Informasi Karyawan PT. JAI (Pemohon)'
                    : 'Informasi Affiliate Yazaki / Tamu Pemohon'}
                </h2>
                <p className="text-[11px] text-muted-foreground font-medium">
                  Identitas pemohon, departemen tujuan, dan kontak konfirmasi persetujuan
                </p>
              </div>
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
                  autoComplete="name"
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
                    autoComplete="organization"
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
                autoComplete="tel"
                placeholder="Contoh: 081234567890"
                value={applicantPhone}
                onChange={(e) => setApplicantPhone(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        {/* Section 2: Jadwal & Tujuan */}
        <section className="space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <span className="grid size-7 place-items-center rounded-lg font-mono text-xs font-bold bg-primary text-primary-foreground">
              02
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                {formType === 'out'
                  ? 'Jadwal & Keperluan Membawa Alat Keluar PT. JAI'
                  : 'Jadwal & Keperluan Masuk PT. JAI'}
              </h2>
              <p className="text-[11px] text-muted-foreground font-medium">
                Rentang tanggal dan tujuan pengoperasian perangkat IT
              </p>
            </div>
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
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="grid size-7 place-items-center rounded-lg font-mono text-xs font-bold bg-primary text-primary-foreground">
                03
              </span>
              <div>
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                  {formType === 'out'
                    ? 'Alat IT PT. JAI yang Dibawa Keluar'
                    : 'Alat yang Dibawa Masuk ke PT. JAI'}
                </h2>
                <p className="text-[11px] text-muted-foreground font-medium">
                  Rincian tipe perangkat, merk, serial number, dan nomor identifikasi aset
                </p>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleAddItem('PC / Laptop')}
                className="rounded-lg border border-border bg-secondary/60 px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary transition cursor-pointer"
              >
                + Laptop
              </button>
              <button
                type="button"
                onClick={() => handleAddItem('USB Memory / Flashdisk')}
                className="rounded-lg border border-border bg-secondary/60 px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary transition cursor-pointer"
              >
                + Flashdisk
              </button>
              <button
                type="button"
                onClick={() => handleAddItem('Kamera')}
                className="rounded-lg border border-border bg-secondary/60 px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary transition cursor-pointer"
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
                    <span className="size-5 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-mono text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    Alat #{idx + 1}
                  </span>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded-lg transition cursor-pointer"
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
                      No. / Nama Identifikasi Alat <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={
                        formType === 'out'
                          ? 'Contoh: AST-JAI-0192 / Laptop Kantor IT JAI (Wajib Diisi)'
                          : 'Contoh: AST-0192 / Laptop Vendor / Label Identifikasi Device (Wajib Diisi)'
                      }
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
            className="w-full py-2.5 rounded-xl border border-dashed border-border hover:border-primary hover:bg-secondary/40 text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Plus className="size-4" /> Tambah Baris Alat Lainnya
          </button>
        </section>

        {/* Section 4: Rules & Security Notice */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <span className="grid size-7 place-items-center rounded-lg font-mono text-xs font-bold bg-primary text-primary-foreground">
              04
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                {formType === 'out'
                  ? 'Ketentuan Keamanan ISMS (Karyawan Pembawa Alat Keluar)'
                  : 'Ketentuan Keamanan ISMS (Wajib Dipatuhi Visitor / Affiliate)'}
              </h2>
              <p className="text-[11px] text-muted-foreground font-medium">
                Komitmen perlindungan data dan pemeriksaan fisik di pos Security
              </p>
            </div>
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
              className="mt-0.5 size-4 rounded accent-primary border-input"
            />
            <span className="text-xs font-medium text-foreground">
              {formType === 'out'
                ? 'Saya sebagai karyawan PT. JAI telah membaca, memahami, dan bertanggung jawab penuh mematuhi seluruh ketentuan keamanan informasi (ISMS) selama membawa alat keluar kantor.'
                : 'Saya telah membaca, memahami, dan menyatakan bersedia mematuhi seluruh ketentuan keamanan informasi (ISMS) PT. Jatim Autocomp Indonesia.'}
            </span>
          </label>
        </section>
        </div>

        {/* Submit Footer Bar */}
        <div className="border-t border-border bg-secondary/25 px-6 py-4 sm:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-[11px] text-muted-foreground max-w-md leading-relaxed">
            {formType === 'out'
              ? 'Setelah dikirim, pengajuan bawa keluar wajib disetujui Manager Departemen terkait dan diperiksa oleh tim IT & Security PT. JAI.'
              : 'Setelah dikirim, pengajuan bawa masuk disetujui Manager Departemen terkait / IAA, lalu diperiksa oleh tim IT.'}
          </p>
          <button
            type="submit"
            disabled={loading}
            className="py-3 px-6 rounded-xl bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground font-bold text-xs sm:text-sm shadow-xs transition flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            {loading ? (
              <>
                <div className="animate-spin size-4 border-2 border-white border-t-transparent rounded-full" />
                {formType === 'out'
                  ? 'Mengirim Pengajuan Bawa Keluar...'
                  : 'Mengirim Pengajuan Bawa Masuk...'}
              </>
            ) : (
              <>
                {formType === 'out'
                  ? 'Kirim Pengajuan Membawa Keluar Alat'
                  : 'Kirim Pengajuan Membawa Masuk Alat'}{' '}
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </form>
      </>
      )}

      {/* ── Riwayat Pengajuan (History) View ── */}
      {activeTab === 'history' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Izin Alat
              </span>
              <p className="mt-1.5 font-display text-2xl font-bold text-foreground">{historyCounts.all}</p>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Menunggu ACC
              </span>
              <p className="mt-1.5 font-display text-2xl font-bold text-amber-700 dark:text-amber-400">
                {historyCounts.pending}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Disetujui (Aktif)
              </span>
              <p className="mt-1.5 font-display text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {historyCounts.approved}
              </p>
            </div>
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                Dikembalikan
              </span>
              <p className="mt-1.5 font-display text-2xl font-bold text-blue-700 dark:text-blue-400">
                {historyCounts.returned}
              </p>
            </div>
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-800 dark:text-red-300">
                Ditolak
              </span>
              <p className="mt-1.5 font-display text-2xl font-bold text-red-700 dark:text-red-400">
                {historyCounts.rejected}
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
            {/* Tipe Izin Switcher */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-secondary/40 p-1">
              {[
                { key: 'all', label: 'Semua Izin' },
                { key: 'in', label: 'Izin Masuk (001)' },
                { key: 'out', label: 'Izin Keluar (002)' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setHistoryFilterType(t.key as any)
                    fetchHistory(t.key as any, historyFilterStatus, historySearch)
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    historyFilterType === t.key
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Status Filter */}
              <select
                value={historyFilterStatus}
                onChange={(e) => {
                  setHistoryFilterStatus(e.target.value)
                  fetchHistory(historyFilterType, e.target.value, historySearch)
                }}
                className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-semibold text-foreground outline-none transition focus:border-ring"
              >
                <option value="all">Semua Status</option>
                <option value="pending">Menunggu ACC</option>
                <option value="approved">Disetujui (Aktif)</option>
                <option value="returned">Sudah Keluar / Dikembalikan</option>
                <option value="rejected">Ditolak</option>
              </select>

              {/* Search input */}
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cari No. Form, Pembawa, Dept, S/N..."
                  value={historySearch}
                  onChange={(e) => {
                    setHistorySearch(e.target.value)
                    fetchHistory(historyFilterType, historyFilterStatus, e.target.value)
                  }}
                  className="h-9 w-full rounded-xl border border-input bg-card pl-8.5 pr-8 text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-ring"
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setHistorySearch('')
                      fetchHistory(historyFilterType, historyFilterStatus, '')
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-secondary/50 font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3.5">No. Pengajuan</th>
                    <th className="px-4 py-3.5">Jenis Form</th>
                    <th className="px-4 py-3.5">Pembawa / Instansi</th>
                    <th className="px-4 py-3.5">Departemen &amp; Lokasi</th>
                    <th className="px-4 py-3.5">Jadwal (Masuk &ndash; Keluar)</th>
                    <th className="px-4 py-3.5">Perangkat IT</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        <div className="inline-flex items-center gap-2">
                          <RefreshCw className="size-4 animate-spin text-primary" />
                          <span>Memuat riwayat permohonan alat IT...</span>
                        </div>
                      </td>
                    </tr>
                  ) : historyList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        <div className="mx-auto flex max-w-xs flex-col items-center gap-2">
                          <Laptop className="size-8 text-muted-foreground/50" />
                          <p className="font-semibold text-foreground">Tidak Ada Riwayat Permohonan</p>
                          <p className="text-[11px]">
                            {historySearch || historyFilterStatus !== 'all' || historyFilterType !== 'all'
                              ? 'Tidak ada permohonan yang sesuai dengan filter pencarian Anda.'
                              : 'Belum ada permohonan izin membawa masuk atau keluar alat IT yang diajukan.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    historyList.map((req) => {
                      const isApproved = req.status === 'approved'
                      const isReturned = req.status === 'returned'
                      const isRejected = req.status === 'rejected'
                      const isPending = req.status === 'pending' || req.status === 'approved_manager'
                      const isFormIn = req.form_type === 'in'

                      return (
                        <tr key={req.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3.5 font-mono font-bold text-foreground whitespace-nowrap">
                            <span className="rounded-md border border-border bg-secondary/60 px-2 py-1">
                              {req.request_no}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                isFormIn
                                  ? 'bg-primary/10 text-primary border border-primary/20'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              <Laptop className="size-3" />
                              <span>{isFormIn ? '001 Masuk' : '002 Keluar'}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-foreground">{req.applicant_name}</div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                              {req.company_name}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-foreground">{req.department}</div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                              {req.location}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-[11px]">
                            <div className="text-foreground font-semibold">{req.date_in}</div>
                            <div className="text-muted-foreground">s/d {req.date_out_plan}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-foreground">
                              {(req.items || []).length} Unit
                            </div>
                            <div
                              className="text-[11px] text-muted-foreground truncate max-w-[180px]"
                              title={(req.items || [])
                                .map((it) => `${it.equipment_type} ${it.brand} (S/N: ${it.serial_no})`)
                                .join(', ')}
                            >
                              {(req.items || [])
                                .map((it) => (it.brand ? `${it.brand} ${it.model || ''}` : it.equipment_type))
                                .slice(0, 2)
                                .join(', ')}
                              {(req.items || []).length > 2 ? ' ...' : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                isApproved
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                                  : isReturned
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                                  : isRejected
                                  ? 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${
                                  isApproved
                                    ? 'bg-emerald-500'
                                    : isReturned
                                    ? 'bg-blue-500'
                                    : isRejected
                                    ? 'bg-red-500'
                                    : 'bg-amber-500 animate-pulse'
                                }`}
                              />
                              <span>
                                {isApproved
                                  ? 'Disetujui (Aktif)'
                                  : isReturned
                                  ? 'Dikembalikan'
                                  : isRejected
                                  ? 'Ditolak'
                                  : 'Menunggu ACC'}
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleViewRequestFromHistory(req)}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card hover:bg-secondary px-2.5 py-1.5 text-[11px] font-bold text-foreground transition shadow-2xs cursor-pointer"
                                title="Lihat rincian status dan tracking permohonan"
                              >
                                <Eye className="size-3 text-primary" />
                                <span>Lihat Detail</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExportSingleExcel(req)}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card hover:bg-secondary px-2 py-1.5 text-[11px] font-bold text-foreground transition shadow-2xs cursor-pointer"
                                title="Download rincian permohonan ke Excel (.xlsx)"
                              >
                                <Download className="size-3 text-emerald-600" />
                                <span className="hidden sm:inline">Excel</span>
                              </button>
                              {isApproved && (
                                <a
                                  href={`${API_BASE_PATH}/api/it-equipment-requests/${req.id}/pdf?token=${req.token}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 hover:bg-primary hover:text-primary-foreground px-2 py-1.5 text-[11px] font-bold text-primary transition shadow-2xs"
                                  title="Unduh Form Izin PDF Resmi Ber-QR E-Sign"
                                >
                                  <Download className="size-3" />
                                  <span className="hidden lg:inline">PDF</span>
                                </a>
                              )}
                              {req.token && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const url = `${window.location.origin}/ijin-masuk-alat-it?token=${req.token}`
                                    const ok = await copyText(url)
                                    if (ok) {
                                      setHistoryCopiedId(req.id)
                                      setTimeout(() => setHistoryCopiedId(null), 2000)
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-card hover:bg-secondary px-2 py-1.5 text-[11px] font-semibold text-muted-foreground transition shadow-2xs cursor-pointer"
                                  title="Salin Tautan Status Tracking"
                                >
                                  {historyCopiedId === req.id ? (
                                    <Check className="size-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <GuestLinkGeneratorModal
        open={guestLinkModalOpen}
        onClose={() => setGuestLinkModalOpen(false)}
        defaultWalkIn={true}
        initialCount={guestLinkCount}
      />
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
