// components/kiosk/kiosk-shared.ts
// Types, constants and pure helpers shared by LobbyView and SecurityView —
// both render the same vendor_registrations data, just filtered/labeled
// differently for their respective kiosk role.

import type { CardType } from '@/components/kiosk/ActiveCardsWidget'

export type Stage = 'pending_approval' | 'active' | 'closed'
export type EntryPath = 'security' | 'lobby_affiliate'

export type Registration = {
  id: number
  full_name: string
  id_card: string
  pic_jai: string
  purpose: string
  company_remark: string
  registered_at: string
  entry_at: string | null
  exit_at: string | null
  entry_path: EntryPath
  stage: Stage
  current_card_type: CardType | null
  visitor_card_barcode: string | null
  vendor_card_barcode: string | null
  affiliate_card_barcode: string | null
  special_area_card_barcode: string | null
  photography_card_barcode: string | null
}

export const CARD_BARCODE_FIELD: Record<CardType, keyof Registration> = {
  visitor: 'visitor_card_barcode',
  vendor: 'vendor_card_barcode',
  affiliate: 'affiliate_card_barcode',
  special_area: 'special_area_card_barcode',
  photography: 'photography_card_barcode',
}

export function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const inputClass = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
export const labelClass = 'mb-1.5 block text-xs font-semibold text-muted-foreground'
