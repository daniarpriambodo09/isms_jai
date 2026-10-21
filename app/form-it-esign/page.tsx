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
  }
> = {
  'ISMS-F-010-001': {
    icon: Laptop,
    shortTitle: 'PC & Laptop',
    colorClass: 'text-slate-900 dark:text-white',
    activeBorder: 'border-slate-900 ring-2 ring-slate-900/15 dark:border-white',
    activeBg: 'from-slate-50 via-white to-white dark:from-slate-800 dark:via-slate-900 dark:to-slate-900',
    glowShadow: 'shadow-xs',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    tag: 'Hardware IT',
    opCategory: 'HARDWARE & ASSET',
    category: 'Perangkat Kerja',
    approvalCount: 4,
    features: ['PC Baru / Ganti', 'OS & Lisensi Wajib', '4 Tahap E-Sign'],
    shortDesc: 'Form permohonan pengadaan atau pembaharuan unit PC/Laptop kerja beserta lisensi software wajib.',
    themeColor: 'blue',
    gradientBar: 'from-slate-800 to-slate-900',
    heroIconBg: 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700',
    activeCardBorder: 'border-slate-900 dark:border-white',
    activeCardBg: 'bg-white dark:bg-slate-900',
    activeRing: 'ring-2 ring-slate-900/15',
    stepBadge: 'bg-slate-900 text-white',
    stepSubBadge: 'text-slate-900 dark:text-slate-100 bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-700',
    stepBorder: 'border-slate-300 dark:border-slate-700',
    focusRing: 'focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10',
    buttonGradient: 'bg-slate-900 hover:bg-slate-800 text-white',
    buttonShadow: 'shadow-sm',
    submitLabel: 'Kirim Permohonan PC & Laptop (F-010-001)',
  },
  'ISMS-F-010-003': {
    icon: Cpu,
    shortTitle: 'Lisensi Software',
    colorClass: 'text-slate-900 dark:text-white',
    activeBorder: 'border-slate-900 ring-2 ring-slate-900/15 dark:border-white',
    activeBg: 'from-slate-50 via-white to-white dark:from-slate-800 dark:via-slate-900 dark:to-slate-900',
    glowShadow: 'shadow-xs',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    tag: 'Software Resmi',
    opCategory: 'SOFTWARE & LICENSE',
    category: 'Software Resmi',
    approvalCount: 4,
    features: ['Lisensi Baru / Upgrade', 'Verifikasi Asset No.', '4 Tahap E-Sign'],
    shortDesc: 'Form permohonan pembelian lisensi software baru atau pembaharuan versi software pada komputer.',
    themeColor: 'purple',
    gradientBar: 'from-slate-800 to-slate-900',
    heroIconBg: 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700',
    activeCardBorder: 'border-slate-900 dark:border-white',
    activeCardBg: 'bg-white dark:bg-slate-900',
    activeRing: 'ring-2 ring-slate-900/15',
    stepBadge: 'bg-slate-900 text-white',
    stepSubBadge: 'text-slate-900 dark:text-slate-100 bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-700',
    stepBorder: 'border-slate-300 dark:border-slate-700',
    focusRing: 'focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10',
    buttonGradient: 'bg-slate-900 hover:bg-slate-800 text-white',
    buttonShadow: 'shadow-sm',
    submitLabel: 'Kirim Permohonan Lisensi Software (F-010-003)',
  },
  'ISMS-F-010-006': {
    icon: Mail,
    shortTitle: 'Email & User ID',
    colorClass: 'text-slate-900 dark:text-white',
    activeBorder: 'border-slate-900 ring-2 ring-slate-900/15 dark:border-white',
    activeBg: 'from-slate-50 via-white to-white dark:from-slate-800 dark:via-slate-900 dark:to-slate-900',
    glowShadow: 'shadow-xs',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    tag: 'Akun & Akses',
    opCategory: 'DOMAIN & IAM',
    category: 'Akses Pengguna',
    approvalCount: 3,
    features: ['Domain @jai.co.id', 'Akun Active Directory', '3 Tahap E-Sign'],
    shortDesc: 'Form permohonan pembuatan baru atau perubahan email dan user ID login karyawan.',
    themeColor: 'emerald',
    gradientBar: 'from-slate-800 to-slate-900',
    heroIconBg: 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700',
    activeCardBorder: 'border-slate-900 dark:border-white',
    activeCardBg: 'bg-white dark:bg-slate-900',
    activeRing: 'ring-2 ring-slate-900/15',
    stepBadge: 'bg-slate-900 text-white',
    stepSubBadge: 'text-slate-900 dark:text-slate-100 bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-700',
    stepBorder: 'border-slate-300 dark:border-slate-700',
    focusRing: 'focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10',
    buttonGradient: 'bg-slate-900 hover:bg-slate-800 text-white',
    buttonShadow: 'shadow-sm',
    submitLabel: 'Kirim Permohonan Email & User ID (F-010-006)',
  },
  'ISMS-F-010-007': {
    icon: ShieldAlert,
    shortTitle: 'Penghapusan Akun',
    colorClass: 'text-slate-900 dark:text-white',
    activeBorder: 'border-slate-900 ring-2 ring-slate-900/15 dark:border-white',
    activeBg: 'from-slate-50 via-white to-white dark:from-slate-800 dark:via-slate-900 dark:to-slate-900',
    glowShadow: 'shadow-xs',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    tag: 'Deaktivasi User',
    opCategory: 'OFFBOARDING & DECOM',
    category: 'Pemberhentian Akses',
    approvalCount: 3,
    features: ['Deaktivasi Mailbox', 'Penonaktifan Domain', 'Audit Trail'],
    shortDesc: 'Form permohonan penonaktifan atau penghapusan email dan user ID login karyawan.',
    themeColor: 'rose',
    gradientBar: 'from-slate-800 to-slate-900',
    heroIconBg: 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700',
    activeCardBorder: 'border-slate-900 dark:border-white',
    activeCardBg: 'bg-white dark:bg-slate-900',
    activeRing: 'ring-2 ring-slate-900/15',
    stepBadge: 'bg-slate-900 text-white',
    stepSubBadge: 'text-slate-900 dark:text-slate-100 bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-700',
    stepBorder: 'border-slate-300 dark:border-slate-700',
    focusRing: 'focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10',
    buttonGradient: 'bg-slate-900 hover:bg-slate-800 text-white',
    buttonShadow: 'shadow-sm',
    submitLabel: 'Kirim Permohonan Penghapusan Akun (F-010-007)',
  },
  'ISMS-F-03-00-003': {
    icon: Wifi,
    shortTitle: 'Koneksi Jaringan',
    colorClass: 'text-slate-900 dark:text-white',
    activeBorder: 'border-slate-900 ring-2 ring-slate-900/15 dark:border-white',
    activeBg: 'from-slate-50 via-white to-white dark:from-slate-800 dark:via-slate-900 dark:to-slate-900',
    glowShadow: 'shadow-xs',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    tag: 'Security Network',
    opCategory: 'NETWORK & INFRA',
    category: 'Security JAI Network',
    approvalCount: 4,
    features: ['DHCP / IP Statis', 'Verifikasi Anti-Virus', 'Izin Akses LAN/Wi-Fi'],
    shortDesc: 'Form izin penyambungan perangkat ke jaringan internal perusahaan (DHCP/Static IP).',
    themeColor: 'teal',
    gradientBar: 'from-slate-800 to-slate-900',
    heroIconBg: 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700',
    activeCardBorder: 'border-slate-900 dark:border-white',
    activeCardBg: 'bg-white dark:bg-slate-900',
    activeRing: 'ring-2 ring-slate-900/15',
    stepBadge: 'bg-slate-900 text-white',
    stepSubBadge: 'text-slate-900 dark:text-slate-100 bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-700',
    stepBorder: 'border-slate-300 dark:border-slate-700',
    focusRing: 'focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10',
    buttonGradient: 'bg-slate-900 hover:bg-slate-800 text-white',
    buttonShadow: 'shadow-sm',
    submitLabel: 'Kirim Izin Koneksi Jaringan (F-03-00-003)',
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
  const [antivirusVersion, setAntivirusVersion] = useState('Latest Definition Updated')
  const [osInfo, setOsInfo] = useState('Windows 11 Pro 64-bit')
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
        formDataPayload.os_info = osInfo.trim()
        formDataPayload.ip_mode = ipMode
        if (ipMode === 'static') {
          formDataPayload.static_ip = staticIp.trim()
          formDataPayload.static_subnet = staticSubnet.trim()
          formDataPayload.static_gateway = staticGateway.trim()
          formDataPayload.dns_priority = dnsPriority.trim()
          formDataPayload.dns_secondary = dnsSecondary.trim()
        }
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
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-9 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] transition-all dark:border-slate-800 dark:bg-slate-900">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-slate-900 dark:bg-slate-700" />
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-slate-500/5 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -left-20 -bottom-20 size-72 rounded-full bg-slate-500/5 blur-3xl" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900">
              <FileSignature className="size-8" />
              <span className="absolute -top-1 -right-1 flex size-3">
                <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
              </span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2 font-mono text-[10.5px]">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold tracking-wider text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                  PT. JATIM AUTOCOMP INDONESIA
                </span>
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  ISO/IEC 27001 ISMS CONTROLLED
                </span>
                <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">/</span>
                <span className="hidden sm:inline text-slate-500 dark:text-slate-400">
                  DIGITAL E-SIGN
                </span>
              </div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Formulir Layanan Digital &amp; Pengesahan E-Sign IT
              </h1>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 sm:text-sm max-w-2xl leading-relaxed">
                Portal resmi pengajuan permohonan aset hardware, lisensi software, akun domain, dan infrastruktur jaringan dengan persetujuan bertingkat terverifikasi QR Code.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
            <Link
              href="/ijin-masuk-alat-it"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-xs transition hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Laptop className="size-4 text-slate-700 dark:text-slate-300" />
              <span>Izin Bawa Alat IT</span>
            </Link>
            {adminUser && (
              <Link
                href="/kelola-approver-it"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 hover:-translate-y-0.5 dark:bg-slate-100 dark:text-slate-900"
              >
                <Users className="size-4" />
                <span>Pengaturan Approver</span>
              </Link>
            )}
          </div>
        </div>

        {/* Search tracking bar with executive enterprise styling */}
        <div className="relative mt-7 flex items-center gap-2 rounded-2xl border border-slate-300 bg-slate-50/70 p-2 shadow-xs focus-within:border-slate-800 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-900/10 transition dark:border-slate-700 dark:bg-slate-800/80">
          <div className="flex items-center justify-center size-8 rounded-xl bg-white text-slate-500 ml-1 shrink-0 shadow-2xs border border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">
            <Search className="size-4" />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchInput.trim() && fetchSubmissionByToken(searchInput.trim())}
            placeholder="Masukkan kode pelacakan / token pengajuan formulir (contoh: a7b8c9d0...)"
            className="flex-1 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400 sm:text-sm px-1 font-mono font-medium dark:text-white"
          />
          <button
            type="button"
            onClick={() => searchInput.trim() && fetchSubmissionByToken(searchInput.trim())}
            disabled={searchLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50 active:scale-95 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {searchLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
            <span>{searchLoading ? 'Mencari...' : 'Lacak Status'}</span>
          </button>
        </div>
      </section>

      {/* IF SUBMISSION RESULT EXISTS (LIVE E-SIGN STATUS VIEW) */}
      {submissionResult ? (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between dark:border-slate-800">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                    {submissionResult.form_code}
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-500">
                    #{submissionResult.request_no}
                  </span>
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                      submissionResult.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                        : submissionResult.status === 'rejected'
                        ? 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
                        : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                    }`}
                  >
                    {submissionResult.status === 'approved'
                      ? '✓ SELESAI DISETUJUI'
                      : submissionResult.status === 'rejected'
                      ? '✕ DITOLAK / PERLU REVISI'
                      : `⏱ PROSES APPROVAL (${submissionResult.current_step}/${submissionResult.total_steps})`}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 sm:text-2xl dark:text-white">
                  {submissionResult.form_name}
                </h2>
                <p className="mt-1 text-xs text-slate-600 sm:text-sm dark:text-slate-400">
                  Pemohon: <span className="font-semibold text-slate-900 dark:text-white">{submissionResult.applicant_name}</span> &bull; {submissionResult.department} &bull; Tanggal: {submissionResult.request_date}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={copyShareLink}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {copiedLink ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                  {copiedLink ? 'Link Tersalin!' : 'Salin Tautan'}
                </button>
                <a
                  href={`${API_BASE_PATH}/api/it-form-submissions/${submissionResult.id}/pdf?token=${submissionResult.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
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
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
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

                      {/* Approver Status (Read-Only Tracking View) */}
                      {isPending && (
                        <div className="mt-4 border-t border-slate-200/80 pt-3 dark:border-slate-700">
                          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/60">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                Otorisasi Pejabat
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                                <span className="size-1 rounded-full bg-amber-500 animate-pulse" />
                                Menunggu
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                              Persetujuan digital dilakukan oleh pejabat bersangkutan melalui email dinas terverifikasi atau portal persetujuan resmi.
                            </p>
                            <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                              <Link
                                href={`/persetujuan-saya?token=${encodeURIComponent(submissionResult.token)}`}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-900 hover:underline dark:text-white"
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
          {/* SECTION HEADER: Form Switcher Cards */}
          <div className="space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-6 items-center justify-center rounded-lg bg-slate-900 text-white shadow-2xs dark:bg-white dark:text-slate-900">
                    <Layers className="size-3.5" />
                  </span>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight sm:text-lg">
                    Pilih Formulir Layanan Digital &amp; E-Sign IT
                  </h2>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                  Tersedia 5 formulir resmi layanan operasional IT PT. JAI ber-E-Sign verifikasi digital ISO 27001:
                </p>
              </div>

              {/* Link to dedicated Fingerprint form */}
              <Link
                href="/registrasi-fingerprint"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-slate-50 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 self-start sm:self-auto"
              >
                <Fingerprint className="size-4 text-slate-700 dark:text-slate-300" />
                <span>Form Registrasi Fingerprint Special Security Area &rarr;</span>
              </Link>
            </div>

            {/* Symmetrical 5-Card Responsive Grid with Distinct Themes */}
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
                    className={`group relative flex flex-col items-center justify-between rounded-2xl p-3.5 sm:p-4 text-center transition-all duration-200 cursor-pointer min-h-[168px] ${
                      active
                        ? `border-2 ${meta.activeCardBorder} bg-white dark:bg-slate-900 shadow-xl ${meta.activeRing} -translate-y-1`
                        : 'border border-slate-200/90 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-[0_2px_12px_rgba(15,23,42,0.05)] hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5'
                    }`}
                  >
                    {active && (
                      <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-slate-900 dark:bg-white" />
                    )}

                    <span className={`absolute top-2.5 right-2.5 font-mono text-[9px] font-bold ${active ? 'text-slate-900 dark:text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
                      #{idx + 1}
                    </span>

                    <div
                      className={`grid size-12 place-items-center rounded-xl transition-all duration-200 ${
                        active
                          ? 'bg-slate-900 text-white border border-slate-900 dark:bg-white dark:text-slate-900 shadow-xs'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 group-hover:bg-slate-200 group-hover:text-slate-900'
                      }`}
                    >
                      <IconComponent className="size-6" />
                    </div>

                    <div className="w-full my-1.5 space-y-0.5">
                      <span className="font-mono text-[8.5px] font-bold tracking-wider block truncate text-slate-500 dark:text-slate-400 uppercase">
                        {meta.opCategory}
                      </span>
                      <h3 className="font-display text-xs font-black text-slate-900 dark:text-white leading-snug line-clamp-2">
                        {meta.shortTitle}
                      </h3>
                      <span className="font-mono text-[8.5px] font-medium text-slate-400 block truncate">
                        {def.code}
                      </span>
                    </div>

                    <div className="w-full pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[9.5px] font-bold transition ${
                          active
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 group-hover:bg-slate-200 group-hover:text-slate-900'
                        }`}
                      >
                        {active ? '✓ AKTIF' : 'Buka Form →'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Active Form Separation Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-5 py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <span className={`grid size-8 place-items-center rounded-xl font-mono text-xs font-black shrink-0 ${currentMeta.stepBadge}`}>
                {currentFormDef.code.slice(-3)}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">{currentFormDef.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${currentMeta.badgeClass}`}>
                    {currentMeta.tag}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                    {currentFormDef.code}
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                  Formulir mandiri berotorisasi {currentMeta.approvalCount} pejabat penyetuju &bull; Standar ISO 27001.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="inline-flex size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Formulir Terbuka Siap Diisi</span>
            </div>
          </div>

          {/* MAIN FORM CANVAS - Dedicated per-form container */}
          <form
            onSubmit={handleSubmit}
            className={`relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-9 shadow-[0_6px_30px_-6px_rgba(15,23,42,0.08)] space-y-8 dark:border-slate-800 dark:bg-slate-900`}
          >
            {/* Top theme accent bar */}
            <span className="absolute inset-x-0 top-0 h-1.5 bg-slate-900 dark:bg-white" />
            {/* Form Title Banner with Theme Accent & Stepper */}
            <div className={`relative overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50/70 p-6 sm:p-7 shadow-xs dark:border-slate-800 dark:bg-slate-800/50`}>
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-slate-500/5 blur-2xl" />
              <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-white border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-700">
                    {React.createElement(currentMeta.icon, {
                      className: `size-8 ${currentMeta.colorClass}`,
                    })}
                    <span className="absolute -bottom-1 -right-1 flex size-3">
                      <span className="relative inline-flex size-3 rounded-full bg-slate-900 dark:bg-white" />
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs dark:bg-slate-800 dark:text-white dark:border-slate-700">
                        {currentFormDef.code}
                      </span>
                      <span className="rounded-full bg-slate-100 border border-slate-300 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-800 uppercase tracking-wider dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                        {currentFormDef.badge}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200 flex items-center gap-1 shadow-2xs dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                        <Users className="size-3 text-slate-700 dark:text-slate-300" />
                        <span>{currentMeta.approvalCount} Tingkat Approver E-Sign</span>
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${currentMeta.badgeClass}`}>
                        {currentMeta.category}
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      {currentFormDef.name}
                    </h2>

                    <div className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-0.5 text-[11px] font-mono text-slate-600 border border-slate-200 shadow-2xs dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                      <span>🇯🇵</span>
                      <span className="font-semibold">{currentFormDef.jpName}</span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed pt-1 font-medium">
                      {currentMeta.shortDesc}
                    </p>

                    {/* Features Pill Row */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {currentMeta.features.map((feat, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200 shadow-2xs dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                        >
                          <CheckCircle2 className="size-3 text-slate-700 dark:text-slate-300" />
                          <span>{feat}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4-Step Progress Indicator */}
                <div className="rounded-2xl bg-white p-3.5 sm:p-4 border border-slate-200 shadow-xs shrink-0 self-stretch lg:self-center dark:bg-slate-900 dark:border-slate-700">
                  <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between dark:text-slate-400">
                    <span>Tahapan Pengisian</span>
                    <span className="text-slate-900 dark:text-white font-mono font-bold">4 Langkah</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2 text-[11px]">
                    <div className={`flex items-center gap-2 rounded-xl p-2 font-extrabold ${currentMeta.stepSubBadge}`}>
                      <span className={`grid size-5 place-items-center rounded-full text-[10px] font-black shrink-0 ${currentMeta.stepBadge}`}>
                        1
                      </span>
                      <span className="truncate">Data Pemohon</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 p-2 font-semibold text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                      <span className="grid size-5 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 shrink-0 dark:bg-slate-700 dark:text-slate-200">
                        2
                      </span>
                      <span className="truncate">Spesifikasi</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 p-2 font-semibold text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                      <span className="grid size-5 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 shrink-0 dark:bg-slate-700 dark:text-slate-200">
                        3
                      </span>
                      <span className="truncate">Catatan &amp; Alasan</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 p-2 font-semibold text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                      <span className="grid size-5 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 shrink-0 dark:bg-slate-700 dark:text-slate-200">
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
            <div className="rounded-3xl border border-slate-200/90 bg-slate-50/50 p-6 sm:p-7 space-y-6 shadow-xs dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <span className={`grid size-8 place-items-center rounded-xl font-mono text-xs font-black shadow-2xs ${currentMeta.stepBadge}`}>
                    01
                  </span>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">
                      Data Pemohon (Applicant Identity)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Informasi identitas karyawan yang mengajukan {currentFormDef.name}
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-full dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 shadow-2xs">
                  <span>Langkah 1 dari 4</span>
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Nama Pemohon */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Nama Pemohon (氏名) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="Nama lengkap pemohon..."
                      className={`h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 ${currentMeta.focusRing} shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white`}
                      required
                    />
                  </div>
                </div>

                {/* NIK */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200">
                    NIK / Nomor Karyawan (従業員番号)
                  </label>
                  <div className="relative">
                    <BadgeCheck className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={applicantNik}
                      onChange={(e) => setApplicantNik(e.target.value)}
                      placeholder="Contoh: 123456"
                      className={`h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 ${currentMeta.focusRing} font-mono shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white`}
                    />
                  </div>
                </div>

                {/* Jabatan */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Jabatan (職務)
                  </label>
                  <div className="relative">
                    <Briefcase className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={applicantPosition}
                      onChange={(e) => setApplicantPosition(e.target.value)}
                      placeholder="Contoh: Staff, Leader, Supervisor"
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Departemen & Seksi / Bagian (CASCADING DROPDOWNS) */}
                <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-700 dark:bg-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Departemen */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                          Departemen (所属部署) <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono">
                          Sinkron Master ISMS
                        </span>
                      </div>
                      <div className="relative">
                        <Building className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                        <select
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50/60 pl-10 pr-8 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/10 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          {(availableDepartments.length > 0 ? availableDepartments : DEPARTMENTS).map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Seksi / Bagian (Cascading Dropdown) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                          Seksi / Bagian (課・係)
                        </label>
                        {availableSections.length > 0 && (
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono">
                            {availableSections.length} Seksi Terdaftar
                          </span>
                        )}
                      </div>

                      {availableSections.length > 0 ? (
                        <div className="space-y-2">
                          <select
                            value={sectionChoice}
                            onChange={(e) => setSectionChoice(e.target.value)}
                            className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50/60 px-3 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/10 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          >
                            <option value="">-- Pilih Seksi / Bagian --</option>
                            {availableSections.map((sec) => (
                              <option key={sec.id} value={sec.name}>
                                {sec.name} {department.toUpperCase() === 'PGA' && sec.name === 'IT' ? '(Information Technology)' : ''}
                              </option>
                            ))}
                            <option value="__custom__">+ Ketik Seksi Manual / Lainnya...</option>
                          </select>

                          {sectionChoice === '__custom__' && (
                            <input
                              type="text"
                              value={customSection}
                              onChange={(e) => setCustomSection(e.target.value)}
                              placeholder="Ketik nama seksi / bagian..."
                              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 shadow-xs animate-in fade-in dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                          )}
                        </div>
                      ) : (
                        <div>
                          <input
                            type="text"
                            value={customSection}
                            onChange={(e) => setCustomSection(e.target.value)}
                            placeholder="Masukkan nama seksi / bagian (opsional)..."
                            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="mt-2.5 text-[11px] text-slate-500 flex items-center gap-1.5 dark:text-slate-400 font-medium">
                    <Info className="size-3.5 text-slate-500 shrink-0" />
                    <span>
                      Departemen &amp; Seksi di atas akan dicetak pada dokumen resmi PDF: <code className="font-mono text-slate-800 dark:text-slate-200 font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">{department}{effectiveSection ? ` / ${effectiveSection}` : ''}</code>
                    </span>
                  </p>
                </div>

                {/* Status Karyawan - Modern Segmented Buttons */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200">
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
                              ? 'border-slate-900 bg-slate-900 text-white shadow-xs dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {isSelected ? (
                            <Check className="size-3.5 shrink-0" />
                          ) : st === 'TETAP' ? (
                            <BadgeCheck className="size-3.5 text-slate-400 shrink-0" />
                          ) : st === 'KONTRAK' ? (
                            <CalendarDays className="size-3.5 text-slate-400 shrink-0" />
                          ) : (
                            <User className="size-3.5 text-slate-400 shrink-0" />
                          )}
                          <span>{st === 'Other' ? 'Lainnya / Vendor' : st}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {employeeStatus === 'Other' && (
                  <div className="sm:col-span-3 animate-in fade-in">
                    <label className="mb-1.5 block text-xs font-bold text-slate-800 dark:text-slate-200">
                      Keterangan Status Lainnya (e.g. Magang, Vendor, Tamu)
                    </label>
                    <input
                      type="text"
                      value={otherStatus}
                      onChange={(e) => setOtherStatus(e.target.value)}
                      placeholder="Tuliskan status kekaryawanan..."
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2: FORM SPECIFIC FIELDS */}
            {/* ISMS-F-010-001: Pengadaan PC / Laptop */}
            {selectedFormCode === 'ISMS-F-010-001' && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 space-y-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-slate-900 text-white font-mono text-xs font-black shadow-xs dark:bg-slate-700">
                      02
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Informasi Pengadaan PC/Laptop &amp; Lisensi Wajib
                        </h3>
                        <span className="hidden sm:inline-block font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                          HARDWARE ASSET
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Tentukan jenis pengadaan baru atau pembaharuan unit beserta spesifikasi perangkat komputer
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center text-[11px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full">
                    STEP 2 / 4
                  </span>
                </div>

                {/* Jenis Pengadaan Feature Cards */}
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-900 dark:text-white">
                    Jenis Pengadaan (購入種類) <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div
                      onClick={() => setJenisPengadaan('baru')}
                      className={`relative flex items-start gap-3.5 rounded-xl border p-4.5 cursor-pointer transition ${
                        jenisPengadaan === 'baru'
                          ? 'border-2 border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800/80 shadow-xs ring-2 ring-slate-900/10'
                          : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800'
                      }`}
                    >
                      <div className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border ${
                        jenisPengadaan === 'baru' ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                      }`}>
                        <Plus className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 dark:text-white">PENGADAAN BARU</span>
                          <span className="text-[10px] text-slate-500 font-mono">(新規パソコン追加購入)</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 font-normal">
                          Penambahan unit komputer/laptop kerja baru untuk karyawan baru atau divisi baru.
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={() => setJenisPengadaan('pembaharuan')}
                      className={`relative flex items-start gap-3.5 rounded-xl border p-4.5 cursor-pointer transition ${
                        jenisPengadaan === 'pembaharuan'
                          ? 'border-2 border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800/80 shadow-xs ring-2 ring-slate-900/10'
                          : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800'
                      }`}
                    >
                      <div className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border ${
                        jenisPengadaan === 'pembaharuan' ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                      }`}>
                        <RotateCcw className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 dark:text-white">PEMBAHARUAN</span>
                          <span className="text-[10px] text-slate-500 font-mono">(新規パソコンとの変更購入)</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 font-normal">
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
                      <label className="text-xs font-bold text-slate-900 dark:text-white">Maker / Merk (メーカー名)</label>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {['Dell', 'Lenovo', 'HP', 'ASUS'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMaker(m)}
                          className={`rounded px-2 py-0.5 text-[10px] font-bold border transition ${
                            maker === m
                              ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
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
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-900 dark:text-white">
                      Model / Type (型番)
                    </label>
                    <input
                      type="text"
                      value={modelType}
                      onChange={(e) => setModelType(e.target.value)}
                      placeholder="e.g. Latitude 5440, ThinkPad T14"
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-900 dark:text-white">Operating System (OS)</label>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {['Windows 11 Pro', 'Windows 10 Pro'].map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => setOsInfo(o)}
                          className={`rounded px-2 py-0.5 text-[10px] font-bold border transition ${
                            osInfo === o
                              ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
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
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {jenisPengadaan === 'pembaharuan' && (
                    <div className="animate-in fade-in">
                      <label className="mb-1.5 block text-xs font-bold text-slate-900 dark:text-white">
                        PC Name Lama (Khusus Pembaharuan) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={oldPcName}
                        onChange={(e) => setOldPcName(e.target.value)}
                        placeholder="e.g. JAI-PC-MFG01"
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-900 dark:text-white">
                      Login User Name (ユーザー名)
                    </label>
                    <input
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="e.g. jaimfg01 atau nama user"
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-900 dark:text-white">
                      Kegunaan / Fungsi Komputer (使用用途)
                    </label>
                    <input
                      type="text"
                      value={functionPurpose}
                      onChange={(e) => setFunctionPurpose(e.target.value)}
                      placeholder="e.g. Input Produksi, Drawing CAD, Office"
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Software List Section with Quick Chips */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 space-y-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Cpu className="size-4 text-slate-700 dark:text-slate-300" />
                      <span>List Software yang Diwajibkan dengan Lisensi Resmi (ライセンス必須 ソフトウェアリスト)</span>
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">Tuliskan 1 software per baris</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Pilihan Cepat:</span>
                    {['Microsoft Office 2021', 'AutoCAD LT', 'Adobe Acrobat Standard', 'SAP Client', 'SolidWorks 2024', 'VS Code'].map((sw) => (
                      <button
                        key={sw}
                        type="button"
                        onClick={() => appendSoftware(sw)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-800 hover:border-slate-400 hover:bg-slate-100 transition active:scale-95 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Plus className="size-2.5 text-slate-700 dark:text-slate-300" />
                        <span>{sw}</span>
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={4}
                    value={softwareListText}
                    onChange={(e) => setSoftwareListText(e.target.value)}
                    placeholder="Contoh:&#10;1. Microsoft Office 2021 Pro&#10;2. AutoCAD LT 2024&#10;3. Adobe Acrobat DC"
                    className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* ISMS-F-010-003: Pengadaan Software */}
            {selectedFormCode === 'ISMS-F-010-003' && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 space-y-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-slate-900 text-white font-mono text-xs font-black shadow-xs dark:bg-slate-700">
                      02
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Informasi Software &amp; Komputer yang Akan Diinstall
                        </h3>
                        <span className="hidden sm:inline-block font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                          LICENSE &amp; COMPLIANCE
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Rincian lisensi software yang diajukan dan identitas PC tujuan instalasi
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center text-[11px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full">
                    STEP 2 / 4
                  </span>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-900 dark:text-white">
                    Jenis Pengadaan Software (購入種類) <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div
                      onClick={() => setJenisPengadaan('baru')}
                      className={`relative flex items-start gap-3.5 rounded-xl border p-4.5 cursor-pointer transition ${
                        jenisPengadaan === 'baru'
                          ? 'border-2 border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800/80 shadow-xs ring-2 ring-slate-900/10'
                          : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800'
                      }`}
                    >
                      <div className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border ${
                        jenisPengadaan === 'baru' ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                      }`}>
                        <Sparkles className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 dark:text-white">PENGADAAN LISENSI BARU</span>
                          <span className="text-[10px] text-slate-500 font-mono">(新規購入)</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 font-normal">
                          Pembelian lisensi baru yang belum pernah dimiliki sebelumnya.
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={() => setJenisPengadaan('pembaharuan')}
                      className={`relative flex items-start gap-3.5 rounded-xl border p-4.5 cursor-pointer transition ${
                        jenisPengadaan === 'pembaharuan'
                          ? 'border-2 border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800/80 shadow-xs ring-2 ring-slate-900/10'
                          : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800'
                      }`}
                    >
                      <div className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border ${
                        jenisPengadaan === 'pembaharuan' ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                      }`}>
                        <RotateCcw className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 dark:text-white">PEMBAHARUAN VERSI</span>
                          <span className="text-[10px] text-slate-500 font-mono">(バージョンアップ)</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 font-normal">
                          Upgrade versi software resmi ke rilis yang lebih baru.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 space-y-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Cpu className="size-4 text-slate-700 dark:text-slate-300" />
                      <span>Software Wajib Berlisensi yang Akan Diorderkan (ライセンス必須 ソフトウェアリスト)</span>
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">Tuliskan 1 software per baris</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Pilihan Cepat:</span>
                    {['SolidWorks Professional', 'MATLAB & Simulink', 'AutoCAD Mechanical', 'Microsoft Visio Pro', 'Visual Studio Enterprise'].map((sw) => (
                      <button
                        key={sw}
                        type="button"
                        onClick={() => appendSoftware(sw)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-800 hover:border-slate-400 hover:bg-slate-100 transition active:scale-95 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Plus className="size-2.5 text-slate-700 dark:text-slate-300" />
                        <span>{sw}</span>
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={4}
                    value={softwareListText}
                    onChange={(e) => setSoftwareListText(e.target.value)}
                    placeholder="Contoh:&#10;1. SolidWorks Professional 2024&#10;2. MATLAB Machine Learning Toolbox"
                    className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                {/* PC Info Section */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs dark:border-slate-800 dark:bg-slate-800/60">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                    <Laptop className="size-4 text-slate-700 dark:text-slate-300" />
                    <span>Informasi PC/Laptop yang Akan Diinstall (インストールするコンピューター情報)</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Asset No. (資産管理番号)</label>
                      <input
                        type="text"
                        value={assetNo}
                        onChange={(e) => setAssetNo(e.target.value)}
                        placeholder="e.g. AST-IT-2024-001"
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none focus:border-slate-900 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Maker (メーカー名)</label>
                      <input
                        type="text"
                        value={maker}
                        onChange={(e) => setMaker(e.target.value)}
                        placeholder="e.g. Dell, Lenovo"
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-900 outline-none focus:border-slate-900 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Model/Type (型番)</label>
                      <input
                        type="text"
                        value={modelType}
                        onChange={(e) => setModelType(e.target.value)}
                        placeholder="e.g. OptiPlex 7010"
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-900 outline-none focus:border-slate-900 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Serial No. (製造番号)</label>
                      <input
                        type="text"
                        value={serialNo}
                        onChange={(e) => setSerialNo(e.target.value)}
                        placeholder="e.g. SN12345678"
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none focus:border-slate-900 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 pt-1">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Operating System (OS)</label>
                      <input
                        type="text"
                        value={osInfo}
                        onChange={(e) => setOsInfo(e.target.value)}
                        placeholder="e.g. Windows 11 Pro"
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-900 outline-none focus:border-slate-900 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">PC Name (コンピューター名)</label>
                      <input
                        type="text"
                        value={pcName}
                        onChange={(e) => setPcName(e.target.value)}
                        placeholder="e.g. JAI-PC-ENG01"
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none focus:border-slate-900 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Login User Name</label>
                      <input
                        type="text"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        placeholder="e.g. username"
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none focus:border-slate-900 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Kegunaan/Fungsi</label>
                      <input
                        type="text"
                        value={functionPurpose}
                        onChange={(e) => setFunctionPurpose(e.target.value)}
                        placeholder="e.g. Desain Drawing"
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-900 outline-none focus:border-slate-900 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ISMS-F-010-006: Email & User ID */}
            {selectedFormCode === 'ISMS-F-010-006' && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 space-y-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-slate-900 text-white font-mono text-xs font-black shadow-xs dark:bg-slate-700">
                      02
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Perihal Pengajuan / Perubahan Akun (件名)
                        </h3>
                        <span className="hidden sm:inline-block font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                          IDENTITY &amp; DOMAIN ACCESS
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Pilih layanan email atau user ID login yang hendak dibuat atau dimodifikasi
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center text-[11px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full">
                    STEP 2 / 4
                  </span>
                </div>

                {/* 4 Interactive Toggle Cards */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div
                    onClick={() => setReqEmail(!reqEmail)}
                    className={`flex items-center gap-3.5 rounded-xl border p-4.5 cursor-pointer transition ${
                      reqEmail
                        ? 'border-2 border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800/80 ring-2 ring-slate-900/10 shadow-xs'
                        : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-lg border ${
                      reqEmail ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                    }`}>
                      {reqEmail ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">Pengajuan Email Baru</div>
                      <div className="text-[10px] text-slate-500 font-medium">Pembuatan alamat mailbox baru @jai.co.id (Eメール申請)</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setChangeEmail(!changeEmail)}
                    className={`flex items-center gap-3.5 rounded-xl border p-4.5 cursor-pointer transition ${
                      changeEmail
                        ? 'border-2 border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800/80 ring-2 ring-slate-900/10 shadow-xs'
                        : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-lg border ${
                      changeEmail ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                    }`}>
                      {changeEmail ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">Perubahan Email Address</div>
                      <div className="text-[10px] text-slate-500 font-medium">Ganti alias atau nama display email (Eメール変更)</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setReqUserId(!reqUserId)}
                    className={`flex items-center gap-3.5 rounded-xl border p-4.5 cursor-pointer transition ${
                      reqUserId
                        ? 'border-2 border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800/80 ring-2 ring-slate-900/10 shadow-xs'
                        : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-lg border ${
                      reqUserId ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                    }`}>
                      {reqUserId ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">Pengajuan User ID Login</div>
                      <div className="text-[10px] text-slate-500 font-medium">Pembuatan kredensial login Windows / Domain (ユーザID申請)</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setChangeUserId(!changeUserId)}
                    className={`flex items-center gap-3.5 rounded-xl border p-4.5 cursor-pointer transition ${
                      changeUserId
                        ? 'border-2 border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800/80 ring-2 ring-slate-900/10 shadow-xs'
                        : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-lg border ${
                      changeUserId ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                    }`}>
                      {changeUserId ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">Perubahan User ID Login</div>
                      <div className="text-[10px] text-slate-500 font-medium">Update hak akses atau nama user login (ユーザID変更)</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-900 dark:text-white">
                        Alamat Email yang Dimohon / Diubah
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (targetEmail && !targetEmail.includes('@')) {
                            setTargetEmail(`${targetEmail}@jai.co.id`)
                          }
                        }}
                        className="text-[10px] font-bold text-slate-800 hover:underline bg-slate-100 border border-slate-300 px-2 py-0.5 rounded dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                      >
                        + @jai.co.id
                      </button>
                    </div>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={targetEmail}
                        onChange={(e) => setTargetEmail(e.target.value)}
                        placeholder="contoh: nama.karyawan@jai.co.id"
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-900 dark:text-white">
                      Login User ID yang Dimohon / Diubah
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        placeholder="contoh: jaimfg01 atau username domain"
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ISMS-F-010-007: Deletion of Email & ID */}
            {selectedFormCode === 'ISMS-F-010-007' && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 space-y-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-slate-900 text-white font-mono text-xs font-black shadow-xs dark:bg-slate-700">
                      02
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Perihal Penghapusan / Penonaktifan Akun (件名)
                        </h3>
                        <span className="hidden sm:inline-block font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                          DECOMMISSION &amp; REVOKE
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Pilih penonaktifan akun email atau user login untuk karyawan resign / mutasi
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center text-[11px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full">
                    STEP 2 / 4
                  </span>
                </div>

                <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-3 shadow-xs">
                  <ShieldAlert className="size-5 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <span className="font-black block text-xs uppercase tracking-wide mb-1 text-amber-950 dark:text-amber-100">Peringatan Keamanan ISMS ISO/IEC 27001:</span>
                    Penghapusan akun akan mencabut akses ke seluruh email server, active directory, dan sistem internal perusahaan secara permanen guna mencegah akses tidak sah pasca purna tugas karyawan.
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div
                    onClick={() => setDelEmail(!delEmail)}
                    className={`flex items-center gap-3.5 rounded-xl border p-4.5 cursor-pointer transition ${
                      delEmail
                        ? 'border-2 border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800/80 ring-2 ring-slate-900/10 shadow-xs'
                        : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-lg border ${
                      delEmail ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                    }`}>
                      {delEmail ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">Penghapusan Email Address</div>
                      <div className="text-[10px] text-slate-500 font-medium">Deaktivasi &amp; backup mailbox (Eメールアドレスの削除)</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setDelUserId(!delUserId)}
                    className={`flex items-center gap-3.5 rounded-xl border p-4.5 cursor-pointer transition ${
                      delUserId
                        ? 'border-2 border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800/80 ring-2 ring-slate-900/10 shadow-xs'
                        : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    <div className={`grid size-9 shrink-0 place-items-center rounded-lg border ${
                      delUserId ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                    }`}>
                      {delUserId ? <CheckSquare className="size-5" /> : <Square className="size-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">Penghapusan Login User ID</div>
                      <div className="text-[10px] text-slate-500 font-medium">Pencabutan akun domain Windows (ユーザIDの削除)</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-900 dark:text-white">
                      Alamat Email yang Dihapus
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={targetEmail}
                        onChange={(e) => setTargetEmail(e.target.value)}
                        placeholder="contoh: nama.karyawan@jai.co.id"
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-900 dark:text-white">
                      Login User ID yang Dihapus
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        placeholder="contoh: jaimfg01"
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ISMS-F-03-00-003: Network Connection */}
            {selectedFormCode === 'ISMS-F-03-00-003' && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 space-y-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-slate-900 text-white font-mono text-xs font-black shadow-xs dark:bg-slate-700">
                      02
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Informasi Koneksi &amp; Perangkat Jaringan (Network Details)
                        </h3>
                        <span className="hidden sm:inline-block font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                          INFRASTRUCTURE &amp; SECURITY
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Rincian durasi sambungan, lokasi fisik, tujuan akses, dan konfigurasi IP perangkat
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center text-[11px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full">
                    STEP 2 / 4
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-900 dark:text-white">
                      Dari Tanggal (FROM: から) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="date"
                        value={periodFrom}
                        onChange={(e) => setPeriodFrom(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-900 dark:text-white">
                      Sampai Tanggal (TO: まで) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="date"
                        value={periodTo}
                        onChange={(e) => setPeriodTo(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-900 dark:text-white">
                      Lokasi Sambungan (接続場所) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={networkLocation}
                        onChange={(e) => setNetworkLocation(e.target.value)}
                        placeholder="e.g. Ruang Meeting, Server Room, MFG"
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Purpose of Connection Toggle Cards */}
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-900 dark:text-white">
                    Tujuan Penggunaan Jaringan (使用目的)
                  </label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div
                      onClick={() => setPurposeInternet(!purposeInternet)}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition ${
                        purposeInternet
                          ? 'border-2 border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800/80 text-slate-900 dark:text-white font-bold ring-2 ring-slate-900/10 shadow-xs'
                          : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <Globe className={`size-4 ${purposeInternet ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`} />
                      <span className="text-xs">Internet Browsing</span>
                    </div>

                    <div
                      onClick={() => setPurposeEmail(!purposeEmail)}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition ${
                        purposeEmail
                          ? 'border-2 border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800/80 text-slate-900 dark:text-white font-bold ring-2 ring-slate-900/10 shadow-xs'
                          : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <Mail className={`size-4 ${purposeEmail ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`} />
                      <span className="text-xs">Mail Client</span>
                    </div>

                    <div
                      onClick={() => setPurposeWeb(!purposeWeb)}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition ${
                        purposeWeb
                          ? 'border-2 border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800/80 text-slate-900 dark:text-white font-bold ring-2 ring-slate-900/10 shadow-xs'
                          : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <Layers className={`size-4 ${purposeWeb ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`} />
                      <span className="text-xs">Internal Web Apps</span>
                    </div>

                    <div
                      onClick={() => setPurposeFtp(!purposeFtp)}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition ${
                        purposeFtp
                          ? 'border-2 border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800/80 text-slate-900 dark:text-white font-bold ring-2 ring-slate-900/10 shadow-xs'
                          : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <HardDrive className={`size-4 ${purposeFtp ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`} />
                      <span className="text-xs">FTP &amp; File Server</span>
                    </div>
                  </div>
                </div>

                {/* IT Security & Antivirus Verification Box */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 space-y-4 dark:border-slate-800 dark:bg-slate-800/40">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                    <ShieldCheck className="size-4 text-slate-700 dark:text-slate-300" />
                    <span>Verifikasi Anti-Virus &amp; Konfigurasi IP (IT Security Check)</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Status Anti-Virus Terinstall</label>
                      <select
                        value={antivirusInstalled ? 'yes' : 'no'}
                        onChange={(e) => setAntivirusInstalled(e.target.value === 'yes')}
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-900 outline-none focus:border-slate-900 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="yes">YES (Wajib Terinstall)</option>
                        <option value="no">NO</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Nama Software Anti-Virus</label>
                      <input
                        type="text"
                        value={antivirusName}
                        onChange={(e) => setAntivirusName(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-900 outline-none focus:border-slate-900 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Sistem Operasi (OS)</label>
                      <input
                        type="text"
                        value={osInfo}
                        onChange={(e) => setOsInfo(e.target.value)}
                        placeholder="Windows 11 / MacOS / Linux"
                        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-medium text-slate-900 outline-none focus:border-slate-900 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold text-slate-900 dark:text-white">Metode Pengaturan Alamat IP</label>
                    <div className="grid grid-cols-2 gap-3 max-w-md">
                      <button
                        type="button"
                        onClick={() => setIpMode('dhcp')}
                        className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-4 text-xs font-bold transition active:scale-95 ${
                          ipMode === 'dhcp'
                            ? 'border-slate-900 bg-slate-900 text-white dark:bg-white dark:text-slate-900 dark:border-white shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {ipMode === 'dhcp' && <Check className="size-3.5 text-white dark:text-slate-900" />}
                        <span>DHCP (Automatic IP)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIpMode('static')}
                        className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-4 text-xs font-bold transition active:scale-95 ${
                          ipMode === 'static'
                            ? 'border-slate-900 bg-slate-900 text-white dark:bg-white dark:text-slate-900 dark:border-white shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {ipMode === 'static' && <Check className="size-3.5 text-white dark:text-slate-900" />}
                        <span>STATIC IP (Manual)</span>
                      </button>
                    </div>
                  </div>

                  {ipMode === 'static' && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2 animate-in fade-in">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">IP Address</label>
                        <input
                          type="text"
                          value={staticIp}
                          onChange={(e) => setStaticIp(e.target.value)}
                          placeholder="192.168.1.xxx"
                          className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none focus:border-slate-900 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Subnet Mask</label>
                        <input
                          type="text"
                          value={staticSubnet}
                          onChange={(e) => setStaticSubnet(e.target.value)}
                          className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none focus:border-slate-900 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Gateway Address</label>
                        <input
                          type="text"
                          value={staticGateway}
                          onChange={(e) => setStaticGateway(e.target.value)}
                          placeholder="192.168.1.1"
                          className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs sm:text-sm font-mono font-medium text-slate-900 outline-none focus:border-slate-900 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 3: NOTES & JUSTIFICATION */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 space-y-4 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-slate-900 text-white font-mono text-xs font-black shadow-xs dark:bg-slate-700">
                    03
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Catatan Tambahan &amp; Alasan Permohonan (Justification)
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Tuliskan justifikasi operasional atau alasan kebutuhan pengajuan ini
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center text-[11px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full">
                  STEP 3 / 4
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Rekomendasi Template:</span>
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
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-800 hover:border-slate-300 hover:bg-slate-200 transition active:scale-95 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <Plus className="size-2.5 text-slate-700 dark:text-slate-300" />
                      <span>{preset}</span>
                    </button>
                  ))}
                </div>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tuliskan keterangan detail, alasan pengajuan, atau urgensi permohonan layanan IT ini..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* SECTION 4: APPROVERS SEQUENCE PREVIEW */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 space-y-5 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-slate-900 text-white font-mono text-xs font-black shadow-xs dark:bg-slate-700">
                    04
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Alur Pejabat Penyetuju Form Ini (Configured Approvers)
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Daftar pejabat yang akan menerima berkas untuk tanda tangan elektronik digital secara berjenjang
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="hidden sm:inline-flex items-center text-[11px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full">
                    STEP 4 / 4
                  </span>
                  {adminUser && (
                    <Link
                      href="/kelola-approver-it"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 border border-slate-200 px-3 py-1.5 rounded-lg transition dark:bg-slate-800 dark:text-white dark:border-slate-700"
                    >
                      <span>Ubah Pejabat</span>
                      <ExternalLink className="size-3.5" />
                    </Link>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  {approvers.map((a, idx) => (
                    <React.Fragment key={a.id}>
                      <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition dark:border-slate-700 dark:bg-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
                            STEP {idx + 1}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold truncate max-w-[120px]">
                            {a.slot_label}
                          </span>
                        </div>
                        <div className="text-xs font-black text-slate-900 dark:text-white leading-snug">
                          {a.person_name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                          {a.role_title.split('/')[0]}
                        </div>
                      </div>
                      {idx < approvers.length - 1 && (
                        <div className="hidden md:flex items-center justify-center shrink-0">
                          <ArrowRight className="size-4 text-slate-400" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}

                  {approvers.length === 0 && !loadingApprovers && (
                    <div className="text-xs text-slate-500 italic py-2">
                      Belum ada approver yang dikonfigurasi untuk form ini.
                    </div>
                  )}

                  {loadingApprovers && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                      <Loader2 className="size-4 animate-spin text-slate-700 dark:text-slate-300" />
                      <span>Memuat konfigurasi pejabat approver...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* GRAND SUBMIT ACTION BAR */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-900 text-white shadow-xs dark:bg-slate-800">
                  <ShieldCheck className="size-6" />
                </div>
                <div>
                  <span className="font-black text-slate-900 dark:text-white block text-sm">ISMS Digital Compliance</span>
                  Formulir <span className="font-mono font-bold text-slate-900 dark:text-white">{currentFormDef.code}</span> diverifikasi berstandar ISO/IEC 27001 ISMS PT. JAI.
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 text-sm font-bold shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 active:scale-95 cursor-pointer shrink-0 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
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
