// components/page-hero.tsx
//
// One distinct hero per portal menu, so every section has its own visual
// identity instead of the same teal banner everywhere. All colors come from
// the theme tokens (see lib/theme.ts), so each hero follows the palette an
// admin picks in /kelola-tema. Motif CSS (blueprint grid, hazard tape, ruled
// paper, film sprockets, …) lives in app/globals.css under "page hero motifs".

'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, BatteryFull, Camera, Check, Folder, GraduationCap, HardHat, Languages, Layers } from 'lucide-react'

type WithAction = { action?: ReactNode }

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function latestUpload(items: { uploaded_at: string }[]) {
  return items.reduce<string | null>((max, item) => (!max || item.uploaded_at > max ? item.uploaded_at : max), null)
}

// Client-only clock — starts null so server and first client render match.
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

// Terminal-style line under the manifesto eyebrow (motionsites "Sentinel"):
// types each phrase, holds, erases, moves on. Reduced motion shows the first
// phrase statically.
const TYPED_PHRASES = ['lindungi_informasi', 'kendalikan_akses', 'klasifikasikan_dokumen', 'patuhi_kebijakan']

function TypedLine() {
  const [text, setText] = useState('')
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setText(TYPED_PHRASES[0]); return }
    let phrase = 0
    let length = 0
    let deleting = false
    let timer = 0
    const step = () => {
      const target = TYPED_PHRASES[phrase]
      length += deleting ? -1 : 1
      setText(target.slice(0, length))
      let delay = deleting ? 35 : 70
      if (!deleting && length === target.length) { deleting = true; delay = 1800 }
      else if (deleting && length === 0) { deleting = false; phrase = (phrase + 1) % TYPED_PHRASES.length; delay = 350 }
      timer = window.setTimeout(step, delay)
    }
    timer = window.setTimeout(step, 600)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <p className="mt-3 font-mono text-[12.5px] text-muted-foreground" aria-hidden>
      <span className="text-[color:var(--p-600)]">isms@jai:~$</span> {text}
      <span className="typed-caret ml-0.5 inline-block h-[1.05em] w-[0.55em] translate-y-[0.15em] bg-[color:var(--p-600)]" />
    </p>
  )
}

// ─── Kebijakan Dasar ISMS — manifesto ───
export function ManifestoHero({ action }: WithAction) {
  return (
    <section className="relative isolate overflow-hidden pb-2 pt-4 text-center">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-6 -z-10 size-[460px] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
      <p className="portal-eyebrow">Information Security Policy</p>
      <TypedLine />
      <h2 className="mx-auto mt-5 max-w-4xl text-balance font-display text-[clamp(2.5rem,6.2vw,5.4rem)] font-semibold leading-[0.95] text-foreground">
        Satu kebijakan, <span className="font-serif-accent text-[color:var(--p-600)]">dijaga</span> bersama.
      </h2>
      <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
        Visual kebijakan keamanan informasi PT. Jatim Autocomp Indonesia — ditetapkan oleh Information Security Committee dan berlaku untuk seluruh karyawan.
      </p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </section>
  )
}

// ─── Prosedur ISMS — catalogue index ───
export function IndexHero({ eyebrow, title, description, count, countLabel, updatedAt, action }: WithAction & {
  eyebrow: string; title: string; description: string; count: number; countLabel: string; updatedAt: string | null
}) {
  return (
    <section className="grid grid-cols-1 items-end gap-8 border-y-2 border-foreground py-8 md:grid-cols-[auto_1fr]">
      <div className="flex items-end gap-4 md:border-r md:border-border md:pr-10">
        <span className="font-display text-[clamp(5rem,12vw,9.5rem)] font-bold leading-[0.78] tabular-nums text-primary">{String(count).padStart(2, '0')}</span>
        <span className="mb-1 max-w-[7.5rem] font-mono-label text-[10px] leading-4 text-muted-foreground">{countLabel}</span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <p className="portal-eyebrow">{eyebrow}</p>
          <h2 className="mt-3 font-display text-[clamp(1.9rem,3.6vw,3rem)] font-semibold leading-none text-foreground">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
          <p className="mt-4 font-mono-label text-[10px] text-muted-foreground">
            Pembaruan terakhir <span className="mx-1 text-border">/</span> <span className="text-foreground">{formatDate(updatedAt)}</span>
          </p>
        </div>
        {action}
      </div>
    </section>
  )
}

// ─── Standard Requirement TMMIN — blueprint spec sheet ───
export function BlueprintHero({ count, updatedAt, action }: WithAction & { count: number; updatedAt: string | null }) {
  const bracket = 'absolute size-5 border-[color:var(--p-400)]'
  const specs: [string, ReactNode][] = [
    ['Dokumen', count],
    ['Diperbarui', formatDate(updatedAt)],
    ['Sumber', 'PT. TMMIN'],
    ['Status', <span key="s" className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[color:var(--p-400)]" />Berlaku</span>],
  ]
  return (
    <section className="hero-blueprint relative overflow-hidden rounded-2xl p-8 text-primary-foreground sm:p-10">
      <span className={`${bracket} left-4 top-4 border-l-2 border-t-2`} />
      <span className={`${bracket} right-4 top-4 border-r-2 border-t-2`} />
      <span className={`${bracket} bottom-4 left-4 border-b-2 border-l-2`} />
      <span className={`${bracket} bottom-4 right-4 border-b-2 border-r-2`} />
      <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="font-mono-label text-[10.5px] text-[color:var(--p-400)]">Spec sheet — customer requirement</p>
          <h2 className="mt-4 font-display text-[clamp(2.2rem,4.5vw,3.8rem)] font-semibold leading-[0.95]">
            Standard Requirement <span className="text-[color:var(--p-400)]">TMMIN</span>
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-6 text-primary-foreground/70">
            Persyaratan standar dari pelanggan yang wajib dipenuhi dan menjadi acuan penerapan ISMS di seluruh proses.
          </p>
          {action && <div className="mt-6">{action}</div>}
        </div>
        <dl className="self-end font-mono text-[11px]" style={{ border: '1px solid color-mix(in oklch, var(--p-400) 45%, transparent)' }}>
          {specs.map(([label, value], i) => (
            <div key={label} className="grid grid-cols-[8.5rem_1fr]" style={i ? { borderTop: '1px solid color-mix(in oklch, var(--p-400) 30%, transparent)' } : undefined}>
              <dt className="px-3 py-2.5 uppercase tracking-[0.08em] text-primary-foreground/50" style={{ borderRight: '1px solid color-mix(in oklch, var(--p-400) 30%, transparent)' }}>{label}</dt>
              <dd className="px-3 py-2.5 text-primary-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p aria-hidden className="absolute bottom-5 right-12 hidden font-mono text-[9px] tracking-[0.1em] text-primary-foreground/30 sm:block">SCALE 1:1 · DWG ISMS-TMMIN</p>
    </section>
  )
}

// ─── Working Standard — shop-floor hazard tape ───
export function HazardHero({ count, action }: WithAction & { count: number }) {
  const steps = ['Baca', 'Pahami', 'Terapkan']
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <div className="hero-hazard h-3" />
      <div className="relative px-7 py-8 sm:px-10">
        <span aria-hidden className="text-outline pointer-events-none absolute -bottom-12 right-[20%] select-none max-[900px]:right-2 font-display text-[clamp(8rem,19vw,15rem)] font-bold leading-none">WS</span>
        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-md bg-[color:var(--p-900)] px-2.5 py-1 font-mono-label text-[10px] text-accent">
              <HardHat className="size-3.5" /> Shop floor standard
            </span>
            <h2 className="mt-4 font-display text-[clamp(2.2rem,4.5vw,3.6rem)] font-semibold leading-[0.95] text-foreground">Working Standard</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Standar kerja yang dipakai di lapangan — pastikan selalu memakai revisi terbaru sebelum memulai pekerjaan.</p>
            <ol className="mt-6 flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground">
              {steps.map((step, i) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-accent font-mono text-[10px] text-accent-foreground">{i + 1}</span>
                  {step}
                  {i < steps.length - 1 && <ArrowRight className="size-3.5 text-muted-foreground" />}
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col items-start gap-4 sm:items-end">
            <div className="sm:text-right">
              <p className="font-display text-6xl font-bold leading-none tabular-nums text-foreground">{count}</p>
              <p className="mt-1 font-mono-label text-[10px] text-muted-foreground">standar aktif</p>
            </div>
            {action}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Education & Training — learning bento ───
export function BentoHero({ count, categories, languages, action }: WithAction & {
  count: number; categories: { name: string; count: number }[]; languages: string[]
}) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:grid-rows-[auto_auto]">
      <div className="relative col-span-2 overflow-hidden rounded-3xl bg-accent p-6 text-accent-foreground sm:p-9 md:row-span-2">
        <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-16 size-64 rounded-full bg-white/20" />
        <p className="font-mono-label text-[10px] font-semibold opacity-75">Education &amp; Training</p>
        <h2 className="relative mt-4 font-display text-[clamp(2.3rem,4.6vw,3.9rem)] font-semibold leading-[0.95]">
          Belajar aman, kerja <span className="font-serif-accent">tenang.</span>
        </h2>
        <p className="relative mt-4 max-w-md text-sm leading-6 opacity-80">Materi edukasi keamanan informasi untuk seluruh karyawan — video, slide, dan dokumen dalam beberapa bahasa.</p>
        {action && <div className="relative mt-7">{action}</div>}
      </div>
      <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground sm:p-6">
        <GraduationCap className="hero-float size-8 text-accent sm:size-10" style={{ ['--r' as string]: '-8deg' }} />
        <div className="mt-4 sm:mt-6">
          <p className="font-display text-4xl font-bold leading-none tabular-nums sm:text-5xl">{count}</p>
          <p className="mt-1 font-mono-label text-[10px] text-primary-foreground/60">materi tersedia</p>
        </div>
      </div>
      <div className="flex flex-col justify-between rounded-3xl border border-border bg-card p-5 sm:p-6">
        <Languages className="size-7 text-[color:var(--p-600)]" />
        <div className="mt-4 sm:mt-6">
          <p className="font-display text-4xl font-bold leading-none tabular-nums text-foreground sm:text-5xl">{(languages.length || 3)}</p>
          <p className="mt-1 font-mono-label text-[10px] text-muted-foreground">bahasa</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(languages.length ? languages : ['IDN', 'ENG', 'JPN']).map((lang) => (
              <span key={lang} className="rounded-full border border-border px-2.5 py-1 font-mono text-[11px] font-semibold text-foreground">{lang}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="col-span-2 flex flex-col justify-between gap-4 rounded-3xl bg-secondary p-5 text-secondary-foreground sm:p-6">
        <div className="flex items-center gap-2 font-mono-label text-[10px] font-semibold"><Layers className="size-4" /> Format materi</div>
        <div className="flex flex-wrap gap-2">
          {categories.length === 0 && <span className="text-sm opacity-70">Belum ada materi.</span>}
          {categories.map((cat, i) => (
            <span
              key={cat.name}
              className="hero-float inline-flex items-center gap-2 rounded-2xl bg-card px-3.5 py-2 text-sm font-semibold text-foreground shadow-sm"
              style={{ ['--r' as string]: `${(i % 3) - 1}deg`, animationDelay: `${i * 0.4}s` }}
            >
              {cat.name}
              <span className="rounded-full bg-primary px-1.5 font-mono text-[10px] text-primary-foreground">{cat.count}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Form Aplikasi — ruled paper form ───
export function PaperHero({ title, count, action }: WithAction & { title: string; count: number }) {
  const checklist: [string, boolean][] = [['Pilih formulir', true], ['Unduh & isi', true], ['Ajukan ke atasan', false]]
  return (
    <section className="hero-paper relative overflow-hidden rounded-md border border-border py-8 pl-16 pr-7 shadow-[0_22px_40px_-24px_color-mix(in_oklch,var(--p-950)_45%,transparent)] sm:pl-24 sm:pr-10">
      <div aria-hidden className="absolute inset-y-0 left-4 flex flex-col justify-around py-6 sm:left-7">
        {[0, 1, 2].map((i) => <span key={i} className="block size-4 rounded-full bg-background shadow-[inset_0_1px_3px_color-mix(in_oklch,var(--p-950)_35%,transparent)]" />)}
      </div>
      <span aria-hidden className="absolute inset-y-0 left-12 w-px bg-accent sm:left-[4.5rem]" />
      <span aria-hidden className="absolute inset-y-0 left-[3.15rem] w-px bg-accent/50 sm:left-[4.65rem]" />
      <div className="relative flex flex-wrap items-center justify-between gap-8">
        <div className="max-w-xl">
          <p className="font-mono-label text-[10px] text-muted-foreground">Formulir resmi · {count} berkas</p>
          <h2 className="mt-3 font-display text-[clamp(2.2rem,4.5vw,3.6rem)] font-semibold leading-[1] text-foreground">{title}</h2>
          <p className="mt-1 font-serif-accent text-2xl text-[color:var(--p-600)]">isi, ajukan, arsipkan.</p>
          <ul className="mt-5 flex flex-col gap-2 text-sm text-foreground">
            {checklist.map(([label, done]) => (
              <li key={label} className="flex items-center gap-2.5">
                <span className={`grid size-4.5 place-items-center rounded-[4px] border-2 ${done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50'}`}>
                  {done && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className={done ? 'text-muted-foreground line-through decoration-accent decoration-2' : ''}>{label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col items-start gap-5 sm:items-end">
          <div aria-hidden className="grid size-28 rotate-[-12deg] place-items-center rounded-full border-[3px] border-double border-accent text-center font-mono-label text-[10px] font-bold leading-4 text-accent">
            PT. JAI<br />ISMS<br />— Resmi —
          </div>
          {action}
        </div>
      </div>
    </section>
  )
}

// ─── Kontrol CS — control room panel ───
export function ControlPanelHero({ title, count, groups, action, children }: WithAction & { title: string; count: number; groups: number; children?: ReactNode }) {
  const now = useNow(1000)
  const tiles: [string, ReactNode][] = [
    ['Dokumen', count],
    ['Grup', groups],
    ['Standar', 'ISO 27001'],
    ['Status', <span key="s" className="text-emerald-300">OK</span>],
  ]
  return (
    <section className="overflow-hidden rounded-2xl bg-[color:var(--p-900)] text-primary-foreground shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-3 font-mono text-[10.5px] tracking-[0.08em] text-primary-foreground/60">
        <span className="flex items-center gap-2"><span className="hero-blink size-2 rounded-full bg-emerald-400" /> SYSTEM ONLINE</span>
        <span className="tabular-nums">{now ? now.toLocaleTimeString('id-ID', { hour12: false }) : '--.--.--'} WIB</span>
      </div>
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="font-mono-label text-[10px] text-accent">Control room</p>
          <h2 className="mt-3 font-display text-[clamp(2.2rem,4.5vw,3.6rem)] font-semibold leading-[0.95]">{title}</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-primary-foreground/70">Pusat kontrol dokumen CS — pantau form, lembar kontrol, dan registrasi vendor dari satu panel.</p>
          {action && <div className="mt-6 flex flex-wrap gap-2">{action}</div>}
        </div>
        <div className="grid grid-cols-2 gap-3 self-end">
          {tiles.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="font-mono-label text-[9.5px] text-primary-foreground/50">{label}</p>
              <p className="mt-2 font-display text-3xl font-semibold leading-none tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </div>
      {children}
    </section>
  )
}

// ─── Jadwal Audit — tear-off calendar ───
export function CalendarHero({ count }: { count: number }) {
  const now = useNow()
  return (
    <section className="grid grid-cols-1 items-center gap-10 md:grid-cols-[220px_1fr]">
      <div className="relative mx-auto w-[196px] rotate-[-3deg] rounded-2xl bg-card shadow-xl ring-1 ring-border transition-transform duration-300 hover:rotate-0">
        <span aria-hidden className="absolute -top-2.5 left-10 z-10 h-6 w-2 rounded-full bg-foreground/70" />
        <span aria-hidden className="absolute -top-2.5 right-10 z-10 h-6 w-2 rounded-full bg-foreground/70" />
        <div className="rounded-t-2xl bg-accent py-3 text-center font-mono-label text-sm font-bold text-accent-foreground">
          {now ? now.toLocaleDateString('id-ID', { month: 'long' }) : '—'}
        </div>
        <div className="py-5 text-center">
          <p className="font-display text-[5.5rem] font-bold leading-none tabular-nums text-foreground">{now ? now.getDate() : '--'}</p>
          <p className="mt-2 font-mono-label text-[11px] text-muted-foreground">{now ? now.toLocaleDateString('id-ID', { weekday: 'long' }) : ''}</p>
        </div>
        <div className="border-t border-dashed border-border py-2 text-center font-mono text-[10px] text-muted-foreground">{now?.getFullYear()}</div>
      </div>
      <div>
        <p className="portal-eyebrow">Monitoring · Internal audit</p>
        <h2 className="mt-4 font-display text-[clamp(2.4rem,5vw,4.2rem)] font-semibold leading-[0.95] text-foreground">
          Jadwal Audit <span className="font-serif-accent text-[color:var(--p-600)]">Internal</span>
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Jadwal audit internal ISMS terbaru yang diunggah admin ISM. Klik jadwal untuk membukanya dalam ukuran penuh.</p>
        <div className="mt-6 flex flex-wrap gap-8 border-t border-border pt-5">
          <div><p className="font-display text-4xl font-bold tabular-nums text-foreground">{count}</p><p className="font-mono-label text-[10px] text-muted-foreground">jadwal terunggah</p></div>
          <div><p className="font-display text-4xl font-bold text-foreground">27001</p><p className="font-mono-label text-[10px] text-muted-foreground">siklus ISO/IEC</p></div>
        </div>
      </div>
    </section>
  )
}

// ─── News — newspaper masthead ───
export function MastheadHero({ action }: WithAction) {
  const now = useNow()
  return (
    <section className="text-center">
      <div className="flex items-center justify-between gap-3 border-b border-foreground pb-2 font-mono-label text-[10px] text-muted-foreground">
        <span>Edisi internal</span>
        <span className="hidden sm:inline">{now ? now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span>
        <span>Vol. {now?.getFullYear()}</span>
      </div>
      <h2 className="py-5 font-display text-[clamp(3rem,10vw,8rem)] font-bold leading-[0.85] text-foreground">
        Informasi <span className="font-serif-accent text-[color:var(--p-600)]">Baru</span>
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y-[3px] border-double border-foreground py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-label text-[10px] text-foreground">
          <span>Keamanan informasi</span><span className="text-accent">●</span><span>Pengumuman</span><span className="text-accent">●</span><span>Pelatihan</span>
        </div>
        {action}
      </div>
    </section>
  )
}

// ─── Department / section — document folder ───
export function FolderHero({ department, section, count, action }: WithAction & {
  department: { name: string; slug: string; sections: { id: number; name: string; slug: string }[] }
  section: { name: string; slug: string } | null
  count: number
}) {
  const name = section ? section.name : department.name
  const words = name.split(/[\s&/-]+/).filter(Boolean)
  const initials = (words.length === 1 && words[0].length <= 4 ? words[0] : words.slice(0, 3).map((w) => w[0]).join('')).toUpperCase()
  const tabClass = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-accent text-accent-foreground' : 'bg-white/10 text-primary-foreground/80 hover:bg-white/20'}`
  return (
    <section className="relative pt-3">
      <div aria-hidden className="absolute right-16 top-0 h-16 w-44 rotate-[4deg] rounded-md bg-card shadow-md ring-1 ring-border" />
      <div aria-hidden className="absolute right-28 top-1 h-16 w-40 -rotate-[3deg] rounded-md bg-muted shadow ring-1 ring-border" />
      <div className="relative inline-flex items-center gap-2 rounded-t-xl bg-[color:var(--p-850)] px-5 pb-2 pt-2.5 font-mono-label text-[10px] text-primary-foreground/80">
        <Folder className="size-3.5 text-accent" /> Departemen
      </div>
      <div className="relative overflow-hidden rounded-b-2xl rounded-tr-2xl bg-[color:var(--p-850)] p-7 text-primary-foreground shadow-xl sm:p-9">
        <span aria-hidden className="pointer-events-none absolute -right-6 top-1/2 grid size-52 -translate-y-1/2 place-items-center rounded-full border-2 border-white/10 font-display text-7xl font-bold text-white/10 max-[640px]:hidden">
          {initials}
        </span>
        <div className="relative max-w-2xl">
          <p className="font-mono-label text-[10px] text-primary-foreground/55">
            {department.name}{section && <> <span className="mx-1 opacity-50">/</span> Section</>}
          </p>
          <h2 className="mt-3 font-display text-[clamp(2.2rem,4.5vw,3.6rem)] font-semibold leading-[0.95]">{name}</h2>
          <p className="mt-3 text-sm leading-6 text-primary-foreground/70">
            {count} dokumen terkendali untuk {section ? `section ${section.name}` : `departemen ${department.name}`}.
          </p>
          {department.sections.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href={`/documents/department/${department.slug}`} className={tabClass(!section)}>Semua</Link>
              {department.sections.map((s) => (
                <Link key={s.id} href={`/documents/department/${department.slug}/${s.slug}`} className={tabClass(section?.slug === s.slug)}>{s.name}</Link>
              ))}
            </div>
          )}
          {action && <div className="mt-6">{action}</div>}
        </div>
      </div>
    </section>
  )
}

// ─── Ijin Foto/Video — camera viewfinder ───
export function ViewfinderHero({ action }: WithAction) {
  const corner = 'absolute size-9 border-white/70'
  return (
    <section className="relative overflow-hidden rounded-2xl bg-[color:var(--p-950)] px-8 py-8 text-primary-foreground sm:px-14 sm:py-10">
      <div aria-hidden className="pointer-events-none absolute -left-20 top-0 size-80 rounded-full bg-accent/15 blur-3xl" />
      <span className={`${corner} left-4 top-4 border-l-2 border-t-2`} />
      <span className={`${corner} right-4 top-4 border-r-2 border-t-2`} />
      <span className={`${corner} bottom-4 left-4 border-b-2 border-l-2`} />
      <span className={`${corner} bottom-4 right-4 border-b-2 border-r-2`} />
      <div className="relative flex items-center justify-between font-mono text-[11px] tracking-[0.1em] text-primary-foreground/70">
        <span className="flex items-center gap-2"><span className="hero-blink size-2.5 rounded-full bg-red-500" /> REC</span>
        <span className="flex items-center gap-3"><span className="max-[520px]:hidden">1/125 · f2.8 · ISO 400</span><BatteryFull className="size-4" /></span>
      </div>
      <div aria-hidden className="hero-focus absolute right-[14%] top-1/2 hidden size-24 -translate-y-1/2 border-2 border-accent md:block">
        <span className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-accent" />
        <span className="absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-accent" />
      </div>
      <div className="relative mt-8 max-w-xl">
        <p className="flex items-center gap-2 font-mono-label text-[10px] text-accent"><Camera className="size-3.5" /> Izin dokumentasi</p>
        <h2 className="mt-3 font-display text-[clamp(2.3rem,4.8vw,3.9rem)] font-semibold leading-[0.95]">Ijin Foto &amp; Video</h2>
        <p className="mt-3 text-sm leading-6 text-primary-foreground/70">Setiap pengambilan foto/video di area perusahaan wajib mendapat izin terlebih dahulu — untuk karyawan internal maupun tamu.</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
      <div aria-hidden className="relative mt-8 flex items-end justify-center gap-1.5 font-mono text-[9px] text-primary-foreground/45">
        <span className="mr-2">−2</span>
        {Array.from({ length: 17 }).map((_, i) => (
          <span key={i} className={`w-px ${i === 8 ? 'h-3.5 bg-accent' : i % 4 === 0 ? 'h-2.5 bg-white/50' : 'h-1.5 bg-white/30'}`} />
        ))}
        <span className="ml-2">+2</span>
      </div>
    </section>
  )
}

// ─── Rekap Foto/Video — film strip ───
export function FilmStripHero({ action }: WithAction) {
  return (
    <section className="overflow-hidden rounded-xl bg-[color:var(--p-950)] text-primary-foreground shadow-xl">
      <div className="hero-sprockets h-6" />
      <div className="grid grid-cols-1 items-center gap-8 border-y border-white/10 px-7 py-8 sm:px-10 lg:grid-cols-[1fr_auto]">
        <div className="max-w-xl">
          <p className="font-mono-label text-[10px] text-accent">Ledger — semua dept./section</p>
          <h2 className="mt-3 font-display text-[clamp(2.2rem,4.5vw,3.6rem)] font-semibold leading-[0.95]">Rekap Pengajuan Foto/Video</h2>
          <p className="mt-3 text-sm leading-6 text-primary-foreground/70">Arsip seluruh pengajuan izin pengambilan foto/video dari semua departemen — bisa dilihat siapa saja.</p>
          {action && <div className="mt-6">{action}</div>}
        </div>
        <div aria-hidden className="flex gap-2 max-[640px]:hidden">
          {['01A', '02A', '03A'].map((frame, i) => (
            <div key={frame} className="flex h-28 w-24 flex-col justify-between rounded-sm border border-white/15 p-2" style={{ background: `color-mix(in oklch, var(--p-${i === 1 ? '600' : '750'}) ${i === 1 ? 55 : 35}%, transparent)` }}>
              <Camera className="size-4 opacity-60" />
              <span className="font-mono text-[9px] text-primary-foreground/60">{frame}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="hero-sprockets h-6" />
    </section>
  )
}
