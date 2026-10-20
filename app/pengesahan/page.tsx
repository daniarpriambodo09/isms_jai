// app/pengesahan/page.tsx
//
// Where an approver lands from the "Buka & Proses Pengesahan" email button:
// the document (PDF inline), the signing chain so far, and Setujui / Tolak.
// Setujui is one confirmation — the approver never places anything: the QR
// goes where the portal found the signature box, or where the Admin ISM put
// it ("Atur posisi QR" in the register), before or after the approval.
// No login — the ?token= from the email is the credential (see
// app/api/prosedur-isms/approval/route.ts).

'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowLeftRight, ArrowRight, Check, ClipboardCheck, Clock, Copy, Crosshair, ExternalLink, FileSignature, FileText, Gauge, History, Loader2, LogIn, LogOut, MapPin, PencilLine, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { docKindInfo } from '@/lib/document-kinds'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SignatureCard } from '@/components/documents/SignatureQr'
import { RevisionNotesDialog, type RevisionPin } from '@/components/documents/RevisionNotes'
import { RevisionCompareDialog, RevisionHistoryList, hasHistory, openForRequest, type HistoryRequest, type RevisionHistoryData } from '@/components/documents/RevisionHistory'
import { copyText, readClipboardText } from '@/lib/clipboard'

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
  document: { kind?: string; control_no: string; title: string; revision: number; elf_date: string; note: string | null; file_path: string; has_review_form?: boolean; signs_review?: boolean }
  cycle: Step[]
  /** This approver's place in their own chain (Form Review / document). */
  part?: { index: number; total: number }
  /** Only on an old (cancelled) link: where this position stands in the approval running now. */
  now?: { mine: 'pending' | 'waiting' | 'approved' | 'rejected' | 'none'; waitingFor: { title: string; name: string | null; review: boolean } | null; finished: boolean; revising?: boolean } | null
  superseded: boolean
  linkExpired: boolean
  linkValidDays: number
  canPlaceQr: boolean
  /** This approver's QR already has its place on the document (found by the portal or set by the Admin ISM). */
  qrAutoPlaced?: boolean
  /** Approving asks for the 6-digit code sent in the e-mail; locked = too many wrong entries. */
  codeRequired?: boolean
  codeLocked?: boolean
  signedIn?: boolean
  codeValue?: string | null
  qrAdjustableUntil: string | null
  documentId: number
  verifyBase: string
  // Last 'Minta Revisi' on this document (any cycle), if any.
  revisionRequest: HistoryRequest | null
  // Earlier files and every revision request, to compare before / after.
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
  if (status === 'approved') return <span className="grid size-8 place-items-center rounded-full bg-emerald-600 text-white"><Check className="size-4" strokeWidth={3} /></span>
  if (status === 'rejected') return <span className="grid size-8 place-items-center rounded-full bg-[#c2412c] text-white"><PencilLine className="size-4" /></span>
  if (status === 'pending') return <span className="grid size-8 animate-pulse place-items-center rounded-full bg-amber-400 text-amber-950"><Clock className="size-4" /></span>
  return <span className="grid size-8 place-items-center rounded-full border-2 border-dashed border-border text-muted-foreground"><span className="size-1.5 rounded-full bg-current" /></span>
}

function PengesahanContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { sessionUser, logout } = useAuth()
  const token = searchParams.get('token') ?? ''
  const urlCode = searchParams.get('code') ?? ''
  const [view, setView] = useState<View | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // The link was replaced by a newer one (the request was sent again).
  const [replaced, setReplaced] = useState<{ controlNo: string; title: string; kind: string; replacedAt: string; stillPending: boolean } | null>(null)
  // Minta Revisi dialog: 'edit' writes a new request, 'view' shows the last one
  const [notesMode, setNotesMode] = useState<'edit' | 'view' | null>(null)
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  // 'approve': place QR then approve · 'adjust': move QR after approving
  const [confirmApprove, setConfirmApprove] = useState(false)
  // The approval code typed in the Setujui dialog, and what was wrong with it.
  const [approvalCode, setApprovalCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [docTab, setDocTab] = useState<'document' | 'review'>('document')
  // A Form Review approver starts on the Form Review (what they sign).
  const signsReview = !!view?.document?.signs_review
  useEffect(() => { if (signsReview) setDocTab('review') }, [signsReview])
  const [pdfStamp, setPdfStamp] = useState(0) // busts the signed-PDF link after moving QR

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
    if (!token) { setLoadError('Link tidak lengkap — buka kembali tombol di email Anda.'); return }
    try {
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-isms/approval?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.status === 410 && data.replaced) { setReplaced(data.replaced); return }
      if (!res.ok) throw new Error(data.message)
      setView(data)
      if (data.codeValue) {
        setApprovalCode(data.codeValue.trim())
      } else if (urlCode) {
        setCodeFromText(urlCode)
      }
      setLoadError(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Gagal memuat data.')
    }
  }, [token, urlCode])

  useEffect(() => { load() }, [load])

  const decide = async (action: 'approve' | 'reject', revision?: { general: string; pins: RevisionPin[] }) => {
    setSubmitting(action)
    setResult(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-isms/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action, note: revision?.general || null, notes: revision?.pins ?? [], code: action === 'approve' ? approvalCode : undefined }),
      })
      const data = await res.json().catch(() => ({}))
      // A wrong code: said inside the dialog, which stays open for another try.
      if (data.codeError) {
        setCodeError(data.message ?? 'Kode persetujuan salah.')
        await load()
        return data.message ?? 'Kode persetujuan salah.'
      }
      setResult({ ok: res.ok, message: data.message ?? (res.ok ? 'Tersimpan.' : 'Gagal memproses.') })
      if (!res.ok) setConfirmApprove(false)
      await load()
      setPdfStamp(Date.now()) // the document view now carries this decision's QR
      return res.ok ? null : (data.message ?? 'Gagal memproses.')
    } catch {
      setResult({ ok: false, message: 'Tidak dapat menghubungi server.' })
      return 'Tidak dapat menghubungi server.'
    } finally {
      setSubmitting(null)
    }
  }

  if (replaced) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-amber-100 text-amber-700"><History className="size-7" /></span>
        <h2 className="mt-5 font-display text-2xl font-semibold text-foreground">Link ini sudah diganti</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Email pengesahan untuk <strong className="text-foreground">{replaced.controlNo} — {replaced.title}</strong> ({docKindInfo(replaced.kind).label}) dikirim ulang pada {formatDate(replaced.replacedAt, true)}, sehingga link dari email sebelumnya tidak berlaku lagi.
        </p>
        <p className="mt-3 rounded-xl bg-secondary px-4 py-3 text-sm leading-6 text-foreground">
          {replaced.stillPending
            ? <>Buka email <strong>terbaru</strong> untuk dokumen ini (dikirim {formatDate(replaced.replacedAt, true)} atau sesudahnya), lalu tekan tombol <strong>REVIEW &amp; APPROVAL</strong> di sana.</>
            : <>Permintaan ini sudah diproses lewat link yang baru — tidak ada yang perlu Anda lakukan lagi.</>}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Tidak menemukan emailnya? Minta Admin ISM menekan <strong>Kirim ulang</strong>.</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-red-100 text-red-700"><X className="size-7" /></span>
        <h2 className="mt-5 font-display text-2xl font-semibold text-foreground">Link tidak dapat dibuka</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{loadError}</p>
      </div>
    )
  }

  if (!view) {
    return <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="size-7 animate-spin" /></div>
  }

  const { step, document, cycle } = view

  // A link from an earlier email: the document was re-submitted (or the
  // approval restarted) since, and a newer email carries the valid link.
  if (step.status === 'cancelled') {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-amber-100 text-amber-700"><History className="size-7" /></span>
        <h2 className="mt-5 font-display text-2xl font-semibold text-foreground">Link ini sudah diganti</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {view.now?.revising
            ? <>Pengesahan <strong className="text-foreground">{document.control_no} — {document.title}</strong> (Rev. {document.revision}) sedang dihentikan untuk revisi, sehingga link ini tidak berlaku lagi.</>
            : <>Pengesahan <strong className="text-foreground">{document.control_no} — {document.title}</strong> (Rev. {document.revision}) dimulai ulang{document.has_review_form ? ' — misalnya karena Form Review-nya ditambahkan atau berkasnya diganti' : ' — misalnya karena berkas atau approver-nya diganti'}, sehingga link dari email sebelumnya tidak berlaku lagi.</>}
        </p>
        <p className="mt-3 rounded-xl bg-secondary px-4 py-3 text-sm leading-6 text-foreground" data-testid="replaced-now">
          {view.now?.revising ? (
            <>Salah satu approver <strong>meminta revisi</strong>, sehingga permintaan Anda dihentikan dulu. Anda akan menerima <strong>email baru</strong> setelah dokumen diperbaiki dan diajukan ulang — tidak ada yang perlu dilakukan sekarang.</>
          ) : view.now?.mine === 'pending' ? (
            <>Sekarang <strong>giliran Anda</strong>: buka email <strong>terbaru</strong> untuk dokumen ini, lalu tekan tombol <strong>REVIEW &amp; APPROVAL</strong> di sana.</>
          ) : view.now?.mine === 'waiting' ? (
            <>
              <strong>Belum giliran Anda.</strong>{' '}
              {view.now.waitingFor
                ? <>Saat ini menunggu tanda tangan <strong>{view.now.waitingFor.name ?? view.now.waitingFor.title}</strong> ({view.now.waitingFor.review ? <>Form Review — {view.now.waitingFor.title}</> : view.now.waitingFor.title}). </>
                : null}
              Anda akan menerima <strong>email baru</strong> saat tiba giliran Anda — tidak ada yang perlu dilakukan sekarang.
            </>
          ) : view.now?.mine === 'approved' ? (
            <>Anda <strong>sudah menyetujui</strong> dokumen ini lewat link yang baru — tidak ada yang perlu dilakukan lagi.</>
          ) : view.now?.finished ? (
            <>Dokumen ini sudah selesai disahkan — tidak ada yang perlu dilakukan lagi.</>
          ) : view.now?.mine === 'none' ? (
            <>Jabatan Anda tidak lagi termasuk approver dokumen ini — tidak ada yang perlu dilakukan.</>
          ) : (
            <>Buka email <strong>terbaru</strong> untuk dokumen ini, lalu tekan tombol <strong>REVIEW &amp; APPROVAL</strong> di sana.</>
          )}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Tidak menemukan emailnya? Minta Admin ISM menekan <strong>Kirim ulang</strong>.</p>
      </div>
    )
  }
  // The revision request came from an earlier (restarted) cycle, not this one.
  const previousCycle = !!view.revisionRequest && !cycle.some((item) => item.id === view.revisionRequest!.approvalId)
  const canDecide = step.status === 'pending' && !view.superseded && !view.linkExpired
  // The document as it stands now: the original with the QR of every approver
  // who has already approved (approver 2 sees approver 1's QR, and so on).
  // The token lets this approver open it before it is published.
  const tokenParam = `token=${encodeURIComponent(token)}`
  // The document, or the Form Review that travels with it (same approval, same QR).
  const showingReview = docTab === 'review' && !!document.has_review_form
  const signedUrl = `${API_BASE_PATH}/api/prosedur-isms/${view.documentId}/pdf?${tokenParam}&t=${pdfStamp}${showingReview ? '&part=review' : ''}`
  const originalUrl = `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(document.file_path)}&${tokenParam}`
  const approvedSoFar = cycle.filter((item) => item.status === 'approved').length
  // The last request, on the file its marks were made on (side by side with
  // the current file once that has been replaced).
  const lastOpen = view.revisionRequest && view.history ? openForRequest(view.history, view.revisionRequest) : null

  return (
    <div className="flex flex-col gap-6">
      {/* Top Navbar with Navigation & Logout */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
          >
            <ArrowLeft className="size-3.5" /> Portal Utama
          </Link>
          <Link
            href="/persetujuan-saya"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15"
          >
            <ClipboardCheck className="size-3.5" /> Persetujuan Saya
          </Link>
        </div>

        <div className="flex items-center gap-2.5">
          {sessionUser ? (
            <>
              <span className="hidden items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1 font-mono text-xs text-foreground sm:inline-flex">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {sessionUser.username} ({sessionUser.role})
              </span>
              <button
                type="button"
                onClick={async () => {
                  await logout()
                  router.push('/')
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-300/80 bg-red-50/90 px-3.5 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/60"
                title="Keluar dari akun Anda"
              >
                <LogOut className="size-3.5" />
                <span>Log Out</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('open-admin-login'))}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              <LogIn className="size-3.5" />
              <span>Masuk Akun</span>
            </button>
          )}
        </div>
      </div>

      {/* Document header */}
      <section className="overflow-hidden rounded-2xl bg-[color:var(--p-900)] text-primary-foreground shadow-xl">
        <div className="h-1.5 bg-accent" />
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="flex items-center gap-2 font-mono-label text-[10px] text-accent"><ShieldCheck className="size-3.5" /> Permohonan pengesahan · {docKindInfo(document.kind).label}</p>
            <h2 className="mt-3 font-display text-[clamp(1.8rem,3.8vw,3rem)] font-semibold leading-[1]">{document.title}</h2>
            <div className="mt-5 flex flex-wrap gap-2 font-mono text-[11px]">
              <span className="rounded-full bg-white/10 px-3 py-1">{document.control_no}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Rev. {document.revision}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Eff Date {formatDate(document.elf_date)}</span>
            </div>
            {document.note && <p className="mt-4 max-w-xl rounded-xl bg-white/5 px-4 py-3 text-sm leading-6 text-primary-foreground/80"><span className="font-semibold text-primary-foreground">Note: </span>{document.note}</p>}
          </div>
          <div className="self-end rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="font-mono-label text-[9.5px] text-primary-foreground/50">Diminta kepada</p>
            <p className="mt-1.5 text-lg font-semibold">{step.approver_name}</p>
            <p className="text-sm text-primary-foreground/65">{step.role_title}</p>
            <p className="mt-2 font-mono text-[11px] text-primary-foreground/50">Tahap {view.part?.index ?? step.step} dari {view.part?.total ?? cycle.length}{document.has_review_form ? (document.signs_review ? ' · Form Review' : ' · Dokumen') : ''}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* PDF */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="min-w-0">
              {document.has_review_form ? (
                <div role="tablist" aria-label="File yang disahkan" className="inline-flex rounded-full border border-border bg-secondary/40 p-0.5">
                  {(['document', 'review'] as const).map((tab) => (
                    <button key={tab} type="button" role="tab" aria-selected={docTab === tab} onClick={() => setDocTab(tab)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${docTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                      <FileText className="size-3.5" /> {tab === 'document' ? 'Dokumen' : 'Form Review'}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><FileText className="size-4 text-[color:var(--p-600)]" /> Dokumen</p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {approvedSoFar > 0
                  ? `Sudah memuat QR ${approvedSoFar} dari ${cycle.length} approver yang menyetujui`
                  : 'Belum ada approver yang menyetujui — QR muncul di sini setelah disetujui'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!showingReview && <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline">File asli</a>}
              <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--p-600)] hover:underline">Buka di tab baru <ExternalLink className="size-3.5" /></a>
            </div>
          </div>
          {/* As tall as a whole A4 page at full width (plus the viewer's toolbar), so
              a one-page sheet like the Form Review is seen from top to bottom by
              scrolling this page — not cut off in a short box that scrolls inside.
              (The browser's viewer fits the page to the width by itself.) */}
          <iframe key={`${pdfStamp}-${showingReview ? 'review' : 'doc'}`} src={signedUrl} title={document.title} className="aspect-[210/312] min-h-[70vh] w-full bg-muted" />
        </section>

        {/* Chain + decision */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="portal-eyebrow">Catatan pengesahan</p>
            <ol className="mt-4 flex flex-col">
              {cycle.map((item, i) => (
                <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < cycle.length - 1 && <span aria-hidden className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-border" />}
                  <StepIcon status={item.status} />
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      {item.approver_name}
                      {item.id === step.id && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">Anda</span>}
                      {item.status === 'approved' && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 align-middle">
                          <Check className="size-3 text-emerald-700" strokeWidth={3} /> Disetujui
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.role_title}</p>
                    <p className="mt-0.5 text-xs font-medium text-foreground/80">
                      {STEP_LABEL[item.status]}{item.decided_at ? ` · ${formatDate(item.decided_at, true)}` : ''}
                    </p>
                    {item.decision_note && <p className="mt-1 whitespace-pre-line text-xs text-[#a83522]">Catatan revisi: {item.decision_note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {result && (
            <p className={`rounded-xl border px-4 py-3 text-sm ${result.ok ? 'border-emerald-600/20 bg-emerald-600/10 text-emerald-800' : 'border-red-600/20 bg-red-600/10 text-red-800'}`}>{result.message}</p>
          )}

          {/* What was asked to be fixed last time — shown to approvers of the
              resubmitted document (and to whoever just asked for it). */}
          {view.revisionRequest && (
            <section className="rounded-2xl border border-[#c2412c]/30 bg-[#fdf6f3] p-5 shadow-sm">
              <p className="flex items-center gap-1.5 font-mono-label text-[10px] text-[#a83522]"><PencilLine className="size-3.5" /> {previousCycle ? 'Catatan revisi sebelumnya' : 'Catatan revisi'}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Dari <strong className="text-foreground">{view.revisionRequest.approverName ?? '-'}</strong> ({view.revisionRequest.roleTitle}) · Rev. {view.revisionRequest.revision} · {formatDate(view.revisionRequest.decidedAt, true)}
              </p>
              {view.revisionRequest.general && <p className="mt-3 whitespace-pre-line text-sm text-foreground">{view.revisionRequest.general}</p>}
              {view.revisionRequest.pins.length > 0 && (
                <ol className="mt-3 flex flex-col gap-1.5">
                  {view.revisionRequest.pins.map((pin, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground">
                      <span className="mt-0.5 grid size-5 flex-none place-items-center rounded-full bg-[#d6452f] text-[10px] font-bold text-white">{i + 1}</span>
                      <span><span className="text-xs text-muted-foreground">Hal. {pin.page + 1}{typeof pin.x2 === 'number' ? ' · coret' : ''} — </span>{pin.note}</span>
                    </li>
                  ))}
                </ol>
              )}
              {(view.revisionRequest.pins.length > 0 || lastOpen?.compare) && (
                <button type="button" onClick={() => setNotesMode('view')} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#c2412c]/40 bg-card px-3.5 py-2 text-xs font-semibold text-[#a83522] transition hover:bg-[#fdf0ec]">
                  {lastOpen?.compare
                    ? <><ArrowLeftRight className="size-3.5" /> Bandingkan sebelum & sesudah revisi</>
                    : <><MapPin className="size-3.5" /> Lihat coretan & penanda di dokumen</>}
                </button>
              )}
            </section>
          )}

          {/* Every earlier file and revision request of this document. */}
          {hasHistory(view.history) && (
            <details className="group rounded-2xl border border-border bg-card shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><History className="size-4 text-[color:var(--p-600)]" /> Riwayat revisi</span>
                <span className="text-xs text-muted-foreground">{view.history!.versions.length + 1} file · {view.history!.requests.length} permintaan revisi</span>
              </summary>
              <div className="border-t border-border px-4 pb-4 pt-3">
                <RevisionHistoryList history={view.history!} token={token} heading={`${document.control_no} — ${document.title}`} />
              </div>
            </details>
          )}

          {canDecide ? (
            <section className="rounded-2xl border-2 border-accent/40 bg-card p-5 shadow-sm">
              <p className="text-sm leading-6 text-foreground">
                Dengan menekan <strong>Setujui</strong>, saya <strong>{step.approver_name}</strong> selaku <strong>{step.role_title}</strong> menyatakan telah memeriksa dan mengesahkan dokumen ini.
              </p>
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                <Crosshair className="mt-0.5 size-3.5 flex-none text-[color:var(--p-600)]" />
                {view.qrAutoPlaced
                  ? <span>QR tanda tangan Anda <strong className="text-foreground">otomatis tercetak di kolom {step.role_title}</strong> pada dokumen — tidak perlu diatur.</span>
                  : <span>Anda cukup menekan Setujui. Setelah itu <strong className="text-foreground">Admin ISM</strong> menempatkan QR tanda tangan Anda di kolom tanda tangan dokumen.</span>}
              </p>
              <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                <PencilLine className="mt-0.5 size-3.5 flex-none text-[#c2412c]" />
                <span>Masih ada yang perlu diperbaiki? Pilih <strong className="text-foreground">Minta Revisi</strong> — coret kata yang salah atau tandai bagian dokumennya, lalu tulis perbaikannya. QR tidak diberikan.</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => setConfirmApprove(true)} disabled={submitting !== null} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-50">
                  {submitting === 'approve' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={3} />} Setujui
                </button>
                <button type="button" onClick={() => setNotesMode('edit')} disabled={submitting !== null} className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[#c2412c]/60 px-5 py-3 text-sm font-bold text-[#a83522] transition hover:bg-[#fdf0ec] disabled:opacity-50">
                  {submitting === 'reject' ? <Loader2 className="size-4 animate-spin" /> : <PencilLine className="size-4" />} Minta Revisi
                </button>
              </div>
            </section>
          ) : step.status === 'approved' && step.verification_code && step.decided_at && !view.superseded ? (
            <section className="flex flex-col gap-3">
              <SignatureCard
                verifyBase={view.verifyBase}
                info={{ code: step.verification_code, name: step.approver_name ?? '-', roleTitle: step.role_title, decidedAt: step.decided_at, documentLabel: `${document.control_no} — ${document.title}` }}
              />
              {view.qrAutoPlaced ? (
                <p className="rounded-xl bg-emerald-600/10 px-3 py-2 text-center text-xs text-emerald-800">
                  QR Anda sudah tercetak otomatis di kolom {step.role_title} pada dokumen.
                </p>
              ) : (
                <p className="rounded-xl bg-secondary px-3 py-2 text-center text-xs text-muted-foreground">
                  Persetujuan Anda sudah tercatat. Posisi QR pada dokumen diatur oleh Admin ISM.
                </p>
              )}
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-secondary"
              >
                <FileSignature className="size-4" /> Lihat PDF bertanda tangan
              </a>

              {/* 2 Pilihan Dashboard Saat Approved */}
              <div className="mt-2 flex flex-col gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  <Sparkles className="size-3.5 text-emerald-600" />
                  <span>Pilihan Dashboard Selanjutnya:</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Dokumen telah disetujui. Silakan pilih dashboard untuk melanjutkan aktivitas Anda:
                </p>
                <div className="mt-1 flex flex-col gap-2">
                  {/* Pilihan 1: Dashboard Persetujuan Saya */}
                  <Link
                    href="/persetujuan-saya"
                    className="group flex items-center justify-between rounded-xl border border-primary/20 bg-card p-3 shadow-sm transition hover:border-primary hover:bg-primary/5 hover:shadow"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                        <ClipboardCheck className="size-4" />
                      </span>
                      <div className="text-left">
                        <span className="block text-xs font-bold text-foreground group-hover:text-primary">
                          1. Dashboard Persetujuan Saya
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          Daftar antrian &amp; dokumen lain yang menunggu persetujuan Anda
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </Link>

                  {/* Pilihan 2: Dashboard Monitoring Admin */}
                  <Link
                    href="/dashboard-admin"
                    className="group flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-sm transition hover:border-foreground/30 hover:bg-secondary hover:shadow"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 place-items-center rounded-lg bg-secondary text-foreground shadow-sm">
                        <Gauge className="size-4 text-[color:var(--p-600)]" />
                      </span>
                      <div className="text-left">
                        <span className="block text-xs font-bold text-foreground">
                          2. Dashboard Admin Monitoring
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          Pantau seluruh berkas, jadwal review, dan status ISMS
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground shadow-sm">
              {view.superseded
                ? 'Dokumen ini sudah direvisi setelah email dikirim — link ini tidak berlaku lagi. Anda akan menerima email baru untuk revisi terbaru.'
                : view.linkExpired
                  ? `Link pengesahan ini sudah kedaluwarsa (berlaku ${view.linkValidDays} hari sejak dikirim). Minta Admin ISM mengirim ulang email pengesahan — Anda akan menerima link baru.`
                : step.status === 'approved'
                  ? `Anda telah menyetujui dokumen ini pada ${step.decided_at ? formatDate(step.decided_at, true) : '-'}.`
                  : step.status === 'rejected'
                    ? 'Anda telah meminta revisi dokumen ini. Admin ISM akan memperbaikinya dan mengajukan ulang — Anda akan menerima email baru.'
                    : 'Tahap ini tidak lagi menunggu keputusan Anda.'}
            </section>
          )}
        </aside>
      </div>

      {notesMode === 'edit' && (
        <RevisionNotesDialog
          mode="edit"
          filePath={document.file_path}
          token={token}
          heading={`${document.control_no} — ${document.title}`}
          subheading={`Rev. ${document.revision} · ${step.approver_name ?? ''} (${step.role_title})`}
          onClose={() => setNotesMode(null)}
          onSubmit={async (general, pins) => {
            const error = await decide('reject', { general, pins })
            if (!error) setNotesMode(null)
            return error
          }}
        />
      )}
      {notesMode === 'view' && view.history && lastOpen && (
        <RevisionCompareDialog
          history={view.history}
          open={lastOpen}
          token={token}
          heading={`${document.control_no} — ${document.title}`}
          onClose={() => setNotesMode(null)}
        />
      )}

      {/* No placing step: just one confirmation before the signature is given. Tanpa kode angka */}
      <ConfirmDialog
        open={confirmApprove}
        title={document.signs_review ? 'Setujui Form Review ini?' : 'Setujui dokumen ini?'}
        message={`${document.control_no} — ${document.title}. QR tanda tangan Anda (${step.role_title}) ${view.qrAutoPlaced ? 'otomatis tercetak di kolomnya pada dokumen' : 'ditempatkan di kolom tanda tangan dokumen oleh Admin ISM setelah Anda menyetujui'}. Persetujuan tidak dapat dibatalkan.`}
        confirmLabel="Ya, setujui"
        danger={false}
        pending={submitting === 'approve'}
        confirmDisabled={submitting !== null}
        onConfirm={async () => {
          const failed = await decide('approve')
          if (!failed) {
            setConfirmApprove(false)
            setApprovalCode('')
            setCodeError(null)
            setCopiedCode(false)
          }
        }}
        onCancel={() => {
          setConfirmApprove(false)
          setCodeError(null)
          setCopiedCode(false)
        }}
      >
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-xs leading-relaxed text-foreground">
          <p className="font-semibold text-emerald-800 dark:text-emerald-400">
            Persetujuan Langsung (Tanpa Kode PIN / Angka)
          </p>
          <p className="mt-1 text-muted-foreground">
            Tanda tangan elektronik digital (QR E-Sign) resmi Anda akan langsung tercatat dan disahkan pada dokumen ini atas nama <strong className="text-foreground">{step.approver_name}</strong> ({step.role_title}).
          </p>
        </div>
      </ConfirmDialog>

    </div>
  )
}

export default function PengesahanPage() {
  return (
    <Suspense fallback={null}>
      <PengesahanContent />
    </Suspense>
  )
}
