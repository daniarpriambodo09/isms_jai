'use client'

// Form "Pengajuan Ijin Masuk Area Special Security" (ISMS-F-006-001) —
// same fields as the paper form. Used from the Lobby kiosk and the ISMS
// admin page; submitting emails the IAA for approval.

import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Clock, Loader2, ShieldAlert, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { SPECIAL_AREAS } from '@/lib/special-area-shared'

const input = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const label = 'mb-1.5 block text-xs font-semibold text-muted-foreground'
const OTHER = '__other__'

// Local "YYYY-MM-DD" and "HH:MM" parts of now (+ offset hours).
function localParts(offsetHours = 0) {
  const d = new Date(Date.now() + offsetHours * 3600_000)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  const iso = d.toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

// Accepts "13:30", "13.30", "1330" or "9" and returns "HH:MM", or null.
function normalizeTime(raw: string) {
  const m = raw.trim().replace('.', ':').match(/^(\d{1,2})(?::?(\d{2}))?$/)
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2] ?? 0)
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function toDate(date: string, time: string) {
  const t = normalizeTime(time)
  if (!date || !t) return null
  const d = new Date(`${date}T${t}`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function SpecialAreaFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [requesterName, setRequesterName] = useState('')
  const [orgCompany, setOrgCompany] = useState('')
  const [department, setDepartment] = useState('')
  // Masuk (dari): "right now" by default — shown live and stamped by the server
  // at the moment of submitting — or typed in by hand (manual mode).
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(t) }, [])
  const [fromManual, setFromManual] = useState(false)
  const [fromDate, setFromDate] = useState(() => localParts().date)
  const [fromTime, setFromTime] = useState(() => localParts().time)
  // Keluar (sampai): always typed / picked by hand.
  const [toDate_, setToDate] = useState(() => localParts(2).date)
  const [toTime, setToTime] = useState(() => localParts(2).time)
  const setToOffset = (hours: number) => {
    const base = fromManual ? toDate(fromDate, fromTime) ?? new Date() : new Date()
    const d = new Date(base.getTime() + hours * 3600_000)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    setToDate(d.toISOString().slice(0, 10))
    setToTime(d.toISOString().slice(11, 16))
  }
  const startManual = () => {
    const p = localParts()
    setFromDate(p.date)
    setFromTime(p.time)
    setFromManual(true)
  }
  const [areaChoice, setAreaChoice] = useState<string>(SPECIAL_AREAS[0])
  const [areaOther, setAreaOther] = useState('')
  const [purpose, setPurpose] = useState('')
  const [idCardNo, setIdCardNo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ emailError: string | null } | null>(null)

  useEscapeClose(true, onClose)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const from = fromManual ? toDate(fromDate, fromTime) : new Date()
    const to = toDate(toDate_, toTime)
    if (!from) { setError('Jam masuk tidak valid — tulis seperti 09:30.'); return }
    if (!to) { setError('Jam keluar tidak valid — tulis seperti 13:30.'); return }
    if (to.getTime() <= from.getTime()) { setError('Waktu keluar harus setelah waktu masuk.'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/special-area-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterName, orgCompany, department,
          ...(fromManual ? { fromAt: from.toISOString() } : {}),
          toAt: to.toISOString(),
          area: areaChoice === OTHER ? areaOther : areaChoice,
          purpose, idCardNo,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.message ?? 'Gagal mengirim pengajuan.'); return }
      setDone({ emailError: data.emailError ?? null })
      onSaved()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Pengajuan Ijin Masuk Area Special Security" onClick={(e) => e.stopPropagation()} className="my-6 w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="h-2" style={{ background: 'repeating-linear-gradient(-45deg, #c7161e 0 10px, #8f0f15 10px 20px)' }} />
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="flex items-center gap-1.5 font-mono-label text-[10px] font-semibold text-red-700"><ShieldAlert className="size-3.5" /> ISMS-F-006-001</p>
            <h2 className="mt-1 text-lg font-bold text-foreground">Pengajuan Ijin Masuk Area Special Security</h2>
            <p className="text-xs text-muted-foreground">特別セキュリティ区画入退許可申請書 · Persetujuan via email (e-sign)</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-8 flex-none place-items-center rounded-full text-muted-foreground hover:bg-secondary"><X className="size-4" /></button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <CheckCircle2 className="size-12 text-emerald-600" />
            <p className="text-base font-semibold text-foreground">Pengajuan terkirim</p>
            {done.emailError
              ? <p className="max-w-md rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-900">Tersimpan, tetapi email persetujuan belum terkirim: {done.emailError}</p>
              : <p className="max-w-md text-sm text-muted-foreground">Email persetujuan sudah dikirim ke approver. Status bisa dipantau di daftar pengajuan.</p>}
            <button type="button" onClick={onClose} className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">Selesai</button>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4 p-6 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className={label}>Nama</span><input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} required autoFocus className={input} /></label>
            <label><span className={label}>Nama Organisasi / Perusahaan</span><input value={orgCompany} onChange={(e) => setOrgCompany(e.target.value)} required className={input} /></label>
            <label><span className={label}>Departemen</span><input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Opsional" className={input} /></label>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Masuk (dari){fromManual ? ' — manual' : ' — otomatis saat ini'}</span>
                <button type="button" onClick={() => (fromManual ? setFromManual(false) : startManual())} className="text-[11px] font-semibold text-[color:var(--p-600)] hover:underline">
                  {fromManual ? 'Pakai waktu sekarang' : 'Isi manual'}
                </button>
              </div>
              {fromManual ? (
                <div className="grid grid-cols-[1fr_96px] gap-2">
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required aria-label="Tanggal masuk" className={input} />
                  <input value={fromTime} onChange={(e) => setFromTime(e.target.value)} onBlur={() => { const t = normalizeTime(fromTime); if (t) setFromTime(t) }} required inputMode="numeric" placeholder="09:30" maxLength={5} aria-label="Jam masuk" className={`${input} text-center font-mono`} />
                </div>
              ) : (
                <div className="flex h-10 items-center gap-2 rounded-xl border border-dashed border-input bg-secondary/40 px-3 text-sm font-medium text-foreground" aria-live="off">
                  <Clock className="size-4 text-emerald-600" />
                  <span className="tabular-nums">{now.toLocaleString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700"><span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />Live</span>
                </div>
              )}
            </div>
            <div>
              <span className={label}>Keluar (sampai)</span>
              <div className="grid grid-cols-[1fr_96px] gap-2">
                <input type="date" value={toDate_} onChange={(e) => setToDate(e.target.value)} required aria-label="Tanggal keluar" className={input} />
                <input value={toTime} onChange={(e) => setToTime(e.target.value)} onBlur={() => { const t = normalizeTime(toTime); if (t) setToTime(t) }} required inputMode="numeric" placeholder="13:30" maxLength={5} aria-label="Jam keluar" className={`${input} text-center font-mono`} />
              </div>
              <span className="mt-1 flex flex-wrap gap-1">
                {[1, 2, 4, 8].map((h) => (
                  <button key={h} type="button" onClick={() => setToOffset(h)} className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground">+{h} jam</button>
                ))}
              </span>
            </div>
            <label className={areaChoice === OTHER ? '' : 'sm:col-span-2'}>
              <span className={label}>Area Special Security</span>
              <select value={areaChoice} onChange={(e) => setAreaChoice(e.target.value)} className={input}>
                {SPECIAL_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                <option value={OTHER}>Lainnya…</option>
              </select>
            </label>
            {areaChoice === OTHER && (
              <label><span className={label}>Nama area</span><input value={areaOther} onChange={(e) => setAreaOther(e.target.value)} required className={input} /></label>
            )}
            <label className="sm:col-span-2"><span className={label}>Tujuan Keluar/Masuk</span><textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} required rows={2} maxLength={2000} className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15" /></label>
            <label className="sm:col-span-2"><span className={label}>ID Card No. (opsional — bisa diisi Lobby saat kartu diberikan)</span><input value={idCardNo} onChange={(e) => setIdCardNo(e.target.value)} className={input} /></label>

            {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive sm:col-span-2">{error}</p>}

            <div className="flex gap-3 sm:col-span-2">
              <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-secondary">Batal</button>
              <button type="submit" disabled={submitting} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#c7161e] py-2.5 text-sm font-semibold text-white hover:bg-[#a51219] disabled:opacity-60">
                {submitting && <Loader2 className="size-4 animate-spin" />} Kirim Pengajuan
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
