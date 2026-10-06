// components/kiosk/PhotoVideoRequestsPanel.tsx
'use client'

import { useState } from 'react'
import { Camera, ChevronDown, Sparkles, UserPlus, Users, X } from 'lucide-react'
import { PhotoVideoLedgerTable } from '@/components/documents/PhotoVideoLedgerTable'
import { PhotoVideoRequestForm } from '@/components/documents/PhotoVideoRequestForm'
import { useEscapeClose } from '@/hooks/useEscapeClose'

function PhotoVideoFormModal({ onClose }: { onClose: () => void }) {
  const [locale, setLocale] = useState<'internal' | 'visitor'>('visitor')
  useEscapeClose(true, onClose)
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ajukan Izin Foto/Video"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="fixed right-6 top-6 z-10 grid size-9 place-items-center rounded-full bg-card text-muted-foreground shadow-md transition hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <div className="mb-4 flex justify-center">
          <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setLocale('internal')}
              className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${locale === 'internal' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Users className="size-3.5" /> Internal
            </button>
            <button
              type="button"
              onClick={() => setLocale('visitor')}
              className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${locale === 'visitor' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Sparkles className="size-3.5" /> Visitor
            </button>
          </div>
        </div>
        <PhotoVideoRequestForm locale={locale} />
      </div>
    </div>
  )
}

// Used by both the Lobby and Security kiosk views — both roles already have
// kiosk-level read access to every request (and, via the PDF route's
// kiosk-gated check, to the resulting Visitor PDF), so the recap here is
// the exact same Internal/Visitor table as the full /rekap-foto-video page.
// "Ajukan Izin Foto/Video" opens the request form (Internal / Visitor) right
// from the kiosk; canSubmit=false would leave only the recap.
export function PhotoVideoRequestsPanel({ canSubmit = true }: { canSubmit?: boolean }) {
  const [open, setOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* On a phone the actions drop under the title instead of squeezing it to one word per line. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3 px-4 py-4 sm:px-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 basis-60 items-center gap-3 text-left"
        >
          <span
            className="grid size-9 flex-shrink-0 place-items-center rounded-lg text-white"
            style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--p-550) 100%)' }}
          >
            <Camera className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Izin Foto/Video</p>
            <p className="text-xs text-muted-foreground">Rekap pengajuan izin foto/video Internal &amp; Visitor — Visitor disetujui PIC Approve lewat email, Internal oleh Admin ISM</p>
          </div>
        </button>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {canSubmit && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5 sm:flex-none"
            >
              <UserPlus className="size-3.5" />Ajukan Izin Foto/Video
            </button>
          )}
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? 'Tutup rekap' : 'Buka rekap'} className="ml-auto grid size-8 flex-shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary">
            <ChevronDown className={`size-5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border p-5">
          <PhotoVideoLedgerTable canViewPdf />
        </div>
      )}

      {formOpen && <PhotoVideoFormModal onClose={() => setFormOpen(false)} />}
    </div>
  )
}
