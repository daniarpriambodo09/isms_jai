// components/documents/LedgerFotoVideoPage.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDownUp, Camera, Download, Eye, Search } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useAuth } from '@/context/AuthContext'
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

export function LedgerFotoVideoPage() {
  const { adminUser } = useAuth()
  const isIsmAdmin = adminUser?.role === 'ism_admin'
  const [requests, setRequests] = useState<LedgerRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

  const filteredRequests = useMemo(() => {
    const value = query.trim().toLowerCase()
    const base = !value
      ? requests
      : requests.filter((r) =>
          r.requester_name.toLowerCase().includes(value) ||
          (r.nik ?? '').toLowerCase().includes(value) ||
          r.dept_or_company.toLowerCase().includes(value) ||
          (r.dept ?? '').toLowerCase().includes(value) ||
          r.location.toLowerCase().includes(value) ||
          r.objective.toLowerCase().includes(value)
        )
    const sorted = [...base].sort((a, b) =>
      sortDesc
        ? new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
        : new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
    )
    return sorted
  }, [requests, query, sortDesc])

  const { page, setPage, totalPages, pageItems, pageSize } = usePagination(filteredRequests, 25)
  useEffect(() => { setPage(1) }, [query, setPage])

  const handleExportCsv = () => {
    downloadExcel(
      `rekap-foto-video-${new Date().toISOString().slice(0, 10)}.xlsx`,
      ['Tanggal Daftar', 'NIK', 'Nama', 'Dept/Section', 'Dari', 'Sampai', 'Lokasi', 'Tujuan', 'Dept. PIC Kamera', 'Kontrol No. Kamera', 'No ID Photography', 'Status', 'Tanggal Keputusan', 'PIC Approval'],
      filteredRequests.map((r) => [
        formatDateTime(r.submitted_at),
        r.nik ?? '',
        r.requester_name,
        r.dept ?? r.dept_or_company,
        formatDateTime(r.from_at),
        formatDateTime(r.to_at),
        r.location,
        r.objective,
        r.dept_pic_kamera ?? '',
        r.camera_control_no ?? '',
        r.photo_id_no ?? '',
        STATUS_LABEL[r.status],
        formatDateTime(r.decided_at),
        r.pic_approve_name ?? '',
      ])
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <section
        className="relative overflow-hidden rounded-[1.25rem] p-6 text-primary-foreground shadow-xl sm:p-8"
        style={{ background: 'linear-gradient(135deg, #1a3a52 0%, #1a5f7a 45%, #278e84 100%)' }}
      >
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
              <Camera className="size-3.5" /> Ledger — All Dept./Section
            </div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Rekap Pengajuan Foto/Video</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/72">Daftar seluruh pengajuan izin pengambilan foto/video dari semua departemen — bisa dilihat siapa saja.</p>
          </div>
          <Link href="/ijin-foto-video" className="inline-flex items-center gap-2 rounded-lg border border-primary-foreground/25 bg-primary-foreground/10 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/20">
            <Camera className="size-4" /> Ajukan Izin Baru
          </Link>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div><p className="portal-eyebrow">Controlled ledger</p><p className="mt-1 text-sm text-muted-foreground">{filteredRequests.length} pengajuan{query ? ` dari ${requests.length}` : ''}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSortDesc((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary">
            <ArrowDownUp className="size-3.5" />{sortDesc ? 'Terbaru dulu' : 'Terlama dulu'}
          </button>
          <button type="button" onClick={handleExportCsv} disabled={filteredRequests.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="size-3.5" />Export Excel
          </button>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, NIK, dept, lokasi..." className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25" />
          </div>
        </div>
      </div>

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${isIsmAdmin ? 'min-w-[1480px]' : 'min-w-[1420px]'}`}>
            <thead className="table-head-gradient">
              <tr>
                {['No', 'Tanggal Daftar', 'NIK', 'Nama', 'Dept/Section', 'Dari', 'Sampai', 'Lokasi', 'Tujuan', 'Dept. PIC Kamera', 'Kontrol No. Kamera', 'No ID Photography', 'Status', 'PIC Approval', ...(isIsmAdmin ? ['Aksi'] : [])].map((head) => (
                  <th key={head} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr><td colSpan={isIsmAdmin ? 15 : 14} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat rekap...</p></td></tr>
              )}
              {!loading && filteredRequests.length === 0 && (
                <tr><td colSpan={isIsmAdmin ? 15 : 14} className="px-5 py-16 text-center"><Camera className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">{query ? 'Tidak ada yang cocok' : 'Belum ada pengajuan'}</p></td></tr>
              )}
              {pageItems.map((r, index) => (
                <tr key={r.id} className={`table-row-glow ${index % 2 ? 'bg-secondary/20' : ''}`}>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{(page - 1) * pageSize + index + 1}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.submitted_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{r.nik ?? '—'}</td>
                  <td className="min-w-[140px] px-4 py-3 font-medium text-foreground">{r.requester_name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.dept ?? r.dept_or_company}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.from_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.to_at)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.location}</td>
                  <td className="min-w-[160px] px-4 py-3 text-xs text-muted-foreground">{r.objective}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.dept_pic_kamera ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{r.camera_control_no ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{r.photo_id_no ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    {r.decided_at && <span className="mt-1 block text-[10px] text-muted-foreground">{formatDateTime(r.decided_at)}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.pic_approve_name ?? '—'}</td>
                  {isIsmAdmin && (
                    <td className="whitespace-nowrap px-4 py-3">
                      {r.request_type === 'visitor' && r.status !== 'pending' ? (
                        <a
                          href={`${API_BASE_PATH}/api/photo-video-requests/${r.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Lihat sertifikat PDF pengajuan ${r.requester_name}`}
                          title="Lihat hasil pengajuan (sertifikat PDF)"
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
        </div>
        {!loading && filteredRequests.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredRequests.length} pageSize={pageSize} />
        )}
      </div>
    </div>
  )
}
