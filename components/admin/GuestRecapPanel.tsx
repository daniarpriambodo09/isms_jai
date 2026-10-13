// components/admin/GuestRecapPanel.tsx
'use client'

// Dashboard: the month's guests per post (Admin Lobby / Pos Security) and per
// kind of card, and the cards that have been out for more than a day.

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Loader2, Users } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { downloadExcel } from '@/lib/excel-export'
import { MONTH_LABELS } from '@/lib/period-filter'

const KINDS = ['visitor', 'vendor', 'supplier', 'affiliate', 'special_area', 'photography'] as const
type Kind = (typeof KINDS)[number]
const KIND_LABEL: Record<Kind, string> = { visitor: 'Visitor', vendor: 'Vendor', supplier: 'Supplier', affiliate: 'Affiliate', special_area: 'Special Area', photography: 'Photography' }
type Station = 'lobby' | 'security'
const STATION_LABEL: Record<Station, string> = { security: 'Pos Security', lobby: 'Admin Lobby' }

type Recap = {
  year: number; month: number; total: number
  byStation: Record<Station, number>; byKind: Record<Kind, number>; counts: Record<Station, Record<Kind, number>>
  closed: number; inside: number; waitingApproval: number
  busiestDay: { date: string; count: number } | null
  overdue: { id: number; name: string; company: string; picJai: string; station: Station; kind: Kind; cardLabel: string; cardNo: string | null; securityCardNo: string | null; entryAt: string; days: number }[]
}

const jakartaNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))
const when = (value: string) => new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const selectClass = 'h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20'

export function GuestRecapPanel() {
  const now = jakartaNow()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<Recap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${API_BASE_PATH}/api/admin/followups?what=guests&year=${year}&month=${month}`, { cache: 'no-store', credentials: 'include' })
      .then(async (res) => { const body = await res.json(); if (!res.ok) throw new Error(body.message); return body as Recap })
      .then((body) => { if (!cancelled) { setData(body); setError(null) } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error && e.message ? e.message : 'Gagal memuat rekap tamu.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [year, month])

  const period = `${MONTH_LABELS[month - 1]} ${year}`
  // only the kinds that actually occur, so the table is not mostly zeros
  const kinds = data ? KINDS.filter((kind) => data.byKind[kind] > 0) : []
  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i)

  const exportExcel = () => {
    if (!data) return
    const rows: (string | number | null)[][] = [
      ...(['security', 'lobby'] as Station[]).map((station) => [STATION_LABEL[station], ...KINDS.map((kind) => data.counts[station][kind]), data.byStation[station]]),
      ['Total', ...KINDS.map((kind) => data.byKind[kind]), data.total],
      [],
      ['Selesai (kartu kembali)', data.closed], ['Masih di dalam', data.inside], ['Menunggu approval', data.waitingApproval],
      ['Hari tersibuk', data.busiestDay ? `${data.busiestDay.date} (${data.busiestDay.count} tamu)` : '-'],
      [],
      ['Kartu belum kembali lebih dari 1 hari (saat ini)'],
      ['Nama', 'Perusahaan', 'PIC JAI', 'Pos', 'Kartu', 'Nomor kartu', 'Kartu Security yang juga masih keluar', 'Jam masuk', 'Hari'],
      ...data.overdue.map((card) => [card.name, card.company, card.picJai, STATION_LABEL[card.station], card.cardLabel, card.cardNo ?? '', card.securityCardNo ?? '', when(card.entryAt), card.days]),
    ]
    downloadExcel(`rekap-tamu-${year}-${String(month).padStart(2, '0')}.xlsx`, [`Rekap tamu ${period}`, ...KINDS.map((kind) => KIND_LABEL[kind]), 'Jumlah'], rows)
  }

  return (
    <section aria-label="Rekap bulanan tamu" className="flex flex-col rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3.5">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Users className="size-4" /></span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Rekap bulanan tamu</h2>
          <p className="text-xs text-muted-foreground">Per pos dan per jenis kartu, dihitung dari tanggal pendaftaran.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Bulan" className={selectClass}>
            {MONTH_LABELS.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Tahun" className={selectClass}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="button" onClick={exportExcel} disabled={!data} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="size-3.5" />Excel
          </button>
        </div>
      </div>

      <div className={`flex flex-col gap-5 px-5 py-4 transition-opacity ${loading && data ? 'opacity-60' : ''}`}>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {!data && !error && <div className="grid place-items-center py-8 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Total tamu', data.total, period],
                ['Pos Security', data.byStation.security, 'terdaftar di pos'],
                ['Admin Lobby', data.byStation.lobby, 'terdaftar di lobby'],
                ['Hari tersibuk', data.busiestDay ? data.busiestDay.count : 0, data.busiestDay ? new Date(`${data.busiestDay.date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' }) : 'belum ada tamu'],
              ].map(([label, value, hint]) => (
                <div key={label as string} className="rounded-xl border border-border bg-secondary/30 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
                  <p className="text-[11px] text-muted-foreground">{hint}</p>
                </div>
              ))}
            </div>

            {data.total === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Belum ada tamu terdaftar pada {period}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm" data-testid="guest-recap-table">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Pos</th>
                      {kinds.map((kind) => <th key={kind} className="px-3 py-2 text-right font-semibold">{KIND_LABEL[kind]}</th>)}
                      <th className="py-2 pl-3 text-right font-semibold">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(['security', 'lobby'] as Station[]).map((station) => (
                      <tr key={station}>
                        <td className="py-2.5 pr-3 font-medium text-foreground">{STATION_LABEL[station]}</td>
                        {kinds.map((kind) => <td key={kind} className="px-3 py-2.5 text-right tabular-nums text-foreground">{data.counts[station][kind] || <span className="text-muted-foreground/50">–</span>}</td>)}
                        <td className="py-2.5 pl-3 text-right font-semibold tabular-nums text-foreground">{data.byStation[station]}</td>
                      </tr>
                    ))}
                    <tr className="bg-secondary/30">
                      <td className="py-2.5 pr-3 font-semibold text-foreground">Total</td>
                      {kinds.map((kind) => <td key={kind} className="px-3 py-2.5 text-right font-semibold tabular-nums text-foreground">{data.byKind[kind]}</td>)}
                      <td className="py-2.5 pl-3 text-right font-bold tabular-nums text-foreground">{data.total}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-muted-foreground">Dari {data.total} tamu: {data.closed} selesai (kartu kembali) · {data.inside} masih di dalam · {data.waitingApproval} menunggu approval.</p>
              </div>
            )}

            <div>
              <p className={`mb-2 flex items-center gap-2 text-sm font-semibold ${data.overdue.length ? 'text-[#b3361f]' : 'text-foreground'}`}>
                {data.overdue.length ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4 text-emerald-600" />}
                Kartu belum kembali lebih dari 1 hari
                <span className="font-normal text-muted-foreground">· saat ini, semua bulan</span>
                {data.overdue.length > 0 && <span className="rounded-full bg-[#fbe6e0] px-2 py-0.5 text-[11px] font-bold text-[#b3361f]">{data.overdue.length}</span>}
              </p>
              {data.overdue.length === 0 ? (
                <p className="text-xs text-muted-foreground">Tidak ada — semua kartu yang keluar lebih dari sehari lalu sudah kembali.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[640px] text-sm" data-testid="overdue-table">
                    <thead className="bg-secondary/40 text-left text-xs text-muted-foreground">
                      <tr>{['Tamu', 'Pos', 'Kartu', 'Jam masuk', 'Lama'].map((head) => <th key={head} className="px-3 py-2 font-semibold">{head}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.overdue.map((card) => (
                        <tr key={card.id}>
                          <td className="px-3 py-2.5"><span className="block font-medium text-foreground">{card.name}</span><span className="block text-xs text-muted-foreground">{[card.company, card.picJai && card.picJai !== '-' ? `PIC ${card.picJai}` : ''].filter(Boolean).join(' · ')}</span></td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{STATION_LABEL[card.station]}</td>
                          <td className="px-3 py-2.5"><span className="block text-xs text-foreground">{card.cardLabel}</span><span className="block font-mono text-[11px] font-semibold text-muted-foreground">{card.cardNo ?? '—'}{card.securityCardNo ? ` + Security ${card.securityCardNo}` : ''}</span></td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{when(card.entryAt)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-[#b3361f]">{card.days} hari</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
