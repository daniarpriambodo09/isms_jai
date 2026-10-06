// app/notifikasi/page.tsx
//
// ISM Admin: "Riwayat Notifikasi" — everything the portal told the admins
// about in the last 90 days (new requests, decisions by e-mail, documents
// signed or sent back, e-mails that failed, …), newest first, grouped by day,
// filterable by area. What still needs action lives in the bell.

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bell, CalendarClock, Camera, FileSignature, History, Loader2, RotateCcw, ShieldAlert, UserPlus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { AdminGate } from '@/components/admin-gate'

type Category = 'photo' | 'special' | 'esign' | 'guest' | 'review'
type Entry = { id: number; kind: string; category: Category; title: string; body: string | null; href: string | null; createdAt: string; seenAt: string | null }

const FILTERS: { value: Category | ''; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'esign', label: 'Pengesahan Dokumen' },
  { value: 'photo', label: 'Izin Foto/Video' },
  { value: 'special', label: 'Izin Area Special' },
]
const ICON: Record<Category, typeof Bell> = { photo: Camera, special: ShieldAlert, esign: FileSignature, guest: UserPlus, review: CalendarClock }

// Colour from what happened (…_approved, …_rejected, …_mailfail, …).
function toneOf(kind: string) {
  if (/_(approved)$/.test(kind)) return 'bg-emerald-100 text-emerald-700'
  if (/_(rejected|mailfail)$/.test(kind)) return 'bg-[#fbe6e0] text-[#b3361f]'
  if (/_(stuck)$/.test(kind)) return 'bg-amber-100 text-amber-800'
  if (/_new$/.test(kind)) return 'bg-primary/15 text-primary'
  return 'bg-secondary text-[color:var(--p-600)]'
}

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
function dayLabel(key: string) {
  const today = dayKey(new Date().toISOString())
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString())
  if (key === today) return 'Hari ini'
  if (key === yesterday) return 'Kemarin'
  return new Date(`${key}T00:00:00+07:00`).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function NotifikasiPage() {
  const { isLoggedIn, isLoading, adminUser } = useAuth()
  const isAdmin = adminUser?.role === 'ism_admin'
  const [filter, setFilter] = useState<Category | ''>('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/admin/notifications?history=1${filter ? `&category=${filter}` : ''}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setEntries(data.history ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat riwayat.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  const days = useMemo(() => {
    const map = new Map<string, Entry[]>()
    for (const entry of entries) {
      const key = dayKey(entry.createdAt)
      map.set(key, [...(map.get(key) ?? []), entry])
    }
    return [...map.entries()]
  }, [entries])

  if (!isLoading && !isLoggedIn) return <AdminGate />
  if (!isLoading && adminUser && !isAdmin) return <AdminGate title="Akses terbatas" message="Halaman ini hanya untuk akun ISM Admin." />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"><History className="size-7 text-[color:var(--p-600)]" />Riwayat Notifikasi</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Semua kejadian yang diberitahukan ke Admin ISM selama 90 hari terakhir. Yang masih perlu ditindaklanjuti ada di lonceng notifikasi.
          </p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary">
          <RotateCcw className="size-3.5" /> Muat ulang
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" onClick={() => setFilter(f.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${filter === f.value ? 'border-transparent bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-secondary'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Memuat…</div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <Bell className="mx-auto mb-2 size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Belum ada notifikasi{filter ? ' untuk kategori ini' : ''}.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map(([key, list]) => (
            <section key={key}>
              <p className="portal-eyebrow mb-2">{dayLabel(key)} <span className="font-normal text-muted-foreground">· {list.length}</span></p>
              <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {list.map((entry) => {
                  const Icon = ICON[entry.category] ?? Bell
                  const content = (
                    <>
                      <span className={`mt-0.5 grid size-9 flex-none place-items-center rounded-full ${toneOf(entry.kind)}`}><Icon className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">{entry.title}</span>
                        {entry.body && <span className="mt-0.5 block break-words text-xs text-muted-foreground">{entry.body}</span>}
                      </span>
                      <span className="flex-none text-right text-[11px] tabular-nums text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })}
                        {!entry.seenAt && <span className="mt-1 block rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">baru</span>}
                      </span>
                    </>
                  )
                  return (
                    <li key={entry.id} className="border-b border-border last:border-0">
                      {entry.href
                        ? <Link href={entry.href} className="flex items-start gap-3 px-4 py-3 transition hover:bg-secondary/40">{content}</Link>
                        : <div className="flex items-start gap-3 px-4 py-3">{content}</div>}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
