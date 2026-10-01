// components/policy/PolicyAcknowledgement.tsx
//
// "Saya sudah membaca & memahami" card under the ISMS Basic Policy. Employees
// have no portal account, so they confirm with NIK + name + department; the
// NIK and name are remembered on this browser so the card can show "sudah
// dikonfirmasi" next time. A new policy version asks everyone again.
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Loader2, ShieldCheck, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

type Department = { id: number; name: string; sections: { id: number; name: string }[] }
type State = { version: string; label: string; ack: { acknowledged_at: string } | null }

const STORAGE_KEY = 'isms-policy-ack'
const inputClass = 'h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'

function remembered(): { nik: string; fullName: string } | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')
    return value && typeof value.nik === 'string' ? value : null
  } catch {
    return null
  }
}

function remember(nik: string, fullName: string) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ nik, fullName })) } catch { /* private mode */ }
}

export function PolicyAcknowledgement() {
  const [state, setState] = useState<State | null>(null)
  const [who, setWho] = useState<{ nik: string; fullName: string } | null>(null)
  const [open, setOpen] = useState(false)

  const check = (nik?: string) =>
    fetch(`${API_BASE_PATH}/api/policy-acknowledgements${nik ? `?nik=${encodeURIComponent(nik)}` : ''}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: State | null) => d && setState(d))
      .catch(() => {})

  useEffect(() => {
    const saved = remembered()
    setWho(saved)
    void check(saved?.nik)
  }, [])

  if (!state || state.version === 'v0') return null

  const done = !!state.ack
  return (
    <section className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 sm:p-6 ${done ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-[color:var(--p-600)]/30 bg-card'}`}>
      <div className="flex min-w-0 items-start gap-3">
        <span className={`grid size-11 flex-none place-items-center rounded-xl ${done ? 'bg-emerald-600 text-white' : 'bg-primary text-primary-foreground'}`}>
          {done ? <CheckCircle2 className="size-5" /> : <ShieldCheck className="size-5" />}
        </span>
        <div className="min-w-0">
          {done ? (
            <>
              <p className="font-display text-lg font-semibold text-foreground">Terima kasih{who?.fullName ? `, ${who.fullName}` : ''} — Anda sudah mengonfirmasi kebijakan ini.</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Dikonfirmasi {new Date(state.ack!.acknowledged_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })} · {state.label}
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-lg font-semibold text-foreground">Sudah membaca Kebijakan Dasar ISMS?</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Setiap karyawan wajib membaca dan memahami kebijakan ini. Konfirmasi dengan NIK Anda — cukup sekali per versi kebijakan ({state.label}).</p>
            </>
          )}
        </div>
      </div>
      {done ? (
        <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline">Bukan Anda? Konfirmasi dengan NIK lain</button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90">
          <CheckCircle2 className="size-4" /> Saya sudah membaca &amp; memahami
        </button>
      )}

      {open && (
        <AckDialog
          version={state.label}
          initial={done ? null : who}
          onClose={() => setOpen(false)}
          onDone={(nik, fullName) => {
            remember(nik, fullName)
            setWho({ nik, fullName })
            setOpen(false)
            void check(nik)
          }}
        />
      )}
    </section>
  )
}

function AckDialog({ version, initial, onClose, onDone }: { version: string; initial: { nik: string; fullName: string } | null; onClose: () => void; onDone: (nik: string, fullName: string) => void }) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [nik, setNik] = useState(initial?.nik ?? '')
  const [fullName, setFullName] = useState(initial?.fullName ?? '')
  const [department, setDepartment] = useState('')
  const [section, setSection] = useState('')
  const [agree, setAgree] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { departments: [] }))
      .then((d) => setDepartments(d.departments ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const sections = departments.find((d) => d.name === department)?.sections ?? []

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/policy-acknowledgements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nik, fullName, department, section: section || null, agree }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message ?? 'Gagal menyimpan.')
      onDone(nik.trim(), fullName.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  // Portal: the card sits inside scroll-reveal sections whose transform would
  // otherwise trap (and clip) this fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="ack-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="ack-title" className="font-display text-xl font-semibold text-foreground">Pernyataan Kebijakan ISMS</h2>
            <p className="mt-1 text-xs text-muted-foreground">{version}</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 flex-none place-items-center rounded-full hover:bg-secondary" aria-label="Tutup"><X className="size-4" /></button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted-foreground">
            NIK *
            <input value={nik} onChange={(e) => setNik(e.target.value)} required maxLength={50} autoFocus className={`${inputClass} mt-1.5 font-mono`} />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Nama lengkap *
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={150} className={`${inputClass} mt-1.5`} />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Departemen *
            <select value={department} onChange={(e) => { setDepartment(e.target.value); setSection('') }} required className={`${inputClass} mt-1.5`}>
              <option value="" disabled>Pilih departemen…</option>
              {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Section
            <select value={section} onChange={(e) => setSection(e.target.value)} disabled={!sections.length} className={`${inputClass} mt-1.5 disabled:opacity-50`}>
              <option value="">{sections.length ? 'Pilih section…' : '—'}</option>
              {sections.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </label>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-secondary/60 p-4 text-sm leading-6 text-foreground">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 size-4 flex-none accent-[color:var(--primary)]" />
          <span>Saya menyatakan telah <strong>membaca dan memahami</strong> Kebijakan Dasar Sistem Manajemen Keamanan Informasi (ISMS) dan bersedia mematuhinya dalam pekerjaan sehari-hari.</span>
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary">Batal</button>
          <button type="submit" disabled={!agree || saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {saving && <Loader2 className="size-4 animate-spin" />} Konfirmasi
          </button>
        </div>
      </form>
    </div>,
    document.body
  )
}
