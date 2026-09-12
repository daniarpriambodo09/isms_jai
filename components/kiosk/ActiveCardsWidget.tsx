// components/kiosk/ActiveCardsWidget.tsx
'use client'

import { ScanLine } from 'lucide-react'

export type CardType = 'visitor' | 'vendor' | 'affiliate' | 'special_area' | 'photography'

type MinimalRegistration = {
  id: number
  full_name: string
  stage: 'pending_approval' | 'active' | 'closed'
  current_card_type: CardType | null
  entry_at: string | null
  visitor_card_barcode?: string | null
  vendor_card_barcode?: string | null
  affiliate_card_barcode?: string | null
  special_area_card_barcode?: string | null
  photography_card_barcode?: string | null
}

const CARD_BARCODE_FIELD: Record<CardType, keyof MinimalRegistration> = {
  visitor: 'visitor_card_barcode',
  vendor: 'vendor_card_barcode',
  affiliate: 'affiliate_card_barcode',
  special_area: 'special_area_card_barcode',
  photography: 'photography_card_barcode',
}

const CARD_META: Record<CardType, { label: string; bg: string; color: string }> = {
  visitor: { label: 'Visitor', bg: '#dff5e6', color: '#1a6e3a' },
  vendor: { label: 'Vendor', bg: '#edf6ff', color: '#1a5fa0' },
  affiliate: { label: 'Affiliate', bg: '#f7f0ff', color: '#6a30a0' },
  special_area: { label: 'Special Area', bg: '#fde2e2', color: '#a13030' },
  photography: { label: 'Photography', bg: '#fff3d6', color: '#8a6100' },
}

function formatShortDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

// Live "which physical cards are currently checked out" panel, grouped by card
// type — mirrors the legacy Lobby system's usage-count columns, minus the fixed
// card-number inventory (this app keeps free-form barcodes on purpose).
export function ActiveCardsWidget({
  registrations,
  cardTypes,
}: {
  registrations: MinimalRegistration[]
  cardTypes: CardType[]
}) {
  const active = registrations.filter((r) => r.stage === 'active' && r.current_card_type)

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-5 py-3">
        <ScanLine className="size-4 text-muted-foreground" />
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Kartu Sedang Digunakan</p>
      </div>
      <div className="grid gap-px bg-border" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {cardTypes.map((type) => {
          const meta = CARD_META[type]
          const items = active.filter((r) => r.current_card_type === type)
          return (
            <div key={type} className="bg-card p-4">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                  style={{ background: meta.bg, color: meta.color }}
                >
                  {meta.label}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">{items.length}</span>
              </div>
              <div className="max-h-32 space-y-1.5 overflow-y-auto pr-1">
                {items.length === 0 && <p className="text-[11px] text-muted-foreground/60">Tidak ada</p>}
                {items.map((r) => (
                  <div key={r.id} className="text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-foreground">{r.full_name}</span>
                      <span className="flex-shrink-0 text-muted-foreground">{formatShortDate(r.entry_at)}</span>
                    </div>
                    <span className="font-mono text-[10px] font-semibold tracking-wide text-muted-foreground">
                      {r[CARD_BARCODE_FIELD[type]] ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
