// components/home/SecurityPillars.tsx
//
// Home chapter after the statement: the three pillars of information security
// (Confidentiality · Integrity · Availability) as panels that open one at a
// time — the open one widens and lists three everyday habits, the others fold
// to a tall slim card. It advances on its own until the visitor hovers, taps
// or focuses a panel. Below it, the latest uploads across every register
// (/api/home-latest). Theme tokens throughout. (.pillar-* in globals.css)

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, DatabaseBackup, EyeOff, FileCheck2, FilePenLine, HardDrive, KeyRound, LockKeyhole, MonitorOff, ShieldAlert, type LucideIcon } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { ChapterHeader } from '@/components/home/ChapterHeader'

type Pillar = {
  letter: string
  english: string
  title: string
  tagline: string
  icon: LucideIcon
  habits: { icon: LucideIcon; text: string }[]
}

const PILLARS: Pillar[] = [
  {
    letter: 'C',
    english: 'Confidentiality',
    title: 'Kerahasiaan',
    tagline: 'Informasi hanya diketahui oleh yang berhak.',
    icon: LockKeyhole,
    habits: [
      { icon: MonitorOff, text: 'Kunci layar setiap kali meninggalkan meja.' },
      { icon: KeyRound, text: 'Password dan akun tidak dipinjamkan ke siapa pun.' },
      { icon: EyeOff, text: 'Dokumen dan area terbatas tidak difoto atau dibagikan tanpa izin.' },
    ],
  },
  {
    letter: 'I',
    english: 'Integrity',
    title: 'Integritas',
    tagline: 'Informasi tetap benar, utuh, dan tidak diubah sembarangan.',
    icon: FileCheck2,
    habits: [
      { icon: FileCheck2, text: 'Selalu pakai dokumen revisi terbaru dari portal ini.' },
      { icon: FilePenLine, text: 'Perubahan dokumen hanya lewat pengesahan resmi.' },
      { icon: ShieldAlert, text: 'Data yang tampak berubah tanpa izin segera dilaporkan ke atasan.' },
    ],
  },
  {
    letter: 'A',
    english: 'Availability',
    title: 'Ketersediaan',
    tagline: 'Informasi siap dipakai saat dibutuhkan.',
    icon: DatabaseBackup,
    habits: [
      { icon: HardDrive, text: 'Simpan file kerja di lokasi resmi, bukan hanya di perangkat pribadi.' },
      { icon: DatabaseBackup, text: 'Jaga perangkat kerja dan jangan memasang software tidak resmi.' },
      { icon: ShieldAlert, text: 'Perangkat rusak atau hilang dilaporkan saat itu juga.' },
    ],
  },
]

const AUTO_MS = 6000

type Latest = { kind: string; kindLabel: string; title: string; code: string | null; uploadedAt: string; href: string }

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function SecurityPillars() {
  const [active, setActive] = useState(0)
  // Auto-advance stops for good once the visitor takes over.
  const [auto, setAuto] = useState(true)
  const [inView, setInView] = useState(false)
  const [latest, setLatest] = useState<Latest[] | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/home-latest`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { documents: [] }))
      .then((data: { documents: Latest[] }) => setLatest(data.documents ?? []))
      .catch(() => setLatest([]))
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!auto || !inView) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setTimeout(() => setActive((current) => (current + 1) % PILLARS.length), AUTO_MS)
    return () => window.clearTimeout(timer)
  }, [auto, inView, active])

  const choose = (index: number) => { setAuto(false); setActive(index) }

  return (
    <section>
      <ChapterHeader eyebrow="Tiga pilar" title="Dijaga bersama, setiap hari" meta="Confidentiality · Integrity · Availability" />

      <div ref={ref} className="flex flex-col gap-3 lg:h-[430px] lg:flex-row">
        {PILLARS.map((pillar, index) => {
          const open = index === active
          const Icon = pillar.icon
          return (
            <article
              key={pillar.letter}
              data-open={open}
              onMouseEnter={() => choose(index)}
              style={{ flexGrow: open ? 2.6 : 1 }}
              className={`pillar group relative min-w-0 flex-none overflow-hidden lg:flex-auto lg:basis-0 rounded-3xl border transition-[flex-grow,background-color,border-color,color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                open ? 'border-transparent bg-[color:var(--p-900)] text-primary-foreground' : 'border-border bg-card text-foreground'
              }`}
            >
              {/* Giant letter, drawn in outline behind the content */}
              <span
                aria-hidden
                className={`pillar-letter pointer-events-none absolute -bottom-10 right-2 select-none font-display text-[13rem] font-bold leading-none transition-all duration-700 lg:text-[17rem] ${open ? 'opacity-[0.09]' : 'opacity-[0.07]'}`}
              >
                {pillar.letter}
              </span>

              <button
                type="button"
                onClick={() => choose(index)}
                onFocus={() => choose(index)}
                aria-expanded={open}
                className="relative block w-full p-6 text-left sm:p-7"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className={`font-mono-label text-[10px] ${open ? 'text-accent' : 'text-[color:var(--p-600)]'}`}>
                    0{index + 1} — {pillar.english}
                  </span>
                  <span className={`grid size-11 flex-none place-items-center rounded-2xl transition-colors duration-500 ${open ? 'bg-accent text-accent-foreground' : 'bg-secondary text-[color:var(--p-600)]'}`}>
                    <Icon className="size-5" />
                  </span>
                </span>
                <span className="mt-2 block font-display text-[clamp(1.7rem,2.3vw,2.25rem)] font-semibold leading-none">{pillar.title}</span>
                <span className={`mt-3 block max-w-sm text-sm leading-6 ${open ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{pillar.tagline}</span>
              </button>

              {open && (
                <ul className="relative flex flex-col gap-2.5 px-6 pb-7 sm:px-7 lg:absolute lg:inset-x-0 lg:bottom-0">
                  {pillar.habits.map((habit, i) => (
                    <li
                      key={habit.text}
                      className="pillar-habit flex items-center gap-3 rounded-2xl bg-white/[0.07] px-4 py-3 text-sm leading-5 text-primary-foreground/90 ring-1 ring-white/10"
                      style={{ animationDelay: `${220 + i * 110}ms` }}
                    >
                      <habit.icon className="size-[18px] flex-none text-accent" />
                      {habit.text}
                    </li>
                  ))}
                </ul>
              )}

              {/* Time left before the next pillar opens (auto-advance only) */}
              {open && auto && inView && <span key={`timer-${active}`} aria-hidden className="pillar-timer absolute inset-x-0 bottom-0 h-[3px] origin-left bg-accent" style={{ animationDuration: `${AUTO_MS}ms` }} />}
            </article>
          )
        })}
      </div>

      {/* Latest uploads */}
      <div className="mt-8 pb-14 max-[680px]:pb-10">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <h3 className="font-display text-xl font-semibold text-foreground">Dokumen terbaru</h3>
          <span className="flex items-center gap-1.5 font-mono-label text-[10px] text-muted-foreground"><span className="size-1.5 rounded-full bg-[color:var(--p-600)]" /> Baru diunggah</span>
        </div>
        {latest === null ? (
          <div className="grid gap-x-8 gap-y-5 pt-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[70, 55, 82, 60, 74, 66].map((width, i) => <span key={i} className="skeleton h-4" style={{ width: `${width}%`, animationDelay: `${i * 90}ms` }} />)}
          </div>
        ) : latest.length === 0 ? (
          <p className="pt-5 text-sm text-muted-foreground">Belum ada dokumen.</p>
        ) : (
          <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((doc, i) => (
              <li key={`${doc.kind}-${doc.code ?? doc.title}-${i}`} className="border-b border-border">
                <Link href={doc.href} className="group flex items-center gap-3 py-3.5 transition-[padding] duration-300 hover:pl-2">
                  <span className="font-mono text-[11px] text-muted-foreground/70">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{doc.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {doc.kindLabel}{doc.code ? ` · ${doc.code}` : ''} · {formatDate(doc.uploadedAt)}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 flex-none text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[color:var(--p-600)]" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
