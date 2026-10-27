// app/registrasi-fingerprint/page.tsx
'use client'

import React, { useState, useEffect, Suspense, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Fingerprint,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  AlertTriangle,
  ArrowRight,
  Building,
  User,
  Calendar,
  Download,
  Copy,
  Check,
  Search,
  X,
  Info,
  RotateCcw,
  ShieldAlert,
  Send,
  ExternalLink,
  ChevronRight,
  Eye,
  CheckCheck,
  PencilLine,
  Loader2,
  Lock,
  BadgeCheck,
  QrCode,
  Shield,
  Briefcase,
  CalendarDays,
  FileCheck,
  CheckSquare,
  Square,
  Laptop,
  RefreshCw,
  History,
  FileDown,
  Filter,
  Trash2,
} from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import {
  FINGERPRINT_FORM_DEFINITION,
  type ItFormApprover,
  type ItFormSubmission,
} from '@/lib/it-form-shared'
import { SPECIAL_AREAS } from '@/lib/special-area-shared'
import { downloadExcel } from '@/lib/excel-export'
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

const DEFAULT_DEPARTMENTS = [
  'PGA',
  'FATP - EXIM',
  'MPC - WHS',
  'QA',
  'DE - MTC',
  'ENG',
  'PRODUKSI',
  'NYS - PP',
  'PPIC - WHS',
  'ME',
]

function FingerprintPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tokenQuery = searchParams.get('token')
  const tabQuery = searchParams.get('tab')
  const { adminUser } = useAuth()

  // Navigation tab: 'form' or 'history'
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form')

  // Form Applicant fields
  const [applicantName, setApplicantName] = useState('')
  const [applicantNik, setApplicantNik] = useState('')
  const [applicantPosition, setApplicantPosition] = useState('')
  const [employeeStatus, setEmployeeStatus] = useState<'TETAP' | 'KONTRAK' | 'MAGANG' | 'Other'>('TETAP')
  const [otherStatus, setOtherStatus] = useState('')
  const [companyName, setCompanyName] = useState('PT. Jatim Autocomp Indonesia')

  // Department and Section (Cascading)
  const [rawDepartments, setRawDepartments] = useState<DepartmentItem[]>([])
  const [department, setDepartment] = useState('PGA')
  const [sectionChoice, setSectionChoice] = useState('')
  const [customSection, setCustomSection] = useState('')

  // Special Area Master Data
  const [specialAreas, setSpecialAreas] = useState<string[]>([...SPECIAL_AREAS])
  const [loadingAreas, setLoadingAreas] = useState(false)
  const [areaChoice, setAreaChoice] = useState<string>(SPECIAL_AREAS[0])
  const [customArea, setCustomArea] = useState('')
  const [fingerprintId, setFingerprintId] = useState('')
  const [noExpiration, setNoExpiration] = useState(true)
  const [accessDeletionDate, setAccessDeletionDate] = useState('')
  const [komitmenAgreed, setKomitmenAgreed] = useState(true)
  const [notes, setNotes] = useState('')

  // Submission State
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [submissionResult, setSubmissionResult] = useState<ItFormSubmission | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // In-page Token / Review state
  const [searchLoading, setSearchLoading] = useState(false)

  // Approvers list
  const [approvers, setApprovers] = useState<ItFormApprover[]>([])
  const [loadingApprovers, setLoadingApprovers] = useState(false)

  // History state
  const [historyList, setHistoryList] = useState<ItFormSubmission[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>('all')
  const [historySearch, setHistorySearch] = useState<string>('')
  const [copiedRowId, setCopiedRowId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Fetch departments & cascading sections from database
  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_PATH}/api/departments`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.departments) && data.departments.length > 0) {
          setRawDepartments(data.departments)
          const pgaExists = data.departments.some((d: any) => d.name.toUpperCase() === 'PGA')
          if (pgaExists) {
            setDepartment('PGA')
          } else {
            setDepartment(data.departments[0].name)
          }
        }
      })
      .catch((err) => console.error('Failed to load departments:', err))
    return () => {
      cancelled = true
    }
  }, [])

  // Fetch Special Security Areas master list
  useEffect(() => {
    let cancelled = false
    setLoadingAreas(true)
    fetch(`${API_BASE_PATH}/api/special-area-requests/areas`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { areas?: string[] } | null) => {
        if (cancelled || !data?.areas?.length) return
        setSpecialAreas(data.areas)
        setAreaChoice((current) => (current === 'Lainnya' || data.areas!.includes(current) ? current : data.areas![0]))
      })
      .catch((err) => console.error('Failed to load special areas:', err))
      .finally(() => {
        if (!cancelled) setLoadingAreas(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Current department object and its sections
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

  // Load configured approvers for ISMS-F-02-00-002
  useEffect(() => {
    let cancelled = false
    setLoadingApprovers(true)
    fetch(`${API_BASE_PATH}/api/it-form-approvers?form_code=ISMS-F-02-00-002`)
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
  }, [])

  // Fetch history submissions for ISMS-F-02-00-002
  const fetchHistory = useCallback(async (statusFilter = historyFilterStatus, searchVal = historySearch) => {
    setHistoryLoading(true)
    try {
      const q = new URLSearchParams()
      q.set('form_code', 'ISMS-F-02-00-002')
      if (statusFilter && statusFilter !== 'all') {
        q.set('status', statusFilter)
      }
      if (searchVal.trim()) {
        q.set('search', searchVal.trim())
      }
      const res = await fetch(`${API_BASE_PATH}/api/it-form-submissions?${q.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && Array.isArray(data.submissions)) {
        setHistoryList(data.submissions)
      }
    } catch (err) {
      console.error('Failed to load fingerprint history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [historyFilterStatus, historySearch])

  // History counts summary
  const historyCounts = useMemo(() => {
    return {
      all: historyList.length,
      pending: historyList.filter((s) => s.status === 'pending').length,
      approved: historyList.filter((s) => s.status === 'approved').length,
      rejected: historyList.filter((s) => s.status === 'rejected').length,
    }
  }, [historyList])

  // Initial tab & history loading
  useEffect(() => {
    if (tabQuery === 'history') {
      setActiveTab('history')
    }
    fetchHistory()
  }, [tabQuery, fetchHistory])

  // Load submission by token
  const fetchSubmissionByToken = async (tok: string) => {
    setSearchLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-form-submissions?token=${encodeURIComponent(tok)}`)
      const data = await res.json()
      if (res.ok && data.submission) {
        setSubmissionResult(data.submission)
        setActiveTab('form')
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

  // Effective section name
  const effectiveSection = useMemo(() => {
    if (sectionChoice === '__custom__') {
      return customSection.trim()
    }
    if (sectionChoice) {
      return sectionChoice.trim()
    }
    return customSection.trim()
  }, [sectionChoice, customSection])

  // Effective Area Special Security
  const effectiveArea = useMemo(() => {
    if (areaChoice === 'Lainnya') {
      return customArea.trim() || 'Special Security Area'
    }
    return areaChoice
  }, [areaChoice, customArea])

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!applicantName.trim()) {
      setErrorMsg('Nama Pemohon wajib diisi.')
      return
    }
    if (!applicantNik.trim()) {
      setErrorMsg('Nomor Induk Karyawan (NIK) wajib diisi.')
      return
    }
    if (!komitmenAgreed) {
      setErrorMsg('Anda harus menyetujui komitmen kerahasiaan Special Security Area.')
      return
    }

    setSubmitting(true)
    setErrorMsg('')

    try {
      const payloadFormData: Record<string, any> = {
        section: effectiveSection || null,
        area_special_security: effectiveArea,
        fingerprint_id: fingerprintId.trim() || applicantNik.trim(),
        access_deletion_date: noExpiration ? 'Sesuai Masa Penugasan' : accessDeletionDate.trim() || 'Sesuai Masa Penugasan',
        komitmen_agreed: komitmenAgreed,
      }

      const res = await fetch(`${API_BASE_PATH}/api/it-form-submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_code: 'ISMS-F-02-00-002',
          applicant_name: applicantName.trim(),
          applicant_nik: applicantNik.trim() || null,
          applicant_position: applicantPosition.trim() || null,
          employee_status: employeeStatus === 'Other' ? otherStatus.trim() || 'Other' : employeeStatus,
          department: department.trim(),
          company_name: companyName.trim() || 'PT. Jatim Autocomp Indonesia',
          purpose: effectiveArea,
          form_data: payloadFormData,
          notes: notes.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim permohonan registrasi fingerprint.')

      setSubmissionResult(data.submission)
      fetchHistory()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat mengirim permohonan.')
    } finally {
      setSubmitting(false)
    }
  }

  const copyVerifyLink = () => {
    if (!submissionResult) return
    const url = `${window.location.origin}${API_BASE_PATH}/registrasi-fingerprint?token=${submissionResult.token}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  const copyRowLink = (sub: ItFormSubmission) => {
    const url = `${window.location.origin}${API_BASE_PATH}/registrasi-fingerprint?token=${sub.token}`
    navigator.clipboard.writeText(url)
    setCopiedRowId(sub.id)
    setTimeout(() => setCopiedRowId(null), 2500)
  }

  const viewDetailFromHistory = (sub: ItFormSubmission) => {
    setSubmissionResult(sub)
    setActiveTab('form')
    window.scrollTo({ top: 120, behavior: 'smooth' })
  }

  const handleDeleteHistory = async (sub: ItFormSubmission) => {
    const ok = window.confirm(
      `Apakah Anda yakin ingin menghapus permohonan No. ${sub.request_no} atas nama "${sub.applicant_name}"?\n\nData yang dihapus tidak dapat dipulihkan.`
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

  const handleExportHistoryExcel = () => {
    if (!historyList.length) return
    const filename = `riwayat-registrasi-fingerprint-${new Date().toISOString().slice(0, 10)}`
    const headers = [
      'No',
      'No. Permohonan',
      'Tanggal Permohonan',
      'Nama Pemohon',
      'NIK / No. Karyawan',
      'Departemen',
      'Seksi / Bagian',
      'Area Akses (Special / Bisnis)',
      'ID Fingerprint',
      'Masa Berlaku Akses',
      'Status Permohonan',
      'Approver E-Sign',
      'Tanggal Sah E-Sign',
      'Alasan Kebutuhan Akses',
    ]

    const rows = historyList.map((sub, idx) => {
      const isApproved = sub.status === 'approved'
      const isRejected = sub.status === 'rejected'
      const sig = sub.signatures?.[0]
      const areaName = sub.form_data?.area_special_security || sub.purpose || 'Special Security Area'
      const statusLabel = isApproved ? 'Disetujui' : isRejected ? 'Ditolak' : 'Menunggu Approval'

      return [
        idx + 1,
        sub.request_no,
        sub.request_date,
        sub.applicant_name,
        sub.applicant_nik || '-',
        sub.department,
        (sub.form_data?.section as string) || '-',
        areaName,
        sub.form_data?.fingerprint_id || '-',
        sub.form_data?.access_deletion_date || 'Sesuai Masa Penugasan',
        statusLabel,
        sig?.approver_name || 'Teguh Sunjoyo (IAA)',
        isApproved && sig?.signed_at ? new Date(sig.signed_at).toLocaleDateString('id-ID') : '-',
        sub.notes || '-',
      ]
    })

    downloadExcel(filename, headers, rows, 'Registrasi Fingerprint')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-24 pt-4 px-3 sm:px-6">
      {/* Top Banner / Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-card via-card/95 to-indigo-50/40 p-6 sm:p-9 shadow-sm dark:border-indigo-900/50 dark:from-card dark:via-card/95 dark:to-indigo-950/20">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500" />
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -left-20 -bottom-20 size-72 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-rose-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-md">
              <Fingerprint className="size-8" />
              <span className="absolute -top-1 -right-1 flex size-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex size-3.5 rounded-full bg-indigo-500" />
              </span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-red-600 dark:text-red-400 uppercase">
                  <Lock className="size-3" />
                  CONFIDENTIAL - LEVEL 3
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-400">
                  <ShieldCheck className="size-3" />
                  Special Security Area
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border bg-secondary/70 px-2.5 py-0.5 font-mono text-[10px] font-bold text-foreground">
                  ISMS-F-02-00-002
                </span>
              </div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                Pengajuan Registrasi Finger Print Special Security Area
              </h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground sm:text-sm">
                【記録】特別セキュリティ区画指紋入退システム申請書
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground max-w-2xl leading-relaxed">
                PT. Jatim Autocomp Indonesia &bull; Pendaftaran &amp; permohonan izin sidik jari masuk kawasan berkeamanan tinggi dengan pengesahan resmi Information Assets Administrator (IAA - Teguh Sunjoyo).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
            <button
              type="button"
              onClick={() => {
                setActiveTab(activeTab === 'history' ? 'form' : 'history')
                if (activeTab === 'form') fetchHistory()
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-950/40 px-4 py-2.5 text-xs font-semibold text-indigo-800 dark:text-indigo-200 shadow-xs transition hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:-translate-y-0.5"
            >
              <History className="size-4 text-indigo-600 dark:text-indigo-400" />
              <span>{activeTab === 'history' ? 'Buka Form Pendaftaran' : `Lihat Riwayat (${historyCounts.all})`}</span>
            </button>
            <Link
              href="/form-it-esign"
              className="inline-flex items-center gap-2 rounded-xl border border-border/90 bg-card px-4 py-2.5 text-xs font-semibold text-foreground shadow-xs transition hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300 hover:-translate-y-0.5"
            >
              <Laptop className="size-4 text-emerald-600" />
              <span>Buka Form Layanan IT &rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Tab Navigation */}
      <div className="flex items-center justify-between border-b border-border/80 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'form'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/80'
            }`}
          >
            <FileText className="size-4" />
            <span>Formulir Pengajuan Baru</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('history')
              fetchHistory()
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-xs'
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

        {activeTab === 'history' && (
          <button
            type="button"
            onClick={() => fetchHistory()}
            disabled={historyLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${historyLoading ? 'animate-spin text-indigo-600' : ''}`} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>
        )}
      </div>


      {/* Submission Result / Active Review Box */}
      {submissionResult && activeTab === 'form' && (
        <section className="relative overflow-hidden rounded-3xl border-2 border-indigo-500/40 bg-card p-6 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                    submissionResult.status === 'approved'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : submissionResult.status === 'rejected'
                      ? 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30'
                      : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {submissionResult.status === 'approved' ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : submissionResult.status === 'rejected' ? (
                    <XCircle className="size-3.5" />
                  ) : (
                    <Clock className="size-3.5 animate-pulse" />
                  )}
                  <span className="uppercase">
                    {submissionResult.status === 'approved'
                      ? 'Terverifikasi & Disetujui'
                      : submissionResult.status === 'rejected'
                      ? 'Ditolak'
                      : 'Menunggu Persetujuan IAA (Teguh Sunjoyo)'}
                  </span>
                </span>
                <span className="font-mono text-xs font-bold text-foreground">
                  {submissionResult.request_no}
                </span>
              </div>
              <h2 className="mt-2 font-display text-lg font-bold text-foreground sm:text-xl">
                Pengajuan Registrasi Finger Print: {submissionResult.applicant_name} ({submissionResult.department}
                {submissionResult.form_data?.section ? ` / ${submissionResult.form_data.section}` : ''})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`${API_BASE_PATH}/api/it-form-submissions/${submissionResult.id}/pdf?token=${submissionResult.token}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700"
              >
                <Download className="size-4" />
                <span>Download Form PDF (Single Copy)</span>
              </a>
              <button
                type="button"
                onClick={copyVerifyLink}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
              >
                {copiedLink ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                <span>{copiedLink ? 'Tersalin' : 'Salin Tautan'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmissionResult(null)
                  router.push('/registrasi-fingerprint')
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-secondary"
              >
                <RotateCcw className="size-3.5" />
                <span>Form Baru</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmissionResult(null)
                  setActiveTab('history')
                  fetchHistory()
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50/50 px-3 py-2.5 text-xs font-semibold text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 hover:bg-indigo-100"
              >
                <History className="size-3.5" />
                <span>Ke Riwayat</span>
              </button>
            </div>
          </div>

          {/* Details Grid */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
              <p className="text-muted-foreground font-semibold">Nama Pemohon</p>
              <p className="mt-1 font-bold text-foreground text-sm">{submissionResult.applicant_name}</p>
              <p className="text-muted-foreground font-mono mt-0.5">NIK: {submissionResult.applicant_nik || '-'}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
              <p className="text-muted-foreground font-semibold">Departemen &amp; Seksi</p>
              <p className="mt-1 font-bold text-foreground text-sm">
                {submissionResult.department}
                {submissionResult.form_data?.section ? ` / ${submissionResult.form_data.section}` : ''}
              </p>
              <p className="text-muted-foreground mt-0.5">Status: {submissionResult.employee_status}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
              <p className="text-muted-foreground font-semibold">Area Akses (Special / Bisnis)</p>
              <p className="mt-1 font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                {submissionResult.form_data?.area_special_security || submissionResult.purpose || 'Area Akses Terdaftar'}
              </p>
              <p className="text-muted-foreground font-mono mt-0.5">
                ID Sidik Jari: {submissionResult.form_data?.fingerprint_id || '-'}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
              <p className="text-muted-foreground font-semibold">Masa Berlaku Akses</p>
              <p className="mt-1 font-bold text-foreground text-sm">
                {submissionResult.form_data?.access_deletion_date || 'Sesuai Masa Penugasan'}
              </p>
              <p className="text-muted-foreground mt-0.5">
                Diajukan: {new Date(submissionResult.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
              </p>
            </div>
          </div>

          {/* Signatures Timeline */}
          {submissionResult.signatures && submissionResult.signatures.length > 0 && (
            <div className="mt-6 border-t border-border/70 pt-5">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileCheck className="size-4 text-indigo-600" />
                <span>Otorisasi &amp; Tanda Tangan Digital Resmi (E-Sign Verification)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {submissionResult.signatures.map((sig) => {
                  const isApp = sig.status === 'approved'
                  const isRej = sig.status === 'rejected'
                  return (
                    <div
                      key={sig.id}
                      className={`relative flex flex-col justify-between rounded-2xl border p-4 transition ${
                        isApp
                          ? 'border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/20'
                          : isRej
                          ? 'border-red-500/40 bg-red-50/30 dark:bg-red-950/20'
                          : 'border-border bg-card'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {sig.slot_label}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isApp
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : isRej
                                ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                                : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {isApp ? 'Disetujui' : isRej ? 'Ditolak' : 'Menunggu Approval'}
                          </span>
                        </div>
                        <p className="font-display text-sm font-bold text-foreground">{sig.approver_name}</p>
                        <p className="text-xs text-muted-foreground">{sig.role_title}</p>
                      </div>

                      {isApp && (
                        <div className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400">
                          <span className="font-mono">Kode E-Sign: {sig.verification_code || 'VERIFIED'}</span>
                          <span>{sig.signed_at ? new Date(sig.signed_at).toLocaleDateString('id-ID') : 'Sah'}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Main Registration Form (When in 'form' tab and not viewing result) */}
      {!submissionResult && activeTab === 'form' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMsg && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 flex items-center gap-2.5">
              <AlertTriangle className="size-5 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Data Identitas Pemohon */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-border/70 pb-4 mb-6">
              <div className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-xs">
                <User className="size-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  1. Informasi Identitas Pemohon
                </h3>
                <p className="text-xs text-muted-foreground">
                  Data karyawan PT. JAI atau mitra yang mengajukan pendaftaran akses sidik jari.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Nama Lengkap */}
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-bold text-foreground">
                  Nama Lengkap Pemohon (申請者の氏名) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    placeholder="Contoh: FADILAH / AHMAD FAUZI"
                    className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
                  />
                </div>
              </div>

              {/* NIK */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-foreground">
                  Nomor Induk Karyawan / NIK (従業員IDコード) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <BadgeCheck className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={applicantNik}
                    onChange={(e) => setApplicantNik(e.target.value)}
                    placeholder="Contoh: 38913"
                    className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 font-mono"
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
                    placeholder="Contoh: Staff, Supervisor, Leader"
                    className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-xs sm:text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
                  />
                </div>
              </div>

              {/* Departemen & Seksi (CASCADING DROPDOWNS) */}
              <div className="sm:col-span-2 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4 dark:border-indigo-950/60 dark:bg-indigo-950/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Departemen */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-foreground">
                        Departemen (所属部署) <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                        Sinkron Database ISMS
                      </span>
                    </div>
                    <div className="relative">
                      <Building className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-8 text-xs sm:text-sm text-foreground outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 font-medium"
                      >
                        {(rawDepartments.length > 0 ? rawDepartments.map((d) => d.name) : DEFAULT_DEPARTMENTS).map((d) => (
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
                      <label className="block text-xs font-bold text-foreground">
                        Seksi / Bagian (課・係) <span className="text-red-500">*</span>
                      </label>
                      {availableSections.length > 0 && (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {availableSections.length} Seksi Terdaftar
                        </span>
                      )}
                    </div>

                    {availableSections.length > 0 ? (
                      <div className="space-y-2">
                        <select
                          value={sectionChoice}
                          onChange={(e) => setSectionChoice(e.target.value)}
                          className="h-11 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm text-foreground outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 font-medium"
                        >
                          <option value="">-- Pilih Seksi / Bagian --</option>
                          {availableSections.map((sec) => (
                            <option key={sec.id} value={sec.name}>
                              {sec.name} {department.toUpperCase() === 'PGA' && sec.name === 'IT' ? '(Information Technology)' : ''}
                            </option>
                          ))}
                          <option value="__custom__">+ Input Seksi Lainnya...</option>
                        </select>

                        {sectionChoice === '__custom__' && (
                          <input
                            type="text"
                            value={customSection}
                            onChange={(e) => setCustomSection(e.target.value)}
                            placeholder="Sebutkan nama seksi / bagian..."
                            className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-indigo-500"
                          />
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={customSection}
                        onChange={(e) => setCustomSection(e.target.value)}
                        placeholder="Contoh: IT Section / Maintenance"
                        className="h-11 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm text-foreground outline-none focus:border-indigo-500"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Status Karyawan */}
              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs font-bold text-foreground">
                  Status Karyawan (ステータス)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['TETAP', 'KONTRAK', 'MAGANG', 'Other'] as const).map((st) => {
                    const isSelected = employeeStatus === st
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setEmployeeStatus(st)}
                        className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-xs font-bold transition active:scale-95 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                            : 'border-border bg-card text-muted-foreground hover:bg-secondary/50'
                        }`}
                      >
                        {isSelected && <Check className="size-3.5 text-indigo-600 shrink-0" />}
                        <span>{st === 'Other' ? 'Lainnya' : st}</span>
                      </button>
                    )
                  })}
                </div>
                {employeeStatus === 'Other' && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in">
                    <input
                      type="text"
                      value={otherStatus}
                      onChange={(e) => setOtherStatus(e.target.value)}
                      placeholder="Sebutkan status hubungan kerja..."
                      className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Nama Perusahaan / Organisasi..."
                      className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Detail Akses Area (Special Security / Business Area) */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-border/70 pb-4 mb-6">
              <div className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-xs">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  2. Area Akses (Special Security / Business Area) &amp; Masa Berlaku
                </h3>
                <p className="text-xs text-muted-foreground">
                  Pemilihan zona keamanan khusus atau area bisnis yang dimohonkan akses sidik jarinya (tersinkron dengan Master Area PT. JAI).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Area Akses (Special Security / Area Bisnis) - DYNAMIC MASTER LIST */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-foreground">
                    Area Akses (Special Security / Area Bisnis) <span className="text-red-500">*</span>
                  </label>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="size-3" />
                    Sinkron Master Area
                  </span>
                </div>
                <select
                  value={areaChoice}
                  onChange={(e) => setAreaChoice(e.target.value)}
                  className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-indigo-500 font-semibold"
                >
                  {specialAreas.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  <option value="Lainnya">Lainnya (Sebutkan Sendiri)</option>
                </select>
                {areaChoice === 'Lainnya' && (
                  <input
                    type="text"
                    value={customArea}
                    onChange={(e) => setCustomArea(e.target.value)}
                    placeholder="Sebutkan area khusus atau area bisnis yang dimohonkan..."
                    className="mt-2 h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-indigo-500"
                  />
                )}
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Pilihan zona terdaftar di Diagram Security Area &amp; Area Bisnis PT. JAI.</span>
                  {adminUser && (adminUser.role === 'ism_admin' || adminUser.role === 'it') && (
                    <Link
                      href="/kelola-izin-area-special"
                      target="_blank"
                      className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                    >
                      <span>Master Area</span>
                      <ExternalLink className="size-2.5" />
                    </Link>
                  )}
                </div>
              </div>

              {/* Kode ID (Opsional) */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-foreground">
                  Kode ID / ID Code (IDコード) <span className="text-muted-foreground font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={fingerprintId}
                  onChange={(e) => setFingerprintId(e.target.value)}
                  placeholder="Contoh: FP-0012 atau nomor ID mesin"
                  className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-indigo-500 font-mono"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Bila dikosongkan, sistem otomatis menggunakan NIK ({applicantNik || 'Nomor Induk Karyawan'}) agar pas dan tercetak di kolom Kode ID formulir PDF.
                </p>
              </div>

              {/* Masa Berlaku Akses / Tanggal Penghapusan */}
              <div className="sm:col-span-2 rounded-2xl border border-border/80 bg-secondary/30 p-4">
                <label className="block text-xs font-bold text-foreground mb-2">
                  Tanggal Penghapusan Akses / Masa Berlaku (アクセス削除日付)
                </label>
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-foreground">
                    <input
                      type="radio"
                      name="expirationMode"
                      checked={noExpiration}
                      onChange={() => setNoExpiration(true)}
                      className="size-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Sesuai Masa Penugasan / Tidak Terbatas (Default Standar ISO 27001)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-foreground">
                    <input
                      type="radio"
                      name="expirationMode"
                      checked={!noExpiration}
                      onChange={() => setNoExpiration(false)}
                      className="size-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Tentukan Tanggal Penghapusan Akses Tertentu:</span>
                  </label>

                  {!noExpiration && (
                    <div className="pl-6 pt-1">
                      <input
                        type="date"
                        value={accessDeletionDate}
                        onChange={(e) => setAccessDeletionDate(e.target.value)}
                        className="h-10 rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Komitmen Special Security Area (YAZAKI STANDARD) */}
              <div className="sm:col-span-2 rounded-2xl border-2 border-indigo-200/90 bg-indigo-50/60 p-5 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                <p className="font-display text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Lock className="size-4 text-indigo-600" />
                  <span>KOMITMEN / 約束 (Standar Khusus Yazaki Special Security Area)</span>
                </p>
                <ol className="list-decimal list-inside space-y-2 text-xs text-foreground/90 pl-1 leading-relaxed">
                  <li>
                    <strong>Menjaga kerahasiaan informasi yang ada di Special Security Area.</strong>
                    <br />
                    <span className="text-[11px] text-muted-foreground font-mono">
                      特別セキュリティ区画にある情報資産を守ること。
                    </span>
                  </li>
                  <li>
                    <strong>Melaporkan ke IAA (Teguh S.) bila terjadi kebocoran informasi.</strong>
                    <br />
                    <span className="text-[11px] text-muted-foreground font-mono">
                      情報漏れが発生した場合、情報資産管理者（タグーさん）へ至急に連絡すること。
                    </span>
                  </li>
                </ol>

                <div className="mt-4 pt-3 border-t border-indigo-200/80 dark:border-indigo-900/60">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={komitmenAgreed}
                      onChange={(e) => setKomitmenAgreed(e.target.checked)}
                      className="mt-0.5 size-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-foreground">
                      Saya telah membaca, memahami, dan berjanji mematuhi seluruh butir komitmen di atas demi menjaga integritas keamanan ISMS ISO/IEC 27001. <span className="text-red-500">*</span>
                    </span>
                  </label>
                </div>
              </div>

              {/* Catatan Tambahan */}
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-bold text-foreground">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Keterangan permohonan, alasan akses, atau referensi penugasan..."
                  className="w-full rounded-xl border border-input bg-card p-3 text-xs text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Pejabat Penyetuju (E-Sign Approver) */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-border/70 pb-4 mb-4">
              <div className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-xs">
                <FileCheck className="size-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  3. Alur Pengesahan Resmi (E-Sign Flow)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Pejabat yang berwenang memberikan verifikasi &amp; stempel tanda tangan digital ber-QR Code.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-200/90 bg-indigo-50/40 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xs">
                  IAA
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                    Information Assets Administrator (MENYETUJUI / 指紋入退申請許可)
                  </p>
                  <p className="text-sm font-bold text-foreground">Teguh Sunjoyo</p>
                  <p className="text-xs text-muted-foreground">teguh.sunjoyo@jai.co.id &bull; PT. Jatim Autocomp Indonesia</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 self-start sm:self-center">
                <ShieldCheck className="size-3.5 text-indigo-600" />
                <span>Otoritas Tunggal Dokumen F-02-00-002</span>
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <Link
              href="/"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition"
            >
              &larr; Kembali ke Beranda Portal ISMS
            </Link>

            <button
              type="submit"
              disabled={submitting || !komitmenAgreed}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-2xl bg-indigo-600 px-8 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 hover:shadow-lg disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Memproses Pengajuan...</span>
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  <span>Ajukan Registrasi Fingerprint Special Security Area</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* History View (When in 'history' tab) */}
      {activeTab === 'history' && (
        <section className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
              <span className="text-[11px] font-semibold text-muted-foreground">Total Pengajuan</span>
              <p className="mt-1.5 font-display text-2xl font-bold text-foreground">{historyCounts.all}</p>
              <span className="text-[10px] text-muted-foreground">Form ISMS-F-02-00-002</span>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20 p-4 shadow-2xs">
              <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">Menunggu Approval</span>
              <p className="mt-1.5 font-display text-2xl font-bold text-amber-700 dark:text-amber-400">{historyCounts.pending}</p>
              <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80">Otorisasi IAA</span>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 shadow-2xs">
              <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Disetujui Resmi</span>
              <p className="mt-1.5 font-display text-2xl font-bold text-emerald-700 dark:text-emerald-400">{historyCounts.approved}</p>
              <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">E-Sign Valid</span>
            </div>
            <div className="rounded-2xl border border-red-500/30 bg-red-50/40 dark:bg-red-950/20 p-4 shadow-2xs">
              <span className="text-[11px] font-semibold text-red-800 dark:text-red-300">Ditolak</span>
              <p className="mt-1.5 font-display text-2xl font-bold text-red-700 dark:text-red-400">{historyCounts.rejected}</p>
              <span className="text-[10px] text-red-700/80 dark:text-red-400/80">Tidak diberikan akses</span>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs">
            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'all', label: 'Semua', count: historyCounts.all },
                { key: 'pending', label: 'Menunggu', count: historyCounts.pending },
                { key: 'approved', label: 'Disetujui', count: historyCounts.approved },
                { key: 'rejected', label: 'Ditolak', count: historyCounts.rejected },
              ].map((tab) => {
                const isSelected = historyFilterStatus === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setHistoryFilterStatus(tab.key)
                      fetchHistory(tab.key, historySearch)
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-background text-foreground'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Search Input & Export Button */}
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cari nama, NIK, No. Request, area..."
                  value={historySearch}
                  onChange={(e) => {
                    setHistorySearch(e.target.value)
                    fetchHistory(historyFilterStatus, e.target.value)
                  }}
                  className="h-9 w-full rounded-xl border border-input bg-card pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-indigo-500 outline-none"
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setHistorySearch('')
                      fetchHistory(historyFilterStatus, '')
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleExportHistoryExcel}
                disabled={historyList.length === 0}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap w-full sm:w-auto"
                title="Export riwayat pendaftaran fingerprint ke Excel (.xlsx)"
              >
                <Download className="size-3.5" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* History Content */}
          {historyLoading ? (
            <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-border/80 bg-card p-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="size-7 animate-spin text-indigo-600" />
                <p className="text-xs font-semibold text-muted-foreground">Memuat riwayat pengajuan fingerprint...</p>
              </div>
            </div>
          ) : historyList.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-card p-10 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                <Fingerprint className="size-6" />
              </div>
              <h4 className="mt-3.5 font-display text-base font-bold text-foreground">
                Belum ada data pengajuan
              </h4>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                {historySearch
                  ? `Tidak ditemukan pengajuan dengan kata kunci "${historySearch}". Coba kata kunci lain.`
                  : 'Belum ada formulir pendaftaran registrasi sidik jari Special Security Area yang diajukan.'}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700"
              >
                <FileText className="size-3.5" />
                <span>Buat Pengajuan Baru</span>
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-secondary/35 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3.5">No. Request &amp; Tanggal</th>
                      <th className="px-4 py-3.5">Pemohon</th>
                      <th className="px-4 py-3.5">Departemen</th>
                      <th className="px-4 py-3.5">Area Akses (Special / Bisnis)</th>
                      <th className="px-4 py-3.5">Masa Berlaku</th>
                      <th className="px-4 py-3.5">Status E-Sign</th>
                      <th className="px-4 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {historyList.map((sub) => {
                      const isApproved = sub.status === 'approved'
                      const isRejected = sub.status === 'rejected'
                      const sig = sub.signatures?.[0]
                      const areaName = sub.form_data?.area_special_security || sub.purpose || 'Special Security Area'

                      return (
                        <tr
                          key={sub.id}
                          className="transition hover:bg-secondary/25"
                        >
                          <td className="px-4 py-3.5 align-top">
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {sub.request_no}
                            </span>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {new Date(sub.created_at).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </td>

                          <td className="px-4 py-3.5 align-top">
                            <p className="font-bold text-foreground">{sub.applicant_name}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              {sub.applicant_nik && (
                                <span className="font-mono bg-secondary px-1 rounded text-[10px]">
                                  NIK: {sub.applicant_nik}
                                </span>
                              )}
                              <span>&bull; {sub.employee_status}</span>
                            </div>
                            {sub.applicant_position && (
                              <p className="text-[10.5px] text-muted-foreground/80">{sub.applicant_position}</p>
                            )}
                          </td>

                          <td className="px-4 py-3.5 align-top">
                            <p className="font-semibold text-foreground">{sub.department}</p>
                            {sub.form_data?.section && (
                              <p className="text-[11px] text-muted-foreground">Seksi: {sub.form_data.section}</p>
                            )}
                          </td>

                          <td className="px-4 py-3.5 align-top">
                            <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-semibold text-indigo-700 dark:text-indigo-300">
                              <Shield className="size-3" />
                              <span>{areaName}</span>
                            </span>
                            {sub.form_data?.fingerprint_id && (
                              <p className="mt-1 font-mono text-[10.5px] text-muted-foreground">
                                ID: {sub.form_data.fingerprint_id}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-3.5 align-top">
                            <span className="text-[11.5px] font-medium text-foreground">
                              {sub.form_data?.access_deletion_date || 'Sesuai Masa Penugasan'}
                            </span>
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
                                <span>{isApproved ? 'Disetujui' : isRejected ? 'Ditolak' : 'Menunggu Approval'}</span>
                              </span>

                              <p className="text-[10.5px] text-muted-foreground">
                                Approver: {sig?.approver_name || 'Teguh Sunjoyo (IAA)'}
                              </p>
                              {isApproved && sig?.signed_at && (
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                                  Sah: {new Date(sig.signed_at).toLocaleDateString('id-ID')}
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 align-top text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                title="Lihat Status & Detail Lengkap"
                                onClick={() => viewDetailFromHistory(sub)}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition"
                              >
                                <Eye className="size-3.5 text-indigo-600" />
                                <span className="hidden md:inline">Detail</span>
                              </button>

                              <a
                                href={`${API_BASE_PATH}/api/it-form-submissions/${sub.id}/pdf?token=${sub.token}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Download Formulir Resmi PDF (Single Copy)"
                                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs transition"
                              >
                                <FileDown className="size-3.5" />
                                <span className="hidden md:inline">PDF</span>
                              </a>

                              <button
                                type="button"
                                title="Salin Tautan Token / Verifikasi"
                                onClick={() => copyRowLink(sub)}
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                              >
                                {copiedRowId === sub.id ? (
                                  <Check className="size-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="size-3.5" />
                                )}
                              </button>

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
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function FingerprintPageLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-8 animate-spin text-indigo-600" />
        <p className="text-xs font-semibold text-muted-foreground">Memuat Form Registrasi Fingerprint...</p>
      </div>
    </div>
  )
}

export default function RegistrasiFingerprintPage() {
  return (
    <Suspense fallback={<FingerprintPageLoading />}>
      <FingerprintPageInner />
    </Suspense>
  )
}
