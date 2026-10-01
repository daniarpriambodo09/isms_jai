// app/pengesahan/page.tsx
//
// Where an approver lands from the "Buka & Proses Pengesahan" email button:
// the document (PDF inline), the signing chain so far, and Setujui / Tolak.
// Setujui first opens the QR placement editor so the approver puts their own
// QR (one or more copies) on the document's signature column, then approves;
// once approved they can reopen it via "Atur posisi QR saya".
// No login — the ?token= from the email is the credential (see
// app/api/prosedur-isms/approval/route.ts).

'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, Clock, Crosshair, ExternalLink, FileSignature, FileText, Loader2, MapPin, PencilLine, ShieldCheck, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { SignatureCard } from '@/components/documents/SignatureQr'
import { SignatureSlotEditor } from '@/components/documents/SignatureSlotEditor'
import { RevisionNotesDialog, type RevisionPin } from '@/components/documents/RevisionNotes'

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
  linkExpired: boolean
  linkValidDays: number
  canPlaceQr: boolean
  qrAdjustableUntil: string | null
  documentId: number
  verifyBase: string
  // Last 'Minta Revisi' on this document (any cycle), if any.
  revisionRequest: {
    approvalId: number
    approverName: string | null
    roleTitle: string
    revision: number
    decidedAt: string
    general: string | null
    pins: RevisionPin[]
  } | null
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
  const token = useSearchParams().get('token') ?? ''
  const [view, setView] = useState<View | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Minta Revisi dialog: 'edit' writes a new request, 'view' shows the last one
  const [notesMode, setNotesMode] = useState<'edit' | 'view' | null>(null)
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  // 'approve': place QR then approve · 'adjust': move QR after approving
  const [placing, setPlacing] = useState<'approve' | 'adjust' | null>(null)
  const [pdfStamp, setPdfStamp] = useState(0) // busts the signed-PDF link after moving QR

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

  const decide = async (action: 'approve' | 'reject', revision?: { general: string; pins: RevisionPin[] }) => {
    setSubmitting(action)
    setResult(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-isms/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action, note: revision?.general || null, notes: revision?.pins ?? [] }),
      })
      const data = await res.json().catch(() => ({}))
      setResult({ ok: res.ok, message: data.message ?? (res.ok ? 'Tersimpan.' : 'Gagal memproses.') })
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
  // The revision request came from an earlier (restarted) cycle, not this one.
  const previousCycle = !!view.revisionRequest && !cycle.some((item) => item.id === view.revisionRequest!.approvalId)
  const canDecide = step.status === 'pending' && !view.superseded && !view.linkExpired
  // The document as it stands now: the original with the QR of every approver
  // who has already approved (approver 2 sees approver 1's QR, and so on).
  // The token lets this approver open it before it is published.
  const tokenParam = `token=${encodeURIComponent(token)}`
  const signedUrl = `${API_BASE_PATH}/api/prosedur-isms/${view.documentId}/pdf?${tokenParam}&t=${pdfStamp}`
  const originalUrl = `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(document.file_path)}&${tokenParam}`
  const approvedSoFar = cycle.filter((item) => item.status === 'approved').length

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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><FileText className="size-4 text-[color:var(--p-600)]" /> Dokumen</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {approvedSoFar > 0
                  ? `Sudah memuat QR ${approvedSoFar} dari ${cycle.length} approver yang menyetujui`
                  : 'Belum ada approver yang menyetujui — QR muncul di sini setelah disetujui'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline">File asli</a>
              <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--p-600)] hover:underline">Buka di tab baru <ExternalLink className="size-3.5" /></a>
            </div>
          </div>
          <iframe key={pdfStamp} src={signedUrl} title={document.title} className="h-[70vh] w-full bg-muted" />
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
                      <span><span className="text-xs text-muted-foreground">Hal. {pin.page + 1} — </span>{pin.note}</span>
                    </li>
                  ))}
                </ol>
              )}
              {view.revisionRequest.pins.length > 0 && (
                <button type="button" onClick={() => setNotesMode('view')} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#c2412c]/40 bg-card px-3.5 py-2 text-xs font-semibold text-[#a83522] transition hover:bg-[#fdf0ec]">
                  <MapPin className="size-3.5" /> Lihat penanda di dokumen
                </button>
              )}
            </section>
          )}

          {canDecide ? (
            <section className="rounded-2xl border-2 border-accent/40 bg-card p-5 shadow-sm">
              <p className="text-sm leading-6 text-foreground">
                Dengan menekan <strong>Setujui</strong>, saya <strong>{step.approver_name}</strong> selaku <strong>{step.role_title}</strong> menyatakan telah memeriksa dan mengesahkan dokumen ini.
              </p>
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                <Crosshair className="mt-0.5 size-3.5 flex-none text-[color:var(--p-600)]" />
                Setelah menekan Setujui, Anda dapat menempatkan QR tanda tangan Anda langsung di kolom tanda tangan dokumen (bisa lebih dari satu tempat).
              </p>
              <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                <PencilLine className="mt-0.5 size-3.5 flex-none text-[#c2412c]" />
                <span>Masih ada yang perlu diperbaiki? Pilih <strong className="text-foreground">Minta Revisi</strong> — tandai langsung bagian dokumennya dan tulis catatannya. QR tidak diberikan.</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => setPlacing('approve')} disabled={submitting !== null} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-50">
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
              {view.canPlaceQr ? (
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setPlacing('adjust')}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
                  >
                    <Crosshair className="size-4" /> Atur posisi QR saya
                  </button>
                  {view.qrAdjustableUntil && (
                    <p className="text-center text-[11px] text-muted-foreground">Bisa diubah sampai {formatDate(view.qrAdjustableUntil, true)}</p>
                  )}
                </div>
              ) : (
                <p className="rounded-xl bg-secondary px-3 py-2 text-center text-xs text-muted-foreground">
                  Posisi QR Anda sudah dikunci. Bila perlu dipindah, hubungi Admin ISM.
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
      {notesMode === 'view' && view.revisionRequest && (
        <RevisionNotesDialog
          mode="view"
          filePath={document.file_path}
          token={token}
          heading={`${document.control_no} — ${document.title}`}
          subheading={`Catatan dari ${view.revisionRequest.approverName ?? '-'} · Rev. ${view.revisionRequest.revision}`}
          hint={view.revisionRequest.revision !== document.revision || previousCycle
            ? 'Penanda dibuat pada file sebelum diperbaiki — posisinya ditampilkan di file terbaru, bisa sedikit bergeser bila tata letaknya berubah.'
            : undefined}
          initialGeneral={view.revisionRequest.general}
          initialPins={view.revisionRequest.pins}
          onClose={() => setNotesMode(null)}
        />
      )}

      {/* Place own QR: right before approving, or later to adjust. */}
      {placing && (
        <SignatureSlotEditor
          token={token}
          onClose={() => setPlacing(null)}
          saveLabel={placing === 'approve' ? 'Simpan posisi & Setujui' : 'Simpan posisi'}
          onSaved={async () => {
            if (placing === 'approve') {
              setPlacing(null)
              await decide('approve')
            } else {
              setPdfStamp(Date.now())
              setResult({ ok: true, message: 'Posisi QR tanda tangan Anda disimpan.' })
              setPlacing(null)
            }
          }}
          secondaryAction={placing === 'approve'
            ? { label: 'Setujui tanpa mengubah posisi QR', run: () => { setPlacing(null); decide('approve') } }
            : undefined}
        />
      )}
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
