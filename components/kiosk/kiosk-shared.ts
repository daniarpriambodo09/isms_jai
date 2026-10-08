// components/kiosk/kiosk-shared.ts
// Types, constants and pure helpers shared by the kiosk views (LobbyView, used by both Admin Lobby and Pos Security) —
// both render the same vendor_registrations data, just filtered/labeled
// differently for their respective kiosk role.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_BASE_PATH } from '@/lib/config'
import type { CardType, PermitCard } from '@/components/kiosk/ActiveCardsWidget'

// Lobby and Security work the same guests from two different kiosks
// (Security approves → Lobby swaps cards → Security closes), so each screen
// re-reads the shared list on an interval and whenever the kiosk window
// regains focus — otherwise one side only sees the other's changes after a
// manual "Muat Ulang".
export const KIOSK_REFRESH_MS = 10_000

export function useKioskAutoRefresh(refresh: () => void, intervalMs = KIOSK_REFRESH_MS) {
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') refresh() }
    const timer = window.setInterval(tick, intervalMs)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [refresh, intervalMs])
}

// Cards that are out on a permit instead of a guest registration, for "Kartu
// Sedang Digunakan" at both kiosks:
// - the ID Photography entered on an Ijin Foto/Video request → Photography;
// - the ID Card No. entered (or scanned) on an Izin Masuk Area Special → Special Area.
// A card counts while its request isn't rejected and its period isn't long
// over (and, for photos, until they are marked as taken).
const PERMIT_CARD_GRACE_MS = 12 * 3_600_000

const CARDS_CHANGED = 'isms:cards-changed'
/** Call after saving a permit's card number, so "Kartu Sedang Digunakan" doesn't wait for its next refresh. */
export function cardsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CARDS_CHANGED))
}

export function usePermitCards(): PermitCard[] {
  const [photo, setPhoto] = useState<PermitCard[]>([])
  const [special, setSpecial] = useState<PermitCard[]>([])
  const load = useCallback(async () => {
    const stillOut = (toAt: string) => Date.parse(toAt) > Date.now() - PERMIT_CARD_GRACE_MS
    const waiting = (status: string) => (status === 'pending' ? ' (menunggu)' : '')
    // each list on its own: one that fails keeps what it showed
    try {
      const res = await fetch(`${API_BASE_PATH}/api/photo-video-requests`, { cache: 'no-store', credentials: 'include' })
      if (res.ok) {
        const data = await res.json() as { requests?: { id: number; requester_name: string; photo_id_no: string | null; status: string; taken_at: string | null; from_at: string; to_at: string }[] }
        setPhoto((data.requests ?? [])
          .filter((r) => r.photo_id_no?.trim() && r.status !== 'rejected' && !r.taken_at && stillOut(r.to_at))
          .map((r) => ({ key: `foto-${r.id}`, type: 'photography' as const, name: r.requester_name, code: r.photo_id_no!.trim(), from: r.from_at, note: `izin foto${waiting(r.status)}` })))
      }
    } catch { /* keep what is shown */ }
    try {
      const res = await fetch(`${API_BASE_PATH}/api/special-area-requests`, { cache: 'no-store', credentials: 'include' })
      if (res.ok) {
        const data = await res.json() as { requests?: { id: number; requester_name: string; id_card_no: string | null; status: string; from_at: string; to_at: string }[] }
        setSpecial((data.requests ?? [])
          .filter((r) => r.id_card_no?.trim() && r.status !== 'rejected' && stillOut(r.to_at))
          .map((r) => ({ key: `area-${r.id}`, type: 'special_area' as const, name: r.requester_name, code: r.id_card_no!.trim(), from: r.from_at, note: `izin area special${waiting(r.status)}` })))
      }
    } catch { /* keep what is shown */ }
  }, [])
  useEffect(() => { load() }, [load])
  useKioskAutoRefresh(load)
  // A card number just entered or scanned on this screen shows up at once (see cardsChanged).
  useEffect(() => {
    window.addEventListener(CARDS_CHANGED, load)
    return () => window.removeEventListener(CARDS_CHANGED, load)
  }, [load])
  return useMemo(() => [...photo, ...special], [photo, special])
}

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
  /** The kiosk the guest was registered at (null on rows from before it was recorded). */
  registered_station?: 'lobby' | 'security' | null
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

// Where a guest was registered — the "Asal" column and the per-post recap.
// entry_path describes the card flow (both kiosks now issue cards directly),
// so it only stands in for rows older than registered_station.
export function stationOf(r: Pick<Registration, 'entry_path' | 'registered_station'>): 'lobby' | 'security' {
  return r.registered_station ?? (r.entry_path === 'security' ? 'security' : 'lobby')
}
