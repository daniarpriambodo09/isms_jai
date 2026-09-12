// components/documents/VendorRegistrationsPanel.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Download, Search, Users } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/components/pagination'
import { downloadExcel } from '@/lib/excel-export'

type CardType = 'visitor' | 'vendor' | 'affiliate' | 'special_area' | 'photography'
type Stage = 'pending_approval' | 'active' | 'closed'
type EntryPath = 'security' | 'lobby_affiliate'

type Registration = {
  id: number
  full_name: string
  id_card: string
  pic_jai: string
  purpose: string
  company_remark: string
  registered_at: string
  entry_at: string | null
  exit_at: string | null
  entry_path: EntryPath
  stage: Stage
  current_card_type: CardType | null
  visitor_card_barcode: string | null
  vendor_card_barcode: string | null
  affiliate_card_barcode: string | null
  special_area_card_barcode: string | null
  photography_card_barcode: string | null
}

const FILTERS: { value: CardType | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'visitor', label: 'Visitor' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'special_area', label: 'Special Area' },
  { value: 'photography', label: 'Photography' },
  { value: 'affiliate', label: 'Affiliate' },
]

const STAGE_LABEL: Record<Stage, string> = { pending_approval: 'Menunggu Approval', active: 'Aktif', closed: 'Selesai' }
const STAGE_BADGE: Record<Stage, string> = {
  pending_approval: 'bg-[#fff3d6] text-[#8a6100]',
  active: 'bg-[#dff5e6] text-[#1a6e3a]',
  closed: 'bg-secondary text-muted-foreground',
}
const CARD_LABEL: Record<CardType, string> = { visitor: 'Visitor', vendor: 'Vendor', affiliate: 'Affiliate', special_area: 'Special Area', photography: 'Photography' }
const CARD_BADGE: Record<CardType, string> = {
  visitor: 'bg-[#dff5e6] text-[#1a6e3a]',
  vendor: 'bg-[#edf6ff] text-[#1a5fa0]',
  affiliate: 'bg-[#f7f0ff] text-[#6a30a0]',
  special_area: 'bg-[#fde2e2] text-[#a13030]',
  photography: 'bg-[#fff3d6] text-[#8a6100]',
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function VendorRegistrationsPanel() {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<CardType | 'all'>('all')
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [rows, setRows] = useState<Registration[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations?sort=newest`, { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setRows(data.registrations ?? [])
      setError(null)
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : 'Gagal memuat data.')
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (open && !loaded) load()
  }, [open, loaded, load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null
    const to = dateTo ? new Date(dateTo + 'T23:59:59') : null
    return rows.filter((r) => {
      if (filter !== 'all' && r.current_card_type !== filter) return false
      if (q && !(r.full_name.toLowerCase().includes(q) || r.pic_jai.toLowerCase().includes(q) || r.company_remark.toLowerCase().includes(q))) return false
      const registeredAt = new Date(r.registered_at)
      if (from && registeredAt < from) return false
      if (to && registeredAt > to) return false
      return true
    })
  }, [rows, filter, query, dateFrom, dateTo])
  const { page, setPage, totalPages, pageItems, pageSize } = usePagination(filtered, 15)
  useEffect(() => { setPage(1) }, [filter, query, dateFrom, dateTo, setPage])

  const handleExportCsv = () => {
    downloadExcel(
      `pendaftaran-tamu-${new Date().toISOString().slice(0, 10)}.xlsx`,
      ['Nama', 'No. Identitas', 'PIC JAI', 'Tujuan', 'Keterangan', 'Asal', 'Jenis Kartu', 'Status', 'Tanggal Daftar', 'Jam Masuk', 'Jam Keluar'],
      filtered.map((r) => [
        r.full_name,
        r.id_card,
        r.pic_jai,
        r.purpose,
        r.company_remark,
        r.entry_path === 'security' ? 'Pos Security' : 'Lobby (Affiliate)',
        r.current_card_type ? CARD_LABEL[r.current_card_type] : '',
        STAGE_LABEL[r.stage],
        formatDateTime(r.registered_at),
        formatDateTime(r.entry_at),
        formatDateTime(r.exit_at),
      ])
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
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
            <Users className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Lihat Data Vendor / Visitor (Pos Security &amp; Lobby)</p>
            <p className="text-xs text-muted-foreground">Pantau data pendaftaran tamu dari kiosk Pos Security dan Lobby — hanya lihat, tidak bisa diubah dari sini</p>
          </div>
        </div>
        <ChevronDown className={`size-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-border p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-all"
                  style={
                    filter === f.value
                      ? { background: 'linear-gradient(135deg, oklch(0.39 0.09 205) 0%, oklch(0.48 0.12 180) 100%)', color: 'white', borderColor: 'transparent' }
                      : { background: 'transparent', color: 'var(--muted-foreground)', borderColor: 'var(--border)' }
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="size-3.5" />Export Excel
            </button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama, PIC JAI, atau keterangan..."
                className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              aria-label="Dari tanggal"
            />
            <span className="text-xs text-muted-foreground">s/d</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              aria-label="Sampai tanggal"
            />
          </div>

          {error && <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="table-head-gradient">
                  <tr>
                    {['Nama', 'PIC JAI', 'Asal', 'Kartu', 'Status', 'Tanggal Daftar'].map((head, i) => (
                      <th key={head} className={`whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground ${i === 1 || i === 2 ? 'max-[760px]:hidden' : ''}`}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && (
                    <tr><td colSpan={6} className="px-5 py-14 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat data...</p></td></tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-14 text-center"><Users className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">Belum ada data.</p></td></tr>
                  )}
                  {pageItems.map((row, index) => (
                    <tr key={row.id} className={`table-row-glow ${index % 2 ? 'bg-secondary/20' : ''}`}>
                      <td className="min-w-[180px] px-4 py-3">
                        <p className="font-medium text-foreground">{row.full_name}</p>
                        <p className="text-xs text-muted-foreground">{row.id_card}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground max-[760px]:hidden">{row.pic_jai}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground max-[760px]:hidden">{row.entry_path === 'security' ? 'Pos Security' : 'Lobby (Affiliate)'}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {row.current_card_type ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${CARD_BADGE[row.current_card_type]}`}>{CARD_LABEL[row.current_card_type]}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STAGE_BADGE[row.stage]}`}>{STAGE_LABEL[row.stage]}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(row.registered_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && filtered.length > 0 && (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={pageSize} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
