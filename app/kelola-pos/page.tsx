// app/kelola-pos/page.tsx
//
// Pengaturan Pos (ISM Admin): switch the two guest posts on or off. Once
// guest registration is centralised at one post, the other is switched off —
// its page then only says so and its account can't change guest data, while
// the post still in use takes over the whole flow. At least one stays on.

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ConciergeBell, Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { AdminGate } from '@/components/admin-gate'
import { toast } from '@/components/toast'
import type { KioskStations } from '@/components/kiosk/kiosk-stations-ui'

const POSTS = [
  {
    key: 'lobby' as const,
    name: 'Admin Lobby',
    href: '/admin-lobby',
    icon: ConciergeBell,
    on: 'Memberi kartu area kerja (Visitor, Vendor, Affiliate) dan menukarnya dengan kartu Security.',
    takeover: 'Bila dinonaktifkan, Pos Security mengambil alih seluruh pendaftaran dan semua kartu.',
  },
  {
    key: 'security' as const,
    name: 'Pos Security',
    href: '/admin-pos-security',
    icon: ShieldCheck,
    on: 'Mendaftarkan tamu di gerbang dan memberi kartu Visitor Security.',
    takeover: 'Bila dinonaktifkan, Admin Lobby menangani seluruh pendaftaran tamu, vendor dan supplier.',
  },
]

export default function KelolaPosPage() {
  const { isLoggedIn, isLoading, adminUser } = useAuth()
  const isAdmin = adminUser?.role === 'ism_admin'
  const [stations, setStations] = useState<KioskStations | null>(null)
  const [saving, setSaving] = useState<'lobby' | 'security' | null>(null)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/kiosk-stations`, { cache: 'no-store' })
      .then((response) => response.json())
      .then(setStations)
      .catch(() => setStations({ lobby: true, security: true }))
  }, [])

  const toggle = async (key: 'lobby' | 'security') => {
    if (!stations) return
    const next = { lobby: stations.lobby, security: stations.security, [key]: !stations[key] }
    if (!next.lobby && !next.security) { toast('Minimal satu pos harus tetap aktif.', 'error'); return }
    setSaving(key)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/kiosk-stations`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) { toast(body.message ?? 'Gagal menyimpan pengaturan pos.', 'error'); return }
      setStations(body)
      const name = POSTS.find((post) => post.key === key)!.name
      toast(next[key] ? `${name} diaktifkan kembali.` : `${name} dinonaktifkan — pendaftaran dipusatkan di ${key === 'lobby' ? 'Pos Security' : 'Admin Lobby'}.`)
    } catch { toast('Gagal menyimpan pengaturan pos.', 'error') } finally { setSaving(null) }
  }

  if (!isLoading && !isLoggedIn) return <AdminGate />
  if (!isLoading && adminUser && !isAdmin) return <AdminGate title="Akses terbatas" message="Halaman ini hanya untuk akun ISM Admin." />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Pengaturan Pos</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
          Pos pendaftaran tamu yang dipakai. Bila semua pendaftaran tamu, vendor dan supplier sudah dipusatkan di satu pos, nonaktifkan pos yang lain.
          Minimal satu pos harus tetap aktif; pos yang dinonaktifkan bisa diaktifkan kembali kapan saja.
        </p>
      </div>

      {!stations ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Memuat…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {POSTS.map((post) => {
            const on = stations[post.key]
            const Icon = post.icon
            const lastOn = on && !stations[post.key === 'lobby' ? 'security' : 'lobby']
            return (
              <section key={post.key} className={`flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm ${on ? 'border-border' : 'border-dashed border-border opacity-90'}`}>
                <div className="flex items-start gap-3">
                  <span className={`grid size-10 flex-none place-items-center rounded-xl ${on ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}><Icon className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-foreground">{post.name}</h3>
                    <p className={`mt-0.5 text-xs font-semibold ${on ? 'text-emerald-700' : 'text-muted-foreground'}`}>{on ? (lastOn ? 'Aktif — semua pendaftaran di sini' : 'Aktif') : 'Nonaktif'}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={`${post.name} aktif`}
                    onClick={() => toggle(post.key)}
                    disabled={saving !== null || lastOn}
                    title={lastOn ? 'Minimal satu pos harus tetap aktif' : on ? `Nonaktifkan ${post.name}` : `Aktifkan ${post.name}`}
                    className={`relative h-7 w-12 flex-none rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${on ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    {saving === post.key ? <Loader2 className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" /> : <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />}
                  </button>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{post.on}</p>
                <p className="rounded-xl bg-secondary/50 px-3 py-2 text-xs leading-5 text-muted-foreground">{post.takeover}</p>
                <Link href={post.href} className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-primary hover:underline">Buka {post.name} <ArrowUpRight className="size-3.5" /></Link>
              </section>
            )
          })}
        </div>
      )}
      {stations?.updatedBy && stations.updatedAt && (
        <p className="text-xs text-muted-foreground">Terakhir diubah oleh {stations.updatedBy} · {new Date(stations.updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
      )}
    </div>
  )
}
