'use client'

// "Catatan Pengesahan" cell of the Prosedur ISMS register: one line per
// signing position — who, their status (✓ approved / waiting / rejected /
// queued) and the date — mirroring the Unit Kerja · Nama · Approve · Tanggal
// block of the paper register. Admins also get resend / restart actions.

import { Check, Clock, FileSignature, Loader2, RotateCcw, Send, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { SignatureQrButton } from '@/components/documents/SignatureQr'

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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_STYLE: Record<ApprovalStep['status'], { icon: React.ReactNode; className: string; label: string }> = {
  approved: { icon: <Check className="size-3" strokeWidth={3} />, className: 'bg-emerald-600 text-white', label: 'Disetujui' },
  pending: { icon: <Clock className="size-3" />, className: 'bg-amber-400 text-amber-950', label: 'Menunggu' },
  rejected: { icon: <X className="size-3" strokeWidth={3} />, className: 'bg-red-600 text-white', label: 'Ditolak' },
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
}) {
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
              {step.status === 'rejected' && step.decision_note && <p className="mt-0.5 text-[11px] text-red-700">Alasan: {step.decision_note}</p>}
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
