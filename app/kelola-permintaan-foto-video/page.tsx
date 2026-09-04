// app/kelola-permintaan-foto-video/page.tsx

'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Camera, Settings } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { PhotoVideoDecisionModal, type PhotoVideoRequest } from '@/components/documents/PhotoVideoDecisionModal'
import { AdminGate } from '@/components/admin-gate'

const STATUS_TABS: { value: string; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
]

const TYPE_TABS: { value: string; label: string }[] = [
  { value: '', label: 'Semua Tipe' },
  { value: 'internal', label: 'Internal' },
  { value: 'visitor', label: 'Visitor' },
]

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-[#fff3d6] text-[#8a6100]',
  approved: 'bg-[#dff5e6] text-[#1a6e3a]',
  rejected: 'bg-[#fdecec] text-[#b3413a]',
}
const STATUS_LABEL: Record<string, string> = { pending: 'Pending', approved: 'Disetujui', rejected: 'Ditolak' }

function KelolaPermintaanFotoVideoContent() {
  const { isLoggedIn, isLoading } = useAuth()
  const searchParams = useSearchParams()
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') ?? '')
  const [requests, setRequests] = useState<PhotoVideoRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PhotoVideoRequest | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('type', typeFilter)
      const response = await fetch(`${API_BASE_PATH}/api/photo-video-requests?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setRequests(data.requests ?? [])
      setError(null)
    } catch (e) {
      setRequests([])
      setError(e instanceof Error ? e.message : 'Gagal memuat daftar pengajuan.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter])

  useEffect(() => { if (isLoggedIn) load() }, [isLoggedIn, load])

  if (!isLoading && !isLoggedIn) {
    return <AdminGate />
  }

  return (
    <div className="flex flex-col gap-7">
      <header className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
              <Settings className="size-3.5" /> Admin workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Permintaan Foto/Video</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">Tinjau dan putuskan pengajuan izin pengambilan foto/video dari karyawan dan visitor.</p>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button key={tab.value} type="button" onClick={() => setStatusFilter(tab.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${statusFilter === tab.value ? 'border-transparent bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-secondary'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_TABS.map((tab) => (
            <button key={tab.value} type="button" onClick={() => setTypeFilter(tab.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${typeFilter === tab.value ? 'border-transparent bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:bg-secondary'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-secondary/55">
              <tr>
                {['Tanggal', 'Tipe', 'Nama/NIK', 'Dept/Company', 'Lokasi', 'Periode', 'Status', 'Aksi'].map((head) => (
                  <th key={head} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr><td colSpan={8} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat...</p></td></tr>
              )}
              {!loading && requests.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-16 text-center"><Camera className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">Tidak ada pengajuan</p></td></tr>
              )}
              {requests.map((req, index) => (
                <tr key={req.id} className={index % 2 ? 'bg-secondary/20' : ''}>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(req.submitted_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{req.request_type === 'internal' ? 'Internal' : 'Visitor'}</td>
                  <td className="min-w-[160px] px-4 py-3 font-medium text-foreground">{req.requester_name}{req.nik && <span className="block text-xs text-muted-foreground">NIK: {req.nik}</span>}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{req.dept_or_company}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{req.location}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(req.from_at)} &ndash; {formatDateTime(req.to_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_BADGE[req.status]}`}>{STATUS_LABEL[req.status]}</span></td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setSelected(req)} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary">
                      {req.status === 'pending' ? 'Putuskan' : 'Lihat'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <PhotoVideoDecisionModal request={selected} onClose={() => setSelected(null)} onDecided={load} />
      )}
    </div>
  )
}

export default function KelolaPermintaanFotoVideoPage() {
  return (
    <Suspense fallback={null}>
      <KelolaPermintaanFotoVideoContent />
    </Suspense>
  )
}
