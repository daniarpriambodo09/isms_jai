// components/documents/VendorRegistrationsPanel.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Building2,
  ChevronDown,
  Download,
  Eye,
  ExternalLink,
  Filter,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/components/pagination'
import { downloadExcel } from '@/lib/excel-export'
import { MONTH_LABELS, availableYears, matchesPeriod } from '@/lib/period-filter'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import {
  CARD_BARCODE_FIELD,
  formatDateTime,
  type Registration,
} from '@/components/kiosk/kiosk-shared'

type CardType = 'visitor' | 'vendor' | 'affiliate' | 'special_area' | 'photography'

const CARD_LABEL: Record<CardType, string> = {
  visitor: 'Visitor',
  vendor: 'Vendor',
  affiliate: 'Affiliate',
  special_area: 'Special Area',
  photography: 'Photography',
}

const CARD_BADGE: Record<CardType, string> = {
  visitor: 'bg-[#dff5e6] text-[#1a6e3a] border-[#b6e6c4]',
  vendor: 'bg-[#edf6ff] text-[#1a5fa0] border-[#bcdcf8]',
  affiliate: 'bg-[#f7f0ff] text-[#6a30a0] border-[#e4ccff]',
  special_area: 'bg-[#fde2e2] text-[#a13030] border-[#f9b8b8]',
  photography: 'bg-[#fff3d6] text-[#8a6100] border-[#fae29c]',
}

const LOBBY_STAGE_BADGE: Record<string, string> = {
  pending_approval: 'bg-[#fff3d6] text-[#8a6100]',
  visitor: 'bg-[#dff5e6] text-[#1a6e3a]',
  vendor: 'bg-[#edf6ff] text-[#1a5fa0]',
  affiliate: 'bg-[#f7f0ff] text-[#6a30a0]',
  special_area: 'bg-[#fde2e2] text-[#a13030]',
  photography: 'bg-[#fff3d6] text-[#8a6100]',
  closed: 'bg-secondary text-muted-foreground',
}

function lobbyStatusOf(r: Registration): { key: string; label: string } {
  if (r.stage === 'pending_approval') return { key: 'pending_approval', label: 'Menunggu Approval Security' }
  if (r.stage === 'closed') return { key: 'closed', label: 'Selesai' }
  if (r.current_card_type && r.current_card_type in CARD_LABEL) {
    return { key: r.current_card_type, label: `Kartu ${CARD_LABEL[r.current_card_type]}` }
  }
  return { key: 'visitor', label: 'Kartu Visitor' }
}

function securityStatusOf(r: Registration): { key: string; label: string; badgeClass: string } {
  if (r.stage === 'pending_approval') {
    return { key: 'pending_approval', label: 'Menunggu Approval', badgeClass: 'bg-[#fff3d6] text-[#8a6100]' }
  }
  if (r.stage === 'closed') {
    return { key: 'closed', label: 'Selesai', badgeClass: 'bg-secondary text-muted-foreground' }
  }
  if (r.current_card_type === 'visitor') {
    return { key: 'visitor', label: 'Kartu Visitor', badgeClass: 'bg-[#dff5e6] text-[#1a6e3a]' }
  }
  return { key: 'working', label: 'Di Area Kerja', badgeClass: 'bg-[#edf6ff] text-[#1a5fa0]' }
}

function getBarcode(r: Registration): string | null {
  if (!r.current_card_type) return null
  return (r[CARD_BARCODE_FIELD[r.current_card_type]] as string) ?? null
}

function GuestDetailModal({ registration, onClose }: { registration: Registration | null; onClose: () => void }) {
  useEscapeClose(Boolean(registration), onClose)
  if (!registration) return null

  const barcode = getBarcode(registration)
  const isSecurity = registration.entry_path === 'security'

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-50 duration-200"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detail Pendaftaran Tamu"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between bg-primary px-6 py-4 text-primary-foreground">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-white/15">
              {isSecurity ? <ShieldCheck className="size-4" /> : <Building2 className="size-4" />}
            </span>
            <div>
              <h3 className="text-sm font-bold">Detail Pendaftaran Tamu</h3>
              <p className="text-[11px] text-primary-foreground/75">
                {isSecurity ? 'General Security Area (Pos Security)' : 'Business Security Area (Admin Lobby)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid size-8 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-4 overflow-y-auto p-6 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nama Lengkap</span>
              <p className="mt-1 font-semibold text-foreground">{registration.full_name}</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Kartu Identitas</span>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">{registration.id_card || '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Perusahaan / Remark</span>
              <p className="mt-1 font-medium text-foreground">{registration.company_remark || '—'}</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/30 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">PIC JAI yang Ditemui</span>
              <p className="mt-1 font-medium text-foreground">{registration.pic_jai || '—'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/30 p-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tujuan Kunjungan</span>
            <p className="mt-1 text-foreground">{registration.purpose || '—'}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl border border-border bg-secondary/20 p-2.5">
              <span className="text-[10px] font-medium text-muted-foreground">Pendaftaran</span>
              <p className="mt-0.5 font-medium text-foreground">{formatDateTime(registration.registered_at)}</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/20 p-2.5">
              <span className="text-[10px] font-medium text-muted-foreground">Jam Masuk</span>
              <p className="mt-0.5 font-medium text-foreground">{formatDateTime(registration.entry_at)}</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/20 p-2.5">
              <span className="text-[10px] font-medium text-muted-foreground">Jam Keluar</span>
              <p className="mt-0.5 font-medium text-foreground">{formatDateTime(registration.exit_at)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status &amp; Kartu</span>
                <p className="mt-1 font-semibold text-foreground">
                  {isSecurity ? securityStatusOf(registration).label : lobbyStatusOf(registration).label}
                </p>
              </div>
              {registration.current_card_type && (
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${CARD_BADGE[registration.current_card_type]}`}>
                  {CARD_LABEL[registration.current_card_type]}
                </span>
              )}
            </div>
            {barcode && (
              <div className="mt-2.5 flex items-center gap-2 border-t border-border pt-2.5">
                <span className="text-[11px] text-muted-foreground">Barcode Terdaftar:</span>
                <span className="font-mono text-xs font-bold text-foreground">{barcode}</span>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border bg-secondary/30 px-6 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

export function VendorRegistrationsPanel({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const [activeTab, setActiveTab] = useState<'general' | 'business' | null>(null)
  const [rows, setRows] = useState<Registration[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewDetail, setViewDetail] = useState<Registration | null>(null)

  // Filters for General Security Area
  const [secMonth, setSecMonth] = useState('')
  const [secYear, setSecYear] = useState('')
  const [secQuery, setSecQuery] = useState('')

  // Filters for Business Security Area
  const [lobbyMonth, setLobbyMonth] = useState('')
  const [lobbyYear, setLobbyYear] = useState('')
  const [lobbyCardType, setLobbyCardType] = useState<CardType | 'all'>('all')
  const [lobbyQuery, setLobbyQuery] = useState('')

  // Escape key closes open pop-up
  useEscapeClose(Boolean(activeTab), () => setActiveTab(null))

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations?sort=newest`, {
        cache: 'no-store',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setRows(data.registrations ?? [])
      setError(null)
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : 'Gagal memuat data pendaftaran.')
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    // Pre-load data on mount so counts appear on buttons
    loadData()
  }, [loadData])

  // Split datasets
  const securityRows = useMemo(() => rows.filter((r) => r.entry_path === 'security'), [rows])
  const lobbyRows = useMemo(() => rows, [rows]) // Admin Lobby handles all registrations/cards

  // Available years per view
  const secYears = useMemo(() => availableYears(securityRows, (r) => r.registered_at), [securityRows])
  const lobbyYears = useMemo(() => availableYears(lobbyRows, (r) => r.registered_at), [lobbyRows])

  // Filtered rows for General Security Area
  const filteredSecRows = useMemo(() => {
    const q = secQuery.trim().toLowerCase()
    return securityRows.filter((r) => {
      if (!matchesPeriod(r.registered_at, secMonth, secYear)) return false
      if (!q) return true
      return (
        r.full_name.toLowerCase().includes(q) ||
        r.id_card.toLowerCase().includes(q) ||
        r.pic_jai.toLowerCase().includes(q) ||
        r.purpose.toLowerCase().includes(q) ||
        r.company_remark.toLowerCase().includes(q)
      )
    })
  }, [securityRows, secMonth, secYear, secQuery])

  // Filtered rows for Business Security Area
  const filteredLobbyRows = useMemo(() => {
    const q = lobbyQuery.trim().toLowerCase()
    return lobbyRows.filter((r) => {
      if (!matchesPeriod(r.registered_at, lobbyMonth, lobbyYear)) return false
      if (lobbyCardType !== 'all' && r.current_card_type !== lobbyCardType) return false
      if (!q) return true
      return (
        r.full_name.toLowerCase().includes(q) ||
        r.pic_jai.toLowerCase().includes(q) ||
        r.company_remark.toLowerCase().includes(q) ||
        r.purpose.toLowerCase().includes(q)
      )
    })
  }, [lobbyRows, lobbyMonth, lobbyYear, lobbyCardType, lobbyQuery])

  // Pagination for both
  const secPagination = usePagination(filteredSecRows, 10)
  const lobbyPagination = usePagination(filteredLobbyRows, 10)

  useEffect(() => {
    secPagination.setPage(1)
  }, [secMonth, secYear, secQuery])

  useEffect(() => {
    lobbyPagination.setPage(1)
  }, [lobbyMonth, lobbyYear, lobbyCardType, lobbyQuery])

  // Export handlers
  const handleExportSec = () => {
    downloadExcel(
      `rekap-supplier-security-${new Date().toISOString().slice(0, 10)}.xlsx`,
      ['Tanggal/Jam', 'Nama Lengkap', 'Kartu Identitas', 'PIC JAI', 'Tujuan', 'Keterangan/Perusahaan', 'Jam Masuk', 'Jam Keluar', 'Status', 'Nomor Kartu'],
      filteredSecRows.map((r) => [
        formatDateTime(r.registered_at),
        r.full_name,
        r.id_card,
        r.pic_jai,
        r.purpose,
        r.company_remark,
        formatDateTime(r.entry_at),
        formatDateTime(r.exit_at),
        securityStatusOf(r).label,
        getBarcode(r) ?? '',
      ])
    )
  }

  const handleExportLobby = () => {
    downloadExcel(
      `rekap-tamu-lobby-${new Date().toISOString().slice(0, 10)}.xlsx`,
      ['Tanggal/Jam', 'Nama Lengkap', 'PIC JAI', 'Keterangan/Perusahaan', 'Asal', 'Status', 'Jenis Kartu', 'Nomor Kartu', 'Jam Masuk', 'Jam Keluar'],
      filteredLobbyRows.map((r) => [
        formatDateTime(r.registered_at),
        r.full_name,
        r.pic_jai,
        r.company_remark,
        r.entry_path === 'security' ? 'Pos Security' : 'Lobby',
        lobbyStatusOf(r).label,
        r.current_card_type ? CARD_LABEL[r.current_card_type] : '',
        getBarcode(r) ?? '',
        formatDateTime(r.entry_at),
        formatDateTime(r.exit_at),
      ])
    )
  }

  // Lobby KPI stats
  const lobbyStats = useMemo(() => {
    const total = filteredLobbyRows.length
    const active = filteredLobbyRows.filter((r) => r.stage === 'active').length
    const pending = filteredLobbyRows.filter((r) => r.stage === 'pending_approval').length
    const closed = filteredLobbyRows.filter((r) => r.stage === 'closed').length
    return { total, active, pending, closed }
  }, [filteredLobbyRows])

  return (
    <>
      {/* COMPACT BUTTONS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/90 px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Users className="size-4" />
          </span>
          <div>
            <p className="text-xs font-bold text-foreground">Pendaftaran Tamu &amp; Vendor</p>
            <p className="text-[11px] text-muted-foreground">Klik tombol untuk cek data pendaftaran area</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol 1: General Security Area */}
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold shadow-xs transition-all duration-150 hover:-translate-y-0.5 ${
              activeTab === 'general'
                ? 'border-emerald-600 bg-emerald-600 text-white ring-2 ring-emerald-500/25'
                : 'border-emerald-600/30 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 hover:border-emerald-600/50 dark:bg-emerald-950/40 dark:text-emerald-300'
            }`}
          >
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>General Security Area</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === 'general'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {loaded ? securityRows.length : '...'}
            </span>
          </button>

          {/* Tombol 2: Business Security Area */}
          <button
            type="button"
            onClick={() => setActiveTab('business')}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold shadow-xs transition-all duration-150 hover:-translate-y-0.5 ${
              activeTab === 'business'
                ? 'border-blue-600 bg-blue-600 text-white ring-2 ring-blue-500/25'
                : 'border-blue-600/30 bg-blue-500/10 text-blue-800 hover:bg-blue-500/20 hover:border-blue-600/50 dark:bg-blue-950/40 dark:text-blue-300'
            }`}
          >
            <Building2 className="size-4 text-blue-600 dark:text-blue-400" />
            <span>Business Security Area</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === 'business'
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-600/15 text-blue-700 dark:text-blue-300'
              }`}
            >
              {loaded ? lobbyRows.length : '...'}
            </span>
          </button>
        </div>
      </div>

      {/* POP-UP MODAL: GENERAL SECURITY AREA */}
      {activeTab === 'general' && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setActiveTab(null) }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in-50 duration-200"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Tabel General Security Area"
            className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-emerald-500/40 bg-card shadow-2xl"
          >
            {/* Pop-up Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-emerald-500/10 px-6 py-4 dark:bg-emerald-950/30">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm">
                  <ShieldCheck className="size-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      Data Pendaftaran Supplier — General Security Area
                    </h3>
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      Pos Security
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Data supplier &amp; vendor yang terdaftar dari Pos Security dengan filter bulan dan tahun
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isLoggedIn && (
                  <Link
                    href="/admin-pos-security"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
                  >
                    <ExternalLink className="size-3.5" /> Buka Kiosk Security
                  </Link>
                )}
                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  title="Muat ulang data"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"
                >
                  <RotateCcw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Muat Ulang
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab(null)}
                  aria-label="Tutup pop-up"
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Pop-up Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Filter className="size-3.5" /> Filter:
                </div>
                <select
                  value={secMonth}
                  onChange={(e) => setSecMonth(e.target.value)}
                  aria-label="Filter Bulan"
                  className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  <option value="">Semua Bulan</option>
                  {MONTH_LABELS.map((label, idx) => (
                    <option key={label} value={idx}>
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  value={secYear}
                  onChange={(e) => setSecYear(e.target.value)}
                  aria-label="Filter Tahun"
                  className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  <option value="">Semua Tahun</option>
                  {secYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>

                {(secMonth !== '' || secYear !== '' || secQuery !== '') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSecMonth('')
                      setSecYear('')
                      setSecQuery('')
                    }}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    Reset Filter
                  </button>
                )}

                <span className="text-xs text-muted-foreground">
                  Menampilkan <strong>{filteredSecRows.length}</strong> data
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={secQuery}
                    onChange={(e) => setSecQuery(e.target.value)}
                    placeholder="Cari nama, KTP, PIC, tujuan..."
                    className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-xs text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExportSec}
                  disabled={filteredSecRows.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="size-3.5" /> Export Excel
                </button>
              </div>
            </div>

            {/* Pop-up Table Content */}
            <div className="flex-1 overflow-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="sticky top-0 z-10 bg-secondary/90 backdrop-blur-xs">
                  <tr>
                    {[
                      'Tanggal/Jam',
                      'Nama Lengkap',
                      'Kartu Identitas',
                      'PIC JAI',
                      'Tujuan',
                      'Keterangan',
                      'Jam Masuk',
                      'Jam Keluar',
                      'Status',
                      'Detail',
                    ].map((head) => (
                      <th
                        key={head}
                        className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && (
                    <tr>
                      <td colSpan={10} className="px-5 py-16 text-center">
                        <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" />
                        <p className="text-sm text-muted-foreground">Memuat data supplier dari security...</p>
                      </td>
                    </tr>
                  )}
                  {!loading && securityRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-5 py-16 text-center text-sm text-muted-foreground">
                        Belum ada data pendaftaran dari Pos Security.
                      </td>
                    </tr>
                  )}
                  {!loading && securityRows.length > 0 && filteredSecRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-5 py-16 text-center text-sm text-muted-foreground">
                        Tidak ada data yang sesuai dengan filter periode atau pencarian.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    secPagination.pageItems.map((r, index) => {
                      const status = securityStatusOf(r)
                      const barcode = getBarcode(r)
                      return (
                        <tr key={r.id} className={`transition-colors hover:bg-secondary/40 ${index % 2 ? 'bg-secondary/15' : ''}`}>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                            {formatDateTime(r.registered_at)}
                          </td>
                          <td className="min-w-[150px] px-4 py-3 font-semibold text-foreground">
                            {r.full_name}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                            {r.id_card || '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {r.pic_jai}
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-3 text-xs text-muted-foreground" title={r.purpose}>
                            {r.purpose}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {r.company_remark}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                            {formatDateTime(r.entry_at)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                            {formatDateTime(r.exit_at)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${status.badgeClass}`}>
                              {status.label}
                            </span>
                            {barcode && (
                              <span className="mt-1 block font-mono text-[10px] font-semibold text-muted-foreground">
                                {barcode}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => setViewDetail(r)}
                              title="Lihat Detail Pendaftaran"
                              className="inline-flex size-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                            >
                              <Eye className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {/* Pop-up Footer Pagination */}
            {!loading && filteredSecRows.length > 0 && (
              <Pagination
                page={secPagination.page}
                totalPages={secPagination.totalPages}
                onPageChange={secPagination.setPage}
                totalItems={filteredSecRows.length}
                pageSize={secPagination.pageSize}
              />
            )}
          </div>
        </div>
      )}

      {/* POP-UP MODAL: BUSINESS SECURITY AREA */}
      {activeTab === 'business' && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setActiveTab(null) }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in-50 duration-200"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Card Tabel Business Security Area"
            className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-blue-500/40 bg-card shadow-2xl"
          >
            {/* Pop-up Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-blue-500/10 px-6 py-4 dark:bg-blue-950/30">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
                  <Building2 className="size-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      Card Tabel Data — Business Security Area
                    </h3>
                    <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                      Admin Lobby
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Data pendaftaran tamu dan pengelolaan kartu dari Admin Lobby dengan filter bulan dan tahun
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isLoggedIn && (
                  <Link
                    href="/admin-lobby"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
                  >
                    <ExternalLink className="size-3.5" /> Buka Kiosk Lobby
                  </Link>
                )}
                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  title="Muat ulang data"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"
                >
                  <RotateCcw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Muat Ulang
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab(null)}
                  aria-label="Tutup pop-up"
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Quick Stat Summary Cards */}
            <div className="grid grid-cols-2 gap-3 border-b border-border bg-secondary/20 p-4 sm:grid-cols-4 sm:p-5">
              <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Tamu</span>
                <p className="mt-1 text-xl font-extrabold text-foreground">{lobbyStats.total}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Sedang Aktif</span>
                <p className="mt-1 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{lobbyStats.active}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Menunggu Approval</span>
                <p className="mt-1 text-xl font-extrabold text-amber-600 dark:text-amber-400">{lobbyStats.pending}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Selesai</span>
                <p className="mt-1 text-xl font-extrabold text-foreground">{lobbyStats.closed}</p>
              </div>
            </div>

            {/* Filter Bar: Bulan, Tahun, Jenis Kartu, Pencarian, Export */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Filter className="size-3.5" /> Filter:
                </div>

                <select
                  value={lobbyMonth}
                  onChange={(e) => setLobbyMonth(e.target.value)}
                  aria-label="Filter Bulan"
                  className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  <option value="">Semua Bulan</option>
                  {MONTH_LABELS.map((label, idx) => (
                    <option key={label} value={idx}>
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  value={lobbyYear}
                  onChange={(e) => setLobbyYear(e.target.value)}
                  aria-label="Filter Tahun"
                  className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  <option value="">Semua Tahun</option>
                  {lobbyYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>

                <select
                  value={lobbyCardType}
                  onChange={(e) => setLobbyCardType(e.target.value as CardType | 'all')}
                  aria-label="Filter Jenis Kartu"
                  className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  <option value="all">Semua Jenis Kartu</option>
                  <option value="visitor">Visitor</option>
                  <option value="vendor">Vendor</option>
                  <option value="special_area">Special Area</option>
                  <option value="photography">Photography</option>
                  <option value="affiliate">Affiliate</option>
                </select>

                {(lobbyMonth !== '' || lobbyYear !== '' || lobbyCardType !== 'all' || lobbyQuery !== '') && (
                  <button
                    type="button"
                    onClick={() => {
                      setLobbyMonth('')
                      setLobbyYear('')
                      setLobbyCardType('all')
                      setLobbyQuery('')
                    }}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    Reset Filter
                  </button>
                )}

                <span className="text-xs text-muted-foreground">
                  Menampilkan <strong>{filteredLobbyRows.length}</strong> data
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={lobbyQuery}
                    onChange={(e) => setLobbyQuery(e.target.value)}
                    placeholder="Cari nama, PIC, keterangan..."
                    className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-xs text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExportLobby}
                  disabled={filteredLobbyRows.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="size-3.5" /> Export Excel
                </button>
              </div>
            </div>

            {/* Pop-up Card Table Content */}
            <div className="flex-1 overflow-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="sticky top-0 z-10 bg-secondary/90 backdrop-blur-xs">
                  <tr>
                    {[
                      'Tanggal/Jam',
                      'Nama Lengkap',
                      'PIC JAI',
                      'Keterangan',
                      'Asal',
                      'Status & Kartu',
                      'Barcode',
                      'Jam Masuk',
                      'Jam Keluar',
                      'Detail',
                    ].map((head) => (
                      <th
                        key={head}
                        className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && (
                    <tr>
                      <td colSpan={10} className="px-5 py-16 text-center">
                        <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" />
                        <p className="text-sm text-muted-foreground">Memuat data dari admin lobby...</p>
                      </td>
                    </tr>
                  )}
                  {!loading && lobbyRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-5 py-16 text-center text-sm text-muted-foreground">
                        Belum ada data pendaftaran dari Admin Lobby.
                      </td>
                    </tr>
                  )}
                  {!loading && lobbyRows.length > 0 && filteredLobbyRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-5 py-16 text-center text-sm text-muted-foreground">
                        Tidak ada data yang sesuai dengan filter atau pencarian.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    lobbyPagination.pageItems.map((r, index) => {
                      const status = lobbyStatusOf(r)
                      const barcode = getBarcode(r)
                      return (
                        <tr
                          key={r.id}
                          className={`transition-colors hover:bg-secondary/40 ${index % 2 ? 'bg-secondary/15' : ''}`}
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                            {formatDateTime(r.registered_at)}
                          </td>
                          <td className="min-w-[150px] px-4 py-3 font-semibold text-foreground">
                            {r.full_name}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {r.pic_jai}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {r.company_remark}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                                r.entry_path === 'security'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                              }`}
                            >
                              {r.entry_path === 'security' ? 'Security' : 'Lobby'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                LOBBY_STAGE_BADGE[status.key] ?? 'bg-secondary text-muted-foreground'
                              }`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                            {barcode ?? '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                            {formatDateTime(r.entry_at)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                            {formatDateTime(r.exit_at)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => setViewDetail(r)}
                              title="Lihat Detail Pendaftaran"
                              className="inline-flex size-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                            >
                              <Eye className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {/* Pop-up Footer Pagination */}
            {!loading && filteredLobbyRows.length > 0 && (
              <Pagination
                page={lobbyPagination.page}
                totalPages={lobbyPagination.totalPages}
                onPageChange={lobbyPagination.setPage}
                totalItems={filteredLobbyRows.length}
                pageSize={lobbyPagination.pageSize}
              />
            )}
          </div>
        </div>
      )}

      {/* Guest Detail Modal */}
      {viewDetail && (
        <GuestDetailModal
          registration={viewDetail}
          onClose={() => setViewDetail(null)}
        />
      )}
    </>
  )
}
