'use client'

// "Catatan Pengesahan" cell of the Prosedur ISMS register: one line per
// signing position — who, their status (✓ approved / waiting / rejected /
// queued) and the date — mirroring the Unit Kerja · Nama · Approve · Tanggal
// block of the paper register. Admins also get resend / restart actions.

import { useState } from 'react'
import { Check, Clock, Crosshair, FileSignature, Loader2, MapPin, PencilLine, RotateCcw, Send } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { SignatureQrButton } from '@/components/documents/SignatureQr'
import { SignatureSlotEditor } from '@/components/documents/SignatureSlotEditor'
import { RevisionNotesDialog, type RevisionPin } from '@/components/documents/RevisionNotes'

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
  revisionRequest: { approverName: string | null; roleTitle: string; revision: number; general: string | null; pins: RevisionPin[] }
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
  onSlotsChanged?: () => void
}) {
  const [placing, setPlacing] = useState(false)
  const [notes, setNotes] = useState<NotesView | null>(null)
  const [notesLoading, setNotesLoading] = useState(false)

  const openNotes = async () => {
    setNotesLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-isms/${documentId}/revision-notes`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data.revisionRequest) setNotes(data)
    } finally {
      setNotesLoading(false)
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
                    <button type="button" onClick={openNotes} disabled={notesLoading} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#a83522] hover:underline disabled:opacity-50">
                      {notesLoading ? <Loader2 className="size-3 animate-spin" /> : <MapPin className="size-3" />} Lihat catatan di dokumen
                    </button>
                  )}
                </div>
              )}
              {isAdmin && step.status === 'pending' && step.email_error && <p className="mt-0.5 text-[11px] text-red-700">{step.email_error}</p>}
            </div>
          </div>
        )
      })}

      {steps.some((step) => step.status === 'approved') && (
        <a
          href={`${API_BASE_PATH}/api/prosedur-isms/${documentId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${status === 'approved' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-border text-foreground hover:bg-secondary'}`}
        >
          <FileSignature className="size-3" /> PDF bertanda tangan
        </a>
      )}

      {isAdmin && (
        <button
          type="button"
          onClick={() => setPlacing(true)}
          title="Atur di mana QR tiap approver dibubuhkan pada kolom tanda tangan dokumen"
          className={`mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${slotsCount >= roles.length ? 'border border-emerald-600/30 text-emerald-700 hover:bg-emerald-600/10' : 'border border-amber-500/40 bg-amber-50 text-amber-800 hover:bg-amber-100'}`}
        >
          <Crosshair className="size-3" /> Posisi QR {slotsCount}/{roles.length}
        </button>
      )}
      {placing && <SignatureSlotEditor documentId={documentId} onClose={() => setPlacing(false)} onSaved={onSlotsChanged} />}
      {notes && (
        <RevisionNotesDialog
          mode="view"
          filePath={notes.document.file_path}
          heading={`${notes.document.control_no} — ${notes.document.title}`}
          subheading={`Catatan dari ${notes.revisionRequest.approverName ?? '-'} (${notes.revisionRequest.roleTitle}) · Rev. ${notes.revisionRequest.revision}`}
          hint="Perbaiki bagian yang ditandai, lalu Edit dokumen dan unggah file perbaikannya — pengesahan dimulai ulang dan approver melihat catatan ini di samping dokumen baru."
          initialGeneral={notes.revisionRequest.general}
          initialPins={notes.revisionRequest.pins}
          onClose={() => setNotes(null)}
        />
      )}

      {isAdmin && (status === 'pending' || status === 'rejected') && (
        <button
          type="button"
          onClick={status === 'pending' ? onResend : onRestart}
          disabled={busy}
          className="mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : status === 'pending' ? <Send className="size-3" /> : <RotateCcw className="size-3" />}
          {status === 'pending' ? 'Kirim ulang email' : 'Ajukan ulang'}
        </button>
      )}
    </div>
  )
}
