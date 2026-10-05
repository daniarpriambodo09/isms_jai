'use client'

// "Catatan Pengesahan" cell of the Prosedur ISMS register: one line per
// signing position — who, their status (✓ approved / waiting / rejected /
// queued) and the date — mirroring the Unit Kerja · Nama · Approve · Tanggal
// block of the paper register. Admins also get resend / restart actions.

import { useState } from 'react'
import { Check, Clock, Crosshair, FileSignature, History, Loader2, MapPin, PencilLine, Send, Upload, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { SignatureQrButton } from '@/components/documents/SignatureQr'
import { SignatureSlotEditor } from '@/components/documents/SignatureSlotEditor'
import { RevisionCompareDialog, RevisionHistoryList, openForRequest, type HistoryRequest, type RevisionHistoryData } from '@/components/documents/RevisionHistory'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { RowActionsMenu } from '@/components/documents/RowActionsMenu'

export type ApprovalStep = {
  id: number
  role_code: string
  role_title: string
  step: number
  status: 'waiting' | 'pending' | 'approved' | 'rejected' | 'cancelled'
  approver_name: string | null
  notified_at: string | null
  email_error: string | null
  decided_at: string | null
  decision_note: string | null
  verification_code: string | null
}

type NotesView = {
  document: { control_no: string; title: string; revision: number; file_path: string }
  revisionRequest: HistoryRequest | null
  history: RevisionHistoryData
}

// The register's "Riwayat revisi": every file and revision request of one document.
function HistoryDialog({ notes, onClose }: { notes: NotesView; onClose: () => void }) {
  useEscapeClose(true, onClose)
  return (
    <div className="fixed inset-0 z-[55] grid place-items-center bg-[color-mix(in_oklch,_var(--p-950)_55%,_transparent)] p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Riwayat revisi" onClick={(e) => e.stopPropagation()} className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-mono-label text-[10px] text-muted-foreground"><History className="size-3.5" /> Riwayat revisi</p>
            <h2 className="mt-1 truncate text-base font-semibold text-foreground">{notes.document.control_no} — {notes.document.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-8 flex-none place-items-center rounded-full text-muted-foreground hover:bg-secondary"><X className="size-4" /></button>
        </div>
        <div className="overflow-y-auto p-5">
          <RevisionHistoryList history={notes.history} heading={`${notes.document.control_no} — ${notes.document.title}`} />
        </div>
      </div>
    </div>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_STYLE: Record<ApprovalStep['status'], { icon: React.ReactNode; className: string; label: string }> = {
  approved: { icon: <Check className="size-3" strokeWidth={3} />, className: 'bg-emerald-600 text-white', label: 'Disetujui' },
  pending: { icon: <Clock className="size-3" />, className: 'bg-amber-400 text-amber-950', label: 'Menunggu' },
  rejected: { icon: <PencilLine className="size-3" />, className: 'bg-[#c2412c] text-white', label: 'Minta revisi' },
  waiting: { icon: <span className="size-1.5 rounded-full bg-current" />, className: 'bg-secondary text-muted-foreground', label: 'Antri' },
  cancelled: { icon: <span className="size-1.5 rounded-full bg-current" />, className: 'bg-secondary text-muted-foreground', label: 'Dibatalkan' },
}

export function ProcedureApprovalCell({
  documentId,
  documentLabel,
  verifyBase,
  roles,
  steps,
  status,
  isAdmin,
  busy,
  onResend,
  onRestart,
  slotsCount = 0,
  historyCount = 0,
  onSlotsChanged,
}: {
  documentId: number
  documentLabel: string
  verifyBase: string
  roles: string[]
  steps: ApprovalStep[]
  status: string
  isAdmin: boolean
  busy: boolean
  onResend: () => void
  onRestart: () => void
  slotsCount?: number
  /** Earlier files + revision requests of this document. */
  historyCount?: number
  onSlotsChanged?: () => void
}) {
  const [placing, setPlacing] = useState(false)
  const [notes, setNotes] = useState<NotesView | null>(null)
  // What is open: the latest request's marks, or the whole history.
  const [notesFor, setNotesFor] = useState<'latest' | 'history' | null>(null)
  const [notesLoading, setNotesLoading] = useState<'latest' | 'history' | null>(null)

  const openNotes = async (what: 'latest' | 'history') => {
    setNotesLoading(what)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-isms/${documentId}/revision-notes`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data.history && (what === 'history' || data.revisionRequest)) {
        setNotes(data)
        setNotesFor(what)
      }
    } finally {
      setNotesLoading(null)
    }
  }
  if (roles.length === 0) {
    return <span className="text-muted-foreground" title="Dokumen ini tidak memerlukan pengesahan">–</span>
  }

  return (
    <div className="flex min-w-[230px] flex-col gap-1.5">
      {steps.map((step) => {
        const style = STATUS_STYLE[step.status]
        return (
          <div key={step.id} className="flex items-start gap-2">
            <span title={style.label} className={`mt-0.5 grid size-[18px] flex-none place-items-center rounded-full ${style.className} ${step.status === 'pending' ? 'animate-pulse' : ''}`}>{style.icon}</span>
            <div className="min-w-0 leading-tight">
              <p className="text-[12.5px] font-medium text-foreground">
                {step.approver_name ?? '-'}
                <span title={step.role_title} className="ml-1.5 rounded bg-secondary px-1 py-px align-middle font-mono text-[9.5px] font-semibold text-secondary-foreground">{step.role_code}</span>
                {step.status === 'approved' && step.verification_code && step.decided_at && (
                  <SignatureQrButton
                    verifyBase={verifyBase}
                    info={{ code: step.verification_code, name: step.approver_name ?? '-', roleTitle: step.role_title, decidedAt: step.decided_at, documentLabel }}
                  />
                )}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {step.decided_at ? `${style.label} · ${formatDate(step.decided_at)}` : style.label}
              </p>
              {step.status === 'rejected' && step.decision_note && (
                <div className="mt-1 rounded-md border-l-2 border-[#c2412c] bg-[#fdf6f3] px-2 py-1">
                  <p className="line-clamp-4 whitespace-pre-line text-[11px] leading-snug text-[#8a2d1d]">{step.decision_note}</p>
                  {isAdmin && (
                    <button type="button" onClick={() => openNotes('latest')} disabled={notesLoading !== null} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#a83522] hover:underline disabled:opacity-50">
                      {notesLoading === 'latest' ? <Loader2 className="size-3 animate-spin" /> : <MapPin className="size-3" />} Lihat catatan di dokumen
                    </button>
                  )}
                </div>
              )}
              {isAdmin && step.status === 'pending' && step.email_error && <p className="mt-0.5 text-[11px] text-red-700">{step.email_error}</p>}
            </div>
          </div>
        )
      })}

      {/* One line of actions: the signed PDF, the next step when a revision was
          asked, and everything else (QR placement, history, re-send) under "⋯". */}
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
        {steps.some((step) => step.status === 'approved') && (
          <a
            href={`${API_BASE_PATH}/api/prosedur-isms/${documentId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${status === 'approved' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-border text-foreground hover:bg-secondary'}`}
          >
            <FileSignature className="size-3" /> PDF bertanda tangan
          </a>
        )}
        {isAdmin && status === 'rejected' && (
          <button
            type="button"
            onClick={onRestart}
            disabled={busy}
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#c2412c] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#a83522] disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />} Unggah perbaikan &amp; ajukan ulang
          </button>
        )}
        {isAdmin && (
          <RowActionsMenu
            actions={[
              {
                key: 'qr', icon: <Crosshair className="size-3.5" />, label: 'Atur posisi QR', detail: `${slotsCount}/${roles.length}`,
                attention: slotsCount < roles.length, onSelect: () => setPlacing(true),
              },
              ...(historyCount > 0 ? [{
                key: 'history', icon: <History className="size-3.5" />, label: 'Riwayat revisi', detail: String(historyCount),
                busy: notesLoading === 'history', disabled: notesLoading !== null, onSelect: () => { void openNotes('history') },
              }] : []),
              ...(status === 'pending' ? [{
                key: 'resend', icon: <Send className="size-3.5" />, label: 'Kirim ulang email', busy, onSelect: onResend,
              }] : []),
            ]}
          />
        )}
      </div>
      {placing && <SignatureSlotEditor documentId={documentId} onClose={() => setPlacing(false)} onSaved={onSlotsChanged} />}
      {notes && notesFor === 'latest' && notes.revisionRequest && (
        <RevisionCompareDialog
          history={notes.history}
          open={openForRequest(notes.history, notes.revisionRequest)}
          heading={`${notes.document.control_no} — ${notes.document.title}`}
          onClose={() => setNotesFor(null)}
        />
      )}
      {notes && notesFor === 'history' && <HistoryDialog notes={notes} onClose={() => setNotesFor(null)} />}
    </div>
  )
}
