// app/kelola-izin-area-special/page.tsx
// ISM Admin: every "Ijin Masuk Area Special Security" request (ISMS-F-006-001).
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, Settings } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { AdminGate } from '@/components/admin-gate'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SpecialAreaFormModal } from '@/components/special-area/SpecialAreaForm'
import { SpecialAreaTable } from '@/components/special-area/SpecialAreaTable'
import { SpecialAreaApproverCard } from '@/components/special-area/SpecialAreaApproverCard'
import { SpecialAreaListCard } from '@/components/special-area/SpecialAreaListCard'
import { SpecialAreaEscortCard } from '@/components/special-area/SpecialAreaEscortCard'
import type { SpecialAreaRequest } from '@/lib/special-area-shared'

const TABS = [
  { value: '', label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
]

export default function KelolaIzinAreaSpecialPage() {
  const { isLoggedIn, isLoading, adminUser } = useAuth()
  const isAdmin = adminUser?.role === 'ism_admin'
  const [requests, setRequests] = useState<SpecialAreaRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SpecialAreaRequest | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api/special-area-requests`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setRequests(data.requests ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  const counts = useMemo(() => ({
    '': requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  }) as Record<string, number>, [requests])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return requests.filter((r) =>
      (!tab || r.status === tab) &&
      (!q || `${r.requester_name} ${r.org_company} ${r.department ?? ''} ${r.area} ${r.id_card_no ?? ''}`.toLowerCase().includes(q))
    )
  }, [requests, tab, query])

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    const res = await fetch(`${API_BASE_PATH}/api/special-area-requests/${pendingDelete.id}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) setError('Gagal menghapus pengajuan.')
    setDeleting(false)
    setPendingDelete(null)
    load()
  }

  if (!isLoading && !isLoggedIn) return <AdminGate />
  if (!isLoading && adminUser && !isAdmin) return <AdminGate title="Akses terbatas" message="Halaman ini hanya untuk akun ISM Admin." />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Izin Masuk Area Special Security</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pengajuan form ISMS-F-006-001 dari Lobby maupun Admin ISM. Persetujuan dikirim via email ke approver di bawah — bisa diganti kapan saja saat ada pergantian jabatan.
          </p>
        </div>
        <button type="button" onClick={() => setFormOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-[#c7161e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#a51219]">
          <Plus className="size-4" /> Ajukan Izin
        </button>
      </div>

      <SpecialAreaApproverCard onChanged={load} />
      <SpecialAreaListCard />
      <SpecialAreaEscortCard />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button key={t.value} type="button" onClick={() => setTab(t.value)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${tab === t.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
              {t.label}<span className={`rounded-full px-1.5 font-mono text-[10px] ${tab === t.value ? 'bg-white/20' : 'bg-secondary'}`}>{counts[t.value]}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, perusahaan, area, ID card…" className="h-10 w-full rounded-lg border border-input bg-card pl-10 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25" />
        </div>
      </div>

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      <SpecialAreaTable requests={filtered} loading={loading} canDelete onChanged={load} onDelete={setPendingDelete} />

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Settings className="size-3.5" /> Tip: Admin Lobby juga bisa mengajukan &amp; mengisi ID Card No. dari layar kiosk-nya.</p>

      {formOpen && <SpecialAreaFormModal onClose={() => setFormOpen(false)} onSaved={load} />}
      <ConfirmDialog
        open={!!pendingDelete}
        title="Hapus pengajuan?"
        message={`Pengajuan area special "${pendingDelete?.requester_name}" akan dihapus permanen.`}
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
