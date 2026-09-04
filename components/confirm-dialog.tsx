// components/confirm-dialog.tsx
'use client'

import { AlertTriangle, HelpCircle, Loader2 } from 'lucide-react'
import { useEscapeClose } from '@/hooks/useEscapeClose'

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  danger = true,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEscapeClose(open && !pending, onCancel)

  if (!open) return null

  const accentGradient = danger
    ? 'linear-gradient(135deg, #a03a3a 0%, #c24f3f 100%)'
    : 'linear-gradient(135deg, #1a5f7a 0%, #278e84 100%)'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <style>{`
        @keyframes confirm-pop-in {
          0% { opacity: 0; transform: scale(0.92) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes confirm-backdrop-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .confirm-backdrop { animation: confirm-backdrop-in 180ms ease-out both; }
        .confirm-card { animation: confirm-pop-in 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .confirm-btn { transition: transform 150ms, box-shadow 150ms, background 150ms; }
        .confirm-btn:not(:disabled):hover { transform: translateY(-1px); }
        .confirm-btn:not(:disabled):active { transform: translateY(0) scale(0.98); }
        .confirm-btn:disabled { opacity: 0.65; cursor: not-allowed; }
      `}</style>

      <div
        className="confirm-backdrop absolute inset-0"
        style={{ background: 'rgba(8,18,32,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onCancel}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="confirm-card relative z-10 w-full max-w-sm overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(240,247,251,0.99) 100%)',
          boxShadow: '0 28px 60px rgba(14,34,53,0.35), 0 0 0 1px rgba(255,255,255,0.6)',
        }}
      >
        <div className="h-[3px] w-full" style={{ background: accentGradient }} />

        <div className="p-6">
          <div className="flex items-start gap-3.5">
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: accentGradient, boxShadow: danger ? '0 6px 16px rgba(160,58,58,0.35)' : '0 6px 16px rgba(39,142,132,0.35)' }}
            >
              {danger ? <AlertTriangle className="h-5 w-5 text-white" /> : <HelpCircle className="h-5 w-5 text-white" />}
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 className="text-[15px] font-bold leading-tight" style={{ color: '#12293a' }}>{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: '#7290a5' }}>{message}</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="confirm-btn rounded-lg border px-4 py-2 text-[13px] font-semibold"
              style={{ borderColor: '#dce6ed', color: '#4a6278', background: '#ffffff' }}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="confirm-btn inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white"
              style={{ background: accentGradient, boxShadow: danger ? '0 4px 14px rgba(160,58,58,0.35)' : '0 4px 14px rgba(39,142,132,0.35)' }}
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
