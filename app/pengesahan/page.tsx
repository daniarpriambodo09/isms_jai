// app/pengesahan/page.tsx
//
// Where an approver lands from the "Buka & Proses Pengesahan" email button:
// the document (PDF inline), the signing chain so far, and Setujui / Tolak.
// No login — the ?token= from the email is the credential (see
// app/api/prosedur-isms/approval/route.ts).

'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, Clock, ExternalLink, FileSignature, FileText, Loader2, ShieldCheck, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { SignatureCard } from '@/components/documents/SignatureQr'

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
  document: { control_no: string; title: string; revision: number; elf_date: string; note: string | null; file_path: string }
  cycle: Step[]
  superseded: boolean
  documentId: number
  verifyBase: string
}

function formatDate(value: string, withTime = false) {
  return new Date(value).toLocaleString('id-ID', withTime ? { dateStyle: 'long', timeStyle: 'short' } : { dateStyle: 'long' })
}

const STEP_LABEL: Record<Step['status'], string> = {
  approved: 'Disetujui',
  pending: 'Menunggu',
  rejected: 'Ditolak',
  waiting: 'Antri',
  cancelled: 'Dibatalkan',
}

function StepIcon({ status }: { status: Step['status'] }) {
  if (status === 'approved') return <span className="grid size-8 place-items-center rounded-full bg-emerald-600 text-white"><Check className="size-4" strokeWidth={3} /></span>
  if (status === 'rejected') return <span className="grid size-8 place-items-center rounded-full bg-red-600 text-white"><X className="size-4" strokeWidth={3} /></span>
  if (status === 'pending') return <span className="grid size-8 animate-pulse place-items-center rounded-full bg-amber-400 text-amber-950"><Clock className="size-4" /></span>
  return <span className="grid size-8 place-items-center rounded-full border-2 border-dashed border-border text-muted-foreground"><span className="size-1.5 rounded-full bg-current" /></span>
}

function PengesahanContent() {
  const token = useSearchParams().get('token') ?? ''
  const [view, setView] = useState<View | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const load = useCallback(async () => {
    if (!token) { setLoadError('Link tidak lengkap — buka kembali tombol di email Anda.'); return }
    try {
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-isms/approval?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setView(data)
      setLoadError(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Gagal memuat data.')
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const decide = async (action: 'approve' | 'reject') => {
    setSubmitting(action)
    setResult(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-isms/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action, note: action === 'reject' ? reason : null }),
      })
      const data = await res.json().catch(() => ({}))
      setResult({ ok: res.ok, message: data.message ?? (res.ok ? 'Tersimpan.' : 'Gagal memproses.') })
      setRejecting(false)
      await load()
    } catch {
      setResult({ ok: false, message: 'Tidak dapat menghubungi server.' })
    } finally {
      setSubmitting(null)
    }
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
  const canDecide = step.status === 'pending' && !view.superseded
  const pdfUrl = `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(document.file_path)}`

  return (
    <div className="flex flex-col gap-6">
      {/* Document header */}
      <section className="overflow-hidden rounded-2xl bg-[color:var(--p-900)] text-primary-foreground shadow-xl">
        <div className="h-1.5 bg-accent" />
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="flex items-center gap-2 font-mono-label text-[10px] text-accent"><ShieldCheck className="size-3.5" /> Permohonan pengesahan · Prosedur ISMS</p>
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
            <p className="mt-2 font-mono text-[11px] text-primary-foreground/50">Tahap {step.step} dari {cycle.length}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* PDF */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><FileText className="size-4 text-[color:var(--p-600)]" /> Dokumen</p>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--p-600)] hover:underline">Buka di tab baru <ExternalLink className="size-3.5" /></a>
          </div>
          <iframe src={pdfUrl} title={document.title} className="h-[70vh] w-full bg-muted" />
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
                    </p>
                    <p className="text-xs text-muted-foreground">{item.role_title}</p>
                    <p className="mt-0.5 text-xs font-medium text-foreground/80">
                      {STEP_LABEL[item.status]}{item.decided_at ? ` · ${formatDate(item.decided_at, true)}` : ''}
                    </p>
                    {item.decision_note && <p className="mt-1 text-xs text-red-700">Alasan: {item.decision_note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {result && (
            <p className={`rounded-xl border px-4 py-3 text-sm ${result.ok ? 'border-emerald-600/20 bg-emerald-600/10 text-emerald-800' : 'border-red-600/20 bg-red-600/10 text-red-800'}`}>{result.message}</p>
          )}

          {canDecide ? (
            <section className="rounded-2xl border-2 border-accent/40 bg-card p-5 shadow-sm">
              <p className="text-sm leading-6 text-foreground">
                Dengan menekan <strong>Setujui</strong>, saya <strong>{step.approver_name}</strong> selaku <strong>{step.role_title}</strong> menyatakan telah memeriksa dan mengesahkan dokumen ini.
              </p>
              {rejecting ? (
                <div className="mt-4 flex flex-col gap-2">
                  <label className="text-xs font-semibold text-foreground" htmlFor="reject-reason">Alasan penolakan</label>
                  <textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} autoFocus placeholder="Jelaskan apa yang perlu diperbaiki" className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => decide('reject')} disabled={!reason.trim() || submitting !== null} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
                      {submitting === 'reject' ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Kirim penolakan
                    </button>
                    <button type="button" onClick={() => setRejecting(false)} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary">Batal</button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => decide('approve')} disabled={submitting !== null} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-50">
                    {submitting === 'approve' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={3} />} Setujui
                  </button>
                  <button type="button" onClick={() => setRejecting(true)} disabled={submitting !== null} className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-red-600/60 px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50">
                    <X className="size-4" strokeWidth={3} /> Tolak
                  </button>
                </div>
              )}
            </section>
          ) : step.status === 'approved' && step.verification_code && step.decided_at && !view.superseded ? (
            <section className="flex flex-col gap-3">
              <SignatureCard
                verifyBase={view.verifyBase}
                info={{ code: step.verification_code, name: step.approver_name ?? '-', roleTitle: step.role_title, decidedAt: step.decided_at, documentLabel: `${document.control_no} — ${document.title}` }}
              />
              <a
                href={`${API_BASE_PATH}/api/prosedur-isms/${view.documentId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-secondary"
              >
                <FileSignature className="size-4" /> Lihat PDF bertanda tangan
              </a>
            </section>
          ) : (
            <section className="rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground shadow-sm">
              {view.superseded
                ? 'Dokumen ini sudah direvisi setelah email dikirim — link ini tidak berlaku lagi. Anda akan menerima email baru untuk revisi terbaru.'
                : step.status === 'approved'
                  ? `Anda telah menyetujui dokumen ini pada ${step.decided_at ? formatDate(step.decided_at, true) : '-'}.`
                  : step.status === 'rejected'
                    ? 'Anda telah menolak dokumen ini. Admin ISM akan memperbaikinya dan mengajukan ulang.'
                    : 'Tahap ini tidak lagi menunggu keputusan Anda.'}
            </section>
          )}
        </aside>
      </div>
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
