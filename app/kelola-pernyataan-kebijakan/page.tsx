// app/kelola-pernyataan-kebijakan/page.tsx
//
// ISM Admin: who has confirmed "sudah membaca & memahami" the current ISMS
// Basic Policy — recap per department + the full list, exportable to Excel
// as audit evidence. A new policy version (visuals changed) starts from zero.
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Loader2, Search, ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { AdminGate } from '@/components/admin-gate'
import { downloadExcel } from '@/lib/excel-export'

type Ack = { id: number; nik: string; full_name: string; department: string; section: string | null; acknowledged_at: string }
type Summary = { version: string; label: string; total: number; byDepartment: { department: string; n: number; last: string }[]; list: Ack[] }

const fmt = (v: string) => new Date(v).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

export default function KelolaPernyataanKebijakanPage() {
  const { isLoggedIn, isLoading, adminUser } = useAuth()
  const isAdmin = adminUser?.role === 'ism_admin'
  const [data, setData] = useState<Summary | null>(null)
  const [departments, setDepartments] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [dept, setDept] = useState('')

  const load = useCallback(async () => {
    try {
      const [res, deps] = await Promise.all([
        fetch(`${API_BASE_PATH}/api/policy-acknowledgements?summary=1`, { cache: 'no-store' }),
        fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ departments: [] })),
      ])
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setData(d)
      setDepartments((deps.departments ?? []).map((x: { name: string }) => x.name))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.')
    }
  }, [])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  // Every portal department, including the ones nobody from has confirmed yet.
  const recap = useMemo(() => {
    if (!data) return []
    const counted = new Map(data.byDepartment.map((d) => [d.department, d]))
    const names = [...new Set([...departments, ...data.byDepartment.map((d) => d.department)])]
    return names
      .map((name) => ({ department: name, n: counted.get(name)?.n ?? 0, last: counted.get(name)?.last ?? null }))
      .sort((a, b) => b.n - a.n || a.department.localeCompare(b.department))
  }, [data, departments])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.list ?? []).filter((a) =>
      (!dept || a.department === dept) &&
      (!q || `${a.nik} ${a.full_name} ${a.department} ${a.section ?? ''}`.toLowerCase().includes(q))
    )
  }, [data, query, dept])

  const exportExcel = () => {
    if (!data) return
    downloadExcel(
      `pernyataan-kebijakan-isms-${data.version}.xlsx`,
      ['No', 'NIK', 'Nama', 'Departemen', 'Section', 'Waktu Konfirmasi', 'Versi Kebijakan'],
      filtered.map((a, idx) => [idx + 1, a.nik, a.full_name, a.department, a.section, fmt(a.acknowledged_at), data.label]),
      'Pernyataan'
    )
  }

  if (!isLoading && !isLoggedIn) return <AdminGate />
  if (!isLoading && adminUser && !isAdmin) return <AdminGate title="Akses terbatas" message="Halaman ini hanya untuk akun ISM Admin." />

  const maxN = Math.max(1, ...recap.map((r) => r.n))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Pernyataan Kebijakan</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Karyawan mengonfirmasi <span className="font-semibold text-foreground">&ldquo;Saya sudah membaca &amp; memahami&rdquo;</span> di halaman Kebijakan Dasar ISMS dengan NIK, nama, dan departemen. Setiap kali visual kebijakan diubah, versi baru dimulai dan karyawan diminta mengonfirmasi ulang.
        </p>
      </div>

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {!data ? (
        !error && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Memuat…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><ShieldCheck className="size-4" /> Versi kebijakan</p>
              <p className="mt-2 font-display text-lg font-semibold text-foreground">{data.label}</p>
              <p className="font-mono text-xs text-muted-foreground">{data.version}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Users className="size-4" /> Total konfirmasi</p>
              <p className="mt-2 font-display text-4xl font-semibold text-foreground">{data.total}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-semibold text-muted-foreground">Departemen tercakup</p>
              <p className="mt-2 font-display text-4xl font-semibold text-foreground">
                {recap.filter((r) => r.n > 0).length}<span className="text-lg text-muted-foreground"> / {recap.length}</span>
              </p>
            </div>
          </div>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-lg font-semibold text-foreground">Rekap per departemen</h2>
            <ul className="mt-4 grid gap-x-8 gap-y-2.5 md:grid-cols-2">
              {recap.map((r) => (
                <li key={r.department}>
                  <button type="button" onClick={() => setDept(dept === r.department ? '' : r.department)} className={`w-full rounded-lg px-2 py-1 text-left transition hover:bg-secondary/60 ${dept === r.department ? 'bg-secondary' : ''}`}>
                    <span className="flex items-center justify-between gap-3 text-sm">
                      <span className={`truncate ${r.n ? 'text-foreground' : 'text-muted-foreground'}`}>{r.department}</span>
                      <span className="font-mono text-xs font-semibold text-foreground">{r.n}</span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-secondary">
                      <span className="block h-full rounded-full bg-[color:var(--p-600)]" style={{ width: `${(r.n / maxN) * 100}%` }} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Daftar konfirmasi{dept && <span className="text-muted-foreground"> · {dept}</span>}
                <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 font-mono text-xs">{filtered.length}</span>
              </h2>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <div className="relative flex-1 sm:w-72 sm:flex-none">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari NIK, nama, section…" className="h-10 w-full rounded-lg border border-input bg-card pl-10 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25" />
                </div>
                <button type="button" onClick={exportExcel} disabled={!filtered.length} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50">
                  <Download className="size-4" /> Excel
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="admin-table w-full min-w-[640px] text-sm">
                <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">NIK</th>
                    <th className="px-4 py-2.5 font-semibold">Nama</th>
                    <th className="px-4 py-2.5 font-semibold">Departemen</th>
                    <th className="px-4 py-2.5 font-semibold">Section</th>
                    <th className="px-4 py-2.5 font-semibold">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((a) => (
                    <tr key={a.id}>
                      <td data-label="NIK" className="px-4 py-2.5 font-mono text-xs">{a.nik}</td>
                      <td data-cell="title" className="px-4 py-2.5 font-medium text-foreground">{a.full_name}</td>
                      <td data-label="Departemen" className="px-4 py-2.5">{a.department}</td>
                      <td data-label="Section" className="px-4 py-2.5 text-muted-foreground">{a.section ?? '—'}</td>
                      <td data-label="Waktu" className="px-4 py-2.5 text-muted-foreground">{fmt(a.acknowledged_at)}</td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Belum ada konfirmasi{dept || query ? ' yang cocok' : ' untuk versi ini'}.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
