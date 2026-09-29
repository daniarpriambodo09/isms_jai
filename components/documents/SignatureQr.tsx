'use client'

// One approver's e-signature QR for a Prosedur ISMS document. The QR encodes
// the public verification link (/verifikasi-pengesahan?code=…), so scanning
// it shows who signed, as what, which document/revision and when.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { Download, ExternalLink, QrCode, ShieldCheck, X } from 'lucide-react'
import { useEscapeClose } from '@/hooks/useEscapeClose'

export type SignatureInfo = {
  code: string
  name: string
  roleTitle: string
  decidedAt: string
  documentLabel: string
}

export function useQrDataUrl(value: string | null, size = 480) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!value) { setDataUrl(null); return }
    let cancelled = false
    QRCode.toDataURL(value, { margin: 1, width: size, errorCorrectionLevel: 'M' })
      .then((url) => { if (!cancelled) setDataUrl(url) })
      .catch(() => { if (!cancelled) setDataUrl(null) })
    return () => { cancelled = true }
  }, [value, size])
  return dataUrl
}

function fmt(value: string) {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })
}

// Inline card (approval page, after approving).
export function SignatureCard({ info, verifyBase }: { info: SignatureInfo; verifyBase: string }) {
  const url = `${verifyBase}${info.code}`
  const qr = useQrDataUrl(url, 360)
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-emerald-600/25 bg-emerald-50/60 p-4">
      <div className="grid size-28 flex-none place-items-center rounded-xl bg-white p-1.5 ring-1 ring-emerald-600/20">
        {qr ? <img src={qr} alt={`QR tanda tangan ${info.name}`} className="size-full" /> : <QrCode className="size-8 text-muted-foreground" />}
      </div>
      <div className="min-w-0 text-sm">
        <p className="flex items-center gap-1.5 font-mono-label text-[10px] font-semibold text-emerald-700"><ShieldCheck className="size-3.5" /> Tanda tangan elektronik</p>
        <p className="mt-1 font-semibold text-foreground">{info.name}</p>
        <p className="text-xs text-muted-foreground">{info.roleTitle} · {fmt(info.decidedAt)}</p>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">{info.code}</p>
        {qr && (
          <a href={qr} download={`ttd-${info.code}.png`} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline">
            <Download className="size-3.5" /> Unduh QR
          </a>
        )}
      </div>
    </div>
  )
}

// Small trigger + modal (register table).
export function SignatureQrButton({ info, verifyBase }: { info: SignatureInfo; verifyBase: string }) {
  const [open, setOpen] = useState(false)
  const url = `${verifyBase}${info.code}`
  const qr = useQrDataUrl(open ? url : null)
  useEscapeClose(open, () => setOpen(false))

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`QR tanda tangan ${info.name}`}
        aria-label={`QR tanda tangan ${info.name}`}
        className="ml-1 inline-grid size-5 place-items-center rounded align-middle text-emerald-700 transition hover:bg-emerald-600/10"
      >
        <QrCode className="size-3.5" />
      </button>

      {/* Portaled to <body>: the trigger sits inline inside a <p>, which can't contain the dialog's block content. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[color-mix(in_oklch,_var(--p-950)_55%,_transparent)] p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={`Tanda tangan ${info.name}`} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 bg-[color:var(--p-900)] px-5 py-4 text-primary-foreground">
              <div>
                <p className="flex items-center gap-1.5 font-mono-label text-[10px] text-accent"><ShieldCheck className="size-3.5" /> Tanda tangan elektronik</p>
                <p className="mt-1 text-lg font-semibold">{info.name}</p>
                <p className="text-xs text-primary-foreground/65">{info.roleTitle}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup" className="grid size-8 place-items-center rounded-full text-primary-foreground/70 hover:bg-white/10"><X className="size-4" /></button>
            </div>
            <div className="flex flex-col items-center gap-3 p-5">
              <div className="grid size-60 place-items-center rounded-xl bg-white p-2 ring-1 ring-border">
                {qr ? <img src={qr} alt={`QR tanda tangan ${info.name}`} className="size-full" /> : <QrCode className="size-10 animate-pulse text-muted-foreground" />}
              </div>
              <p className="font-mono text-xs text-muted-foreground">{info.code}</p>
              <p className="text-center text-xs leading-5 text-muted-foreground">
                Disetujui {fmt(info.decidedAt)}<br />untuk <span className="font-medium text-foreground">{info.documentLabel}</span>
              </p>
              <div className="flex w-full gap-2">
                {qr && (
                  <a href={qr} download={`ttd-${info.code}.png`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                    <Download className="size-4" /> Unduh QR
                  </a>
                )}
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary">
                  <ExternalLink className="size-4" /> Verifikasi
                </a>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
