'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, GraduationCap } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

type Status = 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
type ScheduleItem = {
  id: number
  start_date: string
  end_date: string
  period_label: string | null
  title: string
  scope?: string | null
  audience?: string | null
  pic: string | null
  status: Status
}

const STATUS_BADGE: Record<Status, string> = {
  scheduled: 'bg-[#edf6ff] text-[#1a5fa0]',
  ongoing: 'bg-[#fff3d6] text-[#8a6100]',
  completed: 'bg-[#dff5e6] text-[#1a6e3a]',
  cancelled: 'bg-secondary text-muted-foreground',
}
const STATUS_LABEL: Record<Status, string> = { scheduled: 'Terjadwal', ongoing: 'Berlangsung', completed: 'Selesai', cancelled: 'Dibatalkan' }

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function ScheduleRow({ title, endpoint }: { title: string; endpoint: 'audit-schedule' | 'training-schedule' }) {
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const Icon = endpoint === 'audit-schedule' ? CalendarDays : GraduationCap

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/${endpoint}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items: ScheduleItem[] }) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [endpoint])

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="size-4" /></span>
        <p className="portal-eyebrow">{title}</p>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2].map((i) => <div key={i} className="h-32 w-72 flex-none animate-pulse rounded-2xl bg-secondary/50" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-6 py-8 text-center text-sm text-muted-foreground">Belum ada jadwal.</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {items.map((item) => (
            <div key={item.id} className="w-72 flex-none rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">{formatDate(item.start_date)} &ndash; {formatDate(item.end_date)}</span>
                <span className={`inline-flex flex-none items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_BADGE[item.status]}`}>{STATUS_LABEL[item.status]}</span>
              </div>
              <p className="font-semibold text-foreground">{item.title}</p>
              {item.period_label && <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-primary/70">{item.period_label}</p>}
              {(item.scope || item.audience) && <p className="mt-2 text-xs text-muted-foreground">{item.scope ?? item.audience}</p>}
              {item.pic && <p className="mt-1 text-xs text-muted-foreground">PIC: {item.pic}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
