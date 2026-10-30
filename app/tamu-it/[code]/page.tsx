'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Laptop,
  Network,
  Wifi,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  RefreshCw,
  Building,
  User,
  Calendar,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  FileText,
  AlertTriangle,
  Sparkles,
  Server,
  Globe,
  KeyRound,
  ArrowLeft,
} from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { copyText } from '@/lib/clipboard'
import { NetworkPassCard, type NetworkPassData } from '@/components/it/NetworkPassCard'
import {
  EQUIPMENT_TYPES,
  DEFAULT_DEPARTMENTS,
  type ItEquipmentItem,
} from '@/lib/it-equipment-shared'
import type { ItGuestAccessLink } from '@/lib/it-guest-link-shared'

const inputClass =
  'h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15'
const labelClass = 'mb-1.5 block text-xs font-semibold text-foreground'

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

export default function GuestItCombinedFormPage() {
  const params = useParams<{ code: string }>()
  const codeParam = decodeURIComponent(String(params?.code || ''))

  const [guestLink, setGuestLink] = useState<ItGuestAccessLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [notFoundError, setNotFoundError] = useState('')

  // Copy & password visibility states
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Form 1: Izin Masuk (ISMS-F-03-00-001) atau Keluar (ISMS-F-03-00-002) Alat IT
  const [formType, setFormType] = useState<'in' | 'out'>('in')
  const [guestName, setGuestName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [applicantPhone, setApplicantPhone] = useState('')
  const [applicantEmail, setApplicantEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [section, setSection] = useState('')
  const [location, setLocation] = useState('')
  const [purpose, setPurpose] = useState('')
  const [dateIn, setDateIn] = useState('')
  const [dateOutPlan, setDateOutPlan] = useState('')
  const [items, setItems] = useState<ItEquipmentItem[]>([
    {
      equipment_type: 'PC / Laptop',
      brand: '',
      model: '',
      serial_no: '',
      id_no: '',
    },
  ])

  // Form 2: Form Penyambungan Network Internal (ISMS-F-03-00-003)
  const [connectionType, setConnectionType] = useState('Wi-Fi Internal (Wireless)')
  const [deviceType, setDeviceType] = useState('Notebook / Laptop')
  const [macAddress, setMacAddress] = useState('')
  const [osInfo, setOsInfo] = useState('Windows 11 Pro 64-bit')
  const [antivirusInstalled, setAntivirusInstalled] = useState<'Ya' | 'Tidak'>('Ya')
  const [antivirusName, setAntivirusName] = useState('Windows Security / Defender')
  const [antivirusVersion, setAntivirusVersion] = useState('Terbaru (Up-to-date)')
  const [antivirusUpdated, setAntivirusUpdated] = useState<'Ya' | 'Tidak'>('Ya')
  const [purposeInternet, setPurposeInternet] = useState(true)
  const [purposeEmail, setPurposeEmail] = useState(true)
  const [purposeWeb, setPurposeWeb] = useState(false)
  const [purposeFtp, setPurposeFtp] = useState(false)
  const [networkPurpose, setNetworkPurpose] = useState('')
  const [agreeRules, setAgreeRules] = useState(true)

  const [availableDepartments, setAvailableDepartments] = useState<string[]>([])

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { departments: [] }))
      .then((data: { departments?: Array<{ name: string }> }) => {
        if (Array.isArray(data.departments) && data.departments.length > 0) {
          setAvailableDepartments(data.departments.map((d) => d.name))
        }
      })
      .catch(() => {})
  }, [])

  const fetchLinkData = useCallback(
    async (silent = false) => {
      if (!codeParam) return
      if (!silent) setLoading(true)
      try {
        const res = await fetch(
          `${API_BASE_PATH}/api/it-guest-links?code=${encodeURIComponent(codeParam)}`,
          { cache: 'no-store' }
        )
        const data = await res.json()
        if (!res.ok || !data.link) {
          setNotFoundError(data.error || 'Link khusus tamu tidak ditemukan atau sudah dihapus.')
          return
        }
        const link: ItGuestAccessLink = data.link
        setGuestLink(link)
        setNotFoundError('')

        // Populate initial form values only on first load
        if (!silent) {
          const todayStr = new Date().toISOString().slice(0, 10)
          const isPlaceholder =
            !link.guest_name || /^guest(\s*#?\d*|$)/i.test(link.guest_name.trim())
          setGuestName(isPlaceholder ? '' : link.guest_name)
          setCompanyName(link.company_name || '')
          setDepartment(link.department || '')
          setDateIn(link.visit_date ? String(link.visit_date).slice(0, 10) : todayStr)
          setDateOutPlan(
            link.visit_end_date
              ? String(link.visit_end_date).slice(0, 10)
              : link.visit_date
              ? String(link.visit_date).slice(0, 10)
              : todayStr
          )
        }
      } catch (err: any) {
        if (!silent) {
          setNotFoundError(err.message || 'Gagal memuat halaman link tamu.')
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [codeParam]
  )

  useEffect(() => {
    fetchLinkData(false)
  }, [fetchLinkData])

  // Auto-poll every 8 seconds while waiting for IT Admin approval so the guest sees credentials immediately
  useEffect(() => {
    if (!guestLink || guestLink.status !== 'submitted') return
    const timer = setInterval(() => {
      fetchLinkData(true)
    }, 8000)
    return () => clearInterval(timer)
  }, [guestLink, fetchLinkData])

  const handleCopy = async (label: string, value: string) => {
    if (!value) return
    const ok = await copyText(value)
    if (ok) {
      setCopiedField(label)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        equipment_type: 'PC / Laptop',
        brand: '',
        model: '',
        serial_no: '',
        id_no: '',
      },
    ])
  }

  const handleRemoveItem = (idx: number) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleItemChange = (idx: number, field: keyof ItEquipmentItem, val: string) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item)))
  }

  const handleSubmitForm1 = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guestLink) return
    setErrorMsg('')
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-guest-links/${encodeURIComponent(guestLink.link_code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'form_1',
          form_type: formType,
          guest_name: guestName,
          company_name: companyName,
          department,
          section,
          location,
          purpose,
          date_in: dateIn,
          date_out_plan: dateOutPlan,
          applicant_phone: applicantPhone,
          applicant_email: applicantEmail,
          items,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim Formulir 1')
      }
      setGuestLink(data.link)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat menyimpan Formulir 1')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitForm2 = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guestLink) return
    setErrorMsg('')

    if (!agreeRules) {
      setErrorMsg('Anda wajib menyetujui ketentuan keamanan perangkat IT & jaringan internal PT. JAI.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-guest-links/${encodeURIComponent(guestLink.link_code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'form_2',
          connection_type: connectionType,
          device_type: deviceType,
          mac_address: macAddress,
          os_info: osInfo,
          antivirus_installed: antivirusInstalled,
          antivirus_name: antivirusName,
          antivirus_version: antivirusVersion,
          antivirus_updated: antivirusUpdated,
          purpose_internet: purposeInternet,
          purpose_email: purposeEmail,
          purpose_web: purposeWeb,
          purpose_ftp: purposeFtp,
          purpose_others: networkPurpose || purpose,
          network_purpose: networkPurpose || purpose,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim Formulir 2')
      }
      setGuestLink(data.link)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat menyimpan Formulir 2')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitCombined = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guestLink) return
    setErrorMsg('')

    if (!agreeRules) {
      setErrorMsg('Anda wajib menyetujui ketentuan keamanan perangkat IT & jaringan internal PT. JAI.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-guest-links/${encodeURIComponent(guestLink.link_code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: guestName,
          company_name: companyName,
          department,
          section,
          location,
          purpose,
          date_in: dateIn,
          date_out_plan: dateOutPlan,
          applicant_phone: applicantPhone,
          applicant_email: applicantEmail,
          items,
          connection_type: connectionType,
          device_type: deviceType,
          mac_address: macAddress,
          os_info: osInfo,
          antivirus_installed: antivirusInstalled,
          antivirus_name: antivirusName,
          antivirus_version: antivirusVersion,
          antivirus_updated: antivirusUpdated,
          purpose_internet: purposeInternet,
          purpose_email: purposeEmail,
          purpose_web: purposeWeb,
          purpose_ftp: purposeFtp,
          purpose_others: networkPurpose || purpose,
          network_purpose: networkPurpose || purpose,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim formulir')
      }
      setGuestLink(data.link)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat menyimpan data')
    } finally {
      setSubmitting(false)
    }
  }

  const deptList =
    availableDepartments.length > 0 ? availableDepartments : Array.from(DEFAULT_DEPARTMENTS)

  if (loading) {
    return (
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-semibold text-foreground">
            Memuat Portal Registrasi Khusus Tamu PT. Jatim Autocomp Indonesia...
          </p>
        </div>
      </main>
    )
  }

  if (notFoundError || !guestLink) {
    return (
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="mx-auto max-w-xl rounded-2xl border border-destructive/30 bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Link Akses Tamu Tidak Ditemukan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {notFoundError || 'Kode link tamu tidak valid atau sudah dihapus oleh Admin IT.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/ijin-masuk-alat-it"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Ke Halaman Izin Alat IT
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const seqBadge = `#${String(guestLink.seq_no).padStart(3, '0')}`
  const monthLabel = MONTH_NAMES[(guestLink.seq_month || 1) - 1] || `Bulan ${guestLink.seq_month}`

  return (
    <main className="min-h-screen bg-background pb-16 pt-6 px-4 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header Card Identitas Link Unik Per Tamu */}
        <header className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* Top Accent Bar */}
          <div className="h-1.5 w-full bg-primary" />

          {/* Top Bar: Kategori & Periode Urutan Bulanan */}
          <div className="border-b border-border bg-primary/5 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow-xs">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                PORTAL KHUSUS GUEST / TAMU PT. JAI
              </span>
              <span className="rounded-lg border border-primary/25 bg-card px-2.5 py-1 font-mono text-[11px] font-bold text-primary">
                ISMS-F-03-00-001 &amp; 003
              </span>
              {guestLink.is_walk_in && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  Tamu Dadakan (Walk-In)
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="rounded-lg border border-border bg-card px-2.5 py-1 font-bold text-foreground">
                Tahun: {guestLink.seq_year}
              </span>
              <span className="rounded-lg border border-border bg-card px-2.5 py-1 font-bold text-foreground">
                Bulan: {String(guestLink.seq_month || 1).padStart(2, '0')} ({monthLabel})
              </span>
              <span className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 font-bold text-primary">
                No. Urut Tamu: {seqBadge}
              </span>
            </div>
          </div>

          {/* Main Identity & Status Area */}
          <div className="p-6 space-y-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <User className="h-7 w-7" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    Registrasi Terpadu 2 Formulir Wajib • Izin Alat IT &amp; Koneksi Jaringan Internal
                  </p>
                  <h1 className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {guestLink.guest_name}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Kode Link Personal:</span>
                    <code className="rounded-lg border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs font-bold text-foreground">
                      {guestLink.link_code}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy('link_code', guestLink.link_code)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
                    >
                      {copiedField === 'link_code' ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                          Tersalin
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" aria-hidden="true" />
                          Salin Kode
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2 shrink-0">
                {guestLink.status === 'link_created' && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    Tahap 1: Isi 2 Formulir Wajib
                  </span>
                )}
                {guestLink.status === 'submitted' && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                    <Clock className="h-4 w-4 animate-pulse" aria-hidden="true" />
                    Tahap 2: Menunggu Approval &amp; IP Admin IT
                  </span>
                )}
                {guestLink.status === 'approved' && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Tahap 3: Disetujui — Akses Jaringan Aktif
                  </span>
                )}
                {guestLink.status === 'rejected' && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs font-bold text-destructive">
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    Pengajuan Ditolak
                  </span>
                )}
              </div>
            </div>

            {/* 3-Step Visual Progress Tracker */}
            <div className="grid grid-cols-1 gap-2.5 border-t border-border pt-4 sm:grid-cols-3">
              <div
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
                  guestLink.status === 'link_created'
                    ? 'border-primary bg-primary/8 text-foreground'
                    : 'border-emerald-500/30 bg-emerald-500/5 text-foreground'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    guestLink.status === 'link_created'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {guestLink.status === 'link_created' ? '1' : '✓'}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">1. Pengisian 2 Formulir</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Form Alat IT (001) &amp; Network (003)
                  </p>
                </div>
              </div>

              <div
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
                  guestLink.status === 'submitted'
                    ? 'border-blue-500/40 bg-blue-500/10 text-foreground'
                    : guestLink.status === 'approved'
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-foreground'
                    : 'border-border bg-muted/20 text-muted-foreground'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    guestLink.status === 'submitted'
                      ? 'bg-blue-600 text-white'
                      : guestLink.status === 'approved'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {guestLink.status === 'approved' ? '✓' : '2'}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">2. Cek IT &amp; Alokasi IP</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Verifikasi Admin IT &amp; Approval IAA
                  </p>
                </div>
              </div>

              <div
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
                  guestLink.status === 'approved'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
                    : 'border-border bg-muted/20 text-muted-foreground'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    guestLink.status === 'approved'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {guestLink.status === 'approved' ? '✓' : '3'}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">3. Kredensial Jaringan</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Username, Password, IP &amp; DNS Aktif
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* JIKA SUDAH MENGISI FORM 1 & FORM 2 (ATAU DITOLAK / SUDAH APPROVED NETWORK): TAMPILKAN PANEL KREDENSIAL */}
        {(guestLink.status === 'rejected' ||
          guestLink.status === 'approved' ||
          (guestLink.equipment_request && guestLink.network_submission)) && (
          <section
            aria-label="Status Persetujuan dan Kredensial Jaringan Internal"
            className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6"
          >
            {guestLink.status === 'submitted' && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                      <Clock className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-foreground">
                        Kedua Formulir Anda Telah Diterima — Menunggu Persetujuan Admin IT
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Admin IT sedang memverifikasi daftar perangkat IT (<strong>ISMS-F-03-00-001</strong>) dan
                        konfigurasi jaringan (<strong>ISMS-F-03-00-003</strong>). Begitu disetujui,{' '}
                        <strong>Username Jaringan, Password, IP Address, Subnet, Gateway, dan DNS</strong> untuk
                        menyambung ke internet/jaringan internal akan langsung tampil di halaman ini secara otomatis.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchLinkData(false)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Cek Status Sekarang
                  </button>
                </div>
              </div>
            )}

            {guestLink.status === 'rejected' && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
                <div className="flex items-start gap-3">
                  <XCircle className="h-6 w-6 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
                  <div>
                    <h2 className="text-base font-bold text-destructive">
                      Permohonan Izin Alat IT &amp; Koneksi Jaringan Ditolak
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Alasan Penolakan: <strong>{guestLink.rejection_reason || 'Tidak memenuhi persyaratan keamanan IT'}</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {guestLink.status === 'approved' && (
              <div className="space-y-5">
                {/* Official Yazaki Network Pass Card with WhatsApp Share & Print Slip */}
                <NetworkPassCard
                  data={{
                    recipientName: guestLink.guest_name,
                    companyOrDept: guestLink.company_name || guestLink.department,
                    requestNoOrCode: guestLink.link_code,
                    ssid: guestLink.network_ssid || 'JAI-CORP-GUEST',
                    networkUsername: guestLink.network_username,
                    networkPassword: guestLink.network_password,
                    ipMode: guestLink.ip_mode,
                    assignedIp: guestLink.assigned_ip || '',
                    subnetMask: guestLink.subnet_mask || '255.255.255.0',
                    gateway: guestLink.gateway || '192.168.50.1',
                    dnsPrimary: guestLink.dns_primary || '192.168.1.10',
                    dnsSecondary: guestLink.dns_secondary || '8.8.8.8',
                    validFrom: guestLink.visit_date,
                    validUntil: guestLink.visit_end_date,
                    approvedBy: guestLink.approved_by || 'System Security Admin (IT)',
                    approvedAt: guestLink.approved_at,
                    directLink: typeof window !== 'undefined' ? window.location.href : undefined,
                  }}
                />

                {/* Panduan Singkat Menyambung ke Internet / Jaringan Internal */}
                <div className="rounded-xl border border-border bg-muted/15 p-4 text-xs text-muted-foreground space-y-1.5">
                  <p className="font-bold text-foreground">
                    Panduan Menyambung ke Internet / Jaringan Internal PT. JAI:
                  </p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>
                      Hubungkan perangkat Anda ke jaringan Wi-Fi{' '}
                      <strong className="text-foreground">{guestLink.network_ssid || 'JAI-CORP-GUEST'}</strong> atau port LAN yang telah ditentukan oleh PIC.
                    </li>
                    <li>
                      Jika menggunakan <strong>Static IP</strong>, masukkan <strong>IP Address ({guestLink.assigned_ip})</strong>, <strong>Subnet Mask ({guestLink.subnet_mask || '255.255.255.0'})</strong>, <strong>Gateway ({guestLink.gateway || '192.168.50.1'})</strong>, dan <strong>DNS ({guestLink.dns_primary || '192.168.1.10'})</strong> pada pengaturan IPv4 perangkat Anda.
                    </li>
                    <li>
                      Saat halaman autentikasi jaringan (Captive Portal / Login Jaringan) muncul di browser, masukkan{' '}
                      <strong className="text-foreground">Username ({guestLink.network_username})</strong> dan{' '}
                      <strong className="text-foreground">Password / Kode Akses</strong> di atas.
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* Dokumen PDF Terkait (Form 1 & Form 2) */}
            <div className="border-t border-border pt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Dokumen Resmi yang Tercatat pada Link Tamu Ini
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {guestLink.equipment_request && (
                  <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-primary">
                        FORM 1 • ISMS-F-03-00-001
                      </span>
                      <p className="text-xs font-bold text-foreground">
                        Izin Membawa Masuk Alat IT
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {guestLink.equipment_request.request_no}
                      </p>
                    </div>
                    <a
                      href={`${API_BASE_PATH}/api/it-equipment-requests/${guestLink.equipment_request.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      PDF Alat IT
                    </a>
                  </div>
                )}

                {guestLink.network_submission && (
                  <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-primary">
                        FORM 2 • ISMS-F-03-00-003
                      </span>
                      <p className="text-xs font-bold text-foreground">
                        Form Koneksi Jaringan Internal
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {guestLink.network_submission.request_no}
                      </p>
                    </div>
                    <a
                      href={`${API_BASE_PATH}/api/it-form-submissions/${guestLink.network_submission.id}/pdf?token=${encodeURIComponent(guestLink.network_submission.token)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      PDF Network
                    </a>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ALUR BERTAHAP: FORM 1 DULU -> APPROVE FORM 1 -> BARU BISA ISI FORM 2 */}
        {guestLink.status !== 'rejected' &&
          (!guestLink.equipment_request || !guestLink.network_submission) && (
          <div className="space-y-6">
            {errorMsg && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs font-medium text-destructive"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ============================================================== */}
            {/* FORM 1: IZIN MEMBAWA MASUK (001) / KELUAR (002) ALAT IT        */}
            {/* ============================================================== */}
            {!guestLink.equipment_request ? (
              <form
                method="POST"
                action={`${API_BASE_PATH}/api/it-guest-links/${encodeURIComponent(guestLink.link_code)}`}
                onSubmit={handleSubmitForm1}
              >
                <section
                  aria-labelledby="form-1-heading"
                  className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                >
                  <div className="border-b border-border bg-primary/5 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                        <Laptop className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                            FORMULIR 1
                          </span>
                          <span className="font-mono text-[11px] font-bold text-muted-foreground">
                            {formType === 'in' ? 'ISMS-F-03-00-001' : 'ISMS-F-03-00-002'}
                          </span>
                        </div>
                        <h2 id="form-1-heading" className="mt-0.5 text-base font-bold text-foreground">
                          Formulir 1: Pengajuan Izin Membawa {formType === 'in' ? 'Masuk' : 'Keluar'} PC, USB Memory, Kamera, dll.
                        </h2>
                      </div>
                    </div>

                    {/* Pilihan Dokumen Masuk (001) atau Keluar (002) */}
                    <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
                      <button
                        type="button"
                        onClick={() => setFormType('in')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                          formType === 'in'
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Membawa Masuk (001)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormType('out')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                          formType === 'out'
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Membawa Keluar (002)
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="guest-name" className={labelClass}>
                    Nama Lengkap Tamu <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="guest-name"
                    name="guest_name"
                    type="text"
                    required
                    autoComplete="name"
                    enterKeyHint="next"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Contoh: Budi Santoso (Ketik nama lengkap Anda)"
                    className={inputClass}
                  />
                  {guestLink?.guest_name && /^guest(\s*#?\d*|$)/i.test(guestLink.guest_name.trim()) && (
                    <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                      Silakan ketik nama lengkap Anda pada kolom di atas (sebelumnya tercatat sebagai: {guestLink.guest_name}).
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="company-name" className={labelClass}>
                    Nama Perusahaan / Instansi Asal <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="company-name"
                    name="company_name"
                    type="text"
                    required
                    autoComplete="organization"
                    enterKeyHint="next"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Contoh: PT. Mitra Teknologi Nusantara"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="applicant-phone" className={labelClass}>
                    Nomor HP / WhatsApp Aktif
                  </label>
                  <input
                    id="applicant-phone"
                    name="applicant_phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    enterKeyHint="next"
                    value={applicantPhone}
                    onChange={(e) => setApplicantPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="applicant-email" className={labelClass}>
                    Alamat Email Tamu
                  </label>
                  <input
                    id="applicant-email"
                    name="applicant_email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    enterKeyHint="next"
                    value={applicantEmail}
                    onChange={(e) => setApplicantEmail(e.target.value)}
                    placeholder="Contoh: budi@perusahaan.com"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="target-dept" className={labelClass}>
                    Departemen Tujuan di PT. JAI <span className="text-destructive">*</span>
                  </label>
                  <select
                    id="target-dept"
                    name="department"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">-- Pilih Departemen Tujuan --</option>
                    {deptList.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="target-section" className={labelClass}>
                    Seksi / Bagian / Nama PIC Tujuan <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="target-section"
                    name="section"
                    type="text"
                    required
                    enterKeyHint="next"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="Contoh: IT Infrastructure / Bpk. Andi"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="work-location" className={labelClass}>
                    Lokasi Penggunaan Alat di PT. JAI <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="work-location"
                    name="location"
                    type="text"
                    required
                    enterKeyHint="next"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Contoh: Ruang Meeting Lt. 2 / Area Office IT"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="date-in" className={labelClass}>
                      Tanggal Masuk <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="date-in"
                      name="date_in"
                      type="date"
                      required
                      value={dateIn}
                      onChange={(e) => setDateIn(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="date-out" className={labelClass}>
                      Rencana Keluar <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="date-out"
                      name="date_out_plan"
                      type="date"
                      required
                      value={dateOutPlan}
                      onChange={(e) => setDateOutPlan(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="visit-purpose" className={labelClass}>
                    Tujuan Membawa Masuk Alat IT &amp; Kunjungan <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    id="visit-purpose"
                    name="purpose"
                    rows={2}
                    required
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Contoh: Presentasi proyek sistem ERP, maintenance perangkat, atau audit vendor..."
                    className="w-full rounded-xl border border-input bg-card p-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15"
                  />
                </div>
              </div>

              {/* Daftar Perangkat IT yang Dibawa */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Daftar Perangkat IT yang Dibawa Masuk ({items.length} Unit)
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Tambah Perangkat
                  </button>
                </div>

                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-border bg-muted/20 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">
                        Perangkat #{idx + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-destructive hover:underline"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Hapus
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                      <div>
                        <label htmlFor={`eq-type-${idx}`} className={labelClass}>
                          Jenis Alat <span className="text-destructive">*</span>
                        </label>
                        <select
                          id={`eq-type-${idx}`}
                          name={`equipment_type_${idx}`}
                          value={item.equipment_type}
                          onChange={(e) => handleItemChange(idx, 'equipment_type', e.target.value)}
                          className={inputClass}
                        >
                          {EQUIPMENT_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor={`eq-brand-${idx}`} className={labelClass}>
                          Merk / Produsen <span className="text-destructive">*</span>
                        </label>
                        <input
                          id={`eq-brand-${idx}`}
                          name={`brand_${idx}`}
                          type="text"
                          required
                          enterKeyHint="next"
                          value={item.brand}
                          onChange={(e) => handleItemChange(idx, 'brand', e.target.value)}
                          placeholder="Lenovo / Dell / HP"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label htmlFor={`eq-model-${idx}`} className={labelClass}>
                          Model / Tipe
                        </label>
                        <input
                          id={`eq-model-${idx}`}
                          name={`model_${idx}`}
                          type="text"
                          enterKeyHint="next"
                          value={item.model}
                          onChange={(e) => handleItemChange(idx, 'model', e.target.value)}
                          placeholder="ThinkPad X1 / Latitude"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label htmlFor={`eq-serial-${idx}`} className={labelClass}>
                          Serial Number (S/N) <span className="text-destructive">*</span>
                        </label>
                        <input
                          id={`eq-serial-${idx}`}
                          name={`serial_no_${idx}`}
                          type="text"
                          required
                          enterKeyHint="next"
                          value={item.serial_no}
                          onChange={(e) => handleItemChange(idx, 'serial_no', e.target.value)}
                          placeholder="PF-3X982A"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label htmlFor={`eq-id-${idx}`} className={labelClass}>
                          No. Identifikasi / Asset <span className="text-destructive">*</span>
                        </label>
                        <input
                          id={`eq-id-${idx}`}
                          name={`id_no_${idx}`}
                          type="text"
                          required
                          enterKeyHint="next"
                          value={item.id_no || ''}
                          onChange={(e) => handleItemChange(idx, 'id_no', e.target.value)}
                          placeholder="LPT-01 / NB-GUEST"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  <strong>Alur Bertahap:</strong> Kirim <strong>Formulir 1</strong> ini terlebih dahulu. Setelah disetujui oleh <strong>1. IAA / Manager Departemen</strong> lalu diverifikasi oleh <strong>2. Divisi IT (SSA)</strong>, barulah <strong>Formulir 2 (Penyambungan Jaringan Internal)</strong> di bawah akan terbuka.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {submitting ? 'Mengirim Formulir 1...' : 'Kirim Formulir 1 (Tahap 1: Izin Alat IT)'}
                </button>
              </div>
              </div>
            </section>
            </form>
            ) : (
              /* JIKA FORM 1 SUDAH DIKIRIM: TAMPILKAN STATUS FORM 1 (1A. IAA/MGR DEPT -> 1B. CHECK IT) + UNDUH PDF RESMI 001 / 002 */
              <section
                aria-label="Status Formulir 1"
                className="overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        guestLink.equipment_request.status === 'approved' ||
                        guestLink.equipment_request.status === 'returned'
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-blue-500/15 text-blue-600'
                      }`}
                    >
                      {guestLink.equipment_request.status === 'approved' ||
                      guestLink.equipment_request.status === 'returned' ? (
                        <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                      ) : (
                        <Clock className="h-6 w-6 animate-pulse" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                          TAHAP 1 • {guestLink.equipment_request.form_type === 'out' ? 'ISMS-F-03-00-002 (KELUAR)' : 'ISMS-F-03-00-001 (MASUK)'}
                        </span>
                        <span className="font-mono text-xs font-bold text-muted-foreground">
                          {guestLink.equipment_request.request_no}
                        </span>
                      </div>
                      <h2 className="mt-1 text-base font-bold text-foreground">
                        Formulir 1: Pengajuan Izin Membawa Alat IT (Terkirim)
                      </h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {guestLink.equipment_request.status === 'approved' ||
                        guestLink.equipment_request.status === 'returned'
                          ? `Disetujui oleh ${guestLink.equipment_request.approved_by || 'Manager Dept / IAA'} dan diverifikasi oleh ${guestLink.equipment_request.it_checked_by || 'Divisi IT'}.`
                          : 'Formulir 1 (Izin Masuk/Keluar Alat IT) berhasil dikirim. Anda dapat langsung mengisi Formulir 2 (Penyambungan Jaringan) di bawah.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <a
                      href={`${API_BASE_PATH}/api/it-equipment-requests/${guestLink.equipment_request.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      PDF {guestLink.equipment_request.form_type === 'out' ? 'ISMS-F-03-00-002' : 'ISMS-F-03-00-001'}
                    </a>
                    {(guestLink.equipment_request.status === 'pending' ||
                      guestLink.equipment_request.status === 'approved_manager') && (
                      <button
                        type="button"
                        onClick={() => fetchLinkData(false)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        Cek Status
                      </button>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* ============================================================== */}
            {/* FORM 2: PENYAMBUNGAN JARINGAN INTERNAL (ISMS-F-03-00-003)       */}
            {/* TERBUKA LANGSUNG (TIDAK DIKUNCI)                               */}
            {/* ============================================================== */}
            {!guestLink.network_submission ? (
              <form
                method="POST"
                action={`${API_BASE_PATH}/api/it-guest-links/${encodeURIComponent(guestLink.link_code)}`}
                onSubmit={handleSubmitForm2}
              >
            <section
              aria-labelledby="form-2-heading"
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <div className="border-b border-border bg-primary/5 px-6 py-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                    <Network className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        FORMULIR 2
                      </span>
                      <span className="font-mono text-[11px] font-bold text-muted-foreground">
                        ISMS-F-03-00-003
                      </span>
                    </div>
                    <h2 id="form-2-heading" className="mt-0.5 text-base font-bold text-foreground">
                      Formulir 2: Company Network Connection Application Form
                    </h2>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Media Koneksi (Radio Buttons <= 5 options) */}
                <div>
                  <span className={labelClass}>
                    Media Koneksi Jaringan yang Dibutuhkan <span className="text-destructive">*</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    {['Wi-Fi Internal (Wireless)', 'LAN Kabel (Ethernet)'].map((opt) => (
                      <label
                        key={opt}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-xs font-semibold transition ${
                          connectionType === opt
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-foreground hover:bg-muted/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="connection_type"
                          value={opt}
                          checked={connectionType === opt}
                          onChange={() => setConnectionType(opt)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Jenis Perangkat Utama (Radio Buttons <= 5 options) */}
                <div>
                  <span className={labelClass}>
                    Kategori Perangkat yang Disambungkan <span className="text-destructive">*</span>
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {['Notebook / Laptop', 'PC Desktop', 'Smart Device'].map((opt) => (
                      <label
                        key={opt}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                          deviceType === opt
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-foreground hover:bg-muted/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="device_type"
                          value={opt}
                          checked={deviceType === opt}
                          onChange={() => setDeviceType(opt)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="mac-address" className={labelClass}>
                    MAC Address Perangkat (Wi-Fi / LAN) <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="mac-address"
                    name="mac_address"
                    type="text"
                    required
                    enterKeyHint="next"
                    value={macAddress}
                    onChange={(e) => setMacAddress(e.target.value)}
                    placeholder="Contoh: 00:1A:2B:3C:4D:5E"
                    className={`${inputClass} font-mono`}
                  />
                </div>

                <div>
                  <label htmlFor="os-info" className={labelClass}>
                    Sistem Operasi (OS) Perangkat <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="os-info"
                    name="os_info"
                    type="text"
                    required
                    enterKeyHint="next"
                    value={osInfo}
                    onChange={(e) => setOsInfo(e.target.value)}
                    placeholder="Contoh: Windows 11 Pro 64-bit / macOS"
                    className={inputClass}
                  />
                </div>

                {/* Antivirus Installed */}
                <div>
                  <span className={labelClass}>
                    Apakah Antivirus Terinstal &amp; Aktif? <span className="text-destructive">*</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['Ya', 'Tidak'] as const).map((val) => (
                      <label
                        key={val}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-xs font-semibold transition ${
                          antivirusInstalled === val
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-foreground hover:bg-muted/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="antivirus_installed"
                          value={val}
                          checked={antivirusInstalled === val}
                          onChange={() => setAntivirusInstalled(val)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>{val === 'Ya' ? 'Ya, Terinstal' : 'Tidak Ada'}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Antivirus Updated */}
                <div>
                  <span className={labelClass}>
                    Apakah Database Antivirus Up-to-date? <span className="text-destructive">*</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['Ya', 'Tidak'] as const).map((val) => (
                      <label
                        key={val}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-xs font-semibold transition ${
                          antivirusUpdated === val
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-foreground hover:bg-muted/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="antivirus_updated"
                          value={val}
                          checked={antivirusUpdated === val}
                          onChange={() => setAntivirusUpdated(val)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>{val === 'Ya' ? 'Ya, Ter-update' : 'Belum Update'}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="av-name" className={labelClass}>
                    Nama Software Antivirus <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="av-name"
                    name="antivirus_name"
                    type="text"
                    required
                    enterKeyHint="next"
                    value={antivirusName}
                    onChange={(e) => setAntivirusName(e.target.value)}
                    placeholder="Contoh: Windows Defender / Kaspersky / CrowdStrike"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="av-version" className={labelClass}>
                    Versi / Pattern Antivirus
                  </label>
                  <input
                    id="av-version"
                    name="antivirus_version"
                    type="text"
                    enterKeyHint="next"
                    value={antivirusVersion}
                    onChange={(e) => setAntivirusVersion(e.target.value)}
                    placeholder="Contoh: Versi Terbaru / Auto-Update"
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <span className={labelClass}>
                    Tujuan Koneksi Jaringan (Purpose of the Connection) <span className="text-destructive">*</span>
                  </span>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                        purposeInternet
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={purposeInternet}
                        onChange={(e) => setPurposeInternet(e.target.checked)}
                        className="h-4 w-4 rounded accent-primary"
                      />
                      <span>Internet</span>
                    </label>

                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                        purposeEmail
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={purposeEmail}
                        onChange={(e) => setPurposeEmail(e.target.checked)}
                        className="h-4 w-4 rounded accent-primary"
                      />
                      <span>E-Mail</span>
                    </label>

                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                        purposeWeb
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={purposeWeb}
                        onChange={(e) => setPurposeWeb(e.target.checked)}
                        className="h-4 w-4 rounded accent-primary"
                      />
                      <span>Web Application</span>
                    </label>

                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                        purposeFtp
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={purposeFtp}
                        onChange={(e) => setPurposeFtp(e.target.checked)}
                        className="h-4 w-4 rounded accent-primary"
                      />
                      <span>FTP / File Server</span>
                    </label>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="network-purpose" className={labelClass}>
                    Keterangan Tambahan Keperluan Koneksi (Others)
                  </label>
                  <input
                    id="network-purpose"
                    name="network_purpose"
                    type="text"
                    enterKeyHint="done"
                    value={networkPurpose}
                    onChange={(e) => setNetworkPurpose(e.target.value)}
                    placeholder="Kosongkan jika sama dengan tujuan kunjungan di Form 1..."
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Checkbox Persetujuan Aturan Keamanan */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    name="agree_rules"
                    checked={agreeRules}
                    onChange={(e) => setAgreeRules(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-primary"
                  />
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    Saya menyatakan bahwa seluruh data perangkat IT dan informasi keamanan jaringan yang diisikan di atas adalah benar, bebas dari malware/virus, serta bersedia mematuhi seluruh kebijakan Keamanan Informasi (ISMS) PT. Jatim Autocomp Indonesia.
                  </span>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <p className="text-xs text-muted-foreground">
                  Setelah dikirim, Admin IT akan memverifikasi dan memberikan <strong>Username &amp; IP Address</strong> pada halaman link ini.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {submitting
                    ? 'Mengirim Formulir 2...'
                    : 'Kirim Formulir 2 (Permohonan Akses Jaringan)'}
                </button>
              </div>
              </div>
            </section>
            </form>
            ) : (
              <section className="overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
                      <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          FORMULIR 2 TERKIRIM
                        </span>
                        <span className="font-mono text-[11px] font-bold text-muted-foreground">
                          ISMS-F-03-00-003
                        </span>
                        <span className="font-mono text-xs font-bold text-foreground">
                          {guestLink.network_submission.request_no}
                        </span>
                      </div>
                      <h2 className="mt-1 text-base font-bold text-foreground">
                        Formulir 2: Company Network Connection Application Form
                      </h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Status:{' '}
                        <strong>
                          {guestLink.network_submission.status === 'approved'
                            ? 'Disetujui Lengkap oleh IT'
                            : 'Sedang Diverifikasi oleh IT'}
                        </strong>
                      </p>
                    </div>
                  </div>

                  <a
                    href={`${API_BASE_PATH}/api/it-form-submissions/${guestLink.network_submission.id}/pdf?token=${encodeURIComponent(
                      guestLink.network_submission.token
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Unduh PDF Form 003
                  </a>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

