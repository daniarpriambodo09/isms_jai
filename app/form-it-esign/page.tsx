// app/form-it-esign/page.tsx
'use client'

import React, { useState, useEffect, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  FileSignature,
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
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Info,
  RotateCcw,
  ShieldAlert,
  Laptop,
  Network,
  Users,
  Send,
  ExternalLink,
  ChevronRight,
  Eye,
  CheckCheck,
  PencilLine,
  Loader2,
  Wifi,
  Layers,
  Lock,
  BadgeCheck,
  QrCode,
  Shield,
  HardDrive,
  Cpu,
  FileCheck,
  Briefcase,
  CalendarDays,
  Globe,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Fingerprint,
} from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { IT_FORM_DEFINITIONS, type ItFormApprover, type ItFormSubmission } from '@/lib/it-form-shared'
import { useAuth } from '@/context/AuthContext'

const DEPARTMENTS = [
  'Information Technology (IT)',
  'Human Resources / IR',
  'Accounting & Finance',
  'Production Control (PC)',
  'Quality Assurance (QA)',
  'Quality Control (QC)',
  'Manufacturing (MFG)',
  'Maintenance / Facility',
  'Purchasing / Procurement',
  'Warehouse / Logistic',
  'Engineering',
  'General Affair (GA)',
  'Management / Office',
]

const FORM_METADATA: Record<
  string,
  {
    icon: any
    shortTitle: string
    colorClass: string
    activeBorder: string
    activeBg: string
    glowShadow: string
    badgeClass: string
    tag: string
    category: string
    approvalCount: number
    features: string[]
    shortDesc: string
  }
> = {
  'ISMS-F-010-001': {
    icon: Laptop,
    shortTitle: 'PC & Laptop',
    colorClass: 'text-blue-600 dark:text-blue-400',
    activeBorder: 'border-blue-500 ring-2 ring-blue-500/30',
    activeBg: 'from-blue-500/15 via-blue-500/5 to-transparent',
    glowShadow: 'shadow-blue-500/10',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
    tag: 'Hardware IT',
    category: 'Perangkat Kerja',
    approvalCount: 4,
    features: ['PC Baru / Ganti', 'OS & Lisensi Wajib', '4 Tahap E-Sign'],
    shortDesc: 'Form permohonan pengadaan atau pembaharuan unit PC/Laptop kerja beserta lisensi software wajib.',
  },
  'ISMS-F-010-003': {
    icon: Cpu,
    shortTitle: 'Lisensi Software',
    colorClass: 'text-purple-600 dark:text-purple-400',
    activeBorder: 'border-purple-500 ring-2 ring-purple-500/30',
    activeBg: 'from-purple-500/15 via-purple-500/5 to-transparent',
    glowShadow: 'shadow-purple-500/10',
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
    tag: 'Software Resmi',
    category: 'Software Resmi',
    approvalCount: 4,
    features: ['Lisensi Baru / Upgrade', 'Verifikasi Asset No.', '4 Tahap E-Sign'],
    shortDesc: 'Form permohonan pembelian lisensi software baru atau pembaharuan versi software pada komputer.',
  },
  'ISMS-F-010-006': {
    icon: Mail,
    shortTitle: 'Email & User ID',
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/30',
    activeBg: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
    glowShadow: 'shadow-emerald-500/10',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    tag: 'Akun & Akses',
    category: 'Akses Pengguna',
    approvalCount: 3,
    features: ['Domain @jai.co.id', 'Akun Active Directory', '3 Tahap E-Sign'],
    shortDesc: 'Form permohonan pembuatan baru atau perubahan email dan user ID login karyawan.',
  },
  'ISMS-F-010-007': {
    icon: ShieldAlert,
    shortTitle: 'Penghapusan Akun',
    colorClass: 'text-rose-600 dark:text-rose-400',
    activeBorder: 'border-rose-500 ring-2 ring-rose-500/30',
    activeBg: 'from-rose-500/15 via-rose-500/5 to-transparent',
    glowShadow: 'shadow-rose-500/10',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30',
    tag: 'Deaktivasi User',
    category: 'Pemberhentian Akses',
    approvalCount: 3,
    features: ['Deaktivasi Mailbox', 'Penonaktifan Domain', 'Audit Trail'],
    shortDesc: 'Form permohonan penonaktifan atau penghapusan email dan user ID login karyawan.',
  },
  'ISMS-F-03-00-003': {
    icon: Wifi,
    shortTitle: 'Koneksi Jaringan',
    colorClass: 'text-teal-600 dark:text-teal-400',
    activeBorder: 'border-teal-500 ring-2 ring-teal-500/30',
    activeBg: 'from-teal-500/15 via-teal-500/5 to-transparent',
    glowShadow: 'shadow-teal-500/10',
    badgeClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30',
    tag: 'Security Network',
    category: 'Security JAI Network',
    approvalCount: 4,
    features: ['DHCP / IP Statis', 'Verifikasi Anti-Virus', 'Izin Akses LAN/Wi-Fi'],
    shortDesc: 'Form izin penyambungan perangkat ke jaringan internal perusahaan (DHCP/Static IP).',
  },
  'ISMS-F-02-00-002': {
    icon: Fingerprint,
    shortTitle: 'Fingerprint Special Area',
    colorClass: 'text-indigo-600 dark:text-indigo-400',
    activeBorder: 'border-indigo-500 ring-2 ring-indigo-500/30',
    activeBg: 'from-indigo-500/15 via-indigo-500/5 to-transparent',
    glowShadow: 'shadow-indigo-500/10',
    badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
    tag: 'Akses Khusus',
    category: 'Special Security Area',
    approvalCount: 1,
    features: ['Registrasi Sidik Jari', 'Komitmen Keamanan', 'E-Sign IAA Teguh Sunjoyo'],
    shortDesc: 'Form permohonan registrasi sidik jari Special Security Area ber-E-Sign resmi (IAA Teguh Sunjoyo).',
  },
}

function FormItContent() {
  const searchParams = useSearchParams()
  const tokenQuery = searchParams.get('token')
  const formCodeQuery = searchParams.get('form')
  const { adminUser } = useAuth()

  const [selectedFormCode, setSelectedFormCode] = useState<string>(
    formCodeQuery && IT_FORM_DEFINITIONS.some((d) => d.code === formCodeQuery)
      ? formCodeQuery
      : 'ISMS-F-010-001'
  )

  const [approvers, setApprovers] = useState<ItFormApprover[]>([])
  const [loadingApprovers, setLoadingApprovers] = useState(true)

  // Applicant fields
  const [applicantName, setApplicantName] = useState('')
  const [applicantNik, setApplicantNik] = useState('')
  const [applicantPosition, setApplicantPosition] = useState('')
  const [employeeStatus, setEmployeeStatus] = useState<'TETAP' | 'KONTRAK' | 'Other'>('TETAP')
  const [otherStatus, setOtherStatus] = useState('')
  const [department, setDepartment] = useState(DEPARTMENTS[0])
  const [companyName, setCompanyName] = useState('PT. Jatim Autocomp Indonesia')
  const [purpose, setPurpose] = useState('')
  const [notes, setNotes] = useState('')

  // Form specific fields: ISMS-F-010-001 & ISMS-F-010-003 (Procurement PC / Software)
  const [jenisPengadaan, setJenisPengadaan] = useState<'baru' | 'pembaharuan'>('baru')
  const [maker, setMaker] = useState('')
  const [modelType, setModelType] = useState('')
  const [serialNo, setSerialNo] = useState('')
  const [assetNo, setAssetNo] = useState('')
  const [pcName, setPcName] = useState('')
  const [oldPcName, setOldPcName] = useState('')
  const [loginUsername, setLoginUsername] = useState('')
  const [functionPurpose, setFunctionPurpose] = useState('')
  const [softwareListText, setSoftwareListText] = useState('')

  // Form specific fields: ISMS-F-010-006 (Email Application/Change)
  const [reqEmail, setReqEmail] = useState(true)
  const [changeEmail, setChangeEmail] = useState(false)
  const [reqUserId, setReqUserId] = useState(true)
  const [changeUserId, setChangeUserId] = useState(false)
  const [targetEmail, setTargetEmail] = useState('')
  const [targetUserId, setTargetUserId] = useState('')

  // Form specific fields: ISMS-F-010-007 (Delete Email/ID)
  const [delEmail, setDelEmail] = useState(true)
  const [delUserId, setDelUserId] = useState(true)

  // Form specific fields: ISMS-F-03-00-003 (Network Connection)
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [networkLocation, setNetworkLocation] = useState('')
  const [purposeInternet, setPurposeInternet] = useState(true)
  const [purposeEmail, setPurposeEmail] = useState(true)
  const [purposeWeb, setPurposeWeb] = useState(false)
  const [purposeFtp, setPurposeFtp] = useState(false)
  const [purposeOthers, setPurposeOthers] = useState('')
  const [antivirusInstalled, setAntivirusInstalled] = useState(true)
  const [antivirusName, setAntivirusName] = useState('Windows Defender / Endpoint Protection')
  const [antivirusVersion, setAntivirusVersion] = useState('Latest Definition Updated')
  const [osInfo, setOsInfo] = useState('Windows 11 Pro 64-bit')
  const [ipMode, setIpMode] = useState<'dhcp' | 'static'>('dhcp')
  const [staticIp, setStaticIp] = useState('')
  const [staticSubnet, setStaticSubnet] = useState('255.255.255.0')
  const [staticGateway, setStaticGateway] = useState('')
  const [dnsPriority, setDnsPriority] = useState('')
  const [dnsSecondary, setDnsSecondary] = useState('')

  // Form specific fields: ISMS-F-02-00-002 (Fingerprint Special Security Area)
  const [areaSpecialSecurity, setAreaSpecialSecurity] = useState('Ruang Server / Server Room')
  const [fingerprintId, setFingerprintId] = useState('')
  const [accessDeletionDate, setAccessDeletionDate] = useState('')
  const [noExpiration, setNoExpiration] = useState(true)
  const [komitmenAgreed, setKomitmenAgreed] = useState(true)

  // Submission State
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [submissionResult, setSubmissionResult] = useState<ItFormSubmission | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Token search & E-sign approval in-page state
  const [searchInput, setSearchInput] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [approvalNoteInput, setApprovalNoteInput] = useState('')
  const [approverNameInput, setApproverNameInput] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Auto-fill dates
  useEffect(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const fromStr = `${yyyy}-${mm}-${dd}`
    setPeriodFrom(fromStr)

    const nextMonth = new Date(today)
    nextMonth.setDate(nextMonth.getDate() + 30)
    const y2 = nextMonth.getFullYear()
    const m2 = String(nextMonth.getMonth() + 1).padStart(2, '0')
    const d2 = String(nextMonth.getDate()).padStart(2, '0')
    setPeriodTo(`${y2}-${m2}-${d2}`)
  }, [])

  // Auto-fill logged in admin name for approver input
  useEffect(() => {
    if (adminUser?.username) {
      setApproverNameInput(adminUser.username)
    }
  }, [adminUser])

  // Load configured approvers when formCode changes
  useEffect(() => {
    let cancelled = false
    setLoadingApprovers(true)
    fetch(`${API_BASE_PATH}/api/it-form-approvers?form_code=${encodeURIComponent(selectedFormCode)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.approvers) {
          setApprovers(data.approvers)
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!cancelled) setLoadingApprovers(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedFormCode])

  // If token is provided in URL, load submission details
  const fetchSubmissionByToken = async (tok: string) => {
    setSearchLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-form-submissions?token=${encodeURIComponent(tok)}`)
      const data = await res.json()
      if (res.ok && data.submission) {
        setSubmissionResult(data.submission)
        setSelectedFormCode(data.submission.form_code)
      } else {
        alert(data.error || 'Permohonan tidak ditemukan')
      }
    } catch (err) {
      console.error(err)
      alert('Gagal mengambil data permohonan')
    } finally {
      setSearchLoading(false)
    }
  }

  useEffect(() => {
    if (tokenQuery) {
      fetchSubmissionByToken(tokenQuery)
    }
  }, [tokenQuery])

  const activeForms = useMemo(
    () => IT_FORM_DEFINITIONS.filter((d) => d.code !== 'ISMS-F-03-00-001'),
    []
  )

  const currentFormDef = useMemo(() => {
    return IT_FORM_DEFINITIONS.find((d) => d.code === selectedFormCode) || IT_FORM_DEFINITIONS[0]
  }, [selectedFormCode])

  const currentMeta = useMemo(() => {
    return FORM_METADATA[selectedFormCode] || FORM_METADATA['ISMS-F-010-001']
  }, [selectedFormCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!applicantName.trim()) {
      setErrorMsg('Nama Pemohon wajib diisi.')
      return
    }

    setSubmitting(true)
    setErrorMsg('')

    try {
      const formDataPayload: Record<string, any> = {}

      if (selectedFormCode === 'ISMS-F-010-001') {
        formDataPayload.jenis_pengadaan = jenisPengadaan
        formDataPayload.maker = maker.trim()
        formDataPayload.model_type = modelType.trim()
        formDataPayload.os_info = osInfo.trim()
        formDataPayload.software_list = softwareListText.split('\n').map((s) => s.trim()).filter(Boolean)
        formDataPayload.old_pc_name = oldPcName.trim()
        formDataPayload.login_username = loginUsername.trim()
        formDataPayload.function_purpose = functionPurpose.trim()
      } else if (selectedFormCode === 'ISMS-F-010-003') {
        formDataPayload.jenis_pengadaan = jenisPengadaan
        formDataPayload.software_list = softwareListText.split('\n').map((s) => s.trim()).filter(Boolean)
        formDataPayload.asset_no = assetNo.trim()
        formDataPayload.maker = maker.trim()
        formDataPayload.model_type = modelType.trim()
        formDataPayload.serial_no = serialNo.trim()
        formDataPayload.os_info = osInfo.trim()
        formDataPayload.pc_name = pcName.trim()
        formDataPayload.login_username = loginUsername.trim()
        formDataPayload.function_purpose = functionPurpose.trim()
      } else if (selectedFormCode === 'ISMS-F-010-006') {
        formDataPayload.request_email = reqEmail
        formDataPayload.change_email = changeEmail
        formDataPayload.request_user_id = reqUserId
        formDataPayload.change_user_id = changeUserId
        formDataPayload.email_target = targetEmail.trim()
        formDataPayload.user_id_target = targetUserId.trim()
      } else if (selectedFormCode === 'ISMS-F-010-007') {
        formDataPayload.delete_email = delEmail
        formDataPayload.delete_user_id = delUserId
        formDataPayload.email_target = targetEmail.trim()
        formDataPayload.user_id_target = targetUserId.trim()
      } else if (selectedFormCode === 'ISMS-F-03-00-003') {
        formDataPayload.period_from = periodFrom
        formDataPayload.period_to = periodTo
        formDataPayload.location = networkLocation.trim()
        formDataPayload.purpose_internet = purposeInternet
        formDataPayload.purpose_email = purposeEmail
        formDataPayload.purpose_web = purposeWeb
        formDataPayload.purpose_ftp = purposeFtp
        formDataPayload.purpose_others = purposeOthers.trim()
        formDataPayload.antivirus_installed = antivirusInstalled
        formDataPayload.antivirus_name = antivirusName.trim()
        formDataPayload.antivirus_version = antivirusVersion.trim()
        formDataPayload.os_info = osInfo.trim()
        formDataPayload.ip_mode = ipMode
        if (ipMode === 'static') {
          formDataPayload.static_ip = staticIp.trim()
          formDataPayload.static_subnet = staticSubnet.trim()
          formDataPayload.static_gateway = staticGateway.trim()
          formDataPayload.dns_priority = dnsPriority.trim()
          formDataPayload.dns_secondary = dnsSecondary.trim()
        }
      } else if (selectedFormCode === 'ISMS-F-02-00-002') {
        formDataPayload.area_special_security = areaSpecialSecurity.trim()
        formDataPayload.fingerprint_id = fingerprintId.trim()
        formDataPayload.access_deletion_date = noExpiration ? 'Sesuai Masa Penugasan' : accessDeletionDate.trim()
        formDataPayload.komitmen_agreed = komitmenAgreed
      }

      const res = await fetch(`${API_BASE_PATH}/api/it-form-submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_code: selectedFormCode,
          applicant_name: applicantName.trim(),
          applicant_nik: applicantNik.trim() || null,
          applicant_position: applicantPosition.trim() || null,
          employee_status: employeeStatus === 'Other' ? otherStatus.trim() || 'Other' : employeeStatus,
          department,
          company_name: companyName.trim() || null,
          purpose: purpose.trim() || null,
          form_data: formDataPayload,
          notes: notes.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim permohonan.')

      setSubmissionResult(data.submission)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleApproveStep = async (stepNum: number, decision: 'approve' | 'reject') => {
    if (!submissionResult) return
    setActionLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-form-submissions/${submissionResult.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step_number: stepNum,
          decision,
          approver_name: approverNameInput.trim() || adminUser?.username || 'Approver',
          signature_note: approvalNoteInput.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memproses tanda tangan.')
      if (data.submission) {
        setSubmissionResult(data.submission)
      } else {
        await fetchSubmissionByToken(submissionResult.token)
      }
      setApprovalNoteInput('')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const copyShareLink = () => {
    if (!submissionResult) return
    const url = `${window.location.origin}/form-it-esign?token=${submissionResult.token}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  // Quick preset helper for software lists
  const appendSoftware = (name: string) => {
    setSoftwareListText((prev) => {
      const trimmed = prev.trim()
      if (!trimmed) return name
      if (trimmed.toLowerCase().includes(name.toLowerCase())) return trimmed
      return `${trimmed}\n${name}`
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-24 pt-4 px-3 sm:px-6">
      {/* Top Banner / Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card/95 to-secondary/30 p-6 sm:p-9 shadow-sm">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600" />
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -left-20 -bottom-20 size-72 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-blue-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-md">
              <FileSignature className="size-8" />
              <span className="absolute -top-1 -right-1 flex size-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-3.5 rounded-full bg-emerald-500" />
              </span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-red-600 dark:text-red-400 uppercase">
                  <Lock className="size-3" />
                  CONFIDENTIAL - LEVEL 3
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  <Sparkles className="size-3" />
                  Digital E-Sign Workflow
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border bg-secondary/70 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  <ShieldCheck className="size-3 text-emerald-600" />
                  ISO/IEC 27001 ISMS
                </span>
              </div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                Formulir Layanan &amp; Pengesahan IT (E-Sign)
              </h1>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm max-w-2xl">
                PT. Jatim Autocomp Indonesia &bull; Sistem Pengajuan Digital Pengadaan, Akun, Lisensi &amp; Jaringan dengan Pengesahan QR Code Terverifikasi
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
            <Link
              href="/ijin-masuk-alat-it"
              className="inline-flex items-center gap-2 rounded-xl border border-border/90 bg-card px-4 py-2.5 text-xs font-semibold text-foreground shadow-xs transition hover:border-border hover:bg-secondary/70 hover:-translate-y-0.5"
            >
              <Laptop className="size-4 text-blue-600 dark:text-blue-400" />
              <span>Izin Alat Tamu</span>
            </Link>
            {adminUser && (
              <Link
                href="/kelola-approver-it"
                className="inline-flex items-center gap-2 rounded-xl border border-blue-500/40 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 px-4 py-2.5 text-xs font-semibold text-blue-700 dark:text-blue-400 shadow-xs transition hover:bg-blue-500/20 hover:-translate-y-0.5"
              >
                <Users className="size-4" />
                <span>Pengaturan Approver</span>
              </Link>
            )}
          </div>
        </div>

        {/* Search tracking bar with modern floating glass effect */}
        <div className="relative mt-7 flex items-center gap-2 rounded-2xl border border-border/80 bg-background/90 p-2 backdrop-blur-md shadow-xs focus-within:border-emerald-500/60 focus-within:ring-4 focus-within:ring-emerald-500/10 transition">
          <div className="flex items-center justify-center size-8 rounded-xl bg-secondary/60 text-muted-foreground ml-1 shrink-0">
            <Search className="size-4" />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchInput.trim() && fetchSubmissionByToken(searchInput.trim())}
            placeholder="Punya token kode pelacakan formulir? Masukkan di sini (contoh: a7b8c9d0...)"
            className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/70 sm:text-sm px-1 font-mono"
          />
          <button
            type="button"
            onClick={() => searchInput.trim() && fetchSubmissionByToken(searchInput.trim())}
            disabled={searchLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 active:scale-95"
          >
            {searchLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
            <span>{searchLoading ? 'Mencari...' : 'Cek Status'}</span>
          </button>
        </div>
      </section>

      {/* IF SUBMISSION RESULT EXISTS (LIVE E-SIGN STATUS VIEW) */}
      {submissionResult ? (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="rounded-3xl border border-emerald-500/40 bg-card p-6 sm:p-8 shadow-md">
            <div className="flex flex-col gap-4 border-b border-border/80 pb-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/30">
                    {submissionResult.form_code}
                  </span>
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    #{submissionResult.request_no}
                  </span>
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                      submissionResult.status === 'approved'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                        : submissionResult.status === 'rejected'
                        ? 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 animate-pulse'
                    }`}
                  >
                    {submissionResult.status === 'approved'
                      ? '✓ SELESAI DISETUJUI'
                      : submissionResult.status === 'rejected'
                      ? '✕ DITOLAK / PERLU REVISI'
                      : `⏱ PROSES APPROVAL (${submissionResult.current_step}/${submissionResult.total_steps})`}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">
                  {submissionResult.form_name}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  Pemohon: <span className="font-semibold text-foreground">{submissionResult.applicant_name}</span> &bull; {submissionResult.department} &bull; Tanggal: {submissionResult.request_date}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={copyShareLink}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary"
                >
                  {copiedLink ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                  {copiedLink ? 'Link Tersalin!' : 'Salin Tautan'}
                </button>
                <a
                  href={`${API_BASE_PATH}/api/it-form-submissions/${submissionResult.id}/pdf?token=${submissionResult.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:from-emerald-500 hover:to-teal-500"
                >
                  <Download className="size-4" />
                  <span>Download PDF Resmi</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setSubmissionResult(null)
                    window.history.replaceState({}, '', '/form-it-esign')
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                >
                  <Plus className="size-3.5" />
                  Buat Pengajuan Lain
                </button>
              </div>
            </div>

            {/* Approval Steps Chain */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Alur Tanda Tangan Digital &amp; Otorisasi Pejabat
                </h3>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {submissionResult.signatures?.length || 0} Tingkat Persetujuan
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {submissionResult.signatures?.map((sig) => {
                  const isApproved = sig.status === 'approved'
                  const isPending = sig.status === 'pending'
                  const isRejected = sig.status === 'rejected'

                  return (
                    <div
                      key={sig.id}
                      className={`relative flex flex-col justify-between rounded-2xl border p-4.5 transition-all ${
                        isApproved
                          ? 'border-emerald-500/40 bg-gradient-to-b from-emerald-500/10 via-card to-card shadow-xs'
                          : isPending
                          ? 'border-amber-500/60 bg-gradient-to-b from-amber-500/15 via-card to-card shadow-md ring-2 ring-amber-500/20'
                          : isRejected
                          ? 'border-red-500/40 bg-gradient-to-b from-red-500/10 via-card to-card'
                          : 'border-dashed border-border/70 bg-secondary/20 opacity-60'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="font-mono text-[11px] font-bold text-muted-foreground">
                            STEP #{sig.step_number} &bull; {sig.slot_label}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              isApproved
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : isPending
                                ? 'bg-amber-500 text-white animate-pulse shadow-2xs'
                                : isRejected
                                ? 'bg-red-600 text-white shadow-2xs'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {isApproved && <Check className="size-3" />}
                            {isPending && <Clock className="size-3" />}
                            {isRejected && <XCircle className="size-3" />}
                            {isApproved ? 'DISETUJUI' : isPending ? 'MENUNGGU' : isRejected ? 'DITOLAK' : 'ANTRI'}
                          </span>
                        </div>

                        <div className="mt-2.5">
                          <p className="text-sm font-bold text-foreground leading-snug">{sig.approver_name}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{sig.role_title}</p>
                          {sig.approver_email && (
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground/80 truncate">
                              {sig.approver_email}
                            </p>
                          )}
                        </div>

                        {isApproved && (
                          <div className="mt-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-800 dark:text-emerald-300">
                            <div className="flex items-center gap-1.5 font-bold">
                              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>E-Sign Terverifikasi</span>
                            </div>
                            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground break-all">{sig.verification_code}</div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {sig.signed_at ? new Date(sig.signed_at).toLocaleString('id-ID') : '-'}
                            </div>
                            {sig.signature_note && (
                              <div className="mt-1.5 rounded-md bg-emerald-500/10 p-1.5 italic text-[10px] text-foreground">
                                &quot;{sig.signature_note}&quot;
                              </div>
                            )}
                          </div>
                        )}

                        {isRejected && sig.signature_note && (
                          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-[11px] text-red-800 dark:text-red-300">
                            <span className="font-bold">Alasan Penolakan:</span> {sig.signature_note}
                          </div>
                        )}
                      </div>

                      {/* Approver Sign Action if this step is pending */}
                      {isPending && (
                        <div className="mt-4 border-t border-border/80 pt-3">
                          <div className="mb-2">
                            <label className="text-[11px] font-semibold text-foreground block mb-1">
                              Nama Penandatangan (Approver):
                            </label>
                            <input
                              type="text"
                              value={approverNameInput}
                              onChange={(e) => setApproverNameInput(e.target.value)}
                              placeholder={sig.approver_name}
                              className="h-9 w-full rounded-xl border border-input bg-card px-2.5 text-xs text-foreground outline-none focus:border-amber-500"
                            />
                          </div>
                          <div className="mb-3">
                            <input
                              type="text"
                              value={approvalNoteInput}
                              onChange={(e) => setApprovalNoteInput(e.target.value)}
                              placeholder="Catatan / Rekomendasi (opsional)..."
                              className="h-9 w-full rounded-xl border border-input bg-card px-2.5 text-xs text-foreground outline-none focus:border-amber-500"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => handleApproveStep(sig.step_number, 'approve')}
                              disabled={actionLoading}
                              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 active:scale-95"
                            >
                              {actionLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" strokeWidth={3} />}
                              <span>{actionLoading ? 'Memproses...' : 'Setujui & Bubuhkan E-Sign'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveStep(sig.step_number, 'reject')}
                              disabled={actionLoading}
                              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-500/40 bg-red-50/50 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 disabled:opacity-50"
                            >
                              <PencilLine className="size-3.5" />
                              <span>Minta Revisi / Tolak</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Application Data Summary */}
            <div className="mt-8 rounded-2xl border border-border/80 bg-secondary/30 p-5 sm:p-6">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileCheck className="size-4 text-emerald-600" />
                <span>Ringkasan Isian Formulir</span>
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground block text-[11px] mb-0.5">Tanggal Pengajuan:</span>
                  <span className="font-semibold text-foreground">{submissionResult.request_date}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px] mb-0.5">Nama Pemohon:</span>
                  <span className="font-semibold text-foreground">{submissionResult.applicant_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px] mb-0.5">Departemen:</span>
                  <span className="font-semibold text-foreground">{submissionResult.department}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px] mb-0.5">Status Karyawan:</span>
                  <span className="font-semibold text-foreground">{submissionResult.employee_status}</span>
                </div>
              </div>
              {submissionResult.notes && (
                <div className="mt-4 pt-3 border-t border-border/60 text-xs">
                  <span className="text-muted-foreground block text-[11px] mb-0.5">Catatan / Alasan:</span>
                  <span className="text-foreground">{submissionResult.notes}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* FORM SUBMISSION INTERFACE */
        <div className="space-y-8">
          {/* SECTION HEADER: Form Switcher Cards (Symmetrical 6-Column Responsive Grid) */}
          <div className="space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Layers className="size-3.5" />
                  </span>
                  <h2 className="text-base font-extrabold text-foreground tracking-tight sm:text-lg">
                    Pilih Kategori Layanan Formulir IT
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pilih salah satu dari {activeForms.length} formulir layanan digital di bawah ini untuk membuka lembar isian dan alur otorisasi E-Sign:
                </p>
              </div>
              <div className="inline-flex items-center gap-2 self-start sm:self-auto rounded-full bg-emerald-500/10 px-3.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shadow-2xs">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                </span>
                <span>{activeForms.length} Formulir Layanan Tersedia</span>
              </div>
            </div>

            {/* Symmetrical 6-Card Responsive Grid: 6 cols on lg, 3 cols on sm/md, 2 cols on mobile */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {activeForms.map((def, idx) => {
                const active = selectedFormCode === def.code
                const meta = FORM_METADATA[def.code] || FORM_METADATA['ISMS-F-010-001']
                const IconComponent = meta.icon

                return (
                  <button
                    key={def.code}
                    type="button"
                    onClick={() => {
                      setSelectedFormCode(def.code)
                      setErrorMsg('')
                    }}
                    className={`group relative flex flex-col items-center justify-between rounded-2xl border p-3.5 sm:p-4 text-center transition-all duration-200 cursor-pointer min-h-[162px] ${
                      active
                        ? 'border-emerald-500/90 bg-gradient-to-b from-emerald-500/10 via-card to-card shadow-lg ring-2 ring-emerald-500/30 -translate-y-1'
                        : 'border-border/80 bg-card/70 hover:bg-card hover:border-border hover:shadow-md hover:-translate-y-0.5'
                    }`}
                  >
                    {active && (
                      <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
                    )}

                    {active ? (
                      <span className="absolute top-2.5 right-2.5 flex size-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
                      </span>
                    ) : (
                      <span className="absolute top-2.5 right-2.5 font-mono text-[9px] font-bold text-muted-foreground/60 group-hover:text-muted-foreground">
                        #{idx + 1}
                      </span>
                    )}

                    <div
                      className={`grid size-12 place-items-center rounded-2xl transition-all duration-200 ${
                        active
                          ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs scale-105'
                          : 'bg-secondary/70 text-muted-foreground group-hover:bg-secondary group-hover:text-foreground group-hover:scale-102'
                      }`}
                    >
                      <IconComponent className="size-6" />
                    </div>

                    <div className="w-full my-1.5 space-y-0.5">
                      <span className="font-mono text-[9px] font-bold text-muted-foreground block truncate">
                        {def.code}
                      </span>
                      <h3 className="font-display text-xs font-bold text-foreground leading-snug line-clamp-2">
                        {meta.shortTitle}
                      </h3>
                    </div>

                    <div className="w-full pt-2 border-t border-border/50 flex items-center justify-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
                          active
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold'
                            : 'bg-secondary text-muted-foreground group-hover:bg-secondary group-hover:text-foreground'
                        }`}
                      >
                        {meta.tag}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* MAIN FORM CARD */}
          <form
            onSubmit={handleSubmit}
            className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-6 sm:p-9 shadow-md space-y-8"
          >
            {/* Form Title Banner with Theme Accent & Stepper */}
            <div className={`relative overflow-hidden rounded-3xl border p-6 sm:p-7 bg-gradient-to-br ${currentMeta.activeBg} ${currentMeta.activeBorder} shadow-sm`}>
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-emerald-500/10 blur-2xl" />
              <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-card/90 border border-border shadow-md">
                    {React.createElement(currentMeta.icon, {
                      className: `size-8 ${currentMeta.colorClass}`,
                    })}
                    <span className="absolute -bottom-1 -right-1 flex size-3">
                      <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground bg-card/90 px-2.5 py-0.5 rounded-md border border-border shadow-2xs">
                        {currentFormDef.code}
                      </span>
                      <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 text-[10px] font-extrabold text-red-600 dark:text-red-400 uppercase tracking-wider">
                        {currentFormDef.badge}
                      </span>
                      <span className="rounded-full bg-card/80 px-2.5 py-0.5 text-[10px] font-semibold text-foreground/80 border border-border/80 flex items-center gap-1 shadow-2xs">
                        <Users className="size-3 text-emerald-600" />
                        <span>{currentMeta.approvalCount} Tingkat Approver E-Sign</span>
                      </span>
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                        {currentMeta.category}
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                      {currentFormDef.name}
                    </h2>

                    <div className="inline-flex items-center gap-1.5 rounded-md bg-secondary/80 px-2.5 py-0.5 text-[11px] font-mono text-muted-foreground border border-border/50">
                      <span>🇯🇵</span>
                      <span>{currentFormDef.jpName}</span>
                    </div>

                    <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed pt-1">
                      {currentMeta.shortDesc}
                    </p>

                    {/* Features Pill Row */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {currentMeta.features.map((feat, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-0.5 text-[10px] font-medium text-foreground/80 border border-border/70 shadow-2xs"
                        >
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          <span>{feat}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4-Step Progress Indicator */}
                <div className="rounded-2xl bg-card/90 p-3.5 sm:p-4 border border-border shadow-xs shrink-0 self-stretch lg:self-center">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Tahapan Pengisian</span>
                    <span className="text-emerald-600 font-mono">4 Langkah</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-2 font-bold text-emerald-800 dark:text-emerald-300">
                      <span className="grid size-5 place-items-center rounded-full bg-emerald-600 text-[10px] font-black text-white shrink-0">
                        1
                      </span>
                      <span className="truncate">Data Pemohon</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-secondary/60 border border-border/60 p-2 font-medium text-muted-foreground">
                      <span className="grid size-5 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                        2
                      </span>
                      <span className="truncate">Spesifikasi</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-secondary/60 border border-border/60 p-2 font-medium text-muted-foreground">
                      <span className="grid size-5 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                        3
                      </span>
                      <span className="truncate">Catatan &amp; Alasan</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-secondary/60 border border-border/60 p-2 font-medium text-muted-foreground">
                      <span className="grid size-5 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                        4
                      </span>
                      <span className="truncate">Alur E-Sign</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-700 dark:text-red-400 animate-in fade-in">
                <AlertTriangle className="size-5 shrink-0 text-red-600" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
            )}

            {/* SECTION 1: APPLICANT INFORMATION */}
            <div className="rounded-3xl border border-border/80 bg-card/50 p-6 sm:p-7 space-y-6 shadow-xs">
              <div className="flex items-center justify-between pb-3.5 border-b border-border/70">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-black shadow-2xs">
                    01
                  </span>
                  <div>
                    <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wide">
                      Data Pemohon (Applicant Identity)
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Informasi identitas karyawan yang mengajukan permohonan layanan IT ini
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/80 border border-border/60 px-3 py-1 rounded-full">
                  <span>Langkah 1 dari 4</span>
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Nama Pemohon */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-foreground">
                    Nama Pemohon (氏名) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="Nama lengkap pemohon..."
                      className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 shadow-2xs"
                      required
                    />
                  </div>
                </div>

                {/* NIK */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-foreground">
                    NIK / Nomor Karyawan (従業員番号)
                  </label>
                  <div className="relative">
                    <BadgeCheck className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={applicantNik}
                      onChange={(e) => setApplicantNik(e.target.value)}
                      placeholder="Contoh: 123456"
                      className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 font-mono shadow-2xs"
                    />
                  </div>
                </div>

                {/* Jabatan */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-foreground">
                    Jabatan (職務)
                  </label>
                  <div className="relative">
                    <Briefcase className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={applicantPosition}
                      onChange={(e) => setApplicantPosition(e.target.value)}
                      placeholder="Contoh: Staff, Leader, Supervisor"
                      className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Departemen */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-foreground">
                    Departemen (所属部署) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-8 text-xs sm:text-sm text-foreground outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 shadow-2xs"
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Status Karyawan - Modern Segmented Pills */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold text-foreground">
                    Status Karyawan (ステータス)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['TETAP', 'KONTRAK', 'Other'] as const).map((st) => {
                      const isSelected = employeeStatus === st
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setEmployeeStatus(st)}
                          className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-xs font-bold transition active:scale-95 ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/80 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                              : 'border-border bg-card text-muted-foreground hover:bg-secondary/50'
                          }`}
                        >
                          {isSelected ? (
                            <Check className="size-3.5 text-emerald-600 shrink-0" />
                          ) : st === 'TETAP' ? (
                            <BadgeCheck className="size-3.5 text-muted-foreground/70 shrink-0" />
                          ) : st === 'KONTRAK' ? (
                            <CalendarDays className="size-3.5 text-muted-foreground/70 shrink-0" />
                          ) : (
                            <User className="size-3.5 text-muted-foreground/70 shrink-0" />
                          )}
                          <span>{st === 'Other' ? 'Lainnya / Vendor' : st}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {employeeStatus === 'Other' && (
                  <div className="sm:col-span-3 animate-in fade-in">
                    <label className="mb-1.5 block text-xs font-bold text-foreground">
                      Keterangan Status Lainnya (e.g. Magang, Vendor, Tamu)
                    </label>
                    <input
                      type="text"
                      value={otherStatus}
                      onChange={(e) => setOtherStatus(e.target.value)}
                      placeholder="Tuliskan status kekaryawanan..."
                      className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2: FORM SPECIFIC FIELDS */}
            {/* ISMS-F-010-001: Pengadaan PC / Laptop */}
            {selectedFormCode === 'ISMS-F-010-001' && (
              <div className="rounded-3xl border border-border/80 bg-card/50 p-6 sm:p-7 space-y-6 shadow-xs">
                <div className="flex items-center justify-between pb-3.5 border-b border-border/70">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-xl bg-blue-500/15 text-blue-700 dark:text-blue-400 font-mono text-xs font-black shadow-2xs">
                      02
                    </span>
                    <div>
                      <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wide">
                        Informasi Pengadaan PC/Laptop &amp; Lisensi Wajib
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Tentukan jenis pengadaan baru atau penggantian unit lama beserta rincian perangkat
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/80 border border-border/60 px-3 py-1 rounded-full">
                    <span>Langkah 2 dari 4</span>
                  </span>
                </div>

                {/* Jenis Pengadaan Feature Cards */}
                <div>
                  <label className="mb-2 block text-xs font-bold text-foreground">
                    Jenis Pengadaan (購入種類) <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div
                      onClick={() => setJenisPengadaan('baru')}
                      className={`relative flex items-start gap-3.5 rounded-2xl border p-4.5 cursor-pointer transition ${
                        jenisPengadaan === 'baru'
                          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/25 ring-2 ring-blue-500/25 shadow-xs'
                          : 'border-border bg-card hover:bg-secondary/40'
                      }`}
                    >
                      <div className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border ${
                        jenisPengadaan === 'baru' ? 'bg-blue-600 text-white border-blue-600' : 'bg-secondary text-muted-foreground border-border'
                      }`}>
                        <Plus className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-foreground">PENGADAAN BARU</span>
                          <span className="text-[10px] text-muted-foreground font-mono">(新規パソコン追加購入)</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Penambahan unit komputer/laptop kerja baru untuk karyawan baru atau divisi baru.
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={() => setJenisPengadaan('pembaharuan')}
                      className={`relative flex items-start gap-3.5 rounded-2xl border p-4.5 cursor-pointer transition ${
                        jenisPengadaan === 'pembaharuan'
                          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/25 ring-2 ring-blue-500/25 shadow-xs'
                          : 'border-border bg-card hover:bg-secondary/40'
                      }`}
                    >
                      <div className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border ${
                        jenisPengadaan === 'pembaharuan' ? 'bg-blue-600 text-white border-blue-600' : 'bg-secondary text-muted-foreground border-border'
                      }`}>
                        <RotateCcw className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-foreground">PEMBAHARUAN</span>
                          <span className="text-[10px] text-muted-foreground font-mono">(新規パソコンとの変更購入)</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Penggantian / upgrade unit PC lama yang rusak atau tidak sesuai spesifikasi lagi.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Maker, Model, OS with Quick Preset Chips */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-foreground">Maker / Merk (メーカー名)</label>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {['Dell', 'Lenovo', 'HP', 'ASUS'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMaker(m)}
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold border transition ${
                            maker === m
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-secondary/60 text-muted-foreground border-border hover:bg-secondary'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={maker}
                      onChange={(e) => setMaker(e.target.value)}
                      placeholder="e.g. Dell, Lenovo, HP"
                      className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-foreground">
                      Model / Type (型番)
                    </label>
                    <input
                      type="text"
                      value={modelType}
                      onChange={(e) => setModelType(e.target.value)}
                      placeholder="e.g. Latitude 5440, ThinkPad T14"
                      className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-foreground">Operating System (OS)</label>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {['Windows 11 Pro', 'Windows 10 Pro'].map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => setOsInfo(o)}
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold border transition ${
                            osInfo === o
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-secondary/60 text-muted-foreground border-border hover:bg-secondary'
                          }`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={osInfo}
                      onChange={(e) => setOsInfo(e.target.value)}
                      placeholder="e.g. Windows 11 Pro 64-bit"
                      className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {jenisPengadaan === 'pembaharuan' && (
                    <div className="animate-in fade-in">
                      <label className="mb-1.5 block text-xs font-bold text-foreground">
                        PC Name Lama (Khusus Pembaharuan) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={oldPcName}
                        onChange={(e) => setOldPcName(e.target.value)}
                        placeholder="e.g. JAI-PC-MFG01"
                        className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 font-mono"
                      />
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-foreground">
                      Login User Name (ユーザー名)
                    </label>
                    <input
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="e.g. jaimfg01 atau nama user"
                      className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 font-mono"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-foreground">
                      Kegunaan / Fungsi Komputer (使用用途)
                    </label>
                    <input
                      type="text"
                      value={functionPurpose}
                      onChange={(e) => setFunctionPurpose(e.target.value)}
                      placeholder="e.g. Input Produksi, Drawing CAD, Office"
                      className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                    />
                  </div>
                </div>

                {/* Software List Section with Quick Chips */}
                <div className="rounded-2xl border border-border/80 bg-secondary/30 p-5 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <label className="text-xs font-bold text-foreground flex items-center gap-2">
                      <Cpu className="size-4 text-blue-600" />
                      <span>List Software yang Diwajibkan dengan Lisensi Resmi (ライセンス必須 ソフトウェアリスト)</span>
                    </label>
                    <span className="text-[11px] text-muted-foreground">Tuliskan 1 software per baris</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground">Pilihan Cepat:</span>
                    {['Microsoft Office 2021', 'AutoCAD LT', 'Adobe Acrobat Standard', 'SAP Client', 'SolidWorks 2024', 'VS Code'].map((sw) => (
                      <button
                        key={sw}
                        type="button"
                        onClick={() => appendSoftware(sw)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[10px] font-semibold text-foreground hover:bg-secondary transition active:scale-95"
                      >
                        <Plus className="size-2.5 text-blue-600" />
                        <span>{sw}</span>
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={4}
                    value={softwareListText}
                    onChange={(e) => setSoftwareListText(e.target.value)}
                    placeholder="Contoh:&#10;1. Microsoft Office 2021 Pro&#10;2. AutoCAD LT 2024&#10;3. Adobe Acrobat DC"
                    className="w-full rounded-xl border border-input bg-card p-3.5 text-xs text-foreground outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 font-mono shadow-inner"
                  />
                </div>
              </div>
            )}

            {/* ISMS-F-010-003: Pengadaan Software */}
            {selectedFormCode === 'ISMS-F-010-003' && (
              <div className="rounded-3xl border border-border/80 bg-card/50 p-6 sm:p-7 space-y-6 shadow-xs">
                <div className="flex items-center justify-between pb-3.5 border-b border-border/70">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-xl bg-purple-500/15 text-purple-700 dark:text-purple-400 font-mono text-xs font-black shadow-2xs">
                      02
                    </span>
                    <div>
                      <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wide">
                        Informasi Software &amp; Komputer yang Akan Diinstall
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Rincian lisensi software yang diajukan dan identitas PC tujuan instalasi
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/80 border border-border/60 px-3 py-1 rounded-full">
                    <span>Langkah 2 dari 4</span>
                  </span>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold text-foreground">
                    Jenis Pengadaan Software (購入種類) <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div
                      onClick={() => setJenisPengadaan('baru')}
                      className={`relative flex items-start gap-3.5 rounded-2xl border p-4.5 cursor-pointer transition ${
                        jenisPengadaan === 'baru'
                          ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/25 ring-2 ring-purple-500/25 shadow-xs'
                          : 'border-border bg-card hover:bg-secondary/40'
                      }`}
                    >
                      <div className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border ${
                        jenisPengadaan === 'baru' ? 'bg-purple-600 text-white border-purple-600' : 'bg-secondary text-muted-foreground border-border'
                      }`}>
                        <Sparkles className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-foreground">PENGADAAN LISENSI BARU</span>
                          <span className="text-[10px] text-muted-foreground font-mono">(新規購入)</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Pembelian lisensi baru yang belum pernah dimiliki sebelumnya.
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={() => setJenisPengadaan('pembaharuan')}
                      className={`relative flex items-start gap-3.5 rounded-2xl border p-4.5 cursor-pointer transition ${
                        jenisPengadaan === 'pembaharuan'
                          ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/25 ring-2 ring-purple-500/25 shadow-xs'
                          : 'border-border bg-card hover:bg-secondary/40'
                      }`}
                    >
                      <div className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border ${
                        jenisPengadaan === 'pembaharuan' ? 'bg-purple-600 text-white border-purple-600' : 'bg-secondary text-muted-foreground border-border'
                      }`}>
                        <RotateCcw className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-foreground">PEMBAHARUAN VERSI</span>
                          <span className="text-[10px] text-muted-foreground font-mono">(バージョンアップ)</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Upgrade versi software resmi ke rilis yang lebih baru.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/80 bg-secondary/30 p-5 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <label className="text-xs font-bold text-foreground flex items-center gap-2">
                      <Cpu className="size-4 text-purple-600" />
                      <span>Software Wajib Berlisensi yang Akan Diorderkan (ライセンス必須 ソフトウェアリスト)</span>
                    </label>
                    <span className="text-[11px] text-muted-foreground">Tuliskan 1 software per baris</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground">Pilihan Cepat:</span>
                    {['SolidWorks Professional', 'MATLAB & Simulink', 'AutoCAD Mechanical', 'Microsoft Visio Pro', 'Visual Studio Enterprise'].map((sw) => (
                      <button
                        key={sw}
                        type="button"
                        onClick={() => appendSoftware(sw)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[10px] font-semibold text-foreground hover:bg-secondary transition active:scale-95"
                      >
                        <Plus className="size-2.5 text-purple-600" />
                        <span>{sw}</span>
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={4}
                    value={softwareListText}
                    onChange={(e) => setSoftwareListText(e.target.value)}
                    placeholder="Contoh:&#10;1. SolidWorks Professional 2024&#10;2. MATLAB Machine Learning Toolbox"
                    className="w-full rounded-xl border border-input bg-card p-3.5 text-xs text-foreground outline-none transition focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 font-mono shadow-inner"
                  />
                </div>

                {/* PC Info Section */}
                <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
                    <Laptop className="size-4 text-purple-600" />
                    <span>Informasi PC/Laptop yang Akan Diinstall (インストールするコンピューター情報)</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">Asset No. (資産管理番号)</label>
                      <input
                        type="text"
                        value={assetNo}
                        onChange={(e) => setAssetNo(e.target.value)}
                        placeholder="e.g. AST-IT-2024-001"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-purple-500 font-mono shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">Maker (メーカー名)</label>
                      <input
                        type="text"
                        value={maker}
                        onChange={(e) => setMaker(e.target.value)}
                        placeholder="e.g. Dell, Lenovo"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-purple-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">Model/Type (型番)</label>
                      <input
                        type="text"
                        value={modelType}
                        onChange={(e) => setModelType(e.target.value)}
                        placeholder="e.g. OptiPlex 7010"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-purple-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">Serial No. (製造番号)</label>
                      <input
                        type="text"
                        value={serialNo}
                        onChange={(e) => setSerialNo(e.target.value)}
                        placeholder="e.g. SN12345678"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-purple-500 font-mono shadow-2xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 pt-1">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">Operating System (OS)</label>
                      <input
                        type="text"
                        value={osInfo}
                        onChange={(e) => setOsInfo(e.target.value)}
                        placeholder="e.g. Windows 11 Pro"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-purple-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">PC Name (コンピューター名)</label>
                      <input
                        type="text"
                        value={pcName}
                        onChange={(e) => setPcName(e.target.value)}
                        placeholder="e.g. JAI-PC-ENG01"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-purple-500 font-mono shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">Login User Name</label>
                      <input
                        type="text"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        placeholder="e.g. username"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-purple-500 font-mono shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">Kegunaan/Fungsi</label>
                      <input
                        type="text"
                        value={functionPurpose}
                        onChange={(e) => setFunctionPurpose(e.target.value)}
                        placeholder="e.g. Desain Drawing"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-purple-500 shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ISMS-F-010-006: Email & User ID */}
            {selectedFormCode === 'ISMS-F-010-006' && (
              <div className="rounded-3xl border border-border/80 bg-card/50 p-6 sm:p-7 space-y-6 shadow-xs">
                <div className="flex items-center justify-between pb-3.5 border-b border-border/70">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-black shadow-2xs">
                      02
                    </span>
                    <div>
                      <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wide">
                        Perihal Pengajuan / Perubahan Akun (件名)
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Pilih layanan email atau user ID login yang hendak dibuat atau diubah
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/80 border border-border/60 px-3 py-1 rounded-full">
                    <span>Langkah 2 dari 4</span>
                  </span>
                </div>

                {/* 4 Interactive Toggle Cards */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div
                    onClick={() => setReqEmail(!reqEmail)}
                    className={`flex items-center gap-3.5 rounded-2xl border p-4.5 cursor-pointer transition ${
                      reqEmail
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/25 ring-2 ring-emerald-500/25 shadow-xs'
                        : 'border-border bg-card hover:bg-secondary/40'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-xl border ${
                      reqEmail ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-secondary text-muted-foreground border-border'
                    }`}>
                      {reqEmail ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-foreground">Pengajuan Email Baru</div>
                      <div className="text-[10px] text-muted-foreground">Pembuatan alamat mailbox baru @jai.co.id (Eメール申請)</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setChangeEmail(!changeEmail)}
                    className={`flex items-center gap-3.5 rounded-2xl border p-4.5 cursor-pointer transition ${
                      changeEmail
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/25 ring-2 ring-emerald-500/25 shadow-xs'
                        : 'border-border bg-card hover:bg-secondary/40'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-xl border ${
                      changeEmail ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-secondary text-muted-foreground border-border'
                    }`}>
                      {changeEmail ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-foreground">Perubahan Email Address</div>
                      <div className="text-[10px] text-muted-foreground">Ganti alias atau nama display email (Eメール変更)</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setReqUserId(!reqUserId)}
                    className={`flex items-center gap-3.5 rounded-2xl border p-4.5 cursor-pointer transition ${
                      reqUserId
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/25 ring-2 ring-emerald-500/25 shadow-xs'
                        : 'border-border bg-card hover:bg-secondary/40'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-xl border ${
                      reqUserId ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-secondary text-muted-foreground border-border'
                    }`}>
                      {reqUserId ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-foreground">Pengajuan User ID Login</div>
                      <div className="text-[10px] text-muted-foreground">Pembuatan kredensial login Windows / Domain (ユーザID申請)</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setChangeUserId(!changeUserId)}
                    className={`flex items-center gap-3.5 rounded-2xl border p-4.5 cursor-pointer transition ${
                      changeUserId
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/25 ring-2 ring-emerald-500/25 shadow-xs'
                        : 'border-border bg-card hover:bg-secondary/40'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-xl border ${
                      changeUserId ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-secondary text-muted-foreground border-border'
                    }`}>
                      {changeUserId ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-foreground">Perubahan User ID Login</div>
                      <div className="text-[10px] text-muted-foreground">Update hak akses atau nama user login (ユーザID変更)</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-foreground">
                        Alamat Email yang Dimohon / Diubah
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (targetEmail && !targetEmail.includes('@')) {
                            setTargetEmail(`${targetEmail}@jai.co.id`)
                          }
                        }}
                        className="text-[10px] font-bold text-emerald-600 hover:underline"
                      >
                        + @jai.co.id
                      </button>
                    </div>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="email"
                        value={targetEmail}
                        onChange={(e) => setTargetEmail(e.target.value)}
                        placeholder="contoh: nama.karyawan@jai.co.id"
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 font-mono shadow-2xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-foreground">
                      Login User ID yang Dimohon / Diubah
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        placeholder="contoh: jaimfg01 atau username domain"
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 font-mono shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ISMS-F-010-007: Deletion of Email & ID */}
            {selectedFormCode === 'ISMS-F-010-007' && (
              <div className="rounded-3xl border border-border/80 bg-card/50 p-6 sm:p-7 space-y-6 shadow-xs">
                <div className="flex items-center justify-between pb-3.5 border-b border-border/70">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-400 font-mono text-xs font-black shadow-2xs">
                      02
                    </span>
                    <div>
                      <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wide">
                        Perihal Penghapusan / Penonaktifan Akun (件名)
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Pilih penonaktifan akun email atau user login untuk karyawan resign / mutasi
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/80 border border-border/60 px-3 py-1 rounded-full">
                    <span>Langkah 2 dari 4</span>
                  </span>
                </div>

                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4.5 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-3">
                  <ShieldAlert className="size-5 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <span className="font-bold block text-sm mb-1">Peringatan Keamanan ISMS ISO/IEC 27001:</span>
                    Penghapusan akun akan mencabut akses ke seluruh email server, active directory, dan sistem internal perusahaan secara permanen guna mencegah akses tidak sah pasca purna tugas karyawan.
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div
                    onClick={() => setDelEmail(!delEmail)}
                    className={`flex items-center gap-3.5 rounded-2xl border p-4.5 cursor-pointer transition ${
                      delEmail
                        ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/25 ring-2 ring-rose-500/25 shadow-xs'
                        : 'border-border bg-card hover:bg-secondary/40'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-xl border ${
                      delEmail ? 'bg-rose-600 text-white border-rose-600' : 'bg-secondary text-muted-foreground border-border'
                    }`}>
                      {delEmail ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-foreground">Penghapusan Email Address</div>
                      <div className="text-[10px] text-muted-foreground">Deaktivasi &amp; backup mailbox (Eメールアドレスの削除)</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setDelUserId(!delUserId)}
                    className={`flex items-center gap-3.5 rounded-2xl border p-4.5 cursor-pointer transition ${
                      delUserId
                        ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/25 ring-2 ring-rose-500/25 shadow-xs'
                        : 'border-border bg-card hover:bg-secondary/40'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-xl border ${
                      delUserId ? 'bg-rose-600 text-white border-rose-600' : 'bg-secondary text-muted-foreground border-border'
                    }`}>
                      {delUserId ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-foreground">Penghapusan Login User ID</div>
                      <div className="text-[10px] text-muted-foreground">Pencabutan akun domain Windows (ユーザIDの削除)</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-foreground">
                      Alamat Email yang Dihapus
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="email"
                        value={targetEmail}
                        onChange={(e) => setTargetEmail(e.target.value)}
                        placeholder="contoh: nama.karyawan@jai.co.id"
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15 font-mono shadow-2xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-foreground">
                      Login User ID yang Dihapus
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        placeholder="contoh: jaimfg01"
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15 font-mono shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ISMS-F-03-00-003: Network Connection */}
            {selectedFormCode === 'ISMS-F-03-00-003' && (
              <div className="rounded-3xl border border-border/80 bg-card/50 p-6 sm:p-7 space-y-6 shadow-xs">
                <div className="flex items-center justify-between pb-3.5 border-b border-border/70">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-400 font-mono text-xs font-black shadow-2xs">
                      02
                    </span>
                    <div>
                      <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wide">
                        Informasi Koneksi &amp; Perangkat Jaringan (Network Details)
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Rincian durasi sambungan, lokasi fisik, tujuan akses, dan konfigurasi IP perangkat
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/80 border border-border/60 px-3 py-1 rounded-full">
                    <span>Langkah 2 dari 4</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-foreground">
                      Dari Tanggal (FROM: から) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="date"
                        value={periodFrom}
                        onChange={(e) => setPeriodFrom(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 font-mono shadow-2xs"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-foreground">
                      Sampai Tanggal (TO: まで) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="date"
                        value={periodTo}
                        onChange={(e) => setPeriodTo(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 font-mono shadow-2xs"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-foreground">
                      Lokasi Sambungan (接続場所) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={networkLocation}
                        onChange={(e) => setNetworkLocation(e.target.value)}
                        placeholder="e.g. Ruang Meeting, Server Room, MFG"
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 shadow-2xs"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Purpose of Connection Toggle Cards */}
                <div>
                  <label className="mb-2 block text-xs font-bold text-foreground">
                    Tujuan Penggunaan Jaringan (使用目的)
                  </label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div
                      onClick={() => setPurposeInternet(!purposeInternet)}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition ${
                        purposeInternet
                          ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/25 ring-2 ring-teal-500/20 text-foreground font-bold shadow-2xs'
                          : 'border-border bg-card text-muted-foreground hover:bg-secondary/40'
                      }`}
                    >
                      <Globe className={`size-4 ${purposeInternet ? 'text-teal-600' : 'text-muted-foreground'}`} />
                      <span className="text-xs">Internet Browsing</span>
                    </div>

                    <div
                      onClick={() => setPurposeEmail(!purposeEmail)}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition ${
                        purposeEmail
                          ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/25 ring-2 ring-teal-500/20 text-foreground font-bold shadow-2xs'
                          : 'border-border bg-card text-muted-foreground hover:bg-secondary/40'
                      }`}
                    >
                      <Mail className={`size-4 ${purposeEmail ? 'text-teal-600' : 'text-muted-foreground'}`} />
                      <span className="text-xs">Mail Client</span>
                    </div>

                    <div
                      onClick={() => setPurposeWeb(!purposeWeb)}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition ${
                        purposeWeb
                          ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/25 ring-2 ring-teal-500/20 text-foreground font-bold shadow-2xs'
                          : 'border-border bg-card text-muted-foreground hover:bg-secondary/40'
                      }`}
                    >
                      <Layers className={`size-4 ${purposeWeb ? 'text-teal-600' : 'text-muted-foreground'}`} />
                      <span className="text-xs">Internal Web Apps</span>
                    </div>

                    <div
                      onClick={() => setPurposeFtp(!purposeFtp)}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition ${
                        purposeFtp
                          ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/25 ring-2 ring-teal-500/20 text-foreground font-bold shadow-2xs'
                          : 'border-border bg-card text-muted-foreground hover:bg-secondary/40'
                      }`}
                    >
                      <HardDrive className={`size-4 ${purposeFtp ? 'text-teal-600' : 'text-muted-foreground'}`} />
                      <span className="text-xs">FTP &amp; File Server</span>
                    </div>
                  </div>
                </div>

                {/* IT Security & Antivirus Verification Box */}
                <div className="rounded-2xl border border-border/80 bg-secondary/30 p-5 space-y-4">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
                    <ShieldCheck className="size-4 text-teal-600" />
                    <span>Verifikasi Anti-Virus &amp; Konfigurasi IP (IT Security Check)</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">Status Anti-Virus Terinstall</label>
                      <select
                        value={antivirusInstalled ? 'yes' : 'no'}
                        onChange={(e) => setAntivirusInstalled(e.target.value === 'yes')}
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-teal-500 shadow-2xs"
                      >
                        <option value="yes">YES (Wajib Terinstall)</option>
                        <option value="no">NO</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">Nama Software Anti-Virus</label>
                      <input
                        type="text"
                        value={antivirusName}
                        onChange={(e) => setAntivirusName(e.target.value)}
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-teal-500 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">Sistem Operasi (OS)</label>
                      <input
                        type="text"
                        value={osInfo}
                        onChange={(e) => setOsInfo(e.target.value)}
                        placeholder="Windows 11 / MacOS / Linux"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-teal-500 shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold text-foreground">Metode Pengaturan Alamat IP</label>
                    <div className="grid grid-cols-2 gap-3 max-w-md">
                      <button
                        type="button"
                        onClick={() => setIpMode('dhcp')}
                        className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-4 text-xs font-bold transition active:scale-95 ${
                          ipMode === 'dhcp'
                            ? 'border-teal-600 bg-teal-50/80 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 ring-2 ring-teal-500/20 shadow-xs'
                            : 'border-border bg-card text-muted-foreground hover:bg-secondary/40'
                        }`}
                      >
                        {ipMode === 'dhcp' && <Check className="size-3.5 text-teal-600" />}
                        <span>DHCP (Automatic IP)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIpMode('static')}
                        className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-4 text-xs font-bold transition active:scale-95 ${
                          ipMode === 'static'
                            ? 'border-teal-600 bg-teal-50/80 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 ring-2 ring-teal-500/20 shadow-xs'
                            : 'border-border bg-card text-muted-foreground hover:bg-secondary/40'
                        }`}
                      >
                        {ipMode === 'static' && <Check className="size-3.5 text-teal-600" />}
                        <span>STATIC IP (Manual)</span>
                      </button>
                    </div>
                  </div>

                  {ipMode === 'static' && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2 animate-in fade-in">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">IP Address</label>
                        <input
                          type="text"
                          value={staticIp}
                          onChange={(e) => setStaticIp(e.target.value)}
                          placeholder="192.168.1.xxx"
                          className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-teal-500 font-mono shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Subnet Mask</label>
                        <input
                          type="text"
                          value={staticSubnet}
                          onChange={(e) => setStaticSubnet(e.target.value)}
                          className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-teal-500 font-mono shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Gateway Address</label>
                        <input
                          type="text"
                          value={staticGateway}
                          onChange={(e) => setStaticGateway(e.target.value)}
                          placeholder="192.168.1.1"
                          className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-teal-500 font-mono shadow-2xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FORM 6: ISMS-F-02-00-002 (Fingerprint Special Security Area) */}
            {selectedFormCode === 'ISMS-F-02-00-002' && (
              <div className="rounded-3xl border border-border/80 bg-card/50 p-6 sm:p-7 space-y-6 shadow-xs">
                <div className="flex items-center justify-between pb-3.5 border-b border-border/70">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-xl bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 font-mono text-xs font-black shadow-2xs">
                      02
                    </span>
                    <div>
                      <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wide">
                        Registrasi Akses Sidik Jari (Special Security Area)
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Pendaftaran akses sidik jari area khusus berkeamanan tinggi dengan verifikasi dan persetujuan resmi IAA
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/80 border border-border/60 px-3 py-1 rounded-full">
                    <span>Langkah 2 dari 4</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-xs font-bold text-foreground">
                      Area Special Security yang Dituju (入退する特別区画) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {[
                        'Ruang Server / Server Room',
                        'Ruang Arsip Data / Document Storage',
                        'Ruang Kontrol / Security Control Room',
                        'Ruang Server Backup & Network Hub',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAreaSpecialSecurity(preset)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                            areaSpecialSecurity === preset
                              ? 'border-indigo-600 bg-indigo-50 font-bold text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                              : 'border-border bg-card text-muted-foreground hover:bg-secondary/40'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={areaSpecialSecurity}
                      onChange={(e) => setAreaSpecialSecurity(e.target.value)}
                      placeholder="Masukkan atau pilih area special security..."
                      className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 shadow-2xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-foreground">
                      Kode ID / ID Sidik Jari (ID コード)
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">(Opsional / jika sudah ada)</span>
                    </label>
                    <div className="relative">
                      <Fingerprint className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={fingerprintId}
                        onChange={(e) => setFingerprintId(e.target.value)}
                        placeholder="Contoh: FP-0129 / Kosongkan jika baru"
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 font-mono shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-foreground">
                        Tanggal Penghapusan Akses (アクセス削除日付)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setNoExpiration(!noExpiration)
                          if (!noExpiration) setAccessDeletionDate('')
                        }}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                      >
                        {noExpiration ? 'Tetapkan Tanggal Tertentu' : 'Sesuai Masa Penugasan'}
                      </button>
                    </div>
                    {noExpiration ? (
                      <div className="flex h-11 w-full items-center rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 px-3.5 text-xs font-semibold text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300">
                        <Check className="mr-2 size-3.5 text-indigo-600" /> Sesuai Masa Penugasan (Tidak Dibatasi Tanggal)
                      </div>
                    ) : (
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="date"
                          value={accessDeletionDate}
                          onChange={(e) => setAccessDeletionDate(e.target.value)}
                          className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 font-mono shadow-2xs"
                          required={!noExpiration}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Komitmen / 約束 Box */}
                <div className="rounded-3xl border border-amber-300/80 bg-gradient-to-br from-amber-50/80 via-amber-50/30 to-transparent p-5 sm:p-6 dark:border-amber-900/60 dark:from-amber-950/20 dark:via-transparent shadow-xs">
                  <div className="flex items-start gap-3.5">
                    <div className="grid size-10 place-items-center rounded-2xl bg-amber-500 text-white shadow-sm shrink-0">
                      <Shield className="size-5" />
                    </div>
                    <div className="flex-1 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-extrabold text-foreground tracking-tight">
                          KOMITMEN KEAMANAN INFORMASI / 特別区画遵守約束
                        </h4>
                        <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-black text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                          Wajib Disetujui
                        </span>
                      </div>
                      <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                        <li className="flex items-start gap-2">
                          <span className="font-bold text-amber-700 dark:text-amber-400 shrink-0">1.</span>
                          <span>
                            <strong>Menjaga kerahasiaan informasi yang ada di Special Security Area</strong> (特別セキュリティ区画にある情報資産を守ること).
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-bold text-amber-700 dark:text-amber-400 shrink-0">2.</span>
                          <span>
                            <strong>Melaporkan ke IAA (Teguh Sunjoyo) bila terjadi kebocoran informasi</strong> (情報漏れが発生した場合、情報資産管理者（タグーさん）へ至急に連絡すること).
                          </span>
                        </li>
                      </ul>

                      <label className={`mt-3 flex items-center gap-3 cursor-pointer p-3 rounded-xl border transition ${
                        komitmenAgreed
                          ? 'border-emerald-500/80 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 shadow-2xs'
                          : 'border-amber-300/80 bg-amber-50/40 dark:border-amber-900/60 text-foreground'
                      }`}>
                        <input
                          type="checkbox"
                          checked={komitmenAgreed}
                          onChange={(e) => setKomitmenAgreed(e.target.checked)}
                          className="size-4.5 rounded text-emerald-600 focus:ring-emerald-500"
                          required
                        />
                        <span className="text-xs font-bold leading-snug">
                          Saya menyatakan memahami, menyetujui, dan berkomitmen mematuhi ketentuan keamanan di atas.
                        </span>
                        {komitmenAgreed && (
                          <CheckCircle2 className="size-4 text-emerald-600 ml-auto shrink-0" />
                        )}
                      </label>
                    </div>
                  </div>
                </div>

                {/* Approver Highlight Box */}
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-200/80 bg-indigo-50/60 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/25 shadow-2xs">
                  <div className="flex items-center gap-3.5">
                    <div className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white font-mono text-xs font-black shadow-xs">
                      IAA
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Penyetuju Akhir: Teguh Sunjoyo</p>
                      <p className="text-[11px] text-muted-foreground">Information Assets Administrator (IAA) • E-Sign Resmi ber-QR Code</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-extrabold text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                    1 Tahap Approval
                  </span>
                </div>
              </div>
            )}

            {/* SECTION 3: NOTES & JUSTIFICATION */}
            <div className="rounded-3xl border border-border/80 bg-card/50 p-6 sm:p-7 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3.5 border-b border-border/70">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-black shadow-2xs">
                    03
                  </span>
                  <div>
                    <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wide">
                      Catatan Tambahan &amp; Alasan Permohonan (Justification)
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Tuliskan justifikasi operasional atau alasan kebutuhan pengajuan ini
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/80 border border-border/60 px-3 py-1 rounded-full">
                  <span>Langkah 3 dari 4</span>
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                  <span className="text-[10px] font-bold text-muted-foreground">Rekomendasi Template:</span>
                  {[
                    'Karyawan Baru Masuk Kerja',
                    'Penggantian Unit Lama Rusak/Usang',
                    'Kebutuhan Project & Desain',
                    'Audit Keamanan & Penertiban Akses',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNotes((prev) => (prev ? `${prev}. ${preset}` : preset))}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[10px] font-semibold text-foreground hover:bg-secondary transition active:scale-95"
                    >
                      <Plus className="size-2.5 text-emerald-600" />
                      <span>{preset}</span>
                    </button>
                  ))}
                </div>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tuliskan keterangan detail, alasan pengajuan, atau urgensi permohonan layanan IT ini..."
                  rows={3}
                  className="w-full rounded-2xl border border-input bg-card p-3.5 text-xs sm:text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 shadow-inner"
                />
              </div>
            </div>

            {/* SECTION 4: APPROVERS SEQUENCE PREVIEW */}
            <div className="rounded-3xl border border-border/80 bg-card/50 p-6 sm:p-7 space-y-5 shadow-xs">
              <div className="flex items-center justify-between pb-3.5 border-b border-border/70">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-black shadow-2xs">
                    04
                  </span>
                  <div>
                    <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wide">
                      Alur Pejabat Penyetuju Form Ini (Configured Approvers)
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Daftar pejabat yang akan menerima berkas untuk tanda tangan elektronik digital secara berjenjang
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/80 border border-border/60 px-3 py-1 rounded-full">
                    <span>Langkah 4 dari 4</span>
                  </span>
                  {adminUser && (
                    <Link
                      href="/kelola-approver-it"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                    >
                      <span>Ubah Pejabat</span>
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-secondary/30 p-4 sm:p-5">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  {approvers.map((a, idx) => (
                    <React.Fragment key={a.id}>
                      <div className="flex-1 rounded-2xl border border-border bg-card p-3.5 shadow-2xs hover:shadow-sm transition">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            STEP {idx + 1}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-semibold truncate max-w-[120px]">
                            {a.slot_label}
                          </span>
                        </div>
                        <div className="text-xs font-extrabold text-foreground leading-snug">
                          {a.person_name}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {a.role_title.split('/')[0]}
                        </div>
                      </div>
                      {idx < approvers.length - 1 && (
                        <div className="hidden md:flex items-center justify-center shrink-0">
                          <ArrowRight className="size-4 text-emerald-600/70" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}

                  {approvers.length === 0 && !loadingApprovers && (
                    <div className="text-xs text-muted-foreground italic py-2">
                      Belum ada approver yang dikonfigurasi untuk form ini.
                    </div>
                  )}

                  {loadingApprovers && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="size-4 animate-spin text-emerald-600" />
                      <span>Memuat konfigurasi pejabat approver...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* GRAND SUBMIT ACTION BAR */}
            <div className="rounded-3xl border border-border/80 bg-gradient-to-r from-card via-card/90 to-secondary/30 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <span className="font-bold text-foreground block">ISMS Digital Compliance</span>
                  Formulir ini dilindungi pengesahan digital ber-QR Code standar ISO/IEC 27001 ISMS PT. JAI.
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-7 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/20 transition-all hover:from-emerald-500 hover:to-teal-600 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 active:scale-95 cursor-pointer shrink-0"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                <span>{submitting ? 'Mengirim Formulir...' : 'Kirim Permohonan & Mulai E-Sign'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default function FormItEsignPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin text-emerald-600" />
          <span>Memuat Sistem Formulir Layanan IT...</span>
        </div>
      }
    >
      <FormItContent />
    </Suspense>
  )
}
