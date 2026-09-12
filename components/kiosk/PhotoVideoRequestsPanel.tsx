// components/kiosk/PhotoVideoRequestsPanel.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Camera, ChevronDown } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { PhotoVideoDecisionModal, type PhotoVideoRequest } from '@/components/documents/PhotoVideoDecisionModal'

const STATUS_TABS: { value: string; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
]

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-[#fff3d6] text-[#8a6100]',
  approved: 'bg-[#dff5e6] text-[#1a6e3a]',
  rejected: 'bg-[#fdecec] text-[#b3413a]',
}
const STATUS_LABEL: Record<string, string> = { pending: 'Pending', approved: 'Disetujui', rejected: 'Ditolak' }

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

export function PhotoVideoRequestsPanel() {
  const [open, setOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [requests, setRequests] = useState<PhotoVideoRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<PhotoVideoRequest | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`${API_BASE_PATH}/api/photo-video-requests?${params.toString()}`, { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setRequests(data.requests ?? [])
      setError(null)
    } catch (e) {
      setRequests([])
      setError(e instanceof Error ? e.message : 'Gagal memuat data.')
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [statusFilter])

  useEffect(() => {
    if (open) load()
  }, [open, statusFilter, load])

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary/30"
      >
        <div className="flex items-center gap-3">
          <span
            className="grid size-9 flex-shrink-0 place-items-center rounded-lg text-white"
            style={{ background: 'linear-gradient(135deg, oklch(0.39 0.09 205) 0%, oklch(0.48 0.12 180) 100%)' }}
          >
            <Camera className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Izin Foto/Video</p>
            <p className="text-xs text-muted-foreground">Lihat pengajuan izin foto/video — persetujuan hanya diproses oleh Admin ISM</p>
          </div>
        </div>
        <ChevronDown className={`size-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-border p-5">
          <div className="mb-4 flex flex-wrap gap-1.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-all"
                style={
                  statusFilter === tab.value
                    ? { background: 'linear-gradient(135deg, oklch(0.39 0.09 205) 0%, oklch(0.48 0.12 180) 100%)', color: 'white', borderColor: 'transparent' }
                    : { background: 'transparent', color: 'var(--muted-foreground)', borderColor: 'var(--border)' }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {error && <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="table-head-gradient">
                  <tr>
                    {['Tanggal', 'Tipe', 'Nama/NIK', 'Dept/Company', 'Periode', 'Status', 'Aksi'].map((head, i) => (
                      <th key={head} className={`whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground ${i === 1 ? 'max-[760px]:hidden' : ''}`}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && (
                    <tr><td colSpan={7} className="px-5 py-14 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat data...</p></td></tr>
                  )}
                  {!loading && loaded && requests.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-14 text-center"><Camera className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">Tidak ada pengajuan.</p></td></tr>
                  )}
                  {requests.map((req, index) => (
                    <tr key={req.id} className={`table-row-glow ${index % 2 ? 'bg-secondary/20' : ''}`}>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(req.submitted_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground max-[760px]:hidden">{req.request_type === 'internal' ? 'Internal' : 'Visitor'}</td>
                      <td className="min-w-[160px] px-4 py-3">
                        <p className="font-medium text-foreground">{req.requester_name}</p>
                        {req.nik && <p className="text-xs text-muted-foreground">NIK: {req.nik}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{req.dept_or_company}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(req.from_at)} &ndash; {formatDateTime(req.to_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_BADGE[req.status]}`}>{STATUS_LABEL[req.status]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setSelected(req)} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary">
                          Lihat
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selected && <PhotoVideoDecisionModal request={selected} onClose={() => setSelected(null)} readOnly />}
    </div>
  )
}
