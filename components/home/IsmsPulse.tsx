// components/home/IsmsPulse.tsx
//
// First Home chapter: an ISMS statement that reveals line by line and then
// "inks in" word by word as the reader scrolls (motionsites "Data
// Storytelling"), followed by live counters that count up once in view
// (motionsites "Cybersecurity SaaS" stat box). Counts come from the public,
// aggregate-only /api/home-stats. Colours are theme tokens, so the section
// follows Kelola Tema like the rest of the portal.

'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { API_BASE_PATH } from '@/lib/config'

const FULL_BLEED = 'w-screen ml-[calc(50%-50vw)]'

type Stats = {
  documents: number
  proceduresApproved: number
  proceduresPending: number
  photoApproved: number
  photoTotal: number
  visitsTotal: number
  visitsMonth: number
  specialAreaApproved: number
  generatedAt: string
}

type Word = { text: string; style?: 'serif' | 'outline' }

// One inner array per visual line; each line rises out of its own mask.
const STATEMENT: Word[][] = [
  [{ text: 'Setiap', style: 'serif' }, { text: 'informasi', style: 'serif' }],
  [{ text: 'punya' }, { text: 'pemilik,' }],
  [{ text: 'setiap' }, { text: 'orang' }, { text: 'ikut' }],
  [{ text: 'menjaganya.', style: 'outline' }],
]
const WORD_COUNT = STATEMENT.flat().length

const nf = new Intl.NumberFormat('id-ID')

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function useInView<T extends Element>(threshold = 0.3) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); observer.disconnect() }
    }, { threshold })
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])
  return [ref, inView] as const
}

function CountUp({ value, run }: { value: number; run: boolean }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!run) return
    if (prefersReducedMotion() || value === 0) { setShown(value); return }
    const duration = 1600
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setShown(Math.round(value * (1 - Math.pow(1 - t, 4))))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, run])
  return <>{nf.format(shown)}</>
}

function StatBox({ index, label, value, caption, ratio, run }: {
  index: number
  label: string
  value: number | null
  caption: string
  ratio?: number
  run: boolean
}) {
  return (
    <div className="flex flex-col justify-between gap-6 border border-border bg-card p-5 transition-colors hover:border-[color:var(--p-600)]">
      <div className="flex items-start justify-between gap-3 font-mono-label text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="text-[color:var(--p-600)]">S/{String(index).padStart(2, '0')}</span>
      </div>
      <div>
        <p className="font-display text-[clamp(2.4rem,4.2vw,3.6rem)] font-semibold leading-none tabular-nums text-foreground">
          {value === null ? <span className="text-muted-foreground/40">—</span> : <CountUp value={value} run={run} />}
        </p>
        {/* Boxes without a ratio keep an empty track so the numbers line up. */}
        <div className={`mt-4 h-[3px] w-full overflow-hidden ${ratio === undefined ? '' : 'bg-secondary'}`}>
          {ratio !== undefined && (
            <div
              className="h-full origin-left bg-[color:var(--p-600)] transition-transform duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: `scaleX(${run ? ratio : 0})` }}
            />
          )}
        </div>
        <p className="mt-3 text-[12.5px] leading-snug text-muted-foreground">{caption}</p>
      </div>
    </div>
  )
}

export function IsmsPulse() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [statementRef, statementIn] = useInView<HTMLDivElement>(0.25)
  const [gridRef, gridIn] = useInView<HTMLDivElement>(0.3)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/home-stats`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Stats | null) => setStats(data))
      .catch(() => setStats(null))
  }, [])

  // Scroll-linked "ink": --sp runs 0→1 while the statement travels from the
  // lower part of the viewport to its upper third; each word's opacity is
  // derived from it in CSS (.pulse-word in globals.css).
  useEffect(() => {
    const el = statementRef.current
    const section = sectionRef.current
    if (!el || !section) return
    if (prefersReducedMotion()) { section.style.setProperty('--sp', '1'); return }
    let frame = 0
    const update = () => {
      frame = 0
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      const progress = (vh * 0.85 - rect.top) / (vh * 0.85 - vh * 0.3 + rect.height * 0.4)
      section.style.setProperty('--sp', String(Math.max(0, Math.min(1, progress))))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [statementRef])

  const updatedAt = stats ? new Date(stats.generatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null
  const photoRatio = stats && stats.photoTotal > 0 ? stats.photoApproved / stats.photoTotal : 0
  const procedureTotal = stats ? stats.proceduresApproved + stats.proceduresPending : 0
  const procedureRatio = stats && procedureTotal > 0 ? stats.proceduresApproved / procedureTotal : 0

  let wordIndex = 0

  return (
    <section
      ref={sectionRef}
      className={`home-chapter isms-pulse ${FULL_BLEED} bg-background text-foreground`}
      style={{ '--sp': 0, '--words': WORD_COUNT } as React.CSSProperties}
    >
      <div className="mx-auto max-w-[1480px] px-10 pb-16 pt-12 max-[900px]:px-6 max-[680px]:px-4 max-[680px]:pb-12 max-[680px]:pt-9">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-3 font-mono-label text-[10.5px] text-muted-foreground">
          <span>(<span className="chapter-num" />) — Komitmen ISMS</span>
          <span className="flex items-center gap-2 text-right">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[color:var(--p-600)] opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-[color:var(--p-600)]" />
            </span>
            {updatedAt ? `Data live · ${updatedAt}` : 'Data live'}
          </span>
        </div>

        <div className="mt-10 grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-end gap-12 max-[1100px]:grid-cols-1 max-[1100px]:gap-10">
          <div ref={statementRef}>
            <h2
              aria-label={STATEMENT.flat().map((w) => w.text).join(' ')}
              className={`font-display text-[clamp(2.6rem,6.4vw,6rem)] font-semibold leading-[0.98] ${statementIn ? 'is-in' : ''}`}
            >
              {STATEMENT.map((line, li) => (
                <span key={li} aria-hidden className="line-mask" style={{ '--d': `${li * 0.12}s` } as React.CSSProperties}>
                  <span>
                    {line.map((word, wi) => {
                      const i = wordIndex++
                      const cls = word.style === 'serif'
                        ? 'font-serif-accent text-[color:var(--p-600)]'
                        : word.style === 'outline' ? 'pulse-outline' : ''
                      return (
                        <Fragment key={wi}>
                          {wi > 0 && ' '}
                          <span className={`pulse-word ${cls}`} style={{ '--i': i } as React.CSSProperties}>{word.text}</span>
                        </Fragment>
                      )
                    })}
                  </span>
                </span>
              ))}
            </h2>
          </div>
          <div className="max-w-[440px] pb-2">
            <p className="font-mono-label text-[10.5px] text-[color:var(--p-600)]">ISMS · PT. Jatim Autocomp Indonesia</p>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              Sistem Manajemen Keamanan Informasi PT. Jatim Autocomp Indonesia memastikan setiap dokumen terkendali,
              setiap akses ke area terbatas tercatat, dan setiap pengambilan gambar mendapat izin — angka di bawah
              diambil langsung dari portal ini.
            </p>
          </div>
        </div>

        <div ref={gridRef} className="mt-14 grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[560px]:grid-cols-1">
          <StatBox
            index={1}
            label="Dokumen terkendali"
            value={stats?.documents ?? null}
            caption="Prosedur, form, standar & materi edukasi"
            run={gridIn && stats !== null}
          />
          <StatBox
            index={2}
            label="Prosedur disahkan"
            value={stats?.proceduresApproved ?? null}
            caption={stats ? (stats.proceduresPending > 0 ? `${nf.format(stats.proceduresPending)} menunggu approval` : 'Tidak ada yang menunggu approval') : 'Pengesahan e-sign QR'}
            ratio={procedureRatio}
            run={gridIn && stats !== null}
          />
          <StatBox
            index={3}
            label="Izin foto/video"
            value={stats?.photoApproved ?? null}
            caption={stats ? `Disetujui dari ${nf.format(stats.photoTotal)} pengajuan` : 'Pengajuan disetujui'}
            ratio={photoRatio}
            run={gridIn && stats !== null}
          />
          <StatBox
            index={4}
            label="Kunjungan tercatat"
            value={stats?.visitsTotal ?? null}
            caption={stats ? `${nf.format(stats.visitsMonth)} bulan ini · ${nf.format(stats.specialAreaApproved)} izin area special` : 'Tamu, vendor & affiliate'}
            ratio={stats && stats.visitsTotal > 0 ? stats.visitsMonth / stats.visitsTotal : 0}
            run={gridIn && stats !== null}
          />
        </div>
      </div>
    </section>
  )
}
