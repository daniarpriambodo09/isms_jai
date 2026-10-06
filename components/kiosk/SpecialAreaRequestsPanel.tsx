// components/kiosk/SpecialAreaRequestsPanel.tsx
// Lobby kiosk: submit + track "Ijin Masuk Area Special Security" requests.
'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ShieldAlert, UserPlus } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { SpecialAreaFormModal } from '@/components/special-area/SpecialAreaForm'
import { SpecialAreaTable } from '@/components/special-area/SpecialAreaTable'
import { useKioskAutoRefresh } from '@/components/kiosk/kiosk-shared'
import type { SpecialAreaRequest } from '@/lib/special-area-shared'

export function SpecialAreaRequestsPanel() {
  const [open, setOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [requests, setRequests] = useState<SpecialAreaRequest[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api/special-area-requests`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setRequests(data.requests ?? [])
    } catch { /* keep the current list */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useKioskAutoRefresh(load)

  const pending = requests.filter((r) => r.status === 'pending').length

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* On a phone the actions drop under the title instead of squeezing it to one word per line. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3 px-4 py-4 sm:px-5">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-w-0 flex-1 basis-60 items-center gap-3 text-left">
          <span className="grid size-9 flex-shrink-0 place-items-center rounded-lg bg-[#c7161e] text-white"><ShieldAlert className="size-4" /></span>
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              Izin Masuk Area Special Security
              {pending > 0 && <span className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-[10px] font-bold text-[#8a6100]">{pending} menunggu</span>}
            </p>
            <p className="text-xs text-muted-foreground">Form ISMS-F-006-001 — disetujui approver via email (e-sign)</p>
          </div>
        </button>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button type="button" onClick={() => setFormOpen(true)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#c7161e] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 sm:flex-none">
            <UserPlus className="size-3.5" />Ajukan Izin Area Special
          </button>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Tutup daftar' : 'Buka daftar'} className="ml-auto grid size-8 flex-shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary">
            <ChevronDown className={`size-5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border p-5">
          <SpecialAreaTable requests={requests} loading={loading} onChanged={load} />
        </div>
      )}
      {formOpen && <SpecialAreaFormModal onClose={() => setFormOpen(false)} onSaved={load} />}
    </div>
  )
}
