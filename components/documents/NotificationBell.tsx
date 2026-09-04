'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, Camera } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'

type PendingRequest = {
  id: number
  request_type: 'internal' | 'visitor'
  requester_name: string
  dept_or_company: string
  location: string
  submitted_at: string
}

const POLL_MS = 30000

function formatRelative(value: string) {
  const diffMin = Math.floor((Date.now() - new Date(value).getTime()) / 60000)
  if (diffMin < 1) return 'Baru saja'
  if (diffMin < 60) return `${diffMin} menit lalu`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} jam lalu`
  return `${Math.floor(diffHour / 24)} hari lalu`
}

export function NotificationBell() {
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEscapeClose(open, () => setOpen(false))

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api/photo-video-requests?status=pending`, { cache: 'no-store', credentials: 'include' })
      if (!res.ok) { setRequests([]); return }
      const data = await res.json()
      setRequests(data.requests ?? [])
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, POLL_MS)
    return () => clearInterval(interval)
  }, [load])

  const count = requests.length

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `Notifikasi, ${count} pengajuan menunggu` : 'Notifikasi'}
        className="relative grid size-10 place-items-center rounded-md text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
      >
        <Bell className="size-[18px]" />
        {count > 0 && (
          <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-accent text-[9px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            aria-label="Notifications"
            className="absolute right-0 top-[calc(100%+10px)] z-20 w-80 overflow-hidden rounded-2xl text-popover-foreground"
            style={{
              animation: 'dropdown-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both',
              background: 'linear-gradient(160deg, rgba(255,255,255,0.97) 0%, rgba(240,247,251,0.98) 100%)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 20px 45px oklch(0.2 0.05 220 / 25%), 0 0 0 1px oklch(0.48 0.12 180 / 12%), inset 0 1px 0 rgba(255,255,255,0.85)',
            }}
          >
            <div className="nav-dropdown-bar h-[2.5px] w-full" />
            <div className="border-b border-border/60 px-4 py-3">
              <p className="portal-eyebrow">Notifications</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {count > 0 ? `${count} pengajuan foto/video menunggu persetujuan` : 'Tidak ada pengajuan baru'}
              </p>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading && <p className="px-4 py-6 text-center text-xs text-muted-foreground">Memuat...</p>}
              {!loading && requests.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <Camera className="mx-auto mb-2 size-7 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Belum ada pengajuan izin foto/video baru.</p>
                </div>
              )}
              {requests.map((req) => (
                <Link
                  key={req.id}
                  href="/kelola-permintaan-foto-video?status=pending"
                  onClick={() => setOpen(false)}
                  className="nav-drop-item flex items-start gap-3 border-b border-border/60 px-4 py-3 text-sm last:border-0"
                >
                  <span className="mt-0.5 grid size-8 flex-none place-items-center rounded-full bg-accent/15 text-accent-foreground">
                    <Camera className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{req.requester_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {req.request_type === 'internal' ? 'Internal' : 'Visitor'} &middot; {req.location}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground/70">{formatRelative(req.submitted_at)}</span>
                  </span>
                </Link>
              ))}
            </div>

            {requests.length > 0 && (
              <Link
                href="/kelola-permintaan-foto-video?status=pending"
                onClick={() => setOpen(false)}
                className="nav-drop-item block border-t border-border/60 px-4 py-2.5 text-center text-xs font-semibold text-primary"
              >
                Lihat semua pengajuan
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  )
}
