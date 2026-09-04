'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'

export type ScheduleKind = 'audit-schedule' | 'training-schedule'
export type Status = 'scheduled' | 'ongoing' | 'completed' | 'cancelled'

export type EditableSchedule = {
  id: number
  startDate: string
  endDate: string
  periodLabel: string | null
  title: string
  scopeOrAudience: string | null
  pic: string | null
  status: Status
}

const inputClass = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const labelClass = 'mb-1.5 block text-xs font-semibold text-muted-foreground'

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'scheduled', label: 'Terjadwal' },
  { value: 'ongoing', label: 'Berlangsung' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
]

export function ScheduleFormModal({
  open,
  onClose,
  onSaved,
  kind,
  item,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  kind: ScheduleKind
  item?: EditableSchedule
}) {
  const isEdit = Boolean(item)
  const isAudit = kind === 'audit-schedule'
  const scopeLabel = isAudit ? 'Scope / Departemen' : 'Target Peserta'

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [periodLabel, setPeriodLabel] = useState('')
  const [title, setTitle] = useState('')
  const [scopeOrAudience, setScopeOrAudience] = useState('')
  const [pic, setPic] = useState('')
  const [status, setStatus] = useState<Status>('scheduled')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEscapeClose(open, onClose)

  useEffect(() => {
    if (open) {
      setStartDate(item?.startDate ?? '')
      setEndDate(item?.endDate ?? '')
      setPeriodLabel(item?.periodLabel ?? '')
      setTitle(item?.title ?? '')
      setScopeOrAudience(item?.scopeOrAudience ?? '')
      setPic(item?.pic ?? '')
      setStatus(item?.status ?? 'scheduled')
      setError(null)
    }
  }, [open, item])

  if (!open) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload = {
        startDate,
        endDate,
        periodLabel: periodLabel || null,
        title,
        [isAudit ? 'scope' : 'audience']: scopeOrAudience || null,
        pic: pic || null,
        status,
      }
      const res = await fetch(`${API_BASE_PATH}/api/${kind}${isEdit ? `/${item!.id}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.message ?? 'Gagal menyimpan jadwal.')
        return
      }
      onSaved()
      onClose()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit Jadwal' : 'Tambah Jadwal'} className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-primary px-6 py-5 text-primary-foreground">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground/65">{isAudit ? 'Jadwal Audit' : 'Jadwal Training'}</p>
            <h2 className="text-lg font-bold">{isEdit ? 'Edit Jadwal' : 'Tambah Jadwal'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-8 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground">
            <X className="size-[18px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <label>
            <span className={labelClass}>Judul</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={labelClass}>Tanggal Mulai</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Tanggal Selesai</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className={inputClass} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={labelClass}>Label Periode (opsional)</span>
              <input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="Q1 / 2026" className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={inputClass}>
                {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={labelClass}>{scopeLabel}</span>
              <input value={scopeOrAudience} onChange={(e) => setScopeOrAudience(e.target.value)} className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>PIC</span>
              <input value={pic} onChange={(e) => setPic(e.target.value)} className={inputClass} />
            </label>
          </div>

          {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary">
              Batal
            </button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
