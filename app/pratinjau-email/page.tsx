// app/pratinjau-email/page.tsx
//
// ISM Admin: what every e-mail of the portal looks like, before anyone
// receives one — a sample of each (per register: request, re-submission,
// reminder, result; plus Izin Foto/Video, Izin Area Special and the weekly
// review digest), rendered by the real templates from made-up data.

'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Mail, Monitor, Smartphone } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { AdminGate } from '@/components/admin-gate'

type Item = { id: string; group: string; label: string; to: string }

export default function PratinjauEmailPage() {
  const { isLoggedIn, isLoading, adminUser } = useAuth()
  const isAdmin = adminUser?.role === 'ism_admin'
  const [items, setItems] = useState<Item[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [mail, setMail] = useState<{ subject: string; html: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState<'desktop' | 'phone'>('desktop')

  useEffect(() => {
    if (!isAdmin) return
    fetch(`${API_BASE_PATH}/api/admin/email-preview`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { items?: Item[] }) => { setItems(data.items ?? []); setSelected((current) => current ?? data.items?.[0]?.id ?? null) })
      .catch(() => setError('Gagal memuat daftar email.'))
  }, [isAdmin])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`${API_BASE_PATH}/api/admin/email-preview?id=${encodeURIComponent(selected)}`, { cache: 'no-store' })
      .then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.message); return data })
      .then((data) => { if (!cancelled) setMail(data) })
      .catch((e) => { if (!cancelled) { setMail(null); setError(e instanceof Error ? e.message : 'Gagal membuat pratinjau.') } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selected])

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const item of items) map.set(item.group, [...(map.get(item.group) ?? []), item])
    return [...map.entries()]
  }, [items])
  const current = items.find((item) => item.id === selected)

  if (!isLoading && !isLoggedIn) return <AdminGate />
  if (!isLoading && adminUser && !isAdmin) return <AdminGate title="Akses terbatas" message="Halaman ini hanya untuk akun ISM Admin." />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Pratinjau Email</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Contoh setiap email yang dikirim portal, dibuat dari data contoh oleh template yang sama dengan email sungguhan. Tidak ada email yang terkirim dari halaman ini.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* Which e-mail */}
        <nav aria-label="Daftar email" className="flex flex-col gap-4 lg:max-h-[78vh] lg:overflow-y-auto lg:pr-1">
          <label className="lg:hidden">
            <span className="sr-only">Pilih email</span>
            <select value={selected ?? ''} onChange={(e) => setSelected(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold text-foreground">
              {groups.map(([group, list]) => (
                <optgroup key={group} label={group}>
                  {list.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          {groups.map(([group, list]) => (
            <div key={group} className="hidden lg:block">
              <p className="portal-eyebrow mb-1.5">{group}</p>
              <ul className="flex flex-col gap-1">
                {list.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(item.id)}
                      aria-current={item.id === selected}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-[13px] transition ${item.id === selected ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card text-foreground hover:bg-secondary'}`}
                    >
                      <span className="font-semibold">{item.label}</span>
                      <span className={`flex-none text-[10.5px] ${item.id === selected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{item.to}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* The e-mail */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/30 px-5 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-mono-label text-[10px] text-muted-foreground"><Mail className="size-3.5" /> {current ? `${current.group} · kepada ${current.to}` : 'Email'}</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground" title={mail?.subject}>{mail?.subject ?? '—'}</p>
            </div>
            <div role="group" aria-label="Lebar pratinjau" className="flex rounded-full border border-border bg-card p-0.5 text-xs font-semibold">
              {([['desktop', 'Komputer', Monitor], ['phone', 'HP', Smartphone]] as const).map(([value, label, Icon]) => (
                <button key={value} type="button" aria-pressed={width === value} onClick={() => setWidth(value)} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition ${width === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative bg-muted/50 p-3 sm:p-5">
            {loading && <div className="absolute inset-0 z-10 grid place-items-center bg-card/50"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}
            {error && <p className="mx-auto max-w-md rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-center text-sm text-destructive">{error}</p>}
            {mail && (
              // sandboxed: the sample's links and scripts do nothing here
              <iframe
                title="Pratinjau email"
                sandbox=""
                srcDoc={mail.html}
                className="mx-auto block h-[72vh] w-full rounded-lg border border-border bg-white shadow-sm transition-[max-width]"
                style={{ maxWidth: width === 'phone' ? 390 : 720 }}
              />
            )}
          </div>
          <p className="border-t border-border px-5 py-2.5 text-[11.5px] text-muted-foreground">
            Tampilan di aplikasi email (Gmail, Outlook) bisa sedikit berbeda. Nama, nomor, dan tanggal di atas hanyalah contoh; tombol di dalam pratinjau tidak berfungsi.
          </p>
        </section>
      </div>
    </div>
  )
}
