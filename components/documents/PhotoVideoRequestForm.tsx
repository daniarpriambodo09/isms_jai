'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Camera, CheckCircle2, Clock, MapPin, Send, Sparkles, Users } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

type Department = { id: number; name: string; slug: string }

const inputClass = 'h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const labelClass = 'mb-1.5 block text-xs font-semibold text-muted-foreground'

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
  const [deptOrCompany, setDeptOrCompany] = useState('')
  const [dept, setDept] = useState('')
  const [deptPicKamera, setDeptPicKamera] = useState('')
  const [fromAt, setFromAt] = useState('')
  const [toAt, setToAt] = useState('')
  const [location, setLocation] = useState('')
  const [objective, setObjective] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
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

  const resetForm = () => {
    setNik(''); setRequesterName(''); setDeptOrCompany(''); setDept(''); setDeptPicKamera('')
    setFromAt(''); setToAt(''); setLocation(''); setObjective('')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccessAt(null)
    setSubmitting(true)
    try {
      const payload = {
        requestType: locale,
        requesterName,
        deptOrCompany,
        fromAt: fromAt ? new Date(fromAt).toISOString() : '',
        toAt: toAt ? new Date(toAt).toISOString() : '',
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isInternal && (
            <Field label="NIK">
              <input value={nik} onChange={(e) => setNik(e.target.value)} placeholder="Nomor Induk Karyawan" className={inputClass} />
            </Field>
          )}
          <Field label={isInternal ? 'Nama' : 'Full Name'} span={isInternal ? 1 : 2}>
            <input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} required className={inputClass} />
          </Field>
          <Field label={isInternal ? 'Dept. / Seksi' : 'Company / Organization'}>
            <input value={deptOrCompany} onChange={(e) => setDeptOrCompany(e.target.value)} required className={inputClass} />
          </Field>
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
          <Field label={isInternal ? 'Dari Tgl/Jam' : 'From Date/Time'}>
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="datetime-local" value={fromAt} onChange={(e) => setFromAt(e.target.value)} required className={`${inputClass} pl-10`} />
            </div>
          </Field>
          <Field label={isInternal ? 'Sampai Tgl/Jam' : 'To Date/Time'}>
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="datetime-local" value={toAt} onChange={(e) => setToAt(e.target.value)} required className={`${inputClass} pl-10`} />
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
