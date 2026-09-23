// components/documents/PhotoVideoLedgerTable.tsx
//
// The Internal/Visitor recap table — columns matching each type's own
// registration form — shared between the full-page ledger (/rekap-foto-video)
// and the compact panel embedded in the Lobby kiosk view, so both stay in
// sync instead of drifting into two copies.
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownUp, Camera, Download, Eye, Search, Sparkles, Users } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/components/pagination'
import { downloadExcel } from '@/lib/excel-export'

type LedgerRequest = {
  id: number
  request_type: 'internal' | 'visitor'
  nik: string | null
  requester_name: string
  dept_or_company: string
  dept: string | null
  dept_pic_kamera: string | null
  from_at: string
  to_at: string
  location: string
  objective: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  decided_at: string | null
  pic_approve_name: string | null
  camera_control_no: string | null
  photo_id_no: string | null
  camera_serial_no: string | null
  pic_jai: string | null
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-[#fff3d6] text-[#8a6100]',
  approved: 'bg-[#dff5e6] text-[#1a6e3a]',
  rejected: 'bg-[#fdecec] text-[#b3413a]',
}
const STATUS_LABEL: Record<string, string> = { pending: 'Pending', approved: 'Disetujui', rejected: 'Ditolak' }

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function StatusCell({ r }: { r: LedgerRequest }) {
  return (
    <td className="whitespace-nowrap px-4 py-3">
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
      {r.decided_at && <span className="mt-1 block text-[10px] text-muted-foreground">{formatDateTime(r.decided_at)}</span>}
    </td>
  )
}

// canViewPdf: who gets the Visitor "Aksi" (view PDF) column — ISM Admin,
// Lobby and Security all have kiosk-level read access to the underlying
// data, so all three are allowed to see the resulting PDF too.
export function PhotoVideoLedgerTable({ canViewPdf }: { canViewPdf: boolean }) {
  const [requests, setRequests] = useState<LedgerRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [locale, setLocale] = useState<'internal' | 'visitor'>('internal')
  const [query, setQuery] = useState('')
  const [sortDesc, setSortDesc] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/photo-video-requests/ledger`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setRequests(data.requests ?? [])
      setError(null)
    } catch (e) {
      setRequests([])
      setError(e instanceof Error ? e.message : 'Gagal memuat rekap pengajuan.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const typedRequests = useMemo(() => requests.filter((r) => r.request_type === locale), [requests, locale])

  const filteredRequests = useMemo(() => {
    const value = query.trim().toLowerCase()
    const base = !value
      ? typedRequests
      : typedRequests.filter((r) =>
          r.requester_name.toLowerCase().includes(value) ||
          (r.nik ?? '').toLowerCase().includes(value) ||
          r.dept_or_company.toLowerCase().includes(value) ||
          (r.dept ?? '').toLowerCase().includes(value) ||
          (r.pic_jai ?? '').toLowerCase().includes(value) ||
          r.location.toLowerCase().includes(value) ||
          r.objective.toLowerCase().includes(value)
        )
    const sorted = [...base].sort((a, b) =>
      sortDesc
        ? new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
        : new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
    )
    return sorted
  }, [typedRequests, query, sortDesc])

  const { page, setPage, totalPages, pageItems, pageSize } = usePagination(filteredRequests, 25)
  useEffect(() => { setPage(1) }, [query, locale, setPage])

  const handleExportCsv = () => {
    if (locale === 'internal') {
      downloadExcel(
        `rekap-foto-video-internal-${new Date().toISOString().slice(0, 10)}.xlsx`,
        ['Tanggal Daftar', 'NIK', 'Nama', 'Dept/Seksi', 'Dept. PIC Kamera', 'No. Kontrol Kamera', 'No. ID Photography', 'PIC Approve', 'Dari', 'Sampai', 'Lokasi', 'Tujuan', 'Status', 'Tanggal Keputusan'],
        filteredRequests.map((r) => [
          formatDateTime(r.submitted_at),
          r.nik ?? '',
          r.requester_name,
          r.dept_or_company,
          r.dept_pic_kamera ?? '',
          r.camera_control_no ?? '',
          r.photo_id_no ?? '',
          r.pic_approve_name ?? '',
          formatDateTime(r.from_at),
          formatDateTime(r.to_at),
          r.location,
          r.objective,
          STATUS_LABEL[r.status],
          formatDateTime(r.decided_at),
        ])
      )
    } else {
      downloadExcel(
        `rekap-foto-video-visitor-${new Date().toISOString().slice(0, 10)}.xlsx`,
        ['Tanggal Daftar', 'Nama', 'Company / Organization', 'Department', 'PIC JAI', 'Serial No. Kamera', 'No ID Photography', 'Dari', 'Sampai', 'Lokasi', 'Tujuan', 'Status', 'Tanggal Keputusan', 'PIC Approval'],
        filteredRequests.map((r) => [
          formatDateTime(r.submitted_at),
          r.requester_name,
          r.dept_or_company,
          r.dept ?? '',
          r.pic_jai ?? '',
          r.camera_serial_no ?? '',
          r.photo_id_no ?? '',
          formatDateTime(r.from_at),
          formatDateTime(r.to_at),
          r.location,
          r.objective,
          STATUS_LABEL[r.status],
          formatDateTime(r.decided_at),
          r.pic_approve_name ?? '',
        ])
      )
    }
  }

  const internalColCount = 14
  const visitorColCount = canViewPdf ? 15 : 14

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setLocale('internal')}
            className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${locale === 'internal' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Users className="size-3.5" /> Internal
          </button>
          <button
            type="button"
            onClick={() => setLocale('visitor')}
            className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${locale === 'visitor' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Sparkles className="size-3.5" /> Visitor
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div><p className="portal-eyebrow">Controlled ledger</p><p className="mt-1 text-sm text-muted-foreground">{filteredRequests.length} pengajuan{query ? ` dari ${typedRequests.length}` : ''}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSortDesc((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary">
            <ArrowDownUp className="size-3.5" />{sortDesc ? 'Terbaru dulu' : 'Terlama dulu'}
          </button>
          <button type="button" onClick={handleExportCsv} disabled={filteredRequests.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="size-3.5" />Export Excel
          </button>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, dept, lokasi..." className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25" />
          </div>
        </div>
      </div>

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          {locale === 'internal' ? (
            <table className="w-full min-w-[1480px] text-sm">
              <thead className="table-head-gradient">
                <tr>
                  {['No', 'Tanggal Daftar', 'NIK', 'Nama', 'Dept/Seksi', 'Dept. PIC Kamera', 'No. Kontrol Kamera', 'No. ID Photography', 'PIC Approve', 'Dari', 'Sampai', 'Lokasi', 'Tujuan', 'Status'].map((head) => (
                    <th key={head} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={internalColCount} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat rekap...</p></td></tr>
                )}
                {!loading && filteredRequests.length === 0 && (
                  <tr><td colSpan={internalColCount} className="px-5 py-16 text-center"><Camera className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">{query ? 'Tidak ada yang cocok' : 'Belum ada pengajuan'}</p></td></tr>
                )}
                {pageItems.map((r, index) => (
                  <tr key={r.id} className={`table-row-glow ${index % 2 ? 'bg-secondary/20' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{(page - 1) * pageSize + index + 1}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.submitted_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{r.nik ?? '—'}</td>
                    <td className="min-w-[140px] px-4 py-3 font-medium text-foreground">{r.requester_name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.dept_or_company}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.dept_pic_kamera ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{r.camera_control_no ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{r.photo_id_no ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.pic_approve_name ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.from_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.to_at)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.location}</td>
                    <td className="min-w-[160px] px-4 py-3 text-xs text-muted-foreground">{r.objective}</td>
                    <StatusCell r={r} />
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className={`w-full text-sm ${canViewPdf ? 'min-w-[1560px]' : 'min-w-[1480px]'}`}>
              <thead className="table-head-gradient">
                <tr>
                  {['No', 'Tanggal Daftar', 'Nama', 'Company / Organization', 'Department', 'PIC JAI', 'Serial No. Kamera', 'No ID Photography', 'Dari', 'Sampai', 'Lokasi', 'Tujuan', 'Status', 'PIC Approval', ...(canViewPdf ? ['Aksi'] : [])].map((head) => (
                    <th key={head} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={visitorColCount} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat rekap...</p></td></tr>
                )}
                {!loading && filteredRequests.length === 0 && (
                  <tr><td colSpan={visitorColCount} className="px-5 py-16 text-center"><Camera className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">{query ? 'Tidak ada yang cocok' : 'Belum ada pengajuan'}</p></td></tr>
                )}
                {pageItems.map((r, index) => (
                  <tr key={r.id} className={`table-row-glow ${index % 2 ? 'bg-secondary/20' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{(page - 1) * pageSize + index + 1}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.submitted_at)}</td>
                    <td className="min-w-[140px] px-4 py-3 font-medium text-foreground">{r.requester_name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.dept_or_company}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.dept ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.pic_jai ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{r.camera_serial_no ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{r.photo_id_no ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.from_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.to_at)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.location}</td>
                    <td className="min-w-[160px] px-4 py-3 text-xs text-muted-foreground">{r.objective}</td>
                    <StatusCell r={r} />
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.pic_approve_name ?? '—'}</td>
                    {canViewPdf && (
                      <td className="whitespace-nowrap px-4 py-3">
                        {r.status !== 'pending' ? (
                          <a
                            href={`${API_BASE_PATH}/api/photo-video-requests/${r.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Lihat surat pengajuan PDF ${r.requester_name}`}
                            title="Lihat hasil pengajuan (surat pengajuan PDF)"
                            className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                          >
                            <Eye className="size-3.5" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!loading && filteredRequests.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredRequests.length} pageSize={pageSize} />
        )}
      </div>
    </div>
  )
}
