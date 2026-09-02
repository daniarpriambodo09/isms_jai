// app/audits/page.tsx

'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

type Status = 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
type AuditRow = {
  id: number
  start_date: string
  end_date: string
  period_label: string | null
  title: string
  scope: string | null
  pic: string | null
  status: Status
}

function toUtcDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`)
}
function formatShort(value: string, part: 'month' | 'day') {
  const date = toUtcDate(value)
  return part === 'month'
    ? date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
    : date.toLocaleDateString('en-US', { day: '2-digit', timeZone: 'UTC' })
}
function formatDate(value: string) {
  return toUtcDate(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
function formatEta(value: string) {
  const diffDays = Math.round((toUtcDate(value).getTime() - Date.now()) / 86_400_000)
  if (diffDays > 1) return `In ${diffDays} days`
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === 0) return 'Today'
  return 'In progress'
}

const statusBadge = (highlighted: boolean) => {
  if (highlighted) return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
      style={{ background: 'linear-gradient(135deg, #edf8f7, #d4f0ee)', color: '#1a6e6a', border: '1px solid rgba(39,142,132,0.25)' }}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#278e84]" />
      Upcoming
    </span>
  )
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
      style={{ background: '#f3f6fa', color: '#5a7a92', border: '1px solid rgba(90,122,146,0.2)' }}
    >
      Scheduled
    </span>
  )
}

export default function AuditsPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/audit-schedule`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items: AuditRow[] }) => setRows(data.items ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const timeline = useMemo(
    () => rows
      .filter((row) => row.status === 'scheduled' || row.status === 'ongoing')
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 3),
    [rows]
  )

  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: '#e0eaf1',
        background: 'linear-gradient(145deg, #ffffff 0%, #f7fafc 100%)',
        boxShadow: '0 4px 20px rgba(34,58,79,0.06), 0 1px 4px rgba(34,58,79,0.04)',
      }}
    >
      {/* Card header */}
      <div
        className="border-b px-7 py-6"
        style={{
          borderColor: '#e8f0f5',
          background: 'linear-gradient(135deg, #f8fbfd 0%, #f0f6fa 100%)',
        }}
      >
        <div className="flex items-start justify-between gap-5 max-[680px]:flex-col">
          <div className="flex items-center gap-4">
            {/* Icon badge */}
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #1a5f7a 0%, #278e84 100%)',
                boxShadow: '0 4px 12px rgba(39,142,132,0.3)',
                color: 'white',
              }}
            >
              <CalendarDays className="size-5" />
            </div>
            <div>
              <div
                className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: '#278e84' }}
              >
                Monitoring
              </div>
              <h2 className="text-[20px] font-bold tracking-tight" style={{ color: '#1a2f3e' }}>
                Internal Audit Schedule
              </h2>
              <p className="mt-1 text-[12.5px] leading-snug" style={{ color: '#6a8499' }}>
                Upcoming audit activities across the ISMS scope.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="inline-flex flex-shrink-0 items-center gap-2 self-center rounded-xl border px-4 py-2.5 text-[12.5px] font-semibold transition-all duration-150 hover:scale-[1.02]"
            style={{
              borderColor: '#c8dce8',
              background: 'linear-gradient(135deg, #ffffff, #f3f8fb)',
              color: '#3c5369',
              boxShadow: '0 2px 6px rgba(34,58,79,0.08)',
            }}
          >
            <CalendarDays className="size-4" />
            Add to calendar
          </button>
        </div>
      </div>

      <div className="p-7 max-[680px]:p-4">
        {/* Timeline cards */}
        {!loading && timeline.length > 0 && (
          <div className="mb-7 grid grid-cols-3 gap-4 max-[680px]:grid-cols-1">
            {timeline.map((item, index) => (
              <div
                key={item.id}
                className="relative overflow-hidden rounded-xl border p-5 transition-all duration-200 hover:scale-[1.01] hover:shadow-md"
                style={{
                  borderColor: index === 0 ? 'rgba(39,142,132,0.3)' : '#dde8ef',
                  background: index === 0
                    ? 'linear-gradient(135deg, #edf8f7 0%, #ddf2f0 100%)'
                    : 'linear-gradient(135deg, #f8fbfd 0%, #f2f7fa 100%)',
                  boxShadow: index === 0
                    ? '0 4px 16px rgba(39,142,132,0.15)'
                    : '0 2px 8px rgba(34,58,79,0.05)',
                }}
              >
                {/* Top accent bar */}
                <div
                  className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl"
                  style={{
                    background: index === 0
                      ? 'linear-gradient(90deg, #278e84, #1a5f7a)'
                      : 'linear-gradient(90deg, #94afc0, #b0c5d4)',
                  }}
                />

                <div className="flex items-start justify-between gap-3">
                  {/* Date block */}
                  <div className="flex flex-col items-center">
                    <span
                      className="text-[9px] font-bold uppercase tracking-widest"
                      style={{ color: index === 0 ? '#1a6e6a' : '#7a9bb0' }}
                    >
                      {formatShort(item.start_date, 'month')}
                    </span>
                    <strong
                      className="text-[28px] font-bold leading-none"
                      style={{ color: index === 0 ? '#1a5f7a' : '#2f4a5e' }}
                    >
                      {formatShort(item.start_date, 'day')}
                    </strong>
                  </div>

                  {/* Icon */}
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      background: index === 0 ? 'rgba(39,142,132,0.15)' : 'rgba(90,122,146,0.1)',
                      color: index === 0 ? '#278e84' : '#5a7a92',
                    }}
                  >
                    {index === 0 ? <Clock className="size-4" /> : <CalendarDays className="size-4" />}
                  </div>
                </div>

                <div className="mt-3">
                  <strong className="block text-[13px] font-bold" style={{ color: '#1a2f3e' }}>
                    {item.title}
                  </strong>
                  <span className="mt-0.5 block text-[11px]" style={{ color: index === 0 ? '#3a7a74' : '#7a9bb0' }}>
                    {formatEta(item.start_date)}
                  </span>
                  <div className="mt-2.5">{statusBadge(index === 0)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Audit table */}
        <div
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: '#e0eaf1' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[12px]">
              <thead>
                <tr
                  style={{
                    background: 'linear-gradient(135deg, #f0f6fa 0%, #e8f2f7 100%)',
                  }}
                >
                  {['Start', 'End', 'Period', 'Activities', 'Scope', 'PIC'].map((head) => (
                    <th
                      key={head}
                      className="whitespace-nowrap border-b px-4 py-3.5 text-left text-[9.5px] font-bold uppercase tracking-[0.1em]"
                      style={{ borderColor: '#d8e8f0', color: '#5a7a92' }}
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[12px]" style={{ color: '#7a9bb0' }}>Memuat jadwal audit...</td></tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[12px]" style={{ color: '#7a9bb0' }}>Belum ada jadwal audit.</td></tr>
                )}
                {rows.map((row, rowIndex) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-[#f5f9fb]"
                    style={{
                      background: rowIndex % 2 === 1 ? '#fafcfd' : '#ffffff',
                    }}
                  >
                    {[formatDate(row.start_date), formatDate(row.end_date), row.period_label ?? '—', row.title, row.scope ?? '—', row.pic ?? '—'].map((value, colIndex) => (
                      <td
                        key={colIndex}
                        className="whitespace-nowrap border-b px-4 py-3.5"
                        style={{
                          borderColor: '#edf2f6',
                          color: colIndex === 0 ? '#278e84' : '#4a6478',
                          fontWeight: colIndex === 0 ? '600' : '400',
                        }}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
