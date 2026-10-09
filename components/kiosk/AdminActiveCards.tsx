// components/kiosk/AdminActiveCards.tsx
'use client'

// "Kartu Sedang Digunakan" for the ISM Admin's dashboard: the same live panel
// the Lobby and Pos Security kiosks show — guest cards plus the cards out on
// photo / special-area permits — with the way into either kiosk.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { ActiveCardsWidget } from '@/components/kiosk/ActiveCardsWidget'
import { useKioskAutoRefresh, usePermitCards, type Registration } from '@/components/kiosk/kiosk-shared'

export function AdminActiveCards() {
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [error, setError] = useState<string | null>(null)
  const permitCards = usePermitCards()

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations?sort=newest`, { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setRegistrations(data.registrations ?? [])
      setError(null)
    } catch (e) {
      // keep the last list; just say it couldn't be refreshed
      setError(e instanceof Error && e.message ? e.message : 'Gagal memuat kartu tamu.')
    }
  }, [])

  useEffect(() => { load() }, [load])
  useKioskAutoRefresh(load)

  return (
    <section aria-label="Kartu sedang digunakan">
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
        {error && <p className="mr-auto text-xs text-destructive">{error}</p>}
        <Link href="/admin-lobby" className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary">
          Buka Admin Lobby <ArrowUpRight className="size-3.5" />
        </Link>
        <Link href="/admin-pos-security" className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary">
          Buka Pos Security <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
      <ActiveCardsWidget registrations={registrations} cardTypes={['visitor', 'vendor', 'special_area', 'photography', 'affiliate']} permitCards={permitCards} />
    </section>
  )
}
