// app/kelola-jadwal/page.tsx

'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, GraduationCap, Pencil, Plus, Settings, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { ScheduleFormModal, type EditableSchedule, type ScheduleKind, type Status } from '@/components/documents/ScheduleFormModal'

type AuditRow = { id: number; start_date: string; end_date: string; period_label: string | null; title: string; scope: string | null; pic: string | null; status: Status }
type TrainingRow = { id: number; start_date: string; end_date: string; period_label: string | null; title: string; audience: string | null; pic: string | null; status: Status }
type Row = AuditRow | TrainingRow

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const STATUS_BADGE: Record<Status, string> = {
  scheduled: 'bg-[#edf6ff] text-[#1a5fa0]',
  ongoing: 'bg-[#fff3d6] text-[#8a6100]',
  completed: 'bg-[#dff5e6] text-[#1a6e3a]',
  cancelled: 'bg-secondary text-muted-foreground',
}
const STATUS_LABEL: Record<Status, string> = { scheduled: 'Terjadwal', ongoing: 'Berlangsung', completed: 'Selesai', cancelled: 'Dibatalkan' }

const TABS: { value: ScheduleKind; label: string; icon: typeof CalendarDays }[] = [
  { value: 'audit-schedule', label: 'Jadwal Audit', icon: CalendarDays },
  { value: 'training-schedule', label: 'Jadwal Training', icon: GraduationCap },
]

export default function KelolaJadwalPage() {
  const { isLoggedIn, isLoading } = useAuth()
  const [tab, setTab] = useState<ScheduleKind>('audit-schedule')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/${tab}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setRows(data.items ?? [])
      setError(null)
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : 'Gagal memuat jadwal.')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { if (isLoggedIn) load() }, [isLoggedIn, load])

  if (!isLoading && !isLoggedIn) {
    return <section className="rounded-3xl border border-border bg-card p-10 text-center shadow-sm"><p className="text-sm text-muted-foreground">Halaman ini khusus untuk admin yang sudah login.</p></section>
  }

  const isAudit = tab === 'audit-schedule'
  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (row: Row) => { setEditing(row); setFormOpen(true) }

  const handleDelete = async (row: Row) => {
    if (!confirm(`Hapus jadwal "${row.title}"?`)) return
    const res = await fetch(`${API_BASE_PATH}/api/${tab}/${row.id}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) { const data = await res.json().catch(() => null); setError(data?.message ?? 'Gagal menghapus jadwal.'); return }
    load()
  }

  const editableItem: EditableSchedule | undefined = editing
    ? {
        id: editing.id,
        startDate: editing.start_date.slice(0, 10),
        endDate: editing.end_date.slice(0, 10),
        periodLabel: editing.period_label,
        title: editing.title,
        scopeOrAudience: isAudit ? (editing as AuditRow).scope : (editing as TrainingRow).audience,
        pic: editing.pic,
        status: editing.status,
      }
    : undefined

  return (
    <div className="flex flex-col gap-7">
      <header className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
              <Settings className="size-3.5" /> Admin workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Kelola Jadwal</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">Atur jadwal audit dan training yang tampil di halaman Home dan halaman Jadwal Audit.</p>
          </div>
          <button type="button" onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5">
            <Plus className="size-4" /> Tambah Jadwal
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.value} type="button" onClick={() => setTab(t.value)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${tab === t.value ? 'border-transparent bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-secondary'}`}>
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-secondary/55">
              <tr>
                {['Periode', 'Judul', isAudit ? 'Scope' : 'Target Peserta', 'PIC', 'Status', 'Aksi'].map((head) => (
                  <th key={head} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr><td colSpan={6} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat...</p></td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-16 text-center"><CalendarDays className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">Belum ada jadwal.</p></td></tr>
              )}
              {rows.map((row, index) => (
                <tr key={row.id} className={index % 2 ? 'bg-secondary/20' : ''}>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(row.start_date)} &ndash; {formatDate(row.end_date)}
                    {row.period_label && <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary/70">{row.period_label}</span>}
                  </td>
                  <td className="min-w-[200px] px-4 py-3 font-medium text-foreground">{row.title}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{isAudit ? (row as AuditRow).scope : (row as TrainingRow).audience}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{row.pic}</td>
                  <td className="whitespace-nowrap px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_BADGE[row.status]}`}>{STATUS_LABEL[row.status]}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => openEdit(row)} aria-label={`Edit ${row.title}`} className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-accent-foreground">
                        <Pencil className="size-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(row)} aria-label={`Hapus ${row.title}`} className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ScheduleFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} kind={tab} item={editableItem} />
    </div>
  )
}
