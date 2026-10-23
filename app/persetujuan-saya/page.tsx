// app/persetujuan-saya/page.tsx
'use client'

// "Persetujuan Saya" (Digital Approval Dashboard):
// Recreated in the ISMS - Digital Approval aesthetic:
// - Modern executive slate-navy top badge and KPI header with counter
// - Status and category filtering tabs
// - 2-Column approval card: Left = Detail Dokumen, Right = Supporting Document (PDF preview)
// - Quick actions: Buka Detail, Catatan Revisi, Tolak, Setujui Langsung

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSignature,
  FileText,
  Filter,
  History,
  Hourglass,
  Info,
  KeyRound,
  Layers,
  Loader2,
  LogIn,
  LogOut,
  Maximize2,
  MessageSquare,
  PenLine,
  QrCode,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ChangePasswordModal } from '@/components/change-password-modal'
import { MyApprovalHistory } from '@/components/approvals/MyApprovalHistory'
import { ApproverReviewModal } from '@/components/approvals/ApproverReviewModal'
import { copyText, readClipboardText } from '@/lib/clipboard'

type Item = {
  stepId: number
  token: string | null
  status: 'pending' | 'waiting' | 'approved' | 'rejected'
  roleCode: string
  roleTitle: string
  signsReview: boolean
  documentId: number
  controlNo: string
  title: string
  revision: number
  kindLabel: string
  sentAt: string | null
  decidedAt: string | null
  waitingFor: string | null
  qrPlaced?: boolean
  code?: string | null
  codeLocked?: boolean
  filePath?: string
  note?: string | null
  uploadedAt?: string | null
  effDate?: string | null
  approverName?: string | null
  // Unified fields:
  category?: 'procedure' | 'it_form' | 'special_area' | 'photo_video'
  actionUrl?: string
  applicantName?: string | null
  department?: string | null
  verificationCode?: string | null
  extraData?: Record<string, unknown> | null
}

type Data = { email: string | null; pending: Item[]; queued: Item[]; recent: Item[] }

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

const waitedDays = (value: string | null | undefined) => (value ? Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000) : 0)

function WhatBadge({ item }: { item: Item }) {
  let categoryChip = (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold border ${
        item.signsReview
          ? 'bg-emerald-500/10 text-emerald-800 border-emerald-500/25 dark:text-emerald-300'
          : 'bg-primary/10 text-primary border-primary/25'
      }`}
    >
      {item.signsReview ? 'Form Review' : 'Dokumen Prosedur'}
    </span>
  )

  if (item.category === 'it_form') {
    categoryChip = (
      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300">
        Form Layanan IT
      </span>
    )
  } else if (item.category === 'special_area') {
    categoryChip = (
      <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-0.5 text-[10.5px] font-bold text-indigo-800 dark:text-indigo-300">
        Izin Area Special
      </span>
    )
  } else if (item.category === 'photo_video') {
    categoryChip = (
      <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 text-[10.5px] font-bold text-purple-800 dark:text-purple-300">
        Izin Foto / Video
      </span>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {categoryChip}
      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10.5px] font-semibold text-secondary-foreground">
        {item.kindLabel}
      </span>
      <span className="font-mono text-[11px] font-semibold text-muted-foreground">
        {item.controlNo} · Rev. {item.revision}
      </span>
      {item.status === 'approved' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <Check className="size-3 text-emerald-700 dark:text-emerald-400" strokeWidth={3} /> Disetujui
        </span>
      )}
    </div>
  )
}

export default function PersetujuanSayaPage() {
  const { sessionUser, isLoading, logout, checkAuth } = useAuth()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Item | null>(null)
  const [reviewModal, setReviewModal] = useState<{ token: string; action?: 'approve' | 'reject' | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [approvalCode, setApprovalCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [passwordOpen, setPasswordOpen] = useState(false)

  // Direct Token Login: auto authenticates approvers whose email matches an account in admins
  const [tokenAuthChecking, setTokenAuthChecking] = useState(false)
  const [tokenAuthMessage, setTokenAuthMessage] = useState<{ ok: boolean; text: string } | null>(null)

  // Tabs: 'pending' (default) | 'queued' | 'recent' | 'all-history'
  const [activeTab, setActiveTab] = useState<'pending' | 'queued' | 'recent' | 'all-history'>('pending')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [decided, setDecided] = useState(0)

  const openApprovalModal = (item: Item, action?: 'approve' | 'reject' | null) => {
    if (action === 'reject') {
      if (item.category === 'procedure' && item.token) {
        setReviewModal({ token: item.token, action: 'reject' })
        return
      }
      if (item.category === 'it_form' && item.token) {
        window.location.href = item.actionUrl || (item.title?.includes('ISMS-F-02-00-002') ? `/registrasi-fingerprint?token=${item.token}` : `/form-it-esign?token=${item.token}`)
        return
      }
      if (item.category === 'special_area' && item.token) {
        window.location.href = `/persetujuan-area-special?token=${item.token}&action=reject`
        return
      }
      if (item.category === 'photo_video' && item.token) {
        window.location.href = `/konfirmasi-approval?token=${item.token}&action=reject`
        return
      }
    }

    if (action === 'approve') {
      setNotice(null)
      setConfirm(item)
      setCodeError(null)
      setCopiedCode(false)
      setApprovalCode(item.code ? item.code.trim() : '')
      return
    }

    // Default open detail
    if (item.category === 'it_form') {
      window.location.href = item.actionUrl || (item.title?.includes('ISMS-F-02-00-002') ? `/registrasi-fingerprint?token=${item.token}` : `/form-it-esign?token=${item.token}`)
      return
    }
    if (item.category === 'special_area') {
      window.location.href = `/persetujuan-area-special?token=${item.token}`
      return
    }
    if (item.category === 'photo_video') {
      window.location.href = `/konfirmasi-approval?token=${item.token}`
      return
    }

    if (item.token) {
      setReviewModal({ token: item.token, action: null })
      return
    }
    setNotice(null)
    setConfirm(item)
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api/my-approvals`, { cache: 'no-store', credentials: 'include' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message)
      setData(body)
      setError(null)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal memuat daftar persetujuan.')
    }
  }, [])

  useEffect(() => {
    if (sessionUser) load()
    else setData(null)
  }, [sessionUser, load])

  useEffect(() => {
    if (!sessionUser) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 30_000)
    window.addEventListener('focus', load)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [sessionUser, load])

  // Direct Token Login: If opened via email link with ?token=..., authenticate matching admin automatically
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) return

    let cancelled = false
    setTokenAuthChecking(true)

    fetch(`${API_BASE_PATH}/api/auth/approver-token-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (cancelled) return

        if (res.ok && body?.success && body?.admin) {
          setTokenAuthMessage({
            ok: true,
            text: `Terhubung otomatis sebagai ${body.admin.username} (${body.matchedEmail}) melalui link persetujuan email.`,
          })
          await checkAuth()
        } else if (body?.matchedEmail) {
          setTokenAuthMessage({
            ok: false,
            text: `Email notifikasi persetujuan (${body.matchedEmail}) belum terdaftar pada akun ISMS. Silakan masuk manual dengan akun Anda atau hubungi Admin ISMS.`,
          })
        } else if (body?.message) {
          setTokenAuthMessage({
            ok: false,
            text: body.message,
          })
        }
      })
      .catch((err) => {
        console.error('[persetujuan-saya/token-login]', err)
      })
      .finally(() => {
        if (!cancelled) setTokenAuthChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [checkAuth])

  // If opened with ?stepId=... or ?token=..., automatically open the approval modal for that step
  useEffect(() => {
    if (!data?.pending?.length) return
    const params = new URLSearchParams(window.location.search)
    const targetStep = params.get('stepId')
    const targetToken = params.get('token')
    if (targetStep) {
      const item = data.pending.find((p) => String(p.stepId) === targetStep)
      if (item) {
        openApprovalModal(item, 'approve')
      }
    } else if (targetToken) {
      const item = data.pending.find((p) => p.token === targetToken)
      if (item) {
        openApprovalModal(item, null)
      }
    }
  }, [data])

  const approve = async () => {
    if (!confirm) return false
    setBusy(true)
    setNotice(null)
    setCodeError(null)
    try {
      if (confirm.category === 'it_form') {
        const res = await fetch(`${API_BASE_PATH}/api/it-form-submissions/${confirm.documentId}/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            step_number: confirm.revision,
            decision: 'approve',
            approver_name: confirm.approverName || sessionUser?.username || 'Approver',
            signature_note: 'Disetujui via Dashboard Approval',
          }),
        })
        const body = await res.json().catch(() => null)
        if (!res.ok) {
          setNotice({ ok: false, text: body?.error ?? body?.message ?? 'Gagal memproses persetujuan form IT.' })
          return false
        }
        setNotice({ ok: true, text: `Formulir IT (${confirm.controlNo}) berhasil disetujui & ditandatangani digital.` })
        setConfirm(null)
        setDecided((n) => n + 1)
        await load()
        return true
      }

      if (confirm.category === 'special_area') {
        const res = await fetch(`${API_BASE_PATH}/api/special-area-requests/approval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token: confirm.token, action: 'approve' }),
        })
        const body = await res.json().catch(() => null)
        if (!res.ok) {
          setNotice({ ok: false, text: body?.message ?? 'Gagal memproses persetujuan Area Special.' })
          return false
        }
        setNotice({ ok: true, text: `Izin Area Special (${confirm.controlNo}) berhasil disetujui.` })
        setConfirm(null)
        setDecided((n) => n + 1)
        await load()
        return true
      }

      if (confirm.category === 'photo_video') {
        const res = await fetch(`${API_BASE_PATH}/api/photo-video-requests/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token: confirm.token, action: 'approve' }),
        })
        const body = await res.json().catch(() => null)
        if (!res.ok) {
          setNotice({ ok: false, text: body?.message ?? 'Gagal memproses persetujuan Foto/Video.' })
          return false
        }
        setNotice({ ok: true, text: `Izin Foto / Video (${confirm.controlNo}) berhasil disetujui.` })
        setConfirm(null)
        setDecided((n) => n + 1)
        await load()
        return true
      }

      // Default: Prosedur ISMS
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-isms/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: confirm.token, action: 'approve', code: approvalCode }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        if (body?.codeError) setCodeError(body.message ?? 'Kode persetujuan salah.')
        else setNotice({ ok: false, text: body?.message ?? 'Gagal memproses.' })
        return false
      }
      setNotice({ ok: res.ok, text: body?.message ?? (res.ok ? 'Persetujuan tersimpan.' : 'Gagal memproses.') })
      setConfirm(null)
      setApprovalCode('')
      setDecided((n) => n + 1)
      await load()
      return true
    } catch {
      setNotice({ ok: false, text: 'Tidak dapat menghubungi server.' })
      return false
    } finally {
      setBusy(false)
    }
  }

  // Filtered pending items
  const filteredPending = useMemo(() => {
    if (!data?.pending) return []
    let list = data.pending
    if (categoryFilter !== 'all') {
      list = list.filter((item) => {
        if (categoryFilter === 'procedure') return !item.category || item.category === 'procedure'
        return item.category === categoryFilter
      })
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (item) =>
          item.controlNo.toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q) ||
          item.roleTitle.toLowerCase().includes(q) ||
          (item.applicantName && item.applicantName.toLowerCase().includes(q)) ||
          (item.department && item.department.toLowerCase().includes(q))
      )
    }
    return list
  }, [data?.pending, categoryFilter, searchQuery])

  // Category counts
  const categoryCounts = useMemo(() => {
    if (!data?.pending) return { all: 0, procedure: 0, it_form: 0, special_area: 0, photo_video: 0 }
    return {
      all: data.pending.length,
      procedure: data.pending.filter((i) => !i.category || i.category === 'procedure').length,
      it_form: data.pending.filter((i) => i.category === 'it_form').length,
      special_area: data.pending.filter((i) => i.category === 'special_area').length,
      photo_video: data.pending.filter((i) => i.category === 'photo_video').length,
    }
  }, [data?.pending])


  if (isLoading || tokenAuthChecking) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium">
          {tokenAuthChecking
            ? 'Memverifikasi akses persetujuan & menghubungkan akun Anda...'
            : 'Memuat dashboard persetujuan...'}
        </p>
      </div>
    )
  }

  if (!sessionUser) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-10 text-center shadow-sm">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          <ClipboardCheck className="size-8" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold text-foreground">ISMS - Digital Approval</h2>

        {tokenAuthMessage && !tokenAuthMessage.ok && (
          <div className="mt-4 rounded-2xl border border-amber-300/80 bg-amber-50/80 p-4 text-left text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
            <p className="font-bold flex items-center gap-1.5"><Info className="size-4 text-amber-600" /> Akses Langsung Memerlukan Akun:</p>
            <p className="mt-1 leading-relaxed">{tokenAuthMessage.text}</p>
          </div>
        )}

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Masuk dengan akun Approver Anda untuk membuka Dashboard Persetujuan Digital dan memproses seluruh dokumen pengajuan ISMS secara langsung.
        </p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('open-admin-login'))}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:bg-primary/90 active:scale-95"
        >
          <LogIn className="size-4" /> Masuk ke Dashboard
        </button>
        <p className="mt-4 text-xs text-muted-foreground">
          Belum punya akun approver? Hubungi Admin ISMS. Link di email tetap dapat dibuka langsung tanpa perlu login.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top App Header / Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary shadow-xs">
            <ClipboardCheck className="size-4 text-primary" />
            <span>Dashboard Approval</span>
            <span className="rounded-full bg-primary px-2 py-0.2 text-[10.5px] font-bold text-primary-foreground">
              {data ? data.pending.length : 0}
            </span>
          </div>
          <span className="hidden text-xs font-semibold text-foreground/75 sm:inline-block">
            ISMS &middot; Digital Approval
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            title="Muat ulang data"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">Muat ulang</span>
          </button>
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            title="Ganti password"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
          >
            <KeyRound className="size-3.5" />
            <span className="hidden sm:inline">Ganti password</span>
          </button>
          <button
            type="button"
            onClick={() => logout()}
            title="Keluar"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>

      {/* Hero KPI Card (Authentic ISMS Portal Theme) */}
      <header className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white shadow-xs backdrop-blur-sm">
              <ClipboardCheck className="size-3.5 text-white" />
              Sistem Persetujuan Digital ISMS
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
              {data
                ? data.pending.length
                  ? `${data.pending.length} Dokumen Menunggu Persetujuan Anda`
                  : 'Semua Dokumen Telah Selesai Disetujui'
                : 'Memuat antrean...'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/90">
              Masuk sebagai <strong className="font-bold text-white">{sessionUser.username}</strong>
              {data?.email ? <> &middot; alamat email: <strong className="font-bold text-white">{data.email}</strong></> : null}.
              Tinjau isi dokumen, beri catatan revisi atau tanda tangani dokumen secara digital langsung dari dashboard.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          {data && (
            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/25 bg-black/20 p-3.5 backdrop-blur-md">
              <div className="text-center">
                <p className="text-[11px] font-bold text-amber-300">Menunggu</p>
                <p className="font-display text-2xl font-bold text-white">{data.pending.length}</p>
              </div>
              <div className="border-x border-white/20 px-3 text-center">
                <p className="text-[11px] font-bold text-white/90">Antrean</p>
                <p className="font-display text-2xl font-bold text-white">{data.queued.length}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-bold text-emerald-300">Selesai</p>
                <p className="font-display text-2xl font-bold text-white">{data.recent.length}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {tokenAuthMessage && tokenAuthMessage.ok && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>{tokenAuthMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setTokenAuthMessage(null)}
            className="text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Tutup
          </button>
        </div>
      )}

      {error && <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
      {notice && (
        <p
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            notice.ok ? 'border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-destructive/20 bg-destructive/10 text-destructive'
          }`}
        >
          {notice.text}
        </p>
      )}

      {data && !data.email && (
        <p className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Akun ini belum memiliki alamat email yang terdaftar. Minta Admin ISMS untuk menambahkan email pada akun Anda di menu Kelola Admin agar sistem dapat mencocokkan dokumen pengajuan.
        </p>
      )}

      {/* Tab Navigation */}
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === 'pending'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <Clock className="size-3.5" />
              <span>Menunggu Persetujuan</span>
              <span className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${activeTab === 'pending' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
                {data.pending.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('queued')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === 'queued'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <Hourglass className="size-3.5" />
              <span>Belum Giliran</span>
              <span className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${activeTab === 'queued' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
                {data.queued.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('recent')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === 'recent'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <CheckCircle2 className="size-3.5" />
              <span>Riwayat Keputusan Terakhir</span>
              <span className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${activeTab === 'recent' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
                {data.recent.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all-history')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === 'all-history'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <History className="size-3.5" />
              <span>Pencarian Riwayat Lengkap</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      {data && activeTab === 'pending' && (
        <section aria-label="Menunggu persetujuan Anda" className="flex flex-col gap-5">
          {/* Filter Pills and Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                  categoryFilter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                Semua Formulir ({categoryCounts.all})
              </button>
              {categoryCounts.procedure > 0 && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter('procedure')}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                    categoryFilter === 'procedure'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  Prosedur ISMS ({categoryCounts.procedure})
                </button>
              )}
              {categoryCounts.it_form > 0 && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter('it_form')}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                    categoryFilter === 'it_form'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  Form Layanan IT ({categoryCounts.it_form})
                </button>
              )}
              {categoryCounts.special_area > 0 && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter('special_area')}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                    categoryFilter === 'special_area'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  Izin Area Special ({categoryCounts.special_area})
                </button>
              )}
              {categoryCounts.photo_video > 0 && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter('photo_video')}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                    categoryFilter === 'photo_video'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  Izin Foto / Video ({categoryCounts.photo_video})
                </button>
              )}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari no. kontrol, pemohon, judul..."
                className="w-full rounded-full border border-border bg-card py-1.5 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {filteredPending.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/50 py-16 text-center">
              <ClipboardCheck className="mx-auto size-12 text-muted-foreground/50" />
              <h3 className="mt-3 text-base font-semibold text-foreground">Tidak Ada Dokumen yang Menunggu Persetujuan</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {searchQuery || categoryFilter !== 'all'
                  ? 'Tidak ada pengajuan yang cocok dengan filter yang Anda pilih.'
                  : 'Semua dokumen dan formulir telah selesai Anda putuskan.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {filteredPending.map((item) => {
                const days = waitedDays(item.sentAt)
                const isProcedure = !item.category || item.category === 'procedure'
                const isItForm = item.category === 'it_form'
                const isSpecialArea = item.category === 'special_area'
                const isPhotoVideo = item.category === 'photo_video'

                const pdfUrl = isItForm
                  ? `${API_BASE_PATH}/api/it-form-submissions/${item.documentId}/pdf?token=${item.token ?? ''}`
                  : `${API_BASE_PATH}/api/prosedur-isms/${item.documentId}/pdf?token=${item.token ?? ''}${
                      item.signsReview ? '&part=review' : ''
                    }`

                return (
                  <article
                    key={item.stepId}
                    data-testid="my-pending"
                    className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
                  >
                    {/* Card Header Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <WhatBadge item={item} />
                        <span className="text-xs text-muted-foreground">
                          · Diminta {when(item.sentAt)}
                        </span>
                        {days >= 1 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            <Clock className="size-3" /> Menunggu {days} hari
                          </span>
                        )}
                      </div>

                      {/* Top Action Toolbar */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openApprovalModal(item, null)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
                        >
                          <Maximize2 className="size-3.5" />
                          <span>Buka Detail</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openApprovalModal(item, 'reject')}
                          title="Beri catatan revisi atau penolakan pengajuan"
                          className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50/50 px-3.5 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100/80 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                        >
                          <PenLine className="size-3.5" />
                          <span>Catatan Revisi</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openApprovalModal(item, 'reject')}
                          className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700"
                        >
                          <XCircle className="size-3.5" />
                          <span>Tolak</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openApprovalModal(item, 'approve')}
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                        >
                          <CheckCircle2 className="size-3.5" />
                          <span>Setujui</span>
                        </button>
                      </div>
                    </div>

                    {/* Card Interior (2 Columns: Detail Dokumen + Supporting Document) */}
                    <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-12">
                      {/* Left Column: Detail Dokumen */}
                      <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-muted/20 p-4 lg:col-span-5">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                            <Info className="size-4 text-primary" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detail Dokumen / Pengajuan</h4>
                          </div>

                          <div className="space-y-2.5 text-xs">
                            <div>
                              <p className="text-[11px] text-muted-foreground">Judul / Keperluan</p>
                              <p className="font-semibold text-foreground text-sm">{item.title}</p>
                            </div>

                            {item.applicantName && (
                              <div className="grid grid-cols-2 gap-2 rounded-xl bg-card border border-border/60 p-2.5">
                                <div>
                                  <p className="text-[11px] text-muted-foreground">Nama Pemohon</p>
                                  <p className="font-semibold text-foreground">{item.applicantName}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-muted-foreground">Departemen / Instansi</p>
                                  <p className="font-medium text-foreground">{item.department || '-'}</p>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-[11px] text-muted-foreground">No. Kontrol / Registrasi</p>
                                <p className="font-mono font-medium text-foreground">{item.controlNo}</p>
                              </div>
                              <div>
                                <p className="text-[11px] text-muted-foreground">Jenis Formulir</p>
                                <p className="font-medium text-foreground">{item.kindLabel}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-[11px] text-muted-foreground">Jabatan Anda</p>
                                <p className="font-medium text-foreground">{item.roleTitle}</p>
                              </div>
                              <div>
                                <p className="text-[11px] text-muted-foreground">Tanggal Efektif / Diajukan</p>
                                <p className="font-medium text-foreground">
                                  {item.effDate ? new Date(item.effDate).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : when(item.sentAt)}
                                </p>
                              </div>
                            </div>

                            {item.note && (
                              <div className="rounded-xl border border-border bg-card p-2.5">
                                <p className="text-[10.5px] font-medium text-muted-foreground">Catatan / Keterangan:</p>
                                <p className="mt-0.5 text-xs text-foreground leading-relaxed">{item.note}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground flex items-center justify-between">
                          <span>Status: <strong className="font-semibold text-primary">Menunggu keputusan Anda</strong></span>
                          {item.actionUrl && (
                            <Link href={item.actionUrl} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                              <span>Formulir Asli</span>
                              <ExternalLink className="size-3" />
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Right Column: Supporting Document / Preview */}
                      <div className="flex flex-col rounded-2xl border border-border/80 bg-muted/20 p-4 lg:col-span-7">
                        <div className="mb-2.5 flex items-center justify-between border-b border-border/60 pb-2">
                          <div className="flex items-center gap-2">
                            <FileText className="size-4 text-primary" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              {isSpecialArea ? 'Pratinjau Pengajuan Area Special' : isPhotoVideo ? 'Pratinjau Pengajuan Foto/Video' : 'Supporting Document (PDF)'}
                            </h4>
                          </div>
                          <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                            {isSpecialArea ? 'Formulir Digital' : isPhotoVideo ? 'Izin Peliputan' : 'PDF E-Sign'}
                          </span>
                        </div>

                        {/* Embedded PDF iframe or Card Preview */}
                        {isProcedure || isItForm ? (
                          <>
                            <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-inner">
                              <iframe
                                src={`${pdfUrl}#toolbar=0&navpanes=0`}
                                className="h-64 w-full rounded-xl"
                                title={`Supporting Document ${item.controlNo}`}
                              />
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                              {isItForm ? (
                                <Link
                                  href={item.actionUrl || (item.title?.includes('ISMS-F-02-00-002') ? `/registrasi-fingerprint?token=${item.token}` : `/form-it-esign?token=${item.token}`)}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                                >
                                  <Maximize2 className="size-3.5" />
                                  <span>Buka Formulir &amp; Tanda Tangan</span>
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setReviewModal({ token: item.token!, action: null })}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                                >
                                  <Maximize2 className="size-3.5" />
                                  <span>Preview Layar Penuh &amp; Pin Revisi</span>
                                </button>
                              )}

                              <a
                                href={pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
                              >
                                <Download className="size-3.5" />
                                <span>Unduh PDF</span>
                              </a>
                            </div>
                          </>
                        ) : isSpecialArea ? (
                          <div className="flex flex-col justify-between h-full rounded-xl border border-border bg-card p-5">
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <span className="grid size-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                                  <ShieldAlert className="size-5" />
                                </span>
                                <div>
                                  <h4 className="font-bold text-foreground text-sm">{item.title}</h4>
                                  <p className="text-xs text-muted-foreground">Formulir Persetujuan Akses Khusus Ruang Server &amp; Area Kritis</p>
                                </div>
                              </div>
                              <div className="rounded-xl bg-muted/40 p-3 space-y-1.5 text-xs">
                                <p><strong className="text-foreground">Pemohon:</strong> {item.applicantName} ({item.department})</p>
                                <p><strong className="text-foreground">Waktu Kunjungan:</strong> {when(item.effDate)}</p>
                                <p><strong className="text-foreground">Tujuan:</strong> {item.note || '-'}</p>
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Persetujuan terhubung dengan akun Anda</span>
                              <Link
                                href={`/persetujuan-area-special?token=${item.token}`}
                                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
                              >
                                <span>Buka Halaman Persetujuan</span>
                                <ExternalLink className="size-3" />
                              </Link>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col justify-between h-full rounded-xl border border-border bg-card p-5">
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <span className="grid size-10 place-items-center rounded-xl bg-purple-500/15 text-purple-700 dark:text-purple-300">
                                  <FileCheck2 className="size-5" />
                                </span>
                                <div>
                                  <h4 className="font-bold text-foreground text-sm">{item.title}</h4>
                                  <p className="text-xs text-muted-foreground">Izin Pengambilan Foto &amp; Video Visitor Pabrik JAI</p>
                                </div>
                              </div>
                              <div className="rounded-xl bg-muted/40 p-3 space-y-1.5 text-xs">
                                <p><strong className="text-foreground">Pemohon:</strong> {item.applicantName} ({item.department})</p>
                                <p><strong className="text-foreground">Waktu:</strong> {when(item.effDate)}</p>
                                <p><strong className="text-foreground">Tujuan:</strong> {item.note || '-'}</p>
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Persetujuan terhubung dengan akun Anda</span>
                              <Link
                                href={`/konfirmasi-approval?token=${item.token}`}
                                className="inline-flex items-center gap-1.5 rounded-full bg-purple-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-purple-700"
                              >
                                <span>Buka Konfirmasi Approval</span>
                                <ExternalLink className="size-3" />
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Queued Tab */}
      {data && activeTab === 'queued' && (
        <section aria-label="Belum giliran Anda" className="rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <Hourglass className="size-4 text-muted-foreground" />
            <p className="portal-eyebrow">Belum giliran Anda</p>
            <span className="ml-auto rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
              {data.queued.length}
            </span>
          </div>
          {data.queued.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">Tidak ada dokumen atau formulir yang sedang mengantre di tahap sebelum Anda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.queued.map((item) => (
                <li key={item.stepId} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <WhatBadge item={item} />
                    <p className="mt-1.5 font-semibold text-foreground">{item.title}</p>
                    {item.applicantName && (
                      <p className="text-xs text-foreground/80 mt-0.5">Pemohon: <span className="font-medium text-foreground">{item.applicantName}</span> {item.department ? `(${item.department})` : ''}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.waitingFor ? (
                        <>
                          Menunggu persetujuan <strong className="text-foreground">{item.waitingFor}</strong> lebih dulu.
                        </>
                      ) : (
                        'Menunggu approver sebelum Anda.'
                      )}{' '}
                      Pengajuan akan otomatis berpindah ke tab Menunggu Persetujuan saat tiba giliran Anda.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 self-start rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground sm:self-center">
                    <Clock className="size-3" /> Mengantre
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Recent Decided Tab */}
      {data && activeTab === 'recent' && (
        <section aria-label="Terakhir Anda putuskan" className="rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <p className="portal-eyebrow">Terakhir Anda putuskan</p>
            <span className="ml-auto rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
              {data.recent.length}
            </span>
          </div>
          {data.recent.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">Belum ada dokumen atau formulir yang Anda putuskan baru-baru ini.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.recent.map((item) => (
                <li key={item.stepId} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div
                    className={`min-w-0 ${item.actionUrl || item.token ? 'cursor-pointer hover:opacity-90' : ''}`}
                    onClick={() => {
                      if (item.category === 'procedure' && item.token) setReviewModal({ token: item.token, action: null })
                      else if (item.actionUrl) {
                        const target = item.actionUrl.startsWith('http') || item.actionUrl.startsWith(API_BASE_PATH)
                          ? item.actionUrl
                          : `${API_BASE_PATH}${item.actionUrl}`
                        window.open(target, '_blank')
                      }
                    }}
                  >
                    <WhatBadge item={item} />
                    <p className="mt-1.5 font-semibold text-foreground">{item.title}</p>
                    {item.applicantName && (
                      <p className="text-xs text-foreground/80 mt-0.5">Pemohon: <span className="font-medium text-foreground">{item.applicantName}</span> {item.department ? `(${item.department})` : ''}</p>
                    )}
                    {item.status === 'approved' && item.qrPlaced === false && (
                      <p className="mt-1.5 inline-flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs leading-5 text-amber-800 dark:text-amber-300" data-testid="qr-pending">
                        <QrCode className="mt-0.5 size-3.5 flex-none" />
                        <span>
                          Persetujuan Anda sudah tercatat. QR tanda tangan Anda <strong>belum ditempatkan oleh Admin ISMS</strong> — sampai itu dilakukan, dokumen masih tampil tanpa QR.
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2.5 text-xs">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                        item.status === 'approved' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {item.status === 'approved' ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                      {item.status === 'approved' ? 'Disetujui' : 'Minta revisi'}
                    </span>
                    <span className="text-muted-foreground">{when(item.decidedAt)}</span>
                    {item.filePath && (
                      <a
                        href={item.filePath.startsWith('http') || item.filePath.startsWith(API_BASE_PATH) ? item.filePath : `${API_BASE_PATH}${item.filePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-foreground transition hover:bg-secondary"
                        title="Unduh / Lihat PDF Resmi"
                      >
                        <Download className="size-3" />
                        <span>PDF</span>
                      </a>
                    )}
                    {item.actionUrl ? (
                      <a
                        href={item.actionUrl.startsWith('http') || item.actionUrl.startsWith(API_BASE_PATH) ? item.actionUrl : `${API_BASE_PATH}${item.actionUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                      >
                        Lihat <ExternalLink className="size-3" />
                      </a>
                    ) : item.token ? (
                      <button
                        type="button"
                        onClick={() => setReviewModal({ token: item.token!, action: null })}
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                      >
                        Lihat <ExternalLink className="size-3" />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Full History Tab */}
      {data && activeTab === 'all-history' && (
        <section aria-label="Riwayat lengkap persetujuan">
          <MyApprovalHistory refreshKey={decided} />
        </section>
      )}

      {/* Confirm Direct Approval Modal */}
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.category === 'it_form'
            ? `Setujui Formulir IT (${confirm.controlNo})?`
            : confirm?.category === 'special_area'
            ? `Setujui Izin Area Special (${confirm.controlNo})?`
            : confirm?.category === 'photo_video'
            ? `Setujui Izin Foto / Video (${confirm.controlNo})?`
            : confirm?.signsReview
            ? 'Setujui Form Review ini?'
            : 'Setujui dokumen ini?'
        }
        message={
          confirm
            ? `${confirm.controlNo} — ${confirm.title}. Anda menyetujui sebagai ${confirm.roleTitle}.${
                confirm.applicantName ? ` Pemohon: ${confirm.applicantName}.` : ''
              } Tanda tangan elektronik Anda resmi akan langsung disahkan pada formulir/dokumen ini.`
            : ''
        }
        confirmLabel="Ya, Setujui Sekarang"
        danger={false}
        pending={busy}
        confirmDisabled={busy}
        onConfirm={approve}
        onCancel={() => {
          setConfirm(null)
          setApprovalCode('')
          setCodeError(null)
          setCopiedCode(false)
        }}
      >
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-50/10 p-4 text-xs leading-relaxed text-foreground">
          <p className="font-semibold text-emerald-800 dark:text-emerald-400">
            Pengesahan Tanda Tangan Digital Resmi
          </p>
          <p className="mt-1 text-muted-foreground">
            Karena Anda telah masuk ke akun resmi Approver ({data?.email}), tanda tangan elektronik digital (QR E-Sign) Anda akan langsung dibubuhkan resmi pada pengajuan ini selaku <strong className="text-foreground">{confirm?.roleTitle}</strong>.
          </p>
        </div>
      </ConfirmDialog>


      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} />}

      {reviewModal && (
        <ApproverReviewModal
          token={reviewModal.token}
          initialAction={reviewModal.action}
          onClose={() => setReviewModal(null)}
          onDecided={() => {
            setDecided((n) => n + 1)
            load()
          }}
        />
      )}
    </div>
  )
}
