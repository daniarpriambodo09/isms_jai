// app/dashboard-admin/page.tsx
//
// ISM Admin dashboard: everything that needs attention today on one screen —
// approvals in progress or sent back, requests waiting, documents due for
// periodic review, visitors and policy acknowledgements.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowRight, Camera, CalendarClock, CheckCircle2, FileSignature, Loader2, PencilLine, RefreshCw,
  ShieldCheck, UserCheck, Users,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { AdminGate } from '@/components/admin-gate'
import { docKindInfo } from '@/lib/document-kinds'

type ReviewItem = { kind: string; kindLabel: string; id: number; controlNo: string; title: string; revision: number | null; effDate: string; dueDate: string; daysLeft: number; href: string }
type Dashboard = {
  generatedAt: string
  procedures: {
    pending: { documentId: number; kind?: string; controlNo: string; title: string; approver: string; role: string; since: string | null; emailError: string | null }[]
    revision: number
    revisionDocs: { id: number; kind?: string; control_no: string; title: string; revision: number }[]
    approvedThisMonth: number
  }
  requests: { photoPending: number; specialPending: number }
  visits: { today: number; inside: number }
  review: { months: number; overdue: ReviewItem[]; soon: ReviewItem[] }
  policy: { version: string; label: string; acknowledged: number; departments: number }
}

const fmtDate = (v: string) => new Date(v.length === 10 ? `${v}T00:00:00+07:00` : v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const daysAgo = (v: string | null) => {
  if (!v) return ''
  const d = Math.floor((Date.now() - new Date(v).getTime()) / 86_400_000)
  return d <= 0 ? 'hari ini' : `${d} hari lalu`
}

function Stat({ icon, label, value, hint, href, tone = 'default' }: { icon: React.ReactNode; label: string; value: number | string; hint?: string; href?: string; tone?: 'default' | 'alert' | 'good' }) {
  const toneClass = tone === 'alert' ? 'text-[#b3361f]' : tone === 'good' ? 'text-emerald-700' : 'text-foreground'
  const body = (
    <>
      <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground [&>svg]:size-4">{icon}{label}</span>
      <span className={`mt-2 block font-display text-4xl font-semibold leading-none ${toneClass}`}>{value}</span>
      {hint && <span className="mt-2 block text-xs text-muted-foreground">{hint}</span>}
    </>
  )
  const cls = 'group block rounded-2xl border border-border bg-card p-5 transition'
  return href ? <Link href={href} className={`${cls} hover:-translate-y-0.5 hover:border-[color:var(--p-600)] hover:shadow-md`}>{body}</Link> : <div className={cls}>{body}</div>
}

function Panel({ title, icon, href, linkLabel, children }: { title: string; icon: React.ReactNode; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground [&>svg]:size-4 [&>svg]:text-[color:var(--p-600)]">{icon}{title}</h2>
        {href && <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--p-600)] hover:underline">{linkLabel ?? 'Lihat semua'} <ArrowRight className="size-3.5" /></Link>}
      </div>
      <div className="flex-1 px-5 py-3">{children}</div>
    </section>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-emerald-600" />{children}</p>
)

export default function DashboardAdminPage() {
  const { isLoggedIn, isLoading, adminUser } = useAuth()
  const isAdmin = adminUser?.role === 'ism_admin'
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/admin/dashboard`, { cache: 'no-store' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setData(d)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat dashboard.')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    load()
    const t = window.setInterval(load, 60_000)
    return () => window.clearInterval(t)
  }, [isAdmin, load])

  if (!isLoading && !isLoggedIn) return <AdminGate />
  if (!isLoading && adminUser && !isAdmin) return <AdminGate title="Akses terbatas" message="Halaman ini hanya untuk akun ISM Admin." />

  if (!data) {
    return error
      ? <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      : <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Memuat dashboard…</p>
  }

  const { procedures, requests, visits, review, policy } = data
  const reviewList = [...review.overdue, ...review.soon]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Dashboard Admin</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Ringkasan yang perlu ditindaklanjuti · diperbarui {new Date(data.generatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <button type="button" onClick={load} disabled={refreshing} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-60">
          <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Muat ulang
        </button>
      </div>

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<FileSignature />} label="Menunggu pengesahan" value={procedures.pending.length} hint="Belum tampil ke pengunjung" href="/prosedur-isms" />
        <Stat icon={<PencilLine />} label="Diminta revisi" value={procedures.revision} hint="Perbaiki lalu ajukan ulang" href="/prosedur-isms" tone={procedures.revision ? 'alert' : 'default'} />
        <Stat icon={<CalendarClock />} label="Review dokumen terlambat" value={review.overdue.length} hint={`${review.soon.length} lagi jatuh tempo ≤ 30 hari`} tone={review.overdue.length ? 'alert' : 'good'} />
        <Stat icon={<ShieldCheck />} label="Konfirmasi kebijakan" value={policy.acknowledged} hint={`${policy.departments} departemen · ${policy.label}`} href="/kelola-pernyataan-kebijakan" />
        <Stat icon={<Camera />} label="Izin foto/video menunggu" value={requests.photoPending} href="/kelola-permintaan-foto-video" tone={requests.photoPending ? 'alert' : 'default'} />
        <Stat icon={<UserCheck />} label="Izin area special menunggu" value={requests.specialPending} href="/kelola-izin-area-special" tone={requests.specialPending ? 'alert' : 'default'} />
        <Stat icon={<Users />} label="Tamu / vendor hari ini" value={visits.today} hint={`${visits.inside} masih di dalam area`} />
        <Stat icon={<CheckCircle2 />} label="Disahkan bulan ini" value={procedures.approvedThisMonth} tone="good" href="/prosedur-isms" />
      </div>

      <div className="grid gap-5">
        <Panel title="Pengesahan berjalan (belum tampil ke pengunjung)" icon={<FileSignature />} href="/prosedur-isms" linkLabel="Register prosedur">
          {!procedures.pending.length && !procedures.revisionDocs.length ? <Empty>Tidak ada pengesahan yang tertunda.</Empty> : (
            <ul className="divide-y divide-border">
              {procedures.revisionDocs.map((d) => (
                <li key={`r${d.id}`} className="py-2.5">
                  <Link href={`${docKindInfo(d.kind).path}?q=${encodeURIComponent(d.control_no)}`} className="block hover:underline">
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><span className="rounded-full bg-[#fbe6e0] px-2 py-0.5 text-[10.5px] text-[#b3361f]">Perlu revisi</span>{d.control_no}</span>
                    <span className="block truncate text-xs text-muted-foreground">{docKindInfo(d.kind).label} · {d.title} · Rev. {d.revision}</span>
                  </Link>
                </li>
              ))}
              {procedures.pending.map((s) => (
                <li key={`p${s.documentId}`} className="py-2.5">
                  <Link href={`${docKindInfo(s.kind).path}?q=${encodeURIComponent(s.controlNo)}`} className="block hover:underline">
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">{s.controlNo}{s.emailError && <AlertTriangle className="size-3.5 text-[#b3361f]" aria-label="Email gagal terkirim" />}</span>
                    <span className="block truncate text-xs text-muted-foreground">{docKindInfo(s.kind).label} · menunggu {s.approver} ({s.role}) · {daysAgo(s.since)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <section>
          <Panel title={`Review dokumen berkala (${review.months} bulan setelah Eff. Date)`} icon={<CalendarClock />}>
            {!reviewList.length ? <Empty>Semua dokumen masih dalam masa berlaku review.</Empty> : (
              <div className="overflow-x-auto">
                <table className="admin-table w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr><th className="py-2 pr-3 font-semibold">Dokumen</th><th className="py-2 pr-3 font-semibold">Jenis</th><th className="py-2 pr-3 font-semibold">Eff. Date</th><th className="py-2 pr-3 font-semibold">Jatuh tempo</th><th className="py-2 font-semibold">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reviewList.map((r) => (
                      <tr key={`${r.kind}${r.id}`}>
                        <td data-cell="title" className="py-2.5 pr-3">
                          <Link href={r.href} className="font-semibold text-foreground hover:underline">{r.controlNo}</Link>
                          <span className="block max-w-[360px] truncate text-xs text-muted-foreground">{r.title}{r.revision !== null ? ` · Rev. ${r.revision}` : ''}</span>
                        </td>
                        <td data-label="Jenis" className="py-2.5 pr-3 text-muted-foreground">{r.kindLabel}</td>
                        <td data-label="Eff. Date" className="py-2.5 pr-3 text-muted-foreground">{fmtDate(r.effDate)}</td>
                        <td data-label="Jatuh tempo" className="py-2.5 pr-3 text-muted-foreground">{fmtDate(r.dueDate)}</td>
                        <td data-label="Status" className="py-2.5">
                          {r.daysLeft < 0
                            ? <span className="rounded-full bg-[#fbe6e0] px-2 py-0.5 text-xs font-semibold text-[#b3361f]">Terlambat {-r.daysLeft} hari</span>
                            : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{r.daysLeft === 0 ? 'Hari ini' : `${r.daysLeft} hari lagi`}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-muted-foreground">Ringkasan ini juga dikirim ke email Admin ISM setiap Senin pagi. Setelah dokumen direview, upload revisi baru dengan Eff. Date terbaru.</p>
              </div>
            )}
          </Panel>
        </section>
      </div>
    </div>
  )
}
