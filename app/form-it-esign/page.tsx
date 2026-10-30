// app/form-it-esign/page.tsx
'use client'

import React, { useState, useEffect, Suspense, useMemo, useCallback } from 'react'
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
  PackagePlus,
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
  History,
  RefreshCw,
  FileDown,
  Filter,
  X,
  Link2,
} from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { IT_FORM_DEFINITIONS, type ItFormApprover, type ItFormSubmission } from '@/lib/it-form-shared'
import { downloadExcel } from '@/lib/excel-export'
import { SignalGrid } from '@/components/backgrounds'
import { useAuth } from '@/context/AuthContext'
import { GuestLinkGeneratorModal } from '@/components/it/GuestLinkGeneratorModal'

interface DepartmentItem {
  id: number
  name: string
  slug: string
  sections: Array<{
    id: number
    department_id: number
    name: string
    slug: string
  }>
}

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
    opCategory: string
    category: string
    approvalCount: number
    features: string[]
    shortDesc: string
    themeColor: 'blue' | 'purple' | 'emerald' | 'rose' | 'teal'
    gradientBar: string
    heroIconBg: string
    activeCardBorder: string
    activeCardBg: string
    activeRing: string
    stepBadge: string
    stepSubBadge: string
    stepBorder: string
    focusRing: string
    buttonGradient: string
    buttonShadow: string
    submitLabel: string
    glowOrb: string
    hoverBorder: string
    hoverIcon: string
    activeIconBg: string
    activeBar: string
  }
> = {
  'ISMS-F-010-001': {
    icon: Laptop,
    shortTitle: 'PC & Laptop',
    colorClass: 'text-primary',
    activeBorder: 'border-primary ring-2 ring-primary/25',
    activeBg: 'bg-primary/5',
    glowShadow: 'shadow-md shadow-primary/20',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    tag: 'Hardware Asset',
    opCategory: 'HARDWARE & ASSET',
    category: 'Perangkat Kerja',
    approvalCount: 4,
    features: ['PC Baru / Ganti', 'OS & Lisensi Wajib', '4 Tahap E-Sign'],
    shortDesc: 'Form permohonan pengadaan atau pembaharuan unit PC/Laptop kerja beserta lisensi software wajib.',
    themeColor: 'blue',
    gradientBar: 'from-primary via-primary/80 to-primary',
    heroIconBg: 'bg-primary text-primary-foreground shadow-sm',
    activeCardBorder: 'border-primary',
    activeCardBg: 'bg-card',
    activeRing: 'focus:border-ring focus:ring-4 focus:ring-ring/15',
    stepBadge: 'bg-primary text-primary-foreground shadow-xs',
    stepSubBadge: 'text-primary bg-primary/10 border-primary/20',
    stepBorder: 'border-primary/30',
    focusRing: 'focus:border-ring focus:ring-4 focus:ring-ring/15',
    buttonGradient: 'bg-primary hover:opacity-90 text-primary-foreground',
    buttonShadow: 'shadow-lg shadow-primary/20',
    submitLabel: 'Kirim Permohonan PC & Laptop (F-010-001)',
    glowOrb: 'bg-primary/15',
    hoverBorder: 'hover:border-primary/50',
    hoverIcon: 'group-hover:text-primary group-hover:bg-primary/10',
    activeIconBg: 'bg-primary text-primary-foreground shadow-xs',
    activeBar: 'bg-primary',
  },
  'ISMS-F-010-003': {
    icon: Cpu,
    shortTitle: 'Lisensi Software',
    colorClass: 'text-primary',
    activeBorder: 'border-primary ring-2 ring-primary/25',
    activeBg: 'bg-primary/5',
    glowShadow: 'shadow-md shadow-primary/20',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    tag: 'Software Resmi',
    opCategory: 'SOFTWARE & LICENSE',
    category: 'Software Resmi',
    approvalCount: 4,
    features: ['Lisensi Baru / Upgrade', 'Verifikasi Asset No.', '4 Tahap E-Sign'],
    shortDesc: 'Form permohonan pembelian lisensi software baru atau pembaharuan versi software pada komputer.',
    themeColor: 'purple',
    gradientBar: 'from-primary via-primary/80 to-primary',
    heroIconBg: 'bg-primary text-primary-foreground shadow-sm',
    activeCardBorder: 'border-primary',
    activeCardBg: 'bg-card',
    activeRing: 'focus:border-ring focus:ring-4 focus:ring-ring/15',
    stepBadge: 'bg-primary text-primary-foreground shadow-xs',
    stepSubBadge: 'text-primary bg-primary/10 border-primary/20',
    stepBorder: 'border-primary/30',
    focusRing: 'focus:border-ring focus:ring-4 focus:ring-ring/15',
    buttonGradient: 'bg-primary hover:opacity-90 text-primary-foreground',
    buttonShadow: 'shadow-lg shadow-primary/20',
    submitLabel: 'Kirim Permohonan Lisensi Software (F-010-003)',
    glowOrb: 'bg-primary/15',
    hoverBorder: 'hover:border-primary/50',
    hoverIcon: 'group-hover:text-primary group-hover:bg-primary/10',
    activeIconBg: 'bg-primary text-primary-foreground shadow-xs',
    activeBar: 'bg-primary',
  },
  'ISMS-F-010-006': {
    icon: Mail,
    shortTitle: 'Email & User ID',
    colorClass: 'text-primary',
    activeBorder: 'border-primary ring-2 ring-primary/25',
    activeBg: 'bg-primary/5',
    glowShadow: 'shadow-md shadow-primary/20',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    tag: 'Akun & Akses',
    opCategory: 'DOMAIN & IAM',
    category: 'Akses Pengguna',
    approvalCount: 3,
    features: ['Domain @jai.co.id', 'Akun Active Directory', '3 Tahap E-Sign'],
    shortDesc: 'Form permohonan pembuatan baru atau perubahan email dan user ID login karyawan.',
    themeColor: 'emerald',
    gradientBar: 'from-primary via-primary/80 to-primary',
    heroIconBg: 'bg-primary text-primary-foreground shadow-sm',
    activeCardBorder: 'border-primary',
    activeCardBg: 'bg-card',
    activeRing: 'focus:border-ring focus:ring-4 focus:ring-ring/15',
    stepBadge: 'bg-primary text-primary-foreground shadow-xs',
    stepSubBadge: 'text-primary bg-primary/10 border-primary/20',
    stepBorder: 'border-primary/30',
    focusRing: 'focus:border-ring focus:ring-4 focus:ring-ring/15',
    buttonGradient: 'bg-primary hover:opacity-90 text-primary-foreground',
    buttonShadow: 'shadow-lg shadow-primary/20',
    submitLabel: 'Kirim Permohonan Email & User ID (F-010-006)',
    glowOrb: 'bg-primary/15',
    hoverBorder: 'hover:border-primary/50',
    hoverIcon: 'group-hover:text-primary group-hover:bg-primary/10',
    activeIconBg: 'bg-primary text-primary-foreground shadow-xs',
    activeBar: 'bg-primary',
  },
  'ISMS-F-010-007': {
    icon: ShieldAlert,
    shortTitle: 'Penghapusan Akun',
    colorClass: 'text-primary',
    activeBorder: 'border-primary ring-2 ring-primary/25',
    activeBg: 'bg-primary/5',
    glowShadow: 'shadow-md shadow-primary/20',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    tag: 'Deaktivasi User',
    opCategory: 'OFFBOARDING & DECOM',
    category: 'Pemberhentian Akses',
    approvalCount: 3,
    features: ['Deaktivasi Mailbox', 'Penonaktifan Domain', 'Audit Trail'],
    shortDesc: 'Form permohonan penonaktifan atau penghapusan email dan user ID login karyawan.',
    themeColor: 'rose',
    gradientBar: 'from-primary via-primary/80 to-primary',
    heroIconBg: 'bg-primary text-primary-foreground shadow-sm',
    activeCardBorder: 'border-primary',
    activeCardBg: 'bg-card',
    activeRing: 'focus:border-ring focus:ring-4 focus:ring-ring/15',
    stepBadge: 'bg-primary text-primary-foreground shadow-xs',
    stepSubBadge: 'text-primary bg-primary/10 border-primary/20',
    stepBorder: 'border-primary/30',
    focusRing: 'focus:border-ring focus:ring-4 focus:ring-ring/15',
    buttonGradient: 'bg-primary hover:opacity-90 text-primary-foreground',
    buttonShadow: 'shadow-lg shadow-primary/20',
    submitLabel: 'Kirim Permohonan Penghapusan Akun (F-010-007)',
    glowOrb: 'bg-primary/15',
    hoverBorder: 'hover:border-primary/50',
    hoverIcon: 'group-hover:text-primary group-hover:bg-primary/10',
    activeIconBg: 'bg-primary text-primary-foreground shadow-xs',
    activeBar: 'bg-primary',
  },
  'ISMS-F-03-00-003': {
    icon: Wifi,
    shortTitle: 'Koneksi Jaringan',
    colorClass: 'text-primary',
    activeBorder: 'border-primary ring-2 ring-primary/25',
    activeBg: 'bg-primary/5',
    glowShadow: 'shadow-md shadow-primary/20',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    tag: 'Security Network',
    opCategory: 'NETWORK & INFRA',
    category: 'Security JAI Network',
    approvalCount: 4,
    features: ['DHCP / IP Statis', 'Verifikasi Anti-Virus', 'Izin Akses LAN/Wi-Fi'],
    shortDesc: 'Form izin penyambungan perangkat ke jaringan internal perusahaan (DHCP/Static IP).',
    themeColor: 'teal',
    gradientBar: 'from-primary via-primary/80 to-primary',
    heroIconBg: 'bg-primary text-primary-foreground shadow-sm',
    activeCardBorder: 'border-primary',
    activeCardBg: 'bg-card',
    activeRing: 'focus:border-ring focus:ring-4 focus:ring-ring/15',
    stepBadge: 'bg-primary text-primary-foreground shadow-xs',
    stepSubBadge: 'text-primary bg-primary/10 border-primary/20',
    stepBorder: 'border-primary/30',
    focusRing: 'focus:border-ring focus:ring-4 focus:ring-ring/15',
    buttonGradient: 'bg-primary hover:opacity-90 text-primary-foreground',
    buttonShadow: 'shadow-lg shadow-primary/20',
    submitLabel: 'Kirim Izin Koneksi Jaringan (F-03-00-003)',
    glowOrb: 'bg-primary/15',
    hoverBorder: 'hover:border-primary/50',
    hoverIcon: 'group-hover:text-primary group-hover:bg-primary/10',
    activeIconBg: 'bg-primary text-primary-foreground shadow-xs',
    activeBar: 'bg-primary',
  },
}

function FormItContent() {
  const searchParams = useSearchParams()
  const tokenQuery = searchParams.get('token')
  const formCodeQuery = searchParams.get('form')
  const { adminUser } = useAuth()

  // Redirect if someone asks for Fingerprint on this IT page
  useEffect(() => {
    if (formCodeQuery === 'ISMS-F-02-00-002') {
      window.location.href = '/registrasi-fingerprint'
    }
  }, [formCodeQuery])

  const [selectedFormCode, setSelectedFormCode] = useState<string>(
    formCodeQuery && formCodeQuery !== 'ISMS-F-02-00-002' && IT_FORM_DEFINITIONS.some((d) => d.code === formCodeQuery)
      ? formCodeQuery
      : 'ISMS-F-010-001'
  )

  const handleSelectForm = (code: string) => {
    setSelectedFormCode(code)
    setErrorMsg('')
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('form', code)
      window.history.replaceState({}, '', url.toString())
    }
  }

  const [approvers, setApprovers] = useState<ItFormApprover[]>([])
  const [loadingApprovers, setLoadingApprovers] = useState(true)

  // Applicant fields
  const [applicantName, setApplicantName] = useState('')
  const [applicantNik, setApplicantNik] = useState('')
  const [applicantPosition, setApplicantPosition] = useState('')
  const [employeeStatus, setEmployeeStatus] = useState<'TETAP' | 'KONTRAK' | 'Other'>('TETAP')
  const [otherStatus, setOtherStatus] = useState('')

  // Tab state: 'form' or 'history'
  const tabQuery = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<'form' | 'history'>(tabQuery === 'history' ? 'history' : 'form')

  // History state
  const [historyList, setHistoryList] = useState<ItFormSubmission[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>('all')
  const [historyFilterForm, setHistoryFilterForm] = useState<string>('all')
  const [historySearch, setHistorySearch] = useState<string>('')
  const [historyCopiedId, setHistoryCopiedId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fetchHistory = useCallback(async (
    statusFilter = historyFilterStatus,
    formFilter = historyFilterForm,
    searchVal = historySearch
  ) => {
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams()
      if (formFilter && formFilter !== 'all') params.set('form_code', formFilter)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (searchVal && searchVal.trim()) params.set('search', searchVal.trim())

      const res = await fetch(`${API_BASE_PATH}/api/it-form-submissions?${params.toString()}`)
      const data = await res.json()
      if (data.submissions) {
        setHistoryList(data.submissions)
      }
    } catch (err) {
      console.error('Failed to load IT forms history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [historyFilterStatus, historyFilterForm, historySearch])

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory()
    }
  }, [activeTab, fetchHistory])

  const historyCounts = useMemo(() => {
    return {
      all: historyList.length,
      pending: historyList.filter((s) => s.status === 'pending').length,
      approved: historyList.filter((s) => s.status === 'approved').length,
      rejected: historyList.filter((s) => s.status === 'rejected').length,
    }
  }, [historyList])

  const handleDeleteHistory = async (sub: ItFormSubmission) => {
    const ok = window.confirm(
      `Apakah Anda yakin ingin menghapus permohonan No. ${sub.request_no} (${sub.form_name}) atas nama "${sub.applicant_name}"?\n\nData yang dihapus tidak dapat dipulihkan.`
    )
    if (!ok) return

    setDeletingId(sub.id)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-form-submissions/${sub.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus permohonan.')
      await fetchHistory()
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus permohonan.')
    } finally {
      setDeletingId(null)
    }
  }

  const copyRowLink = (sub: ItFormSubmission) => {
    const directActionPath = `${API_BASE_PATH}/form-it-esign?token=${encodeURIComponent(sub.token)}`
    const shareUrl = `${window.location.origin}${directActionPath}`
    navigator.clipboard.writeText(shareUrl)
    setHistoryCopiedId(sub.id)
    setTimeout(() => setHistoryCopiedId(null), 2500)
  }

  const viewDetailFromHistory = (sub: ItFormSubmission) => {
    setSubmissionResult(sub)
    setActiveTab('form')
    window.scrollTo({ top: 120, behavior: 'smooth' })
  }

  const handleExportHistoryExcel = async () => {
    let list = historyList
    if (!list.length) {
      try {
        const res = await fetch(`${API_BASE_PATH}/api/it-form-submissions`)
        const data = await res.json()
        if (data.submissions && Array.isArray(data.submissions)) {
          list = data.submissions
          setHistoryList(data.submissions)
        }
      } catch (err) {
        console.error('Failed to load submissions for export:', err)
      }
    }
    if (!list.length) {
      alert('Tidak ada data formulir IT untuk diexport.')
      return
    }
    const filename = `riwayat-formulir-it-esign-${new Date().toISOString().slice(0, 10)}`
    const headers = [
      'No',
      'No. Pengajuan',
      'Kode Formulir',
      'Nama Formulir',
      'Tanggal Pengajuan',
      'Nama Pemohon',
      'NIK',
      'Perusahaan / Organisasi',
      'Departemen',
      'Seksi / Bagian',
      'Jabatan',
      'Status Karyawan',
      'Status Permohonan',
      'Progress E-Sign',
      'Catatan',
    ]

    const rows = historyList.map((sub, idx) => {
      const approvedCount = (sub.signatures || []).filter((s) => s.status === 'approved').length
      const totalSteps = sub.total_steps || (sub.signatures || []).length
      const statusLabel =
        sub.status === 'approved'
          ? 'Disetujui Lengkap'
          : sub.status === 'rejected'
          ? 'Ditolak / Revisi'
          : `Menunggu ACC (Step ${sub.current_step})`

      return [
        idx + 1,
        sub.request_no,
        sub.form_code,
        sub.form_name,
        sub.request_date,
        sub.applicant_name,
        sub.applicant_nik || '-',
        sub.company_name || '-',
        sub.department,
        (sub.form_data?.section as string) || '-',
        sub.applicant_position || '-',
        sub.employee_status || '-',
        statusLabel,
        `${approvedCount}/${totalSteps} Step`,
        sub.notes || '-',
      ]
    })

    downloadExcel(filename, headers, rows, 'Riwayat Pengajuan IT')
  }

  // Department and Section (Cascading)
  const [rawDepartments, setRawDepartments] = useState<DepartmentItem[]>([])
  const [department, setDepartment] = useState(DEPARTMENTS[0])
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([])
  const [sectionChoice, setSectionChoice] = useState('')
  const [customSection, setCustomSection] = useState('')

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
  const [antivirusVersion, setAntivirusVersion] = useState('v1.405.210')
  const [virusDefinitionUpdate, setVirusDefinitionUpdate] = useState('Latest Definition')
  const [osInfo, setOsInfo] = useState('Windows 11 Pro 64-bit')
  const [macAddress, setMacAddress] = useState('')
  const [ipMode, setIpMode] = useState<'dhcp' | 'static'>('dhcp')
  const [staticIp, setStaticIp] = useState('')
  const [staticSubnet, setStaticSubnet] = useState('255.255.255.0')
  const [staticGateway, setStaticGateway] = useState('')
  const [dnsPriority, setDnsPriority] = useState('')
  const [dnsSecondary, setDnsSecondary] = useState('')

  // Submission State
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [submissionResult, setSubmissionResult] = useState<ItFormSubmission | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Token search
  const [searchInput, setSearchInput] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [guestLinkModalOpen, setGuestLinkModalOpen] = useState(false)

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

  // Load configured approvers when formCode or applicant's department changes
  useEffect(() => {
    let cancelled = false
    setLoadingApprovers(true)
    const deptParam = department ? `&department=${encodeURIComponent(department)}` : ''
    fetch(`${API_BASE_PATH}/api/it-form-approvers?form_code=${encodeURIComponent(selectedFormCode)}${deptParam}`)
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
  }, [selectedFormCode, department])

  // Load departments dynamically from database (synced with portal DEPARTMENTS menu)
  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_PATH}/api/departments`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.departments) && data.departments.length > 0) {
          setRawDepartments(data.departments)
          const names: string[] = data.departments.map((d: any) => d.name)
          setAvailableDepartments(names)
          setDepartment((prev) => (names.includes(prev) ? prev : names[0]))
        }
      })
      .catch((err) => console.error('Failed to load departments:', err))
    return () => {
      cancelled = true
    }
  }, [])

  const currentDeptObj = useMemo(() => {
    return rawDepartments.find(
      (d) => d.name.toLowerCase() === department.toLowerCase()
    )
  }, [rawDepartments, department])

  const availableSections = useMemo(() => {
    return currentDeptObj?.sections || []
  }, [currentDeptObj])

  // Reset section choice when department changes
  useEffect(() => {
    if (availableSections.length > 0) {
      const defaultSec = availableSections.find((s) => s.name.toUpperCase() === 'IT') || availableSections[0]
      setSectionChoice(defaultSec ? defaultSec.name : '')
    } else {
      setSectionChoice('')
    }
    setCustomSection('')
  }, [department, availableSections])

  const effectiveSection = useMemo(() => {
    if (sectionChoice === '__custom__') {
      return customSection.trim()
    }
    if (sectionChoice) {
      return sectionChoice.trim()
    }
    return customSection.trim()
  }, [sectionChoice, customSection])

  // If token is provided in URL, load submission details
  const fetchSubmissionByToken = async (tok: string) => {
    setSearchLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-form-submissions?token=${encodeURIComponent(tok)}`)
      const data = await res.json()
      if (res.ok && data.submission) {
        if (data.submission.form_code === 'ISMS-F-02-00-002') {
          window.location.href = `/registrasi-fingerprint?token=${encodeURIComponent(tok)}`
          return
        }
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
    () => IT_FORM_DEFINITIONS.filter((d) => d.code !== 'ISMS-F-03-00-001' && d.code !== 'ISMS-F-02-00-002'),
    []
  )

  const displayedForms = activeForms

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

    if (selectedFormCode === 'ISMS-F-03-00-003') {
      if (!companyName.trim()) {
        setErrorMsg('Company / Organization (組織または会社名) wajib diisi untuk formulir ISMS-F-03-00-003.')
        return
      }
      if (!macAddress.trim()) {
        setErrorMsg('MAC Address Perangkat (Physical Address) wajib diisi untuk pendaftaran koneksi jaringan.')
        return
      }
    }

    setSubmitting(true)
    setErrorMsg('')

    try {
      const formDataPayload: Record<string, any> = {
        section: effectiveSection || null,
      }

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
        formDataPayload.virus_definition_update = virusDefinitionUpdate.trim()
        formDataPayload.os_info = osInfo.trim()
        formDataPayload.mac_address = macAddress.trim().toUpperCase()
        formDataPayload.ip_mode = 'dhcp'
      }

      const res = await fetch(`${API_BASE_PATH}/api/it-form-submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_code: selectedFormCode,
          applicant_name: applicantName.trim(),
          applicant_nik: applicantNik.trim() || null,
          applicant_position: applicantPosition.trim() || null,
          employee_status:
            selectedFormCode === 'ISMS-F-03-00-003'
              ? null
              : employeeStatus === 'Other'
              ? otherStatus.trim() || 'Lainnya'
              : employeeStatus,
          department,
          company_name:
            selectedFormCode === 'ISMS-F-03-00-003'
              ? companyName.trim() || 'PT. Jatim Autocomp Indonesia'
              : 'PT. Jatim Autocomp Indonesia',
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
      {/* Top Banner / Dedicated Paperless Digital E-Sign Terminal */}
      <section className="hero-esign relative overflow-hidden rounded-3xl border border-primary/25 text-primary-foreground p-6 sm:p-9 shadow-xl transition-all">
        <SignalGrid color="currentColor" opacity={0.18} speed={0.4} anchor="right" squareSize={8} gridStep={20} />

        {/* Top Compliance & Operational Status Bar */}
        <div className="relative mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 font-mono text-[11px] tracking-wide text-primary-foreground/75">
          <div className="flex items-center gap-2">
            <span className="portal-eyebrow text-primary-foreground/90">
              PORTAL E-SIGN IT
            </span>
            <span className="text-white/25 hidden sm:inline">&bull;</span>
            <span className="font-semibold text-primary-foreground/80 hidden sm:inline">PT. JATIM AUTOCOMP INDONESIA</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-md border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10.5px] font-bold text-primary-foreground font-mono">
              ISO/IEC 27001
            </span>
          </div>
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="relative grid size-14 sm:size-16 shrink-0 place-items-center rounded-xl bg-white/10 border border-white/20 text-primary-foreground shadow-xs backdrop-blur-md">
              <FileSignature className="size-7 sm:size-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-primary-foreground sm:text-3xl lg:text-4xl">
                Formulir Layanan Digital &amp; E-Sign Otorisasi IT
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-primary-foreground/80 max-w-2xl leading-relaxed font-normal">
                Portal pengajuan aset PC/Laptop, lisensi software, akun domain &amp; akses jaringan dengan alur tanda tangan elektronik (E-Sign) berjenjang.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            <Link
              href="/ijin-masuk-alat-it"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 backdrop-blur-sm px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-xs transition"
            >
              <Laptop className="size-4 text-accent" />
              <span>Izin Bawa Alat IT</span>
            </Link>
            {adminUser && (
              <Link
                href="/kelola-approver-it"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-2xs transition active:scale-95"
              >
                <Users className="size-4" />
                <span>Pengaturan Approver</span>
              </Link>
            )}
          </div>
        </div>

        {/* Search tracking bar */}
        <div className="relative mt-7 flex items-center gap-2 rounded-2xl border border-white/20 bg-black/25 p-2 backdrop-blur-md focus-within:border-white/40 transition-all">
          <div className="flex items-center justify-center size-9 rounded-xl bg-white/10 text-primary-foreground/80 ml-1 shrink-0 border border-white/15">
            <Search className="size-4" />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchInput.trim() && fetchSubmissionByToken(searchInput.trim())}
            placeholder="Masukkan nomor permohonan atau kode token verifikasi e-sign (contoh: req-2026-..., a7b8c9d0...)"
            className="flex-1 bg-transparent text-xs text-primary-foreground outline-none placeholder:text-primary-foreground/50 sm:text-sm px-2 font-mono font-medium"
          />
          <button
            type="button"
            onClick={() => searchInput.trim() && fetchSubmissionByToken(searchInput.trim())}
            disabled={searchLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-accent hover:opacity-90 px-5 py-2.5 text-xs font-bold text-accent-foreground shadow-2xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {searchLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
            <span>{searchLoading ? 'Memeriksa...' : 'Lacak Status E-Sign'}</span>
          </button>
        </div>
      </section>

      {/* Main Tab Navigation: Form vs History */}
      <div className="flex items-center justify-between border-b border-border/80 pb-3">
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
            <span>Formulir Pengajuan Layanan IT</span>
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
            onClick={handleExportHistoryExcel}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-foreground px-3.5 py-2 text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Download rekap data seluruh formulir IT ke Excel (.xlsx)"
          >
            <Download className="size-3.5 text-primary" />
            <span>Export Excel</span>
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

      {/* History View (When in 'history' tab) */}
      {activeTab === 'history' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Pengajuan IT
              </span>
              <p className="mt-1.5 font-display text-2xl font-bold text-foreground">{historyCounts.all}</p>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Menunggu Approval
              </span>
              <p className="mt-1.5 font-display text-2xl font-bold text-amber-700 dark:text-amber-400">{historyCounts.pending}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Disetujui Lengkap
              </span>
              <p className="mt-1.5 font-display text-2xl font-bold text-emerald-700 dark:text-emerald-400">{historyCounts.approved}</p>
            </div>
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-800 dark:text-red-300">
                Ditolak / Revisi
              </span>
              <p className="mt-1.5 font-display text-2xl font-bold text-red-700 dark:text-red-400">{historyCounts.rejected}</p>
            </div>
          </div>

          {/* Filters Bar: Status Tabs, Form Code Filter, & Search */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'all', label: 'Semua Status' },
                { key: 'pending', label: 'Menunggu' },
                { key: 'approved', label: 'Disetujui' },
                { key: 'rejected', label: 'Ditolak' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setHistoryFilterStatus(tab.key)
                    fetchHistory(tab.key, historyFilterForm, historySearch)
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    historyFilterStatus === tab.key
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'border border-border/70 text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Form Code Selector & Search input */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <select
                value={historyFilterForm}
                onChange={(e) => {
                  setHistoryFilterForm(e.target.value)
                  fetchHistory(historyFilterStatus, e.target.value, historySearch)
                }}
                className="h-10 w-full sm:w-56 rounded-xl border border-input bg-card px-3 text-xs font-semibold text-foreground outline-none focus:border-primary"
              >
                <option value="all">Semua Formulir IT</option>
                <option value="ISMS-F-010-001">ISMS-F-010-001 (Pengadaan PC)</option>
                <option value="ISMS-F-010-003">ISMS-F-010-003 (Software)</option>
                <option value="ISMS-F-010-006">ISMS-F-010-006 (Email & User ID)</option>
                <option value="ISMS-F-010-007">ISMS-F-010-007 (Hapus Email/ID)</option>
                <option value="ISMS-F-03-00-003">ISMS-F-03-00-003 (Koneksi LAN)</option>
                <option value="ISMS-F-03-00-001">ISMS-F-03-00-001 (Bawa Masuk Alat)</option>
              </select>

              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => {
                    setHistorySearch(e.target.value)
                    fetchHistory(historyFilterStatus, historyFilterForm, e.target.value)
                  }}
                  placeholder="Cari pemohon, NIK, No. Ref..."
                  className="h-10 w-full rounded-xl border border-input bg-card pl-8 pr-7 text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setHistorySearch('')
                      fetchHistory(historyFilterStatus, historyFilterForm, '')
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Submissions Table */}
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
            {historyLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p className="mt-2 text-xs font-semibold text-muted-foreground">Memuat riwayat pengajuan formulir IT...</p>
              </div>
            ) : historyList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <FileSignature className="size-10 text-muted-foreground/40 mb-2" />
                <h4 className="text-sm font-bold text-foreground">Belum Ada Riwayat Pengajuan</h4>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                  Tidak ditemukan pengajuan dengan filter yang dipilih. Silakan ubah filter atau ajukan formulir baru.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('form')}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  Buat Pengajuan Baru
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/80 bg-muted/30 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-3">No. / Ref Permohonan</th>
                      <th className="px-4 py-3">Formulir IT</th>
                      <th className="px-4 py-3">Pemohon &amp; Departemen</th>
                      <th className="px-4 py-3">Status &amp; Approval</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {historyList.map((sub) => {
                      const isApproved = sub.status === 'approved'
                      const isRejected = sub.status === 'rejected'

                      return (
                        <tr key={sub.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3.5 align-top">
                            <span className="font-mono font-bold text-foreground text-[11.5px] block">
                              {sub.request_no}
                            </span>
                            <span className="text-[10.5px] text-muted-foreground mt-0.5 block">
                              {new Date(sub.request_date).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 align-top">
                            <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10.5px] font-bold text-primary">
                              {sub.form_code}
                            </span>
                            <p className="mt-1 font-semibold text-foreground text-[11.5px] line-clamp-1 max-w-[200px]" title={sub.form_name}>
                              {sub.form_name}
                            </p>
                          </td>

                          <td className="px-4 py-3.5 align-top">
                            <p className="font-bold text-foreground text-[12px]">{sub.applicant_name}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {sub.company_name && sub.company_name !== 'PT. Jatim Autocomp Indonesia' ? (
                                <span className="font-medium text-primary">{sub.company_name} • </span>
                              ) : null}
                              {sub.department} {sub.applicant_position ? `• ${sub.applicant_position}` : ''}
                            </p>
                            {sub.employee_status && (
                              <span className="inline-block mt-1 text-[10px] font-semibold text-muted-foreground/80 bg-secondary px-1.5 py-0.2 rounded">
                                Status: {sub.employee_status}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 align-top">
                            <div className="space-y-1">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                                  isApproved
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                    : isRejected
                                    ? 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30'
                                    : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {isApproved ? (
                                  <CheckCircle2 className="size-3" />
                                ) : isRejected ? (
                                  <XCircle className="size-3" />
                                ) : (
                                  <Clock className="size-3" />
                                )}
                                <span>
                                  {isApproved
                                    ? 'Disetujui Lengkap'
                                    : isRejected
                                    ? 'Ditolak'
                                    : `Menunggu Step ${sub.current_step}/${sub.total_steps}`}
                                </span>
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 align-top text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                title="Lihat Status & Detail Lengkap"
                                onClick={() => viewDetailFromHistory(sub)}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition cursor-pointer"
                              >
                                <Eye className="size-3.5 text-primary" />
                                <span className="hidden md:inline">Detail</span>
                              </button>

                              <a
                                href={`${API_BASE_PATH}/api/it-form-submissions/${sub.id}/pdf?token=${sub.token}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Download Formulir Resmi PDF"
                                className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-2xs transition"
                              >
                                <FileDown className="size-3.5" />
                                <span className="hidden md:inline">PDF</span>
                              </a>

                              <button
                                type="button"
                                title="Salin Tautan Token / Verifikasi"
                                onClick={() => copyRowLink(sub)}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
                              >
                                {historyCopiedId === sub.id ? (
                                  <Check className="size-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="size-3.5" />
                                )}
                              </button>

                              {/* TOMBOL HAPUS */}
                              <button
                                type="button"
                                title="Hapus Permohonan"
                                onClick={() => handleDeleteHistory(sub)}
                                disabled={deletingId === sub.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white transition disabled:opacity-50 cursor-pointer"
                              >
                                {deletingId === sub.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                                <span className="hidden md:inline">Hapus</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form View (When in 'form' tab) */}
      {activeTab === 'form' && (
        <>
          {/* IF SUBMISSION RESULT EXISTS (LIVE E-SIGN STATUS VIEW) */}
          {submissionResult ? (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs font-bold text-foreground bg-secondary/80 px-2.5 py-0.5 rounded-md border border-border">
                    {submissionResult.form_code}
                  </span>
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    #{submissionResult.request_no}
                  </span>
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                      submissionResult.status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : submissionResult.status === 'rejected'
                        ? 'bg-destructive/10 text-destructive border border-destructive/30'
                        : 'bg-accent/15 text-accent-foreground border border-accent/40'
                    }`}
                  >
                    {submissionResult.status === 'approved' ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" />
                        <span>SELESAI DISETUJUI</span>
                      </span>
                    ) : submissionResult.status === 'rejected' ? (
                      <span className="inline-flex items-center gap-1">
                        <XCircle className="size-3.5" />
                        <span>DITOLAK / PERLU REVISI</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" />
                        <span>PROSES APPROVAL ({submissionResult.current_step}/{submissionResult.total_steps})</span>
                      </span>
                    )}
                  </span>
                </div>
                <h2 className="text-xl font-black text-foreground sm:text-2xl tracking-tight">
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
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3.5 py-2 text-xs font-bold text-foreground shadow-xs transition hover:bg-secondary cursor-pointer"
                >
                  {copiedLink ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                  {copiedLink ? 'Link Tersalin!' : 'Salin Tautan'}
                </button>
                <a
                  href={`${API_BASE_PATH}/api/it-form-submissions/${submissionResult.id}/pdf?token=${submissionResult.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90"
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
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  Buat Pengajuan Lain
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubmissionResult(null)
                    setActiveTab('history')
                    fetchHistory()
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
                >
                  <History className="size-3.5" />
                  Lihat Riwayat
                </button>
              </div>
            </div>

            {/* Approval Steps Chain */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Alur Tanda Tangan Digital &amp; Otorisasi Approver
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
                          ? 'border-accent/60 bg-gradient-to-b from-accent/15 via-card to-card shadow-md ring-2 ring-accent/30'
                          : isRejected
                          ? 'border-destructive/40 bg-gradient-to-b from-destructive/10 via-card to-card'
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
                                ? 'bg-accent text-accent-foreground animate-pulse shadow-2xs'
                                : isRejected
                                ? 'bg-destructive text-destructive-foreground shadow-2xs'
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
                          <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-[11px] text-destructive">
                            <span className="font-bold">Alasan Penolakan:</span> {sig.signature_note}
                          </div>
                        )}
                      </div>

                      {/* Approver Status (Read-Only Tracking View) */}
                      {isPending && (
                        <div className="mt-4 border-t border-border pt-3">
                          <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                Otorisasi Approver
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-accent-foreground bg-accent/20 border border-accent/40 rounded px-1.5 py-0.5">
                                <span className="size-1 rounded-full bg-accent animate-pulse" />
                                Menunggu
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                              Persetujuan digital dilakukan oleh approver bersangkutan melalui email dinas terverifikasi atau portal persetujuan resmi.
                            </p>
                            <div className="mt-2.5 pt-2 border-t border-border flex justify-end">
                              <Link
                                href={`/persetujuan-saya?token=${encodeURIComponent(submissionResult.token)}`}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                              >
                                <ExternalLink className="size-3" />
                                <span>Buka di Persetujuan Saya</span>
                              </Link>
                            </div>
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
                <FileCheck className="size-4 text-primary" />
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
                {submissionResult.company_name && (
                  <div>
                    <span className="text-muted-foreground block text-[11px] mb-0.5">Perusahaan / Organisasi:</span>
                    <span className="font-semibold text-foreground">{submissionResult.company_name}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground block text-[11px] mb-0.5">Departemen:</span>
                  <span className="font-semibold text-foreground">{submissionResult.department}</span>
                </div>
                {submissionResult.employee_status && (
                  <div>
                    <span className="text-muted-foreground block text-[11px] mb-0.5">Status Karyawan:</span>
                    <span className="font-semibold text-foreground">{submissionResult.employee_status}</span>
                  </div>
                )}
              </div>
              {submissionResult.form_code === 'ISMS-F-03-00-003' && (
                <div className="mt-4 pt-3 border-t border-border/60">
                  <span className="text-[11px] font-bold text-foreground uppercase tracking-wide block mb-2.5">
                    Informasi Perangkat &amp; Alokasi Jaringan (IT Check)
                  </span>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px] mb-0.5">MAC Address Perangkat:</span>
                      <span className="font-mono font-bold text-foreground">
                        {submissionResult.form_data?.mac_address || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px] mb-0.5">Metode IP:</span>
                      {submissionResult.form_data?.ip_mode === 'static' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-400">
                          <Check className="size-3" /> STATIC IP (Manual)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                          <Check className="size-3" /> DHCP (Automatic)
                        </span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground block text-[11px] mb-0.5">Alokasi IP Address IT:</span>
                      {submissionResult.form_data?.assigned_ip || submissionResult.form_data?.static_ip ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 font-mono font-bold text-emerald-800 dark:text-emerald-300">
                            <Check className="size-3.5" /> {submissionResult.form_data?.assigned_ip || submissionResult.form_data?.static_ip}
                          </span>
                          {submissionResult.form_data?.ip_mode === 'static' && (submissionResult.form_data?.static_subnet || submissionResult.form_data?.static_gateway) && (
                            <div className="text-[11px] font-mono text-muted-foreground">
                              {submissionResult.form_data?.static_subnet ? `Netmask: ${submissionResult.form_data.static_subnet}` : ''}
                              {submissionResult.form_data?.static_gateway ? ` · GW: ${submissionResult.form_data.static_gateway}` : ''}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] font-medium">
                          <Clock className="size-3" /> Menunggu Alokasi Tim IT (Setelah IT Check)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {submissionResult.notes && (
                <div className="mt-4 pt-3 border-t border-border/60 text-xs">
                  <span className="text-muted-foreground block text-[11px] mb-0.5">Catatan / Alasan:</span>
                  <span className="text-foreground whitespace-pre-wrap">{submissionResult.notes}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* FORM SUBMISSION INTERFACE */
        <div className="space-y-8">
          {/* SECTION HEADER: Form Switcher Cards */}
          <div className="space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-2xs">
                    <Layers className="size-3.5" />
                  </span>
                  <h2 className="text-base font-bold text-foreground tracking-tight sm:text-lg">
                    Pilih Formulir Layanan Digital &amp; E-Sign IT
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  Tersedia 5 formulir resmi layanan operasional IT PT. JAI ber-E-Sign verifikasi digital ISO 27001:
                </p>
              </div>

              {/* Link to dedicated Fingerprint form */}
              <Link
                href="/registrasi-fingerprint"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-2xs transition hover:bg-secondary hover:border-primary/40 self-start sm:self-auto"
              >
                <Fingerprint className="size-4 text-primary" />
                <span>Form Registrasi Fingerprint Special Security Area &rarr;</span>
              </Link>
            </div>

            {/* Symmetrical 5-Card Responsive Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {displayedForms.map((def, idx) => {
                const active = selectedFormCode === def.code
                const meta = FORM_METADATA[def.code] || FORM_METADATA['ISMS-F-010-001']
                const IconComponent = meta.icon

                return (
                  <button
                    key={def.code}
                    type="button"
                    onClick={() => handleSelectForm(def.code)}
                    className={`group relative flex flex-col items-start justify-between rounded-2xl p-4 text-left transition-all duration-200 cursor-pointer ${
                      active
                        ? 'border-2 border-primary bg-primary/[0.04] shadow-xs'
                        : 'border border-border/80 bg-card hover:border-foreground/25 hover:bg-secondary/30 shadow-2xs'
                    }`}
                  >
                    <div className="w-full flex items-center justify-between mb-3">
                      <div
                        className={`grid size-10 place-items-center rounded-xl transition-all duration-200 ${
                          active
                            ? 'bg-primary text-primary-foreground shadow-2xs'
                            : 'bg-secondary border border-border/80 text-foreground group-hover:bg-primary/10 group-hover:text-primary'
                        }`}
                      >
                        <IconComponent className="size-4.5" />
                      </div>
                      <span className={`font-mono text-[10px] font-bold ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                        0{idx + 1}
                      </span>
                    </div>

                    <div className="w-full space-y-1">
                      <span className="font-mono text-[10px] font-semibold text-muted-foreground block truncate">
                        {def.code}
                      </span>
                      <h3 className="font-display text-xs font-bold text-foreground leading-snug line-clamp-2">
                        {meta.shortTitle}
                      </h3>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* MAIN FORM CANVAS - Dedicated per-form container */}
          <form
            onSubmit={handleSubmit}
            className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-9 shadow-sm space-y-8"
          >
            {/* Top theme accent bar */}
            <span className="absolute inset-x-0 top-0 h-1 bg-primary" />

            {/* Clean Document Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-border pb-6">
              <div className="flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                  {React.createElement(currentMeta.icon, {
                    className: 'size-6 text-primary-foreground',
                  })}
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary">
                      {currentFormDef.code}
                    </span>
                    <span className="text-muted-foreground/40">&bull;</span>
                    <span className="font-mono text-[11px] font-medium text-muted-foreground">
                      {currentFormDef.jpName}
                    </span>
                  </div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                    {currentFormDef.name}
                  </h2>
                  <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                    {currentMeta.shortDesc}
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-[11px] font-mono font-semibold text-foreground self-start shrink-0">
                <Users className="size-3.5 text-primary" />
                <span>{approvers.length > 0 ? approvers.length : currentMeta.approvalCount} Tingkat E-Sign</span>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-700 dark:text-red-400 animate-in fade-in">
                <AlertTriangle className="size-5 shrink-0 text-red-600" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
            )}

            {/* SECTION 1: APPLICANT INFORMATION */}
            <div className="space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <span className="grid size-7 place-items-center rounded-lg font-mono text-xs font-bold bg-primary text-primary-foreground">
                  01
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                    Data Pemohon (Applicant Identity)
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Informasi identitas karyawan yang mengajukan {currentFormDef.name}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Nama Pemohon */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-foreground">
                    Nama Pemohon (氏名) <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      autoComplete="name"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="Nama lengkap pemohon..."
                      className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      required
                    />
                  </div>
                </div>

                {/* NIK */}
                {selectedFormCode !== 'ISMS-F-03-00-003' && (
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
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 font-mono shadow-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Jabatan */}
                {selectedFormCode !== 'ISMS-F-03-00-003' && (
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
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Perusahaan / Organisasi (Khusus Formulir ISMS-F-03-00-003 Network Connection) */}
                {selectedFormCode === 'ISMS-F-03-00-003' && (
                  <div className="sm:col-span-2 lg:col-span-3 animate-in fade-in">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-foreground">
                        Company / Organization (組織または会社名) <span className="text-destructive">*</span>
                      </label>
                      <span className="text-[10px] font-bold text-primary font-mono">
                        Kolom Wajib Formulir ISMS-F-03-00-003
                      </span>
                    </div>
                    <div className="relative">
                      <Building className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        autoComplete="organization"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Contoh: PT. Jatim Autocomp Indonesia / Nama Perusahaan Pemohon"
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                        required
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                      Dicetak pada baris <code className="font-mono font-bold text-foreground">COMPANY/ORGANIZATION (組織または会社名)</code> formulir resmi koneksi jaringan ISMS-F-03-00-003.
                    </p>
                  </div>
                )}

                {/* Departemen & Seksi / Bagian (Input Bebas / Mengisi Manual) */}
                <div className="sm:col-span-2 rounded-2xl border border-border bg-secondary/30 p-4 shadow-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Departemen */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-foreground">
                          Departemen (所属部署) <span className="text-destructive">*</span>
                        </label>
                      </div>
                      <div className="relative">
                        <Building className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          list="dept-suggestions"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          placeholder="Ketik nama departemen (contoh: PP - NYS, PGA, Produksi...)"
                          className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-xs sm:text-sm font-semibold text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-2xs"
                        />
                        <datalist id="dept-suggestions">
                          {(availableDepartments.length > 0 ? availableDepartments : DEPARTMENTS).map((d) => (
                            <option key={d} value={d} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    {/* Seksi / Bagian */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-foreground">
                          Seksi / Bagian (課・係)
                        </label>
                      </div>
                      <input
                        type="text"
                        list="section-suggestions"
                        value={customSection || sectionChoice}
                        onChange={(e) => {
                          setCustomSection(e.target.value)
                          setSectionChoice(e.target.value)
                        }}
                        placeholder="Ketik nama seksi / bagian (contoh: IT, Accounting, QA...)"
                        className="h-11 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm font-semibold text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-2xs"
                      />
                      <datalist id="section-suggestions">
                        {availableSections.map((sec) => (
                          <option key={sec.id} value={sec.name} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <p className="mt-2.5 text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Info className="size-3.5 text-muted-foreground shrink-0" />
                    <span>
                      Departemen &amp; Seksi di atas akan dicetak pada dokumen resmi PDF: <code className="font-mono text-foreground font-bold bg-secondary px-1.5 py-0.5 rounded border border-border">{department || '—'}{effectiveSection ? ` / ${effectiveSection}` : ''}</code>
                    </span>
                  </p>
                </div>

                {/* Status Karyawan - Khusus formulir internal karyawan (disembunyikan untuk ISMS-F-03-00-003 koneksi jaringan) */}
                {selectedFormCode !== 'ISMS-F-03-00-003' && (
                  <>
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
                              className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-xs font-bold transition cursor-pointer active:scale-95 ${
                                isSelected
                                  ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                                  : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
                              }`}
                            >
                              {isSelected ? (
                                <Check className="size-3.5 shrink-0" />
                              ) : st === 'TETAP' ? (
                                <BadgeCheck className="size-3.5 text-muted-foreground shrink-0" />
                              ) : st === 'KONTRAK' ? (
                                <CalendarDays className="size-3.5 text-muted-foreground shrink-0" />
                              ) : (
                                <User className="size-3.5 text-muted-foreground shrink-0" />
                              )}
                              <span>{st === 'Other' ? 'Lainnya' : st}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {employeeStatus === 'Other' && (
                      <div className="sm:col-span-3 animate-in fade-in">
                        <label className="mb-1.5 block text-xs font-bold text-foreground">
                          Keterangan Status Lainnya (e.g. Magang, PKL, Tamu)
                        </label>
                        <input
                          type="text"
                          value={otherStatus}
                          onChange={(e) => setOtherStatus(e.target.value)}
                          placeholder="Tuliskan status kekaryawanan..."
                          className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* SECTION 2: FORM SPECIFIC FIELDS */}
            {/* ISMS-F-010-001: Pengadaan PC / Laptop */}
            {selectedFormCode === 'ISMS-F-010-001' && (
              <div className="space-y-6 pt-2">
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  <span className="grid size-7 place-items-center rounded-lg font-mono text-xs font-bold bg-primary text-primary-foreground">
                    02
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                      Informasi Pengadaan PC/Laptop &amp; Lisensi Wajib
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Tentukan jenis pengadaan baru atau pembaharuan unit beserta spesifikasi perangkat komputer
                    </p>
                  </div>
                </div>

                {/* Jenis Pengadaan Feature Cards */}
                <div>
                  <label className="mb-2 block text-xs font-bold text-foreground">
                    Jenis Pengadaan (購入種類) <span className="text-destructive">*</span>
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      aria-pressed={jenisPengadaan === 'baru'}
                      onClick={() => setJenisPengadaan('baru')}
                      className={`relative flex items-start gap-3.5 rounded-xl border p-4.5 text-left cursor-pointer transition ${
                        jenisPengadaan === 'baru'
                          ? 'border-2 border-primary bg-primary/[0.05] shadow-sm ring-2 ring-primary/20'
                          : 'border border-border bg-card hover:border-primary/40 hover:bg-secondary/40'
                      }`}
                    >
                      <div className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border ${
                        jenisPengadaan === 'baru' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-secondary text-secondary-foreground border-border'
                      }`}>
                        <Plus className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${jenisPengadaan === 'baru' ? 'text-primary' : 'text-foreground'}`}>PENGADAAN BARU</span>
                          <span className="text-[10px] text-muted-foreground font-mono">(新規パソコン追加購入)</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground font-normal">
                          Penambahan unit komputer/laptop kerja baru untuk karyawan baru atau divisi baru.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      aria-pressed={jenisPengadaan === 'pembaharuan'}
                      onClick={() => setJenisPengadaan('pembaharuan')}
                      className={`relative flex items-start gap-3.5 rounded-xl border p-4.5 text-left cursor-pointer transition ${
                        jenisPengadaan === 'pembaharuan'
                          ? 'border-2 border-primary bg-primary/[0.05] shadow-sm ring-2 ring-primary/20'
                          : 'border border-border bg-card hover:border-primary/40 hover:bg-secondary/40'
                      }`}
                    >
                      <div className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border ${
                        jenisPengadaan === 'pembaharuan' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-secondary text-secondary-foreground border-border'
                      }`}>
                        <RotateCcw className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${jenisPengadaan === 'pembaharuan' ? 'text-primary' : 'text-foreground'}`}>PEMBAHARUAN</span>
                          <span className="text-[10px] text-muted-foreground font-mono">(新規パソコンとの変更購入)</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground font-normal">
                          Penggantian / upgrade unit PC lama yang rusak atau tidak sesuai spesifikasi lagi.
                        </p>
                      </div>
                    </button>
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
                          className={`rounded px-2 py-0.5 text-[10px] font-bold border transition cursor-pointer ${
                            maker === m
                              ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                              : 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80'
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
                      className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
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
                      className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
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
                          className={`rounded px-2 py-0.5 text-[10px] font-bold border transition cursor-pointer ${
                            osInfo === o
                              ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                              : 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80'
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
                      className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {jenisPengadaan === 'pembaharuan' && (
                    <div className="animate-in fade-in">
                      <label className="mb-1.5 block text-xs font-bold text-foreground">
                        PC Name Lama (Khusus Pembaharuan) <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={oldPcName}
                        onChange={(e) => setOldPcName(e.target.value)}
                        placeholder="e.g. JAI-PC-MFG01"
                        className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm font-mono font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
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
                      className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm font-mono font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
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
                      className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                    />
                  </div>
                </div>

                {/* Software List Section with Quick Chips */}
                <div className="rounded-xl border border-border bg-secondary/30 p-5 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <label className="text-xs font-bold text-foreground flex items-center gap-2">
                      <Cpu className="size-4 text-primary" />
                      <span>List Software yang Diwajibkan dengan Lisensi Resmi (ライセンス必須 ソフトウェアリスト)</span>
                    </label>
                    <span className="text-[11px] text-muted-foreground font-medium">Tuliskan 1 software per baris</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Pilihan Cepat:</span>
                    {['Microsoft Office 2021', 'AutoCAD LT', 'Adobe Acrobat Standard', 'SAP Client', 'SolidWorks 2024', 'VS Code'].map((sw) => (
                      <button
                        key={sw}
                        type="button"
                        onClick={() => appendSoftware(sw)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[10px] font-bold text-foreground hover:border-primary/40 hover:text-primary transition active:scale-95 shadow-2xs cursor-pointer"
                      >
                        <Plus className="size-2.5 text-primary" />
                        <span>{sw}</span>
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={4}
                    value={softwareListText}
                    onChange={(e) => setSoftwareListText(e.target.value)}
                    placeholder="Contoh:&#10;1. Microsoft Office 2021 Pro&#10;2. AutoCAD LT 2024&#10;3. Adobe Acrobat DC"
                    className="w-full rounded-xl border border-input bg-card p-3.5 text-xs sm:text-sm font-mono font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                  />
                </div>
              </div>
            )}

            {/* ISMS-F-010-003: Pengadaan Software */}
            {selectedFormCode === 'ISMS-F-010-003' && (
              <div className="space-y-6 pt-2">
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  <span className="grid size-7 place-items-center rounded-lg font-mono text-xs font-bold bg-primary text-primary-foreground">
                    02
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                      Informasi Software &amp; Komputer yang Akan Diinstall
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Rincian lisensi software yang diajukan dan identitas PC tujuan instalasi
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold text-foreground">
                    Jenis Pengadaan Software (購入種類) <span className="text-destructive">*</span>
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      aria-pressed={jenisPengadaan === 'baru'}
                      onClick={() => setJenisPengadaan('baru')}
                      className={`relative flex items-start gap-3.5 rounded-xl border p-4.5 text-left cursor-pointer transition ${
                        jenisPengadaan === 'baru'
                          ? 'border-2 border-primary bg-primary/[0.05] shadow-sm ring-2 ring-primary/20'
                          : 'border border-border bg-card hover:border-primary/40 hover:bg-secondary/40'
                      }`}
                    >
                      <div className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border ${
                        jenisPengadaan === 'baru' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-secondary text-secondary-foreground border-border'
                      }`}>
                        <PackagePlus className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${jenisPengadaan === 'baru' ? 'text-primary' : 'text-foreground'}`}>PENGADAAN LISENSI BARU</span>
                          <span className="text-[10px] text-muted-foreground font-mono">(新規購入)</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground font-normal">
                          Pembelian lisensi baru yang belum pernah dimiliki sebelumnya.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      aria-pressed={jenisPengadaan === 'pembaharuan'}
                      onClick={() => setJenisPengadaan('pembaharuan')}
                      className={`relative flex items-start gap-3.5 rounded-xl border p-4.5 text-left cursor-pointer transition ${
                        jenisPengadaan === 'pembaharuan'
                          ? 'border-2 border-primary bg-primary/[0.05] shadow-sm ring-2 ring-primary/20'
                          : 'border border-border bg-card hover:border-primary/40 hover:bg-secondary/40'
                      }`}
                    >
                      <div className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border ${
                        jenisPengadaan === 'pembaharuan' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-secondary text-secondary-foreground border-border'
                      }`}>
                        <RotateCcw className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${jenisPengadaan === 'pembaharuan' ? 'text-primary' : 'text-foreground'}`}>PEMBAHARUAN VERSI</span>
                          <span className="text-[10px] text-muted-foreground font-mono">(バージョンアップ)</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground font-normal">
                          Upgrade versi software resmi ke rilis yang lebih baru.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-secondary/30 p-5 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <label className="text-xs font-bold text-foreground flex items-center gap-2">
                      <Cpu className="size-4 text-primary" />
                      <span>Software Wajib Berlisensi yang Akan Diorderkan (ライセンス必須 ソフトウェアリスト)</span>
                    </label>
                    <span className="text-[11px] text-muted-foreground font-medium">Tuliskan 1 software per baris</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Pilihan Cepat:</span>
                    {['SolidWorks Professional', 'MATLAB & Simulink', 'AutoCAD Mechanical', 'Microsoft Visio Pro', 'Visual Studio Enterprise'].map((sw) => (
                      <button
                        key={sw}
                        type="button"
                        onClick={() => appendSoftware(sw)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[10px] font-bold text-foreground hover:border-primary/40 hover:text-primary transition active:scale-95 shadow-2xs cursor-pointer"
                      >
                        <Plus className="size-2.5 text-primary" />
                        <span>{sw}</span>
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={4}
                    value={softwareListText}
                    onChange={(e) => setSoftwareListText(e.target.value)}
                    placeholder="Contoh:&#10;1. SolidWorks Professional 2024&#10;2. MATLAB Machine Learning Toolbox"
                    className="w-full rounded-xl border border-input bg-card p-3.5 text-xs sm:text-sm font-mono font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                  />
                </div>

                {/* PC Info Section */}
                <div className="rounded-xl border border-border bg-secondary/20 p-5 space-y-4 shadow-xs">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
                    <Laptop className="size-4 text-primary" />
                    <span>Informasi PC/Laptop yang Akan Diinstall (インストールするコンピューター情報)</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-foreground">Asset No. (資産管理番号)</label>
                      <input
                        type="text"
                        value={assetNo}
                        onChange={(e) => setAssetNo(e.target.value)}
                        placeholder="e.g. AST-IT-2024-001"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm font-mono font-medium text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-foreground">Maker (メーカー名)</label>
                      <input
                        type="text"
                        value={maker}
                        onChange={(e) => setMaker(e.target.value)}
                        placeholder="e.g. Dell, Lenovo"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm font-medium text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-foreground">Model/Type (型番)</label>
                      <input
                        type="text"
                        value={modelType}
                        onChange={(e) => setModelType(e.target.value)}
                        placeholder="e.g. OptiPlex 7010"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm font-medium text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-foreground">Serial No. (製造番号)</label>
                      <input
                        type="text"
                        value={serialNo}
                        onChange={(e) => setSerialNo(e.target.value)}
                        placeholder="e.g. SN12345678"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm font-mono font-medium text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 pt-1">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-foreground">Operating System (OS)</label>
                      <input
                        type="text"
                        value={osInfo}
                        onChange={(e) => setOsInfo(e.target.value)}
                        placeholder="e.g. Windows 11 Pro"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm font-medium text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-foreground">PC Name (コンピューター名)</label>
                      <input
                        type="text"
                        value={pcName}
                        onChange={(e) => setPcName(e.target.value)}
                        placeholder="e.g. JAI-PC-ENG01"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm font-mono font-medium text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-foreground">Login User Name</label>
                      <input
                        type="text"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        placeholder="e.g. username"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm font-mono font-medium text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-foreground">Kegunaan/Fungsi</label>
                      <input
                        type="text"
                        value={functionPurpose}
                        onChange={(e) => setFunctionPurpose(e.target.value)}
                        placeholder="e.g. Desain Drawing"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm font-medium text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ISMS-F-010-006: Email & User ID */}
            {selectedFormCode === 'ISMS-F-010-006' && (
              <div className="space-y-6 pt-2">
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  <span className="grid size-7 place-items-center rounded-lg font-mono text-xs font-bold bg-primary text-primary-foreground">
                    02
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                      Perihal Pengajuan / Perubahan Akun (件名)
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Pilih layanan email atau user ID login yang hendak dibuat atau dimodifikasi
                    </p>
                  </div>
                </div>

                {/* 4 Interactive Toggle Cards */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={reqEmail}
                    onClick={() => setReqEmail(!reqEmail)}
                    className={`flex items-center gap-3.5 rounded-xl border p-4.5 text-left cursor-pointer transition ${
                      reqEmail
                        ? 'border-2 border-primary bg-primary/[0.05] ring-2 ring-primary/20 shadow-sm'
                        : 'border border-border bg-card hover:border-primary/40 hover:bg-secondary/40'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-lg border ${
                      reqEmail ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-secondary text-secondary-foreground border-border'
                    }`}>
                      {reqEmail ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${reqEmail ? 'text-primary' : 'text-foreground'}`}>Pengajuan Email Baru</div>
                      <div className="text-[10px] text-muted-foreground font-medium">Pembuatan alamat mailbox baru @jai.co.id (Eメール申請)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    aria-pressed={changeEmail}
                    onClick={() => setChangeEmail(!changeEmail)}
                    className={`flex items-center gap-3.5 rounded-xl border p-4.5 text-left cursor-pointer transition ${
                      changeEmail
                        ? 'border-2 border-primary bg-primary/[0.05] ring-2 ring-primary/20 shadow-sm'
                        : 'border border-border bg-card hover:border-primary/40 hover:bg-secondary/40'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-lg border ${
                      changeEmail ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-secondary text-secondary-foreground border-border'
                    }`}>
                      {changeEmail ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${changeEmail ? 'text-primary' : 'text-foreground'}`}>Perubahan Email Address</div>
                      <div className="text-[10px] text-muted-foreground font-medium">Ganti alias atau nama display email (Eメール変更)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    aria-pressed={reqUserId}
                    onClick={() => setReqUserId(!reqUserId)}
                    className={`flex items-center gap-3.5 rounded-xl border p-4.5 text-left cursor-pointer transition ${
                      reqUserId
                        ? 'border-2 border-primary bg-primary/[0.05] ring-2 ring-primary/20 shadow-sm'
                        : 'border border-border bg-card hover:border-primary/40 hover:bg-secondary/40'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-lg border ${
                      reqUserId ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-secondary text-secondary-foreground border-border'
                    }`}>
                      {reqUserId ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${reqUserId ? 'text-primary' : 'text-foreground'}`}>Pengajuan User ID Login</div>
                      <div className="text-[10px] text-muted-foreground font-medium">Pembuatan kredensial login Windows / Domain (ユーザID申請)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    aria-pressed={changeUserId}
                    onClick={() => setChangeUserId(!changeUserId)}
                    className={`flex items-center gap-3.5 rounded-xl border p-4.5 text-left cursor-pointer transition ${
                      changeUserId
                        ? 'border-2 border-primary bg-primary/[0.05] ring-2 ring-primary/20 shadow-sm'
                        : 'border border-border bg-card hover:border-primary/40 hover:bg-secondary/40'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-lg border ${
                      changeUserId ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-secondary text-secondary-foreground border-border'
                    }`}>
                      {changeUserId ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${changeUserId ? 'text-primary' : 'text-foreground'}`}>Perubahan User ID Login</div>
                      <div className="text-[10px] text-muted-foreground font-medium">Update hak akses atau nama user login (ユーザID変更)</div>
                    </div>
                  </button>
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
                        className="text-[10px] font-bold text-primary hover:underline bg-primary/10 border border-primary/20 px-2 py-0.5 rounded cursor-pointer"
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
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm font-mono font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
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
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm font-mono font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ISMS-F-010-007: Deletion of Email & ID */}
            {selectedFormCode === 'ISMS-F-010-007' && (
              <div className="space-y-6 pt-2">
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  <span className="grid size-7 place-items-center rounded-lg font-mono text-xs font-bold bg-primary text-primary-foreground">
                    02
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                      Perihal Penghapusan / Penonaktifan Akun (件名)
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Pilih penonaktifan akun email atau user login untuk karyawan resign / mutasi
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4.5 text-xs text-destructive flex items-start gap-3 shadow-xs">
                  <ShieldAlert className="size-5 shrink-0 text-destructive mt-0.5" />
                  <div>
                    <span className="font-bold block text-xs uppercase tracking-wide mb-1 text-destructive">Peringatan Keamanan ISMS ISO/IEC 27001:</span>
                    Penghapusan akun akan mencabut akses ke seluruh email server, active directory, dan sistem internal perusahaan secara permanen guna mencegah akses tidak sah pasca purna tugas karyawan.
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={delEmail}
                    onClick={() => setDelEmail(!delEmail)}
                    className={`flex items-center gap-3.5 rounded-xl border p-4.5 text-left cursor-pointer transition ${
                      delEmail
                        ? 'border-2 border-destructive bg-destructive/[0.08] ring-2 ring-destructive/20 shadow-sm'
                        : 'border border-border bg-card hover:border-border/80 hover:bg-secondary/40'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-lg border ${
                      delEmail ? 'bg-destructive text-white border-destructive shadow-sm' : 'bg-secondary text-secondary-foreground border-border'
                    }`}>
                      {delEmail ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${delEmail ? 'text-destructive' : 'text-foreground'}`}>Penghapusan Email Address</div>
                      <div className="text-[10px] text-muted-foreground font-medium">Deaktivasi &amp; backup mailbox (Eメールアドレスの削除)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    aria-pressed={delUserId}
                    onClick={() => setDelUserId(!delUserId)}
                    className={`flex items-center gap-3.5 rounded-xl border p-4.5 text-left cursor-pointer transition ${
                      delUserId
                        ? 'border-2 border-destructive bg-destructive/[0.08] ring-2 ring-destructive/20 shadow-sm'
                        : 'border border-border bg-card hover:border-border/80 hover:bg-secondary/40'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-lg border ${
                      delUserId ? 'bg-destructive text-white border-destructive shadow-sm' : 'bg-secondary text-secondary-foreground border-border'
                    }`}>
                      {delUserId ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${delUserId ? 'text-destructive' : 'text-foreground'}`}>Penghapusan Login User ID</div>
                      <div className="text-[10px] text-muted-foreground font-medium">Pencabutan akun domain Windows (ユーザIDの削除)</div>
                    </div>
                  </button>
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
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm font-mono font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
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
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm font-mono font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ISMS-F-03-00-003: Network Connection */}
            {selectedFormCode === 'ISMS-F-03-00-003' && (
              <div className="space-y-6 pt-2">
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  <span className="grid size-7 place-items-center rounded-lg font-mono text-xs font-bold bg-primary text-primary-foreground">
                    02
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                      Informasi Koneksi &amp; Perangkat Jaringan (Network Details)
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Rincian durasi sambungan, lokasi fisik, tujuan akses, dan konfigurasi IP perangkat
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-foreground">
                      Dari Tanggal (FROM: から) <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="date"
                        value={periodFrom}
                        onChange={(e) => setPeriodFrom(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm font-mono font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-foreground">
                      Sampai Tanggal (TO: まで) <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="date"
                        value={periodTo}
                        onChange={(e) => setPeriodTo(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm font-mono font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-foreground">
                      Lokasi Sambungan (接続場所) <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={networkLocation}
                        onChange={(e) => setNetworkLocation(e.target.value)}
                        placeholder="e.g. Ruang Meeting, Server Room, MFG"
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
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
                    <button
                      type="button"
                      aria-pressed={purposeInternet}
                      onClick={() => setPurposeInternet(!purposeInternet)}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 text-left cursor-pointer transition ${
                        purposeInternet
                          ? 'border-2 border-primary bg-primary/[0.05] text-primary font-bold ring-2 ring-primary/20 shadow-sm'
                          : 'border border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-secondary/40'
                      }`}
                    >
                      <Globe className={`size-4 shrink-0 ${purposeInternet ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-xs">Internet Browsing</span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={purposeEmail}
                      onClick={() => setPurposeEmail(!purposeEmail)}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 text-left cursor-pointer transition ${
                        purposeEmail
                          ? 'border-2 border-primary bg-primary/[0.05] text-primary font-bold ring-2 ring-primary/20 shadow-sm'
                          : 'border border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-secondary/40'
                      }`}
                    >
                      <Mail className={`size-4 shrink-0 ${purposeEmail ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-xs">Mail Client</span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={purposeWeb}
                      onClick={() => setPurposeWeb(!purposeWeb)}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 text-left cursor-pointer transition ${
                        purposeWeb
                          ? 'border-2 border-primary bg-primary/[0.05] text-primary font-bold ring-2 ring-primary/20 shadow-sm'
                          : 'border border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-secondary/40'
                      }`}
                    >
                      <Layers className={`size-4 shrink-0 ${purposeWeb ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-xs">Internal Web Apps</span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={purposeFtp}
                      onClick={() => setPurposeFtp(!purposeFtp)}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 text-left cursor-pointer transition ${
                        purposeFtp
                          ? 'border-2 border-primary bg-primary/[0.05] text-primary font-bold ring-2 ring-primary/20 shadow-sm'
                          : 'border border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-secondary/40'
                      }`}
                    >
                      <HardDrive className={`size-4 shrink-0 ${purposeFtp ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-xs">FTP &amp; File Server</span>
                    </button>
                  </div>
                </div>

                {/* IT Security & Antivirus Verification Box */}
                <div className="rounded-xl border border-border bg-secondary/30 p-5 space-y-4">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    <span>Verifikasi Anti-Virus &amp; Konfigurasi IP (IT Security Check)</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-foreground">1. Status Anti-Virus (YES/NO)</label>
                      <select
                        value={antivirusInstalled ? 'yes' : 'no'}
                        onChange={(e) => setAntivirusInstalled(e.target.value === 'yes')}
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm font-medium text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      >
                        <option value="yes">YES (Wajib Terinstall)</option>
                        <option value="no">NO</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-foreground">2. Nama Software Anti-Virus</label>
                      <input
                        type="text"
                        value={antivirusName}
                        onChange={(e) => setAntivirusName(e.target.value)}
                        placeholder="Windows Defender, Trend Micro, dsb."
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm font-medium text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-foreground">
                        3. Software Version (バージョン)
                      </label>
                      <input
                        type="text"
                        value={antivirusVersion}
                        onChange={(e) => setAntivirusVersion(e.target.value)}
                        placeholder="Contoh: v1.405.210 / 10.0"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm font-medium text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-foreground">
                        3. Virus Definition Last Update (最終更新)
                      </label>
                      <input
                        type="text"
                        value={virusDefinitionUpdate}
                        onChange={(e) => setVirusDefinitionUpdate(e.target.value)}
                        placeholder="Contoh: 2026-10-27 / Update Terbaru"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm font-medium text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4">
                      <label className="mb-1 block text-xs font-bold text-foreground">4. Sistem Operasi (OS Information)</label>
                      <input
                        type="text"
                        value={osInfo}
                        onChange={(e) => setOsInfo(e.target.value)}
                        placeholder="Windows 11 Pro 64-bit / MacOS / Linux"
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm font-medium text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Metode Pengaturan Alamat IP & MAC Address */}
                  <div className="pt-3 border-t border-border/60 space-y-3">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-foreground">
                          Metode Pengaturan Alamat IP
                        </label>
                        <div className="flex items-center gap-2 h-10 px-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                          <Check className="size-4 text-emerald-600" />
                          <span>DHCP (Automatic IP - Standar Tamu &amp; Rekanan)</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          *Sesuai ketentuan keamanan ISMS JAI, pemohon tamu/rekanan mendaftar via DHCP. Pengaturan Static IP darurat/manual dialokasikan langsung oleh Tim IT saat pengecekan teknis.
                        </p>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-foreground">
                          MAC Address Perangkat (Physical Address) <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={macAddress}
                          onChange={(e) => setMacAddress(e.target.value)}
                          placeholder="Contoh: 00:1A:2B:3C:4D:5E atau E0-D5-5E-12-34-56"
                          className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm font-mono font-bold text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs uppercase tracking-wide"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          *Wajib diisi oleh tamu. Cek pada Windows (<code className="font-mono font-bold text-foreground">getmac</code>) atau Network Adapter Settings.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground flex items-start gap-2.5">
                      <ShieldCheck className="size-4 text-primary mt-0.5 shrink-0" />
                      <div className="leading-relaxed">
                        <span className="font-bold text-foreground">Ketentuan Alokasi Alamat IP:</span> Tamu tidak perlu mengetahui atau mengisi alamat IP. Alamat IP akan dialokasikan dan dikonfigurasi resmi oleh Tim IT setelah permohonan disetujui IAA (Pak Teguh Sunjoyo) dan dilakukan pengecekan oleh IT Section (IT Check).
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: NOTES & JUSTIFICATION */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <span className="grid size-7 place-items-center rounded-lg font-mono text-xs font-bold bg-primary text-primary-foreground">
                  03
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                    Catatan Tambahan &amp; Alasan Permohonan (Justification)
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Tuliskan justifikasi operasional atau alasan kebutuhan pengajuan ini
                  </p>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Rekomendasi Template:</span>
                  {[
                    'Karyawan Baru Masuk Kerja',
                    'Penggantian Unit Lama Rusak/Usang',
                    'Kebutuhan Project & Desain',
                    'Audit Keamanan & Penertiban Akses',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setNotes((prev) => {
                          const trimmed = prev.trim()
                          if (!trimmed) return preset
                          return trimmed.endsWith('.') ? `${trimmed} ${preset}` : `${trimmed}. ${preset}`
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1 text-[10px] font-bold text-foreground hover:border-primary/40 hover:text-primary transition active:scale-95 shadow-2xs cursor-pointer"
                    >
                      <Plus className="size-2.5 text-primary" />
                      <span>{preset}</span>
                    </button>
                  ))}
                </div>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tuliskan keterangan detail, alasan pengajuan, atau urgensi permohonan layanan IT ini..."
                  rows={3}
                  className="w-full rounded-xl border border-input bg-card p-3.5 text-xs sm:text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
                />
              </div>
            </div>

            {/* SECTION 4: APPROVERS SEQUENCE PREVIEW */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="grid size-7 place-items-center rounded-lg font-mono text-xs font-bold bg-primary text-primary-foreground">
                    04
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                      Alur Approver Form Ini (Configured Approvers)
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Daftar approver yang akan menerima berkas untuk tanda tangan elektronik digital secara berjenjang
                    </p>
                  </div>
                </div>

                {adminUser && (
                  <Link
                    href="/kelola-approver-it"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-primary bg-secondary hover:bg-secondary/80 border border-border px-3 py-1.5 rounded-lg transition"
                  >
                    <span>Kelola Approver</span>
                    <ExternalLink className="size-3.5" />
                  </Link>
                )}
              </div>

              <div className="rounded-xl border border-border bg-secondary/30 p-4 sm:p-5">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  {approvers.map((a, idx) => (
                    <React.Fragment key={a.id}>
                      <div className="flex-1 rounded-xl border border-border bg-card p-4 shadow-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-primary/20 bg-primary/10 text-primary">
                            STEP {idx + 1}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-bold truncate max-w-[120px]">
                            {a.slot_label}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-foreground leading-snug">
                          {a.person_name}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-medium truncate mt-0.5">
                          {a.role_title.split('/')[0]}
                        </div>
                      </div>
                      {idx < approvers.length - 1 && (
                        <div className="hidden md:flex items-center justify-center shrink-0">
                          <ArrowRight className="size-4 text-muted-foreground" />
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
                      <Loader2 className="size-4 animate-spin text-primary" />
                      <span>Memuat konfigurasi approver...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SUBMIT ACTION BAR */}
            <div className="border-t border-border pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-xs text-muted-foreground">
                Dokumen <span className="font-mono font-bold text-foreground">{currentFormDef.code}</span> akan diteruskan ke <span className="font-bold text-foreground">{approvers.length > 0 ? approvers.length : currentMeta.approvalCount} approver</span> sesuai urutan di atas.
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-primary hover:opacity-90 text-primary-foreground px-7 py-3 text-sm font-bold shadow-sm transition-all disabled:opacity-50 active:scale-95 cursor-pointer shrink-0"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  React.createElement(currentMeta.icon, { className: 'size-4' })
                )}
                <span>{submitting ? 'Mengirim Formulir...' : currentMeta.submitLabel}</span>
              </button>
            </div>
          </form>
        </div>
      )}
        </>
      )}

      <GuestLinkGeneratorModal
        open={guestLinkModalOpen}
        onClose={() => setGuestLinkModalOpen(false)}
        defaultWalkIn={true}
      />
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
