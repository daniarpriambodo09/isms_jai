// components/kiosk/PhotoVideoRequestsPanel.tsx
'use client'

import { useState } from 'react'
import { Camera, ChevronDown } from 'lucide-react'
import { PhotoVideoLedgerTable } from '@/components/documents/PhotoVideoLedgerTable'

// Used by both the Lobby and Security kiosk views — both roles already have
// kiosk-level read access to every request (and, via the PDF route's
// kiosk-gated check, to the resulting Visitor PDF), so the recap here is
// the exact same Internal/Visitor table as the full /rekap-foto-video page.
export function PhotoVideoRequestsPanel() {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary/30"
      >
        <div className="flex items-center gap-3">
          <span
            className="grid size-9 flex-shrink-0 place-items-center rounded-lg text-white"
            style={{ background: 'linear-gradient(135deg, oklch(0.39 0.09 205) 0%, oklch(0.48 0.12 180) 100%)' }}
          >
            <Camera className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Izin Foto/Video</p>
            <p className="text-xs text-muted-foreground">Rekap pengajuan izin foto/video, Internal &amp; Visitor — persetujuan hanya diproses oleh Admin ISM</p>
          </div>
        </div>
        <ChevronDown className={`size-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-border p-5">
          <PhotoVideoLedgerTable canViewPdf />
        </div>
      )}
    </div>
  )
}
