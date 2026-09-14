'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, Camera, CheckCircle2, Clock, History, MapPin, Search, Send, Sparkles, Users } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

type Section = { id: number; name: string; slug: string }
type Department = { id: number; name: string; slug: string; sections: Section[] }
type Pic = { id: number; name: string; department_id: number | null }

type LookupRequest = {
  id: number
  requester_name: string
  location: string
  from_at: string
  to_at: string
  status: 'pending' | 'approved' | 'rejected'
  taken_at: string | null
  submitted_at: string
}

const inputClass = 'h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const labelClass = 'mb-1.5 block text-xs font-semibold text-muted-foreground'
const STATUS_LABEL: Record<LookupRequest['status'], string> = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' }
const STATUS_TONE: Record<LookupRequest['status'], string> = { pending: 'bg-[#fff3d6] text-[#8a6100]', approved: 'bg-[#dff5e6] text-[#1a6e3a]', rejected: 'bg-[#fdecec] text-[#b3413a]' }

// Self-service "have I already submitted?" lookup by NIK — internal only,
// since visitors have no NIK. Kept collapsed by default so it doesn't
// crowd the form for the common case of a first-time submission.
function NikHistoryLookup() {
  const [open, setOpen] = useState(false)
  const [nik, setNik] = useState('')
  const [results, setResults] = useState<LookupRequest[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    if (!nik.trim()) return
    setSearching(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/photo-video-requests/lookup?nik=${encodeURIComponent(nik.trim())}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) { setError(data?.message ?? 'Gagal memuat riwayat.'); return }
      setResults(data.requests ?? [])
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
      >
        <History className="size-3.5" /> {open ? 'Sembunyikan' : 'Cek riwayat pengajuan saya'}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-border bg-secondary/30 p-4">
          <div className="flex gap-2">
            <input value={nik} onChange={(e) => setNik(e.target.value)} placeholder="Masukkan NIK" className={inputClass} />
            <button type="button" onClick={search} disabled={searching || !nik.trim()} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              <Search className="size-4" /> {searching ? 'Mencari...' : 'Cek'}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          {results && results.length === 0 && !error && <p className="mt-3 text-xs text-muted-foreground">Belum ada pengajuan dengan NIK tersebut.</p>}
          {results && results.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {results.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 text-xs">
                  <span className="text-foreground">
                    {new Date(r.from_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} &middot; {r.location}
                    {r.taken_at && <span className="ml-1.5 text-muted-foreground">(sudah diambil)</span>}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function todayDateStr() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function nowTimeStr() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function Field({ label, span = 1, children }: { label: string; span?: 1 | 2; children: React.ReactNode }) {
  return (
    <div className={span === 2 ? 'sm:col-span-2' : undefined}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  )
}

export function PhotoVideoRequestForm({ locale }: { locale: 'internal' | 'visitor' }) {
  const isInternal = locale === 'internal'

  const [nik, setNik] = useState('')
  const [requesterName, setRequesterName] = useState('')
  const [deptId, setDeptId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [dept, setDept] = useState('')
  const [deptPicKamera, setDeptPicKamera] = useState('')
  const [picApproveId, setPicApproveId] = useState('')
  const [fromDate, setFromDate] = useState(todayDateStr)
  const [fromTime, setFromTime] = useState(nowTimeStr)
  const [toDate, setToDate] = useState(todayDateStr)
  const [toTime, setToTime] = useState('')
  const [location, setLocation] = useState('')
  const [objective, setObjective] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [pics, setPics] = useState<Pic[]>([])
  const [error, setError] = useState<string | null>(null)
  const [successAt, setSuccessAt] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isInternal) return
    fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { departments: [] }))
      .then((data: { departments: Department[] }) => setDepartments(data.departments ?? []))
      .catch(() => setDepartments([]))
  }, [isInternal])

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/pic-approvers`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { pics: [] }))
      .then((data: { pics: Pic[] }) => setPics(data.pics ?? []))
      .catch(() => setPics([]))
  }, [])

  const selectedDept = departments.find((d) => String(d.id) === deptId)

  // A PIC with no department applies everywhere (e.g. a general/HQ approver).
  // For visitors there's no department selection to filter against, so the
  // full roster is shown instead.
  const availablePics = isInternal
    ? pics.filter((pic) => pic.department_id === null || String(pic.department_id) === deptId)
    : pics

  const resetForm = () => {
    setNik(''); setRequesterName(''); setDeptId(''); setSectionId(''); setCompanyName(''); setDept(''); setDeptPicKamera(''); setPicApproveId('')
    setFromDate(todayDateStr()); setFromTime(nowTimeStr()); setToDate(todayDateStr()); setToTime(''); setLocation(''); setObjective('')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccessAt(null)
    setSubmitting(true)
    try {
      const section = selectedDept?.sections.find((s) => String(s.id) === sectionId)
      const deptOrCompany = isInternal
        ? `${selectedDept?.name ?? ''}${section ? ` - ${section.name}` : ''}`
        : companyName
      const payload = {
        requestType: locale,
        requesterName,
        deptOrCompany,
        picApproveId,
        fromAt: fromDate && fromTime ? new Date(`${fromDate}T${fromTime}`).toISOString() : '',
        toAt: toDate && toTime ? new Date(`${toDate}T${toTime}`).toISOString() : '',
        location,
        objective,
        ...(isInternal ? { nik, deptPicKamera } : { dept }),
      }
      const response = await fetch(`${API_BASE_PATH}/api/photo-video-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) { setError(data?.message ?? 'Gagal mengirim pengajuan.'); return }
      setSuccessAt(data?.request?.submitted_at ?? new Date().toISOString())
      resetForm()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSubmitting(false)
    }
  }

  const heading = isInternal ? 'Pengajuan Ijin Pengambilan Foto/Video' : 'Registration for Recording Photo/Video'
  const subheading = isInternal ? 'Berlaku untuk seluruh Dept./Section' : 'For visitor / non-employee'
  const submitLabel = isInternal ? 'Kirim Pengajuan' : 'Submit Registration'
  const noteText = isInternal ? 'Lengkapi seluruh kolom di bawah sebelum mengirim.' : 'Please complete every field before submitting.'

  return (
    <div className="mx-auto w-full max-w-2xl">
      <section
        className="relative overflow-hidden rounded-[1.75rem] border border-border p-6 text-primary-foreground shadow-xl sm:p-8"
        style={{ background: 'linear-gradient(135deg, #1a3a52 0%, #1a5f7a 45%, #278e84 100%)' }}
      >
        <div className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
        <div className="pointer-events-none absolute -bottom-10 left-1/4 h-32 w-32 rounded-full opacity-[0.08]" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />

        <div className="relative z-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
            {isInternal ? <Users className="size-3.5" /> : <Sparkles className="size-3.5" />}
            {isInternal ? 'Internal / All Dept.' : 'Visitor'}
          </div>
          <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{heading}</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-primary-foreground/72">{subheading}</p>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="mt-6 rounded-[1.75rem] border border-border bg-card p-6 shadow-md sm:p-8">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary"><Users className="size-4" /></span>
          <p className="portal-eyebrow">{isInternal ? 'Data Pemohon' : 'Requester Details'}</p>
        </div>
        {isInternal && <NikHistoryLookup />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isInternal && (
            <Field label="NIK">
              <input value={nik} onChange={(e) => setNik(e.target.value)} placeholder="Nomor Induk Karyawan" className={inputClass} />
            </Field>
          )}
          <Field label={isInternal ? 'Nama' : 'Full Name'} span={isInternal ? 1 : 2}>
            <input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} required className={inputClass} />
          </Field>
          {isInternal ? (
            <>
              <Field label="Dept.">
                <select value={deptId} onChange={(e) => { setDeptId(e.target.value); setSectionId(''); setPicApproveId('') }} required className={inputClass}>
                  <option value="">Pilih departemen...</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Seksi">
                <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!selectedDept || selectedDept.sections.length === 0} className={inputClass}>
                  <option value="">{selectedDept && selectedDept.sections.length === 0 ? 'Tidak ada section' : 'Pilih section (opsional)...'}</option>
                  {selectedDept?.sections.map((section) => (
                    <option key={section.id} value={section.id}>{section.name}</option>
                  ))}
                </select>
              </Field>
            </>
          ) : (
            <Field label="Company / Organization">
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className={inputClass} />
            </Field>
          )}
          {!isInternal && (
            <Field label="Department">
              <input value={dept} onChange={(e) => setDept(e.target.value)} required className={inputClass} />
            </Field>
          )}
        </div>

        <div className="my-7 h-px bg-border" />

        <div className="mb-6 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-accent/20 text-accent-foreground"><Camera className="size-4" /></span>
          <p className="portal-eyebrow">{isInternal ? 'Informasi Pengambilan Foto/Video' : 'Recording Photo/Video Information'}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isInternal && (
            <Field label="Dept. PIC Kamera" span={2}>
              <select value={deptPicKamera} onChange={(e) => setDeptPicKamera(e.target.value)} required className={inputClass}>
                <option value="">Pilih Dept./Seksi kamera yang dipinjam...</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.name}>{department.name}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="PIC Approve" span={2}>
            <select value={picApproveId} onChange={(e) => setPicApproveId(e.target.value)} required className={inputClass} disabled={isInternal && !deptId}>
              <option value="">{isInternal && !deptId ? 'Pilih Dept. terlebih dahulu...' : 'Pilih PIC yang akan menyetujui...'}</option>
              {availablePics.map((pic) => (
                <option key={pic.id} value={pic.id}>{pic.name}</option>
              ))}
            </select>
          </Field>
          <Field label={isInternal ? 'Dari Tanggal' : 'From Date'}>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required className={`${inputClass} pl-10`} />
            </div>
          </Field>
          <Field label={isInternal ? 'Sampai Tanggal' : 'To Date'}>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required className={`${inputClass} pl-10`} />
            </div>
          </Field>
          <Field label={isInternal ? 'Dari Jam' : 'From Time'}>
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} required className={`${inputClass} pl-10`} />
            </div>
          </Field>
          <Field label={isInternal ? 'Sampai Jam' : 'To Time'}>
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} required className={`${inputClass} pl-10`} />
            </div>
          </Field>
          <Field label={isInternal ? 'Lokasi' : 'Location'}>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={location} onChange={(e) => setLocation(e.target.value)} required className={`${inputClass} pl-10`} />
            </div>
          </Field>
          <Field label={isInternal ? 'Tujuan' : 'Objective'}>
            <input value={objective} onChange={(e) => setObjective(e.target.value)} required className={inputClass} />
          </Field>
        </div>

        <div className="mt-7 flex flex-col gap-4 rounded-2xl bg-secondary/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{noteText}</p>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, oklch(0.7 0.15 55) 0%, oklch(0.75 0.18 50) 100%)', color: '#1a2f1a' }}
          >
            {submitting ? 'Mengirim...' : <><Send className="size-4" />{submitLabel}</>}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
        )}
        {successAt && (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-accent-foreground">
            <CheckCircle2 className="size-4 flex-none" />
            {isInternal ? 'Pengajuan terkirim' : 'Registration submitted'} &middot; {new Date(successAt).toLocaleString('id-ID')}
          </p>
        )}
      </form>
    </div>
  )
}
