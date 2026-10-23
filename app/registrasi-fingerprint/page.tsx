// app/registrasi-fingerprint/page.tsx
'use client'

import React, { useState, useEffect, Suspense, useMemo } from 'react'
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
} from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import {
  FINGERPRINT_FORM_DEFINITION,
  type ItFormApprover,
  type ItFormSubmission,
} from '@/lib/it-form-shared'
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

const AREA_OPTIONS = [
  'Ruang Server / Server Room',
  'Ruang Arsip Confidential',
  'Data Center & Network Hub',
  'Ruang Kontrol CCTV & Keamanan',
  'Lainnya',
]

function FingerprintPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tokenQuery = searchParams.get('token')
  const { adminUser } = useAuth()

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

  // Access details
  const [areaChoice, setAreaChoice] = useState(AREA_OPTIONS[0])
  const [customArea, setCustomArea] = useState('')
  const [fingerprintId, setFingerprintId] = useState('')
  const [noExpiration, setNoExpiration] = useState(true)
  const [accessDeletionDate, setAccessDeletionDate] = useState('')
  const [komitmenAgreed, setKomitmenAgreed] = useState(true)
  const [notes, setNotes] = useState('')

  // State
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [submissionResult, setSubmissionResult] = useState<ItFormSubmission | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // In-page Token / Review state
  const [searchInput, setSearchInput] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)

  // Approvers list
  const [approvers, setApprovers] = useState<ItFormApprover[]>([])
  const [loadingApprovers, setLoadingApprovers] = useState(false)

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
      // If PGA, default to IT section if present, otherwise first section
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

  // Load submission by token
  const fetchSubmissionByToken = async (tok: string) => {
    setSearchLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-form-submissions?token=${encodeURIComponent(tok)}`)
      const data = await res.json()
      if (res.ok && data.submission) {
        setSubmissionResult(data.submission)
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

      {/* Track & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/60 p-3 sm:p-4 backdrop-blur-xs">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="size-4 text-indigo-600 shrink-0" />
          <span>Sudah pernah mengajukan? Masukkan Token / ID permohonan untuk cek status atau review persetujuan E-Sign:</span>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari token..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchInput.trim()) {
                  fetchSubmissionByToken(searchInput.trim())
                }
              }}
              className="h-9 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (searchInput.trim()) fetchSubmissionByToken(searchInput.trim())
            }}
            disabled={searchLoading || !searchInput.trim()}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {searchLoading ? <Loader2 className="size-3.5 animate-spin" /> : 'Cek Status'}
          </button>
        </div>
      </div>

      {/* Submission Result / Active Review Box */}
      {submissionResult && (
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
              <p className="text-muted-foreground mt-0.5">{submissionResult.applicant_position || 'Staff'}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
              <p className="text-muted-foreground font-semibold">Area Special Security</p>
              <p className="mt-1 font-bold text-indigo-700 dark:text-indigo-400 text-sm">
                {submissionResult.form_data?.area_special_security || submissionResult.purpose || 'Ruang Server'}
              </p>
              <p className="text-muted-foreground mt-0.5 font-mono">
                Kode ID: {submissionResult.form_data?.fingerprint_id || '-'}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
              <p className="text-muted-foreground font-semibold">Masa Berlaku Akses</p>
              <p className="mt-1 font-bold text-foreground text-sm">
                {submissionResult.form_data?.access_deletion_date || 'Sesuai Masa Penugasan'}
              </p>
              <p className="text-muted-foreground mt-0.5">
                Pengajuan: {new Date(submissionResult.request_date).toLocaleDateString('id-ID')}
              </p>
            </div>
          </div>

          {/* Approver Signatures Timeline */}
          <div className="mt-6 rounded-2xl border border-border/80 bg-secondary/20 p-4">
            <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-indigo-600" />
              <span>Status Otorisasi Pejabat ISMS &amp; E-Sign</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(submissionResult.signatures || []).map((sig) => (
                <div
                  key={sig.id}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 transition ${
                    sig.status === 'approved'
                      ? 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : sig.status === 'rejected'
                      ? 'border-red-500/40 bg-red-50/50 dark:bg-red-950/20'
                      : 'border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20'
                  }`}
                >
                  <div className="mt-0.5">
                    {sig.status === 'approved' ? (
                      <CheckCircle2 className="size-5 text-emerald-600" />
                    ) : sig.status === 'rejected' ? (
                      <XCircle className="size-5 text-red-600" />
                    ) : (
                      <Clock className="size-5 text-amber-600 animate-spin" />
                    )}
                  </div>
                  <div className="flex-1 text-xs">
                    <p className="font-bold text-foreground text-sm">{sig.slot_label}</p>
                    <p className="text-muted-foreground font-medium">{sig.role_title}: <span className="text-foreground font-semibold">{sig.approver_name}</span></p>
                    {sig.status === 'approved' && (
                      <div className="mt-2 space-y-1 text-[11px] text-emerald-800 dark:text-emerald-300 font-mono">
                        <p className="flex items-center gap-1.5"><Check className="size-3 text-emerald-600" />E-Sign Terverifikasi: {sig.verification_code}</p>
                        <p className="flex items-center gap-1.5"><Calendar className="size-3 text-emerald-600" />Tanggal: {sig.signed_at ? new Date(sig.signed_at).toLocaleString('id-ID') : '-'}</p>
                        {sig.signature_note && <p className="italic font-sans text-muted-foreground">Catatan: &ldquo;{sig.signature_note}&rdquo;</p>}
                      </div>
                    )}
                    {sig.status === 'rejected' && (
                      <div className="mt-2 text-[11px] text-red-800 dark:text-red-300 font-mono">
                        <p className="flex items-center gap-1.5"><X className="size-3 text-red-600" />Ditolak: {sig.signature_note || 'Tidak disetujui'}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Embedded Live PDF Document Preview */}
          <div className="mt-6 rounded-2xl border border-indigo-200/80 bg-slate-900/5 p-4 dark:border-indigo-900/50">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-indigo-600" />
                <span className="text-xs font-bold text-foreground">
                  Pratinjau Dokumen PDF Resmi (Single Form — Siap Cetak &amp; Arsip)
                </span>
              </div>
              <a
                href={`${API_BASE_PATH}/api/it-form-submissions/${submissionResult.id}/pdf?token=${submissionResult.token}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                <ExternalLink className="size-3" />
                <span>Buka Layar Penuh</span>
              </a>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-inner">
              <iframe
                src={`${API_BASE_PATH}/api/it-form-submissions/${submissionResult.id}/pdf?token=${submissionResult.token}#toolbar=0&navpanes=0`}
                className="h-[480px] w-full rounded-xl bg-white"
                title={`Formulir Registrasi Fingerprint ${submissionResult.request_no}`}
              />
            </div>
          </div>

          {/* Status Alur Pengesahan Pejabat (Official Workflow Status - Read Only) */}
          {submissionResult.status === 'pending' && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5 dark:border-slate-800">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="size-4 text-amber-500" />
                    <span>Status Pengesahan: Menunggu Persetujuan Pejabat Berwenang</span>
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 font-medium">
                    Dokumen ini sedang dalam antrean pengesahan digital oleh pejabat resmi yang ditunjuk.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>MENUNGGU PERSETUJUAN</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Pejabat Penyetuju Resmi (Official Approver)
                  </span>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                    <span>
                      {submissionResult.signatures?.find((s) => s.step_number === submissionResult.current_step)?.approver_name || 'Teguh Sunjoyo'}
                    </span>
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700 font-semibold dark:bg-slate-700 dark:text-slate-300">
                      IAA Administrator
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Mekanisme Otorisasi
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Persetujuan sah dilakukan langsung oleh pejabat bersangkutan melalui notifikasi email dinas atau portal Persetujuan Pejabat resmi.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Main Registration Form */}
      {!submissionResult && (
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
                          <option value="__custom__">+ Ketik Seksi Manual / Lainnya...</option>
                        </select>

                        {sectionChoice === '__custom__' && (
                          <input
                            type="text"
                            value={customSection}
                            onChange={(e) => setCustomSection(e.target.value)}
                            placeholder="Ketik nama seksi / bagian..."
                            className="h-10 w-full rounded-xl border border-indigo-300 bg-card px-3 text-xs text-foreground outline-none focus:border-indigo-500 animate-in fade-in"
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
                          className="h-11 w-full rounded-xl border border-input bg-card px-3 text-xs sm:text-sm text-foreground outline-none transition focus:border-indigo-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Info className="size-3.5 text-indigo-600 shrink-0" />
                  <span>
                    Departemen &amp; Seksi di atas akan dicetak pada kolom <strong>DEPARTEMEN/SEKSI</strong> di form resmi PDF: <code className="font-mono text-indigo-600 font-bold">{department}{effectiveSection ? ` / ${effectiveSection}` : ''}</code>
                  </span>
                </p>
              </div>

              {/* Status Karyawan */}
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-bold text-foreground">
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
                        <span>{st === 'Other' ? 'Lainnya / Vendor' : st}</span>
                      </button>
                    )
                  })}
                </div>
                {employeeStatus === 'Other' && (
                  <input
                    type="text"
                    value={otherStatus}
                    onChange={(e) => setOtherStatus(e.target.value)}
                    placeholder="Sebutkan status hubungan kerja..."
                    className="mt-2 h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-indigo-500"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Detail Akses Special Security Area */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-border/70 pb-4 mb-6">
              <div className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-xs">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  2. Area Special Security &amp; Masa Berlaku
                </h3>
                <p className="text-xs text-muted-foreground">
                  Pemilihan zona keamanan khusus yang dimohonkan akses sidik jarinya.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Area Special Security */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-foreground">
                  Area Special Security (入退する特別区画) <span className="text-red-500">*</span>
                </label>
                <select
                  value={areaChoice}
                  onChange={(e) => setAreaChoice(e.target.value)}
                  className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-xs sm:text-sm text-foreground outline-none transition focus:border-indigo-500 font-semibold"
                >
                  {AREA_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {areaChoice === 'Lainnya' && (
                  <input
                    type="text"
                    value={customArea}
                    onChange={(e) => setCustomArea(e.target.value)}
                    placeholder="Sebutkan area khusus..."
                    className="mt-2 h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none focus:border-indigo-500"
                  />
                )}
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
