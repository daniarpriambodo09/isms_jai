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
}

type Data = { email: string | null; pending: Item[]; queued: Item[]; recent: Item[] }

const when = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

const waitedDays = (value: string | null) => (value ? Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000) : 0)

function WhatBadge({ item }: { item: Item }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold border ${
          item.signsReview
            ? 'bg-emerald-500/10 text-emerald-800 border-emerald-500/25 dark:text-emerald-300'
            : 'bg-primary/10 text-primary border-primary/25'
        }`}
      >
        {item.signsReview ? 'Form Review' : 'Dokumen Prosedur'}
      </span>
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
  const { sessionUser, isLoading, logout } = useAuth()
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

  // Tabs: 'pending' (default) | 'queued' | 'recent' | 'all-history'
  const [activeTab, setActiveTab] = useState<'pending' | 'queued' | 'recent' | 'all-history'>('pending')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [decided, setDecided] = useState(0)

  const openApprovalModal = (item: Item, action?: 'approve' | 'reject' | null) => {
    if (action === 'reject' && item.token) {
      setReviewModal({ token: item.token, action: 'reject' })
      return
    }
    if (action === 'approve') {
      setNotice(null)
      setConfirm(item)
      setCodeError(null)
      setCopiedCode(false)
      setApprovalCode(item.code ? item.code.trim() : '')
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

  // If opened with ?stepId=..., automatically open the approval modal for that step
  useEffect(() => {
    if (!data?.pending?.length) return
    const params = new URLSearchParams(window.location.search)
    const targetStep = params.get('stepId')
    if (targetStep) {
      const item = data.pending.find((p) => String(p.stepId) === targetStep)
      if (item) {
        openApprovalModal(item, 'approve')
      }
    }
  }, [data])

  const approve = async () => {
    if (!confirm?.token) return false
    setBusy(true)
    setNotice(null)
    setCodeError(null)
    try {
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
      list = list.filter((item) => (item.signsReview ? 'Form Review' : item.kindLabel) === categoryFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((item) => item.controlNo.toLowerCase().includes(q) || item.title.toLowerCase().includes(q) || item.roleTitle.toLowerCase().includes(q))
    }
    return list
  }, [data?.pending, categoryFilter, searchQuery])

  // Available categories in pending list
  const pendingCategories = useMemo(() => {
    if (!data?.pending) return []
    const set = new Set<string>()
    for (const item of data.pending) {
      set.add(item.signsReview ? 'Form Review' : item.kindLabel)
    }
    return Array.from(set)
  }, [data?.pending])

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="size-7 animate-spin" />
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
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
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
          Belum punya akun approver? Hubungi Admin ISM. Link di email tetap dapat dibuka langsung tanpa perlu login.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top App Header / Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary shadow-xs">
            <ClipboardCheck className="size-4" />
            <span>Dashboard Approval</span>
            <span className="rounded-full bg-primary px-2 py-0.2 text-[10.5px] font-bold text-primary-foreground">
              {data ? data.pending.length : 0}
            </span>
          </div>
          <span className="hidden font-mono text-xs text-muted-foreground sm:inline-block">
            ISMS - Digital Approval
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
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/20 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-foreground">
              <ClipboardCheck className="size-3.5 text-accent" />
              Sistem Persetujuan Digital ISMS
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-primary-foreground sm:text-3xl md:text-4xl">
              {data
                ? data.pending.length
                  ? `${data.pending.length} Dokumen Menunggu Persetujuan Anda`
                  : 'Semua Dokumen Telah Selesai Disetujui'
                : 'Memuat antrean...'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-primary-foreground/80">
              Masuk sebagai <strong className="font-semibold text-primary-foreground">{sessionUser.username}</strong>
              {data?.email ? <> · alamat email: <strong className="font-semibold text-primary-foreground">{data.email}</strong></> : null}.
              Tinjau isi dokumen, beri catatan revisi atau tanda tangani dokumen secara digital langsung dari dashboard.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          {data && (
            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-3.5 backdrop-blur-md">
              <div className="text-center">
                <p className="text-[11px] font-semibold text-accent">Menunggu</p>
                <p className="font-display text-2xl font-bold text-primary-foreground">{data.pending.length}</p>
              </div>
              <div className="border-x border-primary-foreground/20 px-3 text-center">
                <p className="text-[11px] font-semibold text-primary-foreground/80">Antrean</p>
                <p className="font-display text-2xl font-bold text-primary-foreground">{data.queued.length}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-semibold text-emerald-300">Selesai</p>
                <p className="font-display text-2xl font-bold text-primary-foreground">{data.recent.length}</p>
              </div>
            </div>
          )}
        </div>
      </header>

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
          Akun ini belum memiliki alamat email yang terdaftar. Minta Admin ISM untuk menambahkan email pada akun Anda di menu Kelola Admin agar sistem dapat mencocokkan dokumen pengajuan.
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
                Semua ({data.pending.length})
              </button>
              {pendingCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                    categoryFilter === cat
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari no. kontrol atau judul..."
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
                  ? 'Tidak ada dokumen yang cocok dengan filter yang Anda pilih.'
                  : 'Semua dokumen telah selesai Anda putuskan.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {filteredPending.map((item) => {
                const days = waitedDays(item.sentAt)
                const pdfUrl = `${API_BASE_PATH}/api/prosedur-isms/${item.documentId}/pdf?token=${item.token ?? ''}${
                  item.signsReview ? '&part=review' : ''
                }`

                return (
                  <article
                    key={item.stepId}
                    data-testid="my-pending"
                    className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
                  >
                    {/* Card Header Toolbar (ISMS Style) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                            item.signsReview
                              ? 'bg-emerald-500/10 text-emerald-800 border-emerald-500/25 dark:text-emerald-300'
                              : 'bg-primary/10 text-primary border-primary/25'
                          }`}
                        >
                          {item.signsReview ? 'Form Review' : 'Dokumen Prosedur'}
                        </span>
                        <span className="font-mono text-sm font-bold text-foreground">
                          {item.controlNo}
                        </span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-secondary-foreground">
                          Rev. {item.revision}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          · Diminta {when(item.sentAt)}
                        </span>
                        {days >= 1 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            ⏳ Menunggu {days} hari
                          </span>
                        )}
                      </div>

                      {/* Top Action Toolbar */}
                      <div className="flex flex-wrap items-center gap-2">
                        {item.token ? (
                          <button
                            type="button"
                            onClick={() => setReviewModal({ token: item.token!, action: null })}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
                          >
                            <Maximize2 className="size-3.5" />
                            <span>Buka Detail</span>
                          </button>
                        ) : (
                          <Link
                            href={`/pengesahan?stepId=${item.stepId}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
                          >
                            <Maximize2 className="size-3.5" />
                            <span>Buka Detail</span>
                          </Link>
                        )}

                        {item.token ? (
                          <button
                            type="button"
                            onClick={() => setReviewModal({ token: item.token!, action: 'reject' })}
                            title="Buka dokumen dan tandai catatan revisi dengan sticky pin"
                            className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50/50 px-3.5 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100/80 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                          >
                            <PenLine className="size-3.5" />
                            <span>Catatan Revisi</span>
                          </button>
                        ) : (
                          <Link
                            href={`/pengesahan?stepId=${item.stepId}`}
                            title="Buka dokumen untuk meminta revisi"
                            className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50/50 px-3.5 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100/80 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                          >
                            <PenLine className="size-3.5" />
                            <span>Catatan Revisi</span>
                          </Link>
                        )}

                        <button
                          type="button"
                          onClick={() => setReviewModal({ token: item.token!, action: 'reject' })}
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
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detail Dokumen</h4>
                          </div>

                          <div className="space-y-2 text-xs">
                            <div>
                              <p className="text-[11px] text-muted-foreground">Judul Dokumen</p>
                              <p className="font-semibold text-foreground">{item.title}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-[11px] text-muted-foreground">No. Kontrol</p>
                                <p className="font-mono font-medium text-foreground">{item.controlNo}</p>
                              </div>
                              <div>
                                <p className="text-[11px] text-muted-foreground">Jenis Register</p>
                                <p className="font-medium text-foreground">{item.kindLabel}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-[11px] text-muted-foreground">Jabatan Anda</p>
                                <p className="font-medium text-foreground">{item.roleTitle}</p>
                              </div>
                              <div>
                                <p className="text-[11px] text-muted-foreground">Tanggal Efektif</p>
                                <p className="font-medium text-foreground">
                                  {item.effDate ? new Date(item.effDate).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : 'Otomatis approver akhir'}
                                </p>
                              </div>
                            </div>
                            {item.note && (
                              <div className="rounded-xl border border-border bg-card p-2.5">
                                <p className="text-[10.5px] font-medium text-muted-foreground">Catatan Pengajuan:</p>
                                <p className="mt-0.5 text-xs text-foreground">{item.note}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                          Status: <span className="font-semibold text-primary">Menunggu keputusan Anda</span>
                        </div>
                      </div>

                      {/* Right Column: Supporting Document (PDF Viewer / Preview) */}
                      <div className="flex flex-col rounded-2xl border border-border/80 bg-muted/20 p-4 lg:col-span-7">
                        <div className="mb-2.5 flex items-center justify-between border-b border-border/60 pb-2">
                          <div className="flex items-center gap-2">
                            <FileText className="size-4 text-primary" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Supporting Document</h4>
                          </div>
                          <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                            PDF Lampiran
                          </span>
                        </div>

                        {/* Embedded PDF iframe */}
                        <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-inner">
                          <iframe
                            src={`${pdfUrl}#toolbar=0&navpanes=0`}
                            className="h-60 w-full rounded-xl"
                            title={`Supporting Document ${item.controlNo}`}
                          />
                        </div>

                        {/* Preview Actions */}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setReviewModal({ token: item.token!, action: null })}
                            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                          >
                            <Maximize2 className="size-3.5" />
                            <span>Preview Layar Penuh &amp; Pin Revisi</span>
                          </button>

                          <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
                          >
                            <Download className="size-3.5" />
                            <span>Unduh File PDF</span>
                          </a>
                        </div>
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
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">Tidak ada dokumen yang sedang mengantre di tahap sebelum Anda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.queued.map((item) => (
                <li key={item.stepId} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <WhatBadge item={item} />
                    <p className="mt-1.5 font-semibold text-foreground">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.waitingFor ? (
                        <>
                          Menunggu persetujuan <strong className="text-foreground">{item.waitingFor}</strong> lebih dulu.
                        </>
                      ) : (
                        'Menunggu approver sebelum Anda.'
                      )}{' '}
                      Dokumen akan otomatis berpindah ke tab Menunggu Persetujuan saat tiba giliran Anda.
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
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">Belum ada dokumen yang Anda putuskan baru-baru ini.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.recent.map((item) => (
                <li key={item.stepId} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div
                    className={`min-w-0 ${item.token ? 'cursor-pointer hover:opacity-90' : ''}`}
                    onClick={() => {
                      if (item.token) setReviewModal({ token: item.token, action: null })
                    }}
                  >
                    <WhatBadge item={item} />
                    <p className="mt-1.5 font-semibold text-foreground">{item.title}</p>
                    {item.status === 'approved' && item.qrPlaced === false && (
                      <p className="mt-1.5 inline-flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs leading-5 text-amber-800 dark:text-amber-300" data-testid="qr-pending">
                        <QrCode className="mt-0.5 size-3.5 flex-none" />
                        <span>
                          Persetujuan Anda sudah tercatat. QR tanda tangan Anda <strong>belum ditempatkan oleh Admin ISM</strong> — sampai itu dilakukan, dokumen masih tampil tanpa QR.
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3 text-xs">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                        item.status === 'approved' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {item.status === 'approved' ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                      {item.status === 'approved' ? 'Disetujui' : 'Minta revisi'}
                    </span>
                    <span className="text-muted-foreground">{when(item.decidedAt)}</span>
                    {item.token ? (
                      <button
                        type="button"
                        onClick={() => setReviewModal({ token: item.token!, action: null })}
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                      >
                        Lihat <ExternalLink className="size-3" />
                      </button>
                    ) : (
                      <a
                        href={`${API_BASE_PATH}/api/prosedur-isms/${item.documentId}/pdf?token=${item.token ?? ''}${item.signsReview ? '&part=review' : ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                      >
                        Lihat <ExternalLink className="size-3" />
                      </a>
                    )}
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
        title={confirm?.signsReview ? 'Setujui Form Review ini?' : 'Setujui dokumen ini?'}
        message={
          confirm
            ? `${confirm.controlNo} — ${confirm.title}. Anda menyetujui sebagai ${confirm.roleTitle}. Tanda tangan elektronik Anda (QR E-Sign) resmi akan langsung disahkan pada dokumen ini.`
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
            Karena Anda telah masuk ke akun resmi Approver, tanda tangan elektronik digital (QR E-Sign) Anda akan langsung dibubuhkan pada dokumen ini selaku <strong className="text-foreground">{confirm?.roleTitle}</strong>.
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
