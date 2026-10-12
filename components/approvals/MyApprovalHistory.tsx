// components/approvals/MyApprovalHistory.tsx
'use client'

// "Riwayat lengkap" on Persetujuan Saya: every decision the account has made
// (all revisions, also signings that were started again later), newest
// first, searchable by control number or title.

import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Loader2, QrCode, Search, XCircle } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { Pagination } from '@/components/pagination'

type Item = {
  stepId: number; outcome: 'approved' | 'rejected'; decidedAt: string; roleTitle: string; signsReview: boolean
  documentId: number; controlNo: string; title: string; revision: number; kindLabel: string
  note: string | null; superseded: boolean; token: string | null; qrPending?: boolean
}
type Page = { items: Item[]; total: number; page: number; pages: number; pageSize: number }
type Outcome = '' | 'approved' | 'rejected'

const when = (value: string) => new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// refreshKey: changes when a decision was just made on the page above.
export function MyApprovalHistory({ refreshKey }: { refreshKey: number }) {
  const [typed, setTyped] = useState('')
  const [q, setQ] = useState('')
  const [outcome, setOutcome] = useState<Outcome>('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Page | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // search as you type, a moment after the last key
  useEffect(() => {
    const timer = window.setTimeout(() => { setQ(typed.trim()); setPage(1) }, 300)
    return () => window.clearTimeout(timer)
  }, [typed])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (q) params.set('q', q)
    if (outcome) params.set('outcome', outcome)
    fetch(`${API_BASE_PATH}/api/my-approvals/history?${params}`, { cache: 'no-store', credentials: 'include' })
      .then(async (res) => { const body = await res.json(); if (!res.ok) throw new Error(body.message); return body as Page })
      .then((body) => { if (!cancelled) { setData(body); setError(null) } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error && e.message ? e.message : 'Gagal memuat riwayat.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [q, outcome, page, refreshKey])

  return (
    <section aria-label="Riwayat persetujuan" className="rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="portal-eyebrow">Riwayat persetujuan</p>
          <p className="mt-1 text-xs text-muted-foreground">{data ? `${data.total} keputusan${q || outcome ? ' yang cocok' : ''}` : 'Memuat…'}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Cari riwayat" placeholder="Cari nomor kontrol atau judul…" className="h-10 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15 sm:w-72" />
          </div>
          <div className="inline-flex rounded-full border border-border bg-card p-1" role="group" aria-label="Saring keputusan">
            {([['', 'Semua'], ['approved', 'Disetujui'], ['rejected', 'Minta revisi']] as [Outcome, string][]).map(([value, label]) => (
              <button key={value || 'all'} type="button" aria-pressed={outcome === value} onClick={() => { setOutcome(value); setPage(1) }} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${outcome === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="m-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
      {!data && loading && <div className="grid place-items-center py-14 text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>}
      {data && data.items.length === 0 && (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">{q || outcome ? 'Tidak ada riwayat yang cocok dengan pencarian.' : 'Belum ada keputusan yang tercatat.'}</p>
      )}
      {data && data.items.length > 0 && (
        <>
          <ul className={`divide-y divide-border transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {data.items.map((item) => (
              <li key={item.stepId} data-testid="my-history" className="flex flex-col gap-2 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${item.signsReview ? 'bg-emerald-500/10 text-emerald-700' : 'bg-primary/10 text-primary'}`}>{item.signsReview ? 'Form Review' : 'Dokumen'}</span>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">{item.kindLabel}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{item.controlNo} · Rev. {item.revision}</span>
                    {item.superseded && <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground" title="Pengesahan diulang atau dokumennya sudah direvisi setelah keputusan ini">sudah diganti</span>}
                  </div>
                  <p className="mt-1.5 break-words text-sm font-semibold text-foreground">{item.signsReview ? `Form Review — ${item.title}` : item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Sebagai {item.roleTitle}</p>
                  {item.note && <p className="mt-1.5 line-clamp-2 rounded-lg bg-red-500/5 px-3 py-1.5 text-xs text-red-800">Catatan revisi: {item.note}</p>}
                  {item.qrPending && (
                    <p className="mt-1.5 inline-flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs leading-5 text-amber-800" data-testid="qr-pending">
                      <QrCode className="mt-0.5 size-3.5 flex-none" />
                      <span>Persetujuan Anda sudah tercatat. QR tanda tangan Anda <strong>belum ditempatkan oleh Admin ISM</strong> — sampai itu dilakukan, dokumen masih tampil tanpa QR.</span>
                    </p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-3 text-xs">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${item.outcome === 'approved' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-700'}`}>
                    {item.outcome === 'approved' ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}{item.outcome === 'approved' ? 'Disetujui' : 'Minta revisi'}
                  </span>
                  <span className="whitespace-nowrap text-muted-foreground">{when(item.decidedAt)}</span>
                  {item.token && (
                    <a href={`${API_BASE_PATH}/api/prosedur-isms/${item.documentId}/pdf?token=${item.token}${item.signsReview ? '&part=review' : ''}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[color:var(--p-600)] hover:underline">Lihat <ExternalLink className="size-3" /></a>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.pages} onPageChange={setPage} totalItems={data.total} pageSize={data.pageSize} />
        </>
      )}
    </section>
  )
}
