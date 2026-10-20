// components/approvals/ApproverReviewModal.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardPaste,
  Clock,
  Copy,
  ExternalLink,
  FileSignature,
  FileText,
  Gauge,
  History,
  Loader2,
  LogOut,
  PencilLine,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { docKindInfo } from '@/lib/document-kinds'
import { copyText, readClipboardText } from '@/lib/clipboard'
import { SignatureCard } from '@/components/documents/SignatureQr'
import { RevisionHistoryList, hasHistory, type HistoryRequest, type RevisionHistoryData } from '@/components/documents/RevisionHistory'

type Step = {
  id: number
  role_code: string
  role_title: string
  step: number
  status: 'waiting' | 'pending' | 'approved' | 'rejected' | 'cancelled'
  approver_name: string | null
  decided_at: string | null
  decision_note: string | null
  verification_code: string | null
}

type View = {
  step: Step
  document: {
    kind?: string
    control_no: string
    title: string
    revision: number
    elf_date: string
    note: string | null
    file_path: string
    has_review_form?: boolean
    signs_review?: boolean
  }
  cycle: Step[]
  part?: { index: number; total: number }
  superseded: boolean
  linkExpired: boolean
  linkValidDays: number
  qrAutoPlaced?: boolean
  codeRequired?: boolean
  codeLocked?: boolean
  signedIn?: boolean
  codeValue?: string | null
  documentId: number
  verifyBase: string
  revisionRequest: HistoryRequest | null
  history: RevisionHistoryData | null
}

function formatDate(value: string, withTime = false) {
  return new Date(value).toLocaleString('id-ID', withTime ? { dateStyle: 'long', timeStyle: 'short' } : { dateStyle: 'long' })
}

const STEP_LABEL: Record<Step['status'], string> = {
  approved: 'Disetujui',
  pending: 'Menunggu',
  rejected: 'Minta revisi',
  waiting: 'Antri',
  cancelled: 'Dibatalkan',
}

function StepIcon({ status }: { status: Step['status'] }) {
  if (status === 'approved') return <span className="grid size-7 place-items-center rounded-full bg-emerald-600 text-white"><Check className="size-3.5" strokeWidth={3} /></span>
  if (status === 'rejected') return <span className="grid size-7 place-items-center rounded-full bg-[#c2412c] text-white"><PencilLine className="size-3.5" /></span>
  if (status === 'pending') return <span className="grid size-7 animate-pulse place-items-center rounded-full bg-amber-400 text-amber-950"><Clock className="size-3.5" /></span>
  return <span className="grid size-7 place-items-center rounded-full border-2 border-dashed border-border text-muted-foreground"><span className="size-1.5 rounded-full bg-current" /></span>
}

export function ApproverReviewModal({
  token,
  initialAction,
  onClose,
  onDecided,
}: {
  token: string
  initialAction?: 'approve' | 'reject' | null
  onClose: () => void
  onDecided: () => void
}) {
  useEscapeClose(true, onClose)
  const { sessionUser, logout } = useAuth()

  const [view, setView] = useState<View | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [docTab, setDocTab] = useState<'document' | 'review'>('document')
  const [activeAction, setActiveAction] = useState<'approve' | 'reject' | null>(initialAction ?? null)
  const [approvalCode, setApprovalCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [revisionNote, setRevisionNote] = useState('')
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const setCodeFromText = (value: string) => {
    setApprovalCode(value.replace(/\D/g, '').slice(0, 6))
    setCodeError(null)
  }

  const copyCode = async (code: string) => {
    const ok = await copyText(code)
    if (ok) {
      setCopiedCode(true)
      window.setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const pasteApprovalCode = async () => {
    const text = await readClipboardText()
    if (text) {
      const digits = text.replace(/\D/g, '').slice(0, 6)
      if (digits) {
        setCodeFromText(digits)
        return
      }
    }
    setCodeError('Clipboard tidak dapat dibaca otomatis. Silakan tekan Ctrl+V di kolom input.')
  }

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-isms/approval?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Gagal memuat dokumen pengesahan.')
      setView(data)
      if (data.codeValue) {
        setApprovalCode(data.codeValue.trim())
      }
      if (data.document?.signs_review) {
        setDocTab('review')
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Gagal memuat dokumen.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const submitApprove = async () => {
    setSubmitting('approve')
    setCodeError(null)
    setResult(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-isms/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, action: 'approve', code: approvalCode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.codeError) setCodeError(data.message ?? 'Kode persetujuan salah.')
        else setResult({ ok: false, message: data.message ?? 'Gagal memproses persetujuan.' })
        return
      }
      setResult({ ok: true, message: data.message ?? 'Dokumen telah berhasil disetujui.' })
      window.setTimeout(() => {
        onDecided()
        onClose()
      }, 1200)
    } catch {
      setResult({ ok: false, message: 'Tidak dapat menghubungi server.' })
    } finally {
      setSubmitting(null)
    }
  }

  const submitReject = async () => {
    if (!revisionNote.trim()) {
      setResult({ ok: false, message: 'Mohon isi catatan perbaikan/revisi yang diperlukan.' })
      return
    }
    setSubmitting('reject')
    setResult(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-isms/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, action: 'reject', note: revisionNote.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setResult({ ok: false, message: data.message ?? 'Gagal memproses permohonan revisi.' })
        return
      }
      setResult({ ok: true, message: data.message ?? 'Permintaan revisi telah berhasil dikirim.' })
      window.setTimeout(() => {
        onDecided()
        onClose()
      }, 1200)
    } catch {
      setResult({ ok: false, message: 'Tidak dapat menghubungi server.' })
    } finally {
      setSubmitting(null)
    }
  }

  const tokenParam = `token=${encodeURIComponent(token)}`
  const showingReview = docTab === 'review' && !!view?.document.has_review_form
  const signedUrl = view ? `${API_BASE_PATH}/api/prosedur-isms/${view.documentId}/pdf?${tokenParam}${showingReview ? '&part=review' : ''}` : ''
  const originalUrl = view ? `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(view.document.file_path)}&${tokenParam}` : ''
  const canDecide = view?.step.status === 'pending' && !view.superseded && !view.linkExpired

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Proses Pengesahan Dokumen"
        onClick={(e) => e.stopPropagation()}
        className="flex h-[95vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[color:var(--p-900)] px-5 py-3 text-primary-foreground">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 flex-none place-items-center rounded-xl bg-white/10 text-accent">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-mono-label text-[10px] text-accent">
                {view ? docKindInfo(view.document.kind).label : 'Memuat…'}
                {view?.part && ` · Tahap ${view.part.index} dari ${view.part.total}`}
              </p>
              <h2 className="truncate text-base font-bold text-white sm:text-lg">
                {view ? view.document.title : 'Pengesahan Dokumen'}
              </h2>
            </div>
            {view && (
              <div className="hidden flex-wrap items-center gap-2 font-mono text-[11px] md:flex">
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-white/90">{view.document.control_no}</span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-white/90">Rev. {view.document.revision}</span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-white/90">Eff {formatDate(view.document.elf_date)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/pengesahan?token=${token}`}
              target="_blank"
              title="Buka halaman penuh di tab baru"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              Halaman Penuh <ExternalLink className="size-3.5" />
            </Link>
            {sessionUser && (
              <button
                type="button"
                onClick={async () => {
                  await logout()
                  onClose()
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300/40 bg-red-500/20 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500/30"
                title="Keluar dari akun Anda"
              >
                <LogOut className="size-3.5" />
                <span>Log Out</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup dialog"
              className="grid size-8 place-items-center rounded-full text-white/70 hover:bg-white/15 hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="grid flex-1 place-items-center py-24 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            <p className="mt-2 text-sm">Memuat dokumen pengesahan…</p>
          </div>
        ) : loadError ? (
          <div className="m-auto max-w-md rounded-2xl border border-destructive/20 bg-destructive/10 p-8 text-center text-destructive">
            <X className="mx-auto size-10" />
            <p className="mt-3 font-semibold">{loadError}</p>
            <button type="button" onClick={onClose} className="mt-4 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
              Tutup
            </button>
          </div>
        ) : view ? (
          <div className="grid flex-1 overflow-hidden lg:grid-cols-[1fr_390px] xl:grid-cols-[1fr_420px]">
            {/* Left Column: PDF Viewer */}
            <div className="flex flex-col border-b border-border lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/30 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {view.document.has_review_form ? (
                    <div role="tablist" aria-label="File yang disahkan" className="inline-flex rounded-full border border-border bg-card p-0.5 shadow-sm">
                      {(['document', 'review'] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          role="tab"
                          aria-selected={docTab === tab}
                          onClick={() => setDocTab(tab)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${docTab === tab ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          <FileText className="size-3.5" /> {tab === 'document' ? 'Dokumen' : 'Form Review'}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <FileText className="size-3.5 text-primary" /> Dokumen Utama
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {!showingReview && (
                    <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">
                      File asli
                    </a>
                  )}
                  <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    Buka PDF <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
              <div className="flex-1 bg-muted/40">
                <iframe
                  src={signedUrl}
                  title={view.document.title}
                  className="h-full min-h-[420px] w-full border-0 bg-muted"
                />
              </div>
            </div>

            {/* Right Column: Approval Chain, Decision Panel, Revision History */}
            <div className="flex flex-col overflow-y-auto bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-4">
                {/* Status Notice if any */}
                {result && (
                  <p className={`rounded-xl border px-4 py-3 text-xs font-medium ${result.ok ? 'border-emerald-600/30 bg-emerald-50 text-emerald-800' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
                    {result.message}
                  </p>
                )}

                {/* Catatan Pengesahan (Chain) */}
                <section className="rounded-2xl border border-border bg-secondary/15 p-4 shadow-sm">
                  <p className="portal-eyebrow text-[10.5px]">Catatan Pengesahan</p>
                  <ol className="mt-3 flex flex-col">
                    {view.cycle.map((item, i) => (
                      <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                        {i < view.cycle.length - 1 && <span aria-hidden className="absolute left-3.5 top-8 h-[calc(100%-2rem)] w-px bg-border" />}
                        <StepIcon status={item.status} />
                        <div className="min-w-0 pt-0.5">
                          <p className="text-xs font-semibold text-foreground">
                            {item.approver_name}
                            {item.id === view.step.id && (
                              <span className="ml-1.5 rounded-full bg-accent px-2 py-0.5 text-[9.5px] font-bold text-accent-foreground">Anda</span>
                            )}
                            {item.status === 'approved' && (
                              <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-800 align-middle">
                                <Check className="size-3 text-emerald-700" strokeWidth={3} /> Disetujui
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{item.role_title}</p>
                          <p className="mt-0.5 text-[10.5px] font-medium text-foreground/75">
                            {STEP_LABEL[item.status]}{item.decided_at ? ` · ${formatDate(item.decided_at, true)}` : ''}
                          </p>
                          {item.decision_note && (
                            <p className="mt-1 whitespace-pre-line rounded bg-red-50 p-1.5 text-[11px] text-[#a83522]">
                              Revisi: {item.decision_note}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>

                {/* Revision Notes from previous cycle */}
                {view.revisionRequest && (
                  <section className="rounded-xl border border-[#c2412c]/30 bg-[#fdf6f3] p-3.5 text-xs">
                    <p className="flex items-center gap-1.5 font-mono-label text-[10px] text-[#a83522]">
                      <PencilLine className="size-3.5" /> Catatan revisi sebelumnya
                    </p>
                    <p className="mt-1.5 text-muted-foreground">
                      Dari <strong className="text-foreground">{view.revisionRequest.approverName ?? '-'}</strong> ({view.revisionRequest.roleTitle}) · Rev. {view.revisionRequest.revision}
                    </p>
                    {view.revisionRequest.general && (
                      <p className="mt-2 whitespace-pre-line text-foreground">{view.revisionRequest.general}</p>
                    )}
                  </section>
                )}

                {/* Riwayat Revisi (Collapsible) */}
                {hasHistory(view.history) && (
                  <details className="group rounded-xl border border-border bg-card">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-1.5"><History className="size-3.5 text-primary" /> Riwayat revisi</span>
                      <span className="text-[11px] text-muted-foreground">{view.history!.versions.length + 1} file</span>
                    </summary>
                    <div className="border-t border-border p-3">
                      <RevisionHistoryList history={view.history!} token={token} heading={`${view.document.control_no} — ${view.document.title}`} />
                    </div>
                  </details>
                )}

                {/* Decision Panel */}
                {canDecide ? (
                  <section className="rounded-2xl border-2 border-primary/30 bg-primary/[0.02] p-4 shadow-sm">
                    <p className="text-xs leading-5 text-foreground">
                      Dengan menekan <strong>Setujui</strong>, saya <strong>{view.step.approver_name}</strong> selaku <strong>{view.step.role_title}</strong> menyatakan telah memeriksa dan mengesahkan dokumen ini.
                    </p>

                    {/* Action Choice Tabs */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveAction(activeAction === 'approve' ? null : 'approve')}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${activeAction === 'approve' ? 'bg-emerald-600 text-white shadow-md' : 'border border-emerald-600/40 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}
                      >
                        <Check className="size-4" strokeWidth={3} /> Setujui
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveAction(activeAction === 'reject' ? null : 'reject')}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${activeAction === 'reject' ? 'bg-[#c2412c] text-white shadow-md' : 'border border-[#c2412c]/40 bg-red-50 text-[#a83522] hover:bg-red-100'}`}
                      >
                        <PencilLine className="size-4" /> Minta Revisi
                      </button>
                    </div>

                    {/* Approve Form Box - Tanpa kode angka */}
                    {activeAction === 'approve' && (
                      <div className="mt-3 flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-50/60 p-3.5 dark:bg-emerald-950/20">
                        <div className="flex items-start gap-2.5">
                          <span className="grid size-6 flex-none place-items-center rounded-full bg-emerald-600 text-white">
                            <Check className="size-3.5" strokeWidth={3} />
                          </span>
                          <div className="text-xs">
                            <p className="font-bold text-foreground">Pengesahan Tanda Tangan Digital Resmi</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              Tanda tangan elektronik digital (QR E-Sign) resmi Anda akan langsung tercatat dan disahkan pada dokumen ini selaku <strong className="text-foreground">{view.step.role_title}</strong>.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={submitApprove}
                          disabled={submitting !== null}
                          className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {submitting === 'approve' ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" strokeWidth={3} />}
                          Konfirmasi Setujui Dokumen
                        </button>
                      </div>
                    )}

                    {/* Reject Form Box */}
                    {activeAction === 'reject' && (
                      <div className="mt-3 flex flex-col gap-2 rounded-xl border border-red-500/30 bg-red-50/50 p-3">
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold text-foreground">Catatan perbaikan untuk dokumen ini:</span>
                          <textarea
                            value={revisionNote}
                            onChange={(e) => setRevisionNote(e.target.value)}
                            rows={3}
                            placeholder="Tuliskan bagian mana yang perlu diperbaiki..."
                            className="w-full rounded-lg border border-input bg-card p-2 text-xs text-foreground outline-none focus:border-red-600"
                          />
                        </label>
                        <p className="text-[10.5px] text-muted-foreground">
                          Untuk mencoret teks atau memberi pin penanda visual langsung di atas PDF, Anda dapat membuka via link{' '}
                          <Link href={`/pengesahan?token=${token}`} target="_blank" className="font-semibold text-primary underline">
                            Halaman Penuh
                          </Link>.
                        </p>
                        <button
                          type="button"
                          onClick={submitReject}
                          disabled={submitting !== null || !revisionNote.trim()}
                          className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#c2412c] py-2.5 text-xs font-bold text-white shadow transition hover:bg-[#a83522] disabled:opacity-50"
                        >
                          {submitting === 'reject' ? <Loader2 className="size-3.5 animate-spin" /> : <PencilLine className="size-3.5" />}
                          Kirim Permintaan Revisi
                        </button>
                      </div>
                    )}
                  </section>
                ) : view.step.status === 'approved' && view.step.verification_code && view.step.decided_at && !view.superseded ? (
                  <section className="flex flex-col gap-3">
                    <SignatureCard
                      verifyBase={view.verifyBase}
                      info={{
                        code: view.step.verification_code,
                        name: view.step.approver_name ?? '-',
                        roleTitle: view.step.role_title,
                        decidedAt: view.step.decided_at,
                        documentLabel: `${view.document.control_no} — ${view.document.title}`,
                      }}
                    />
                    <a
                      href={signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground shadow-sm hover:bg-secondary"
                    >
                      <FileSignature className="size-4" /> Lihat PDF bertanda tangan
                    </a>

                    {/* 2 Pilihan Dashboard Saat Approved */}
                    <div className="mt-2 flex flex-col gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50/60 p-3.5 dark:bg-emerald-950/20">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                        <Sparkles className="size-3.5 text-emerald-600" />
                        <span>Pilihan Dashboard Selanjutnya:</span>
                      </div>
                      <div className="mt-1 flex flex-col gap-2">
                        {/* Pilihan 1: Dashboard Persetujuan Saya */}
                        <Link
                          href="/persetujuan-saya"
                          onClick={onClose}
                          className="group flex items-center justify-between rounded-lg border border-primary/20 bg-card p-2.5 shadow-sm transition hover:border-primary hover:bg-primary/5 hover:shadow"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="grid size-7 flex-none place-items-center rounded-md bg-primary text-primary-foreground shadow-sm">
                              <ClipboardCheck className="size-3.5" />
                            </span>
                            <div className="text-left">
                              <span className="block text-xs font-bold text-foreground group-hover:text-primary">
                                1. Dashboard Persetujuan Saya
                              </span>
                              <span className="block text-[10.5px] text-muted-foreground">
                                Cek antrian berkas lain menunggu persetujuan
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                        </Link>

                        {/* Pilihan 2: Dashboard Admin Monitoring */}
                        <Link
                          href="/dashboard-admin"
                          onClick={onClose}
                          className="group flex items-center justify-between rounded-lg border border-border bg-card p-2.5 shadow-sm transition hover:border-foreground/30 hover:bg-secondary hover:shadow"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="grid size-7 flex-none place-items-center rounded-md bg-secondary text-foreground shadow-sm">
                              <Gauge className="size-3.5 text-[color:var(--p-600)]" />
                            </span>
                            <div className="text-left">
                              <span className="block text-xs font-bold text-foreground">
                                2. Dashboard Monitoring Admin
                              </span>
                              <span className="block text-[10.5px] text-muted-foreground">
                                Pantau berkas, jadwal review &amp; status ISMS
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                        </Link>
                      </div>
                    </div>
                  </section>
                ) : (
                  <section className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Status Dokumen: {STEP_LABEL[view.step.status]}</p>
                    <p className="mt-1">Dokumen ini tidak dalam status menunggu persetujuan Anda saat ini.</p>
                  </section>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
