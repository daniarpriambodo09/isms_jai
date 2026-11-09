'use client'

// Form "Pengajuan Ijin Masuk Area Special Security" (ISMS-F-006-001) —
// same fields as the paper form. Used from the Lobby kiosk and the ISMS
// admin page; submitting emails the IAA for approval.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, Clock, Loader2, ScanLine, ShieldAlert, UserPlus, Trash2, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { SPECIAL_AREAS } from '@/lib/special-area-shared'
import { cardsChanged } from '@/components/kiosk/kiosk-shared'
import { ESCORT_OTHER, EscortOptions, escortFromChoice, useEscortList } from '@/components/escort-picker'

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
  const [customDept, setCustomDept] = useState(false)
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([])

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { departments: [] }))
      .then((data: { departments: Array<{ id: number; name: string }> }) => {
        if (Array.isArray(data.departments)) {
          setDepartments(data.departments)
        }
      })
      .catch(() => setDepartments([]))
  }, [])

  // Masuk (dari): "right now" by default — stamped by the server
  // at the moment of submitting — or typed in by hand (manual mode).
  const [now] = useState(() => new Date())
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
  // The areas on offer are set by the ISM Admin (Izin Area Special → Daftar
  // Area Special); the built-in list stands in until they load.
  const [areas, setAreas] = useState<string[]>([...SPECIAL_AREAS])
  const [areaChoice, setAreaChoice] = useState<string>(SPECIAL_AREAS[0])
  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_PATH}/api/special-area-requests/areas`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { areas?: string[] } | null) => {
        if (cancelled || !data?.areas?.length) return
        setAreas(data.areas)
        // Keep the choice if it is still on the list, otherwise start at the top.
        setAreaChoice((current) => (current === OTHER || data.areas!.includes(current) ? current : data.areas![0]))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  const [areaOther, setAreaOther] = useState('')
  const [purpose, setPurpose] = useState('')
  const [idCardNo, setIdCardNo] = useState('')
  const [companions, setCompanions] = useState<Array<{ name: string; idCardNo: string }>>([])
  // PIC Pendamping JAI: who from JAI goes along — the approver reads it in the e-mail ("PIC JAI").
  const escorts = useEscortList()
  const [escortChoice, setEscortChoice] = useState('')
  const [escortName, setEscortName] = useState('')
  const [escortDept, setEscortDept] = useState('')
  // "Scan": the field is cleared and focused, waiting for the scanner to type the card number.
  const idCardRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState(false)
  const startScan = () => {
    setIdCardNo('')
    setScanned(false)
    setScanning(true)
    idCardRef.current?.focus()
  }
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
    const escort = escortFromChoice(escortChoice, escorts, { name: escortName, dept: escortDept })
    if (escortChoice === ESCORT_OTHER && !escort) { setError('Tulis nama PIC pendamping JAI, atau kosongkan pilihannya.'); return }
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
          purpose,
          idCardNo: idCardNo.trim() || null,
          companions: companions
            .filter((c) => c.name.trim())
            .map((c) => ({
              name: c.name.trim(),
              idCardNo: c.idCardNo.trim() || null,
            })),
          escortName: escort?.name ?? null, escortDept: escort?.dept ?? null,
        }),
      })
      let data: any = null
      let rawText = ''
      try {
        rawText = await res.text()
        data = JSON.parse(rawText)
      } catch {
        data = null
      }
      if (!res.ok) {
        const serverDetail = data?.error || (rawText && !rawText.trim().startsWith('<') ? rawText.trim().slice(0, 150) : null) || `Status ${res.status} ${res.statusText}`
        const errMsg = data?.message && data?.error
          ? `${data.message} (${data.error})`
          : (data?.message ?? `Gagal mengirim pengajuan (${serverDetail})`)
        setError(errMsg)
        return
      }
      setDone({ emailError: data.emailError ?? null })
      onSaved()
      cardsChanged()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pengajuan Ijin Masuk Area Special Security"
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="h-1 shrink-0 bg-primary" />
        <div className="flex items-start justify-between gap-4 border-b border-border bg-card px-6 py-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-md border border-primary/25">
                <ShieldAlert className="size-3.5" /> ISMS-F-006-001
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                Zona Khusus
              </span>
            </div>
            <h2 className="mt-1 text-lg font-bold text-foreground">Pengajuan Ijin Masuk Area Special Security</h2>
            <p className="text-xs text-muted-foreground">特別セキュリティ区画入退許可申請書 &bull; Persetujuan via email (e-sign)</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid size-8 flex-none place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center overflow-y-auto flex-1">
            <CheckCircle2 className="size-12 text-emerald-600" />
            <p className="text-base font-semibold text-foreground">Pengajuan terkirim</p>
            {done.emailError
              ? <p className="max-w-md rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-900">Tersimpan, tetapi email persetujuan belum terkirim: {done.emailError}</p>
              : <p className="max-w-md text-sm text-muted-foreground">Email persetujuan sudah dikirim ke approver. Status bisa dipantau di daftar pengajuan.</p>}
            <button type="button" onClick={onClose} className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition cursor-pointer">Selesai</button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
            {/* Scrollable Form Body */}
            <div className="overflow-y-auto flex-1 p-6 grid gap-4 sm:grid-cols-2">
              <label>
                <span className={label}>Nama Lengkap (Pemohon Utama)</span>
                <input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} autoComplete="name" required autoFocus className={input} />
              </label>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="sa-id-card" className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <ScanLine className="size-3.5 text-primary" />
                    <span>ID Card No. / Barcode Kartu</span>
                  </label>
                  <span className="text-[10px] font-medium text-muted-foreground">Opsional</span>
                </div>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <ScanLine className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${scanning ? 'text-emerald-600 animate-pulse' : 'text-muted-foreground'}`} />
                    <input
                      id="sa-id-card"
                      ref={idCardRef}
                      value={idCardNo}
                      onChange={(e) => { setIdCardNo(e.target.value); setScanned(false) }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); if (idCardNo.trim()) setScanned(true); setScanning(false) }
                        if (e.key === 'Escape' && scanning) { e.stopPropagation(); setScanning(false) }
                      }}
                      onBlur={() => setScanning(false)}
                      placeholder={scanning ? 'Arahkan scanner…' : 'Scan barcode / ketik nomor'}
                      maxLength={100}
                      autoComplete="off"
                      className={`${input} pl-9 font-mono ${scanning ? 'border-emerald-500 ring-4 ring-emerald-500/20 bg-emerald-500/5' : ''}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={startScan}
                    aria-pressed={scanning}
                    className={`inline-flex h-10 flex-none items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition cursor-pointer shadow-xs ${scanning ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-border bg-card text-foreground hover:bg-secondary'}`}
                  >
                    <ScanLine className={`size-3.5 ${scanning ? 'animate-pulse' : ''}`} />
                    <span>{scanning ? 'Menunggu…' : idCardNo ? 'Scan Ulang' : 'Scan Barcode'}</span>
                  </button>
                </div>
                {scanned && idCardNo && (
                  <p className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Kartu terbaca: {idCardNo}
                  </p>
                )}
              </div>

              {/* Multiple Visitors / Companions */}
              <div className="sm:col-span-2 pt-2 pb-1 border-t border-b border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-semibold text-foreground">Pengunjung / Anggota Tambahan (opsional)</span>
                    <p className="text-[11px] text-muted-foreground">
                      Tambah nama &amp; barcode kartu ID jika ada anggota tim / vendor lain yang ikut masuk
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCompanions([...companions, { name: '', idCardNo: '' }])}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary cursor-pointer shadow-2xs"
                  >
                    <UserPlus className="size-3.5 text-primary" />
                    Tambah Orang
                  </button>
                </div>

                {companions.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-border bg-secondary/20 p-2.5">
                    {companions.map((comp, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <div className="flex-1 w-full sm:w-auto">
                          <input
                            value={comp.name}
                            onChange={(e) => {
                              const next = [...companions]
                              next[idx] = { ...next[idx], name: e.target.value }
                              setCompanions(next)
                            }}
                            placeholder={`Nama Orang #${idx + 2}`}
                            className={input}
                            required
                          />
                        </div>
                        <div className="relative w-full sm:w-60">
                          <ScanLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={comp.idCardNo}
                            onChange={(e) => {
                              const next = [...companions]
                              next[idx] = { ...next[idx], idCardNo: e.target.value }
                              setCompanions(next)
                            }}
                            placeholder="Scan / Barcode Kartu ID"
                            className={`${input} pl-9 font-mono`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setCompanions(companions.filter((_, j) => j !== idx))}
                          aria-label={`Hapus orang #${idx + 2}`}
                          className="grid size-10 flex-shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label>
                <span className={label}>Nama Organisasi / Perusahaan</span>
                <input value={orgCompany} onChange={(e) => setOrgCompany(e.target.value)} autoComplete="organization" required className={input} />
              </label>
              <div>
                <span className={label}>Departemen</span>
                {customDept ? (
                  <div className="flex gap-2">
                    <input
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Nama departemen / bagian"
                      className={input}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCustomDept(false)
                        setDepartment('')
                      }}
                      className="flex-none rounded-xl border border-input px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary cursor-pointer"
                    >
                      Pilih List
                    </button>
                  </div>
                ) : (
                  <select
                    value={department}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setCustomDept(true)
                        setDepartment('')
                      } else {
                        setDepartment(e.target.value)
                      }
                    }}
                    className={input}
                  >
                    <option value="">-- Pilih Departemen (Opsional) --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                    <option value="__custom__">-- Ketik Departemen Lain / Manual --</option>
                  </select>
                )}
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Masuk (dari){fromManual ? ' — manual' : ' — otomatis saat ini'}</span>
                  <button type="button" onClick={() => (fromManual ? setFromManual(false) : startManual())} className="text-[11px] font-semibold text-primary hover:underline cursor-pointer">
                    {fromManual ? 'Pakai waktu sekarang' : 'Isi manual'}
                  </button>
                </div>
                {fromManual ? (
                  <div className="grid grid-cols-[1fr_96px] gap-2">
                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required aria-label="Tanggal masuk" className={input} />
                    <input value={fromTime} onChange={(e) => setFromTime(e.target.value)} onBlur={() => { const t = normalizeTime(fromTime); if (t) setFromTime(t) }} required inputMode="numeric" placeholder="09:30" maxLength={5} aria-label="Jam masuk" className={`${input} text-center font-mono`} />
                  </div>
                ) : (
                  <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 text-sm font-medium text-foreground">
                    <Clock className="size-4 text-primary" />
                    <span className="tabular-nums">{now.toLocaleString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary">Saat Ini</span>
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
                    <button key={h} type="button" onClick={() => setToOffset(h)} className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer">+{h} jam</button>
                  ))}
                </span>
              </div>
              <label className={areaChoice === OTHER ? '' : 'sm:col-span-2'}>
                <span className={label}>Area Special Security</span>
                <select value={areaChoice} onChange={(e) => setAreaChoice(e.target.value)} className={input}>
                  {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                  <option value={OTHER}>Lainnya…</option>
                </select>
              </label>
              {areaChoice === OTHER && (
                <label><span className={label}>Nama area</span><input value={areaOther} onChange={(e) => setAreaOther(e.target.value)} required className={input} /></label>
              )}
              <label className="sm:col-span-2">
                <span className={label}>Tujuan Keluar/Masuk</span>
                <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} required rows={2} maxLength={2000} className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15" />
              </label>
              <label className="sm:col-span-2">
                <span className={label}>PIC Pendamping JAI (opsional)</span>
                <select value={escortChoice} onChange={(e) => setEscortChoice(e.target.value)} aria-label="PIC Pendamping JAI" className={input}>
                  <option value="">Belum ditentukan — bisa dipilih nanti di daftar</option>
                  <EscortOptions escorts={escorts} />
                  <option value={ESCORT_OTHER}>Lainnya (ketik nama)…</option>
                </select>
                {escortChoice === ESCORT_OTHER && (
                  <span className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input value={escortName} onChange={(e) => setEscortName(e.target.value)} placeholder="Nama PIC pendamping JAI" maxLength={150} aria-label="Nama PIC pendamping JAI" className={input} />
                    <input value={escortDept} onChange={(e) => setEscortDept(e.target.value)} placeholder="Dept./Seksi (opsional)" maxLength={150} aria-label="Dept. PIC pendamping JAI" className={input} />
                  </span>
                )}
                <span className="mt-1 block text-[11px] text-muted-foreground">Karyawan JAI yang mendampingi tamu di area. Tercantum di email ke approver sebagai “PIC JAI”.</span>
              </label>

              {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive sm:col-span-2">{error}</p>}
            </div>

            {/* Sticky Action Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 px-6 py-3.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border bg-card px-5 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:opacity-90 active:scale-95 text-primary-foreground px-5 py-2 text-xs font-bold shadow-xs transition disabled:opacity-60 cursor-pointer"
              >
                {submitting && <Loader2 className="size-3.5 animate-spin" />}
                <span>Kirim Pengajuan</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
