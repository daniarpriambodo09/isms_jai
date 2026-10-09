// components/kiosk/kiosk-stations-ui.tsx
'use client'

// What the kiosk pages show for the "Pengaturan Pos" setting (lib/kiosk-stations.ts):
// a post switched off says so instead of its view; the post still in use
// carries a line saying it now handles every guest.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LogOut, PowerOff, Settings } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'

export type KioskStations = { lobby: boolean; security: boolean; updatedAt?: string | null; updatedBy?: string | null }

/** The setting, or null while it loads. A failed request counts as "both on" (how the posts work by default). */
export function useKioskStations(): KioskStations | null {
  const [stations, setStations] = useState<KioskStations | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_PATH}/api/kiosk-stations`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { lobby: true, security: true }))
      .catch(() => ({ lobby: true, security: true }))
      .then((value: KioskStations) => { if (!cancelled) setStations(value) })
    return () => { cancelled = true }
  }, [])
  return stations
}

const NAMES = { lobby: 'Admin Lobby', security: 'Pos Security' } as const

export function StationOff({ station, isIsmAdmin }: { station: 'lobby' | 'security'; isIsmAdmin: boolean }) {
  const { logout } = useAuth()
  const other = station === 'lobby' ? 'security' : 'lobby'
  const otherPath = other === 'lobby' ? '/admin-lobby' : '/admin-pos-security'
  return (
    <div className="grid min-h-[70vh] place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-secondary text-muted-foreground"><PowerOff className="size-7" /></span>
        <h1 className="mt-5 font-display text-2xl font-semibold text-foreground">{NAMES[station]} dinonaktifkan</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Semua pendaftaran tamu, vendor dan supplier sekarang dipusatkan di <strong className="text-foreground">{NAMES[other]}</strong>.
          {' '}Pos ini bisa diaktifkan kembali oleh Admin ISM di Pengaturan Pos.
        </p>
        {!isIsmAdmin && (
          <button type="button" onClick={() => logout()} className="mt-6 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"><LogOut className="size-4" /> Keluar</button>
        )}
        {isIsmAdmin && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href={otherPath} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Buka {NAMES[other]}</Link>
            <Link href="/kelola-pos" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"><Settings className="size-4" /> Pengaturan Pos</Link>
          </div>
        )}
      </div>
    </div>
  )
}

export function StationNotice({ text }: { text: string }) {
  return <div role="status" className="bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900">{text}</div>
}
