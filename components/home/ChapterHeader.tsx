// components/home/ChapterHeader.tsx
//
// Numbered "chapter" band that introduces each Home section (gallery, then
// one per schedule category). Alternating tones give the page rhythm, so the
// full-bleed media strips read as distinct sections instead of one long run
// of images. Numbers come from a CSS counter (.home-chapters in globals.css),
// so a section that renders nothing never leaves a hole in the numbering.
// The title rises in (same blur-rise as the hero words) once it scrolls into view.

'use client'

import { useEffect, useRef, useState } from 'react'

const FULL_BLEED = 'w-screen ml-[calc(50%-50vw)]'

export type ChapterTone = 'dark' | 'light' | 'accent'

const TONES: Record<ChapterTone, { wrap: string; muted: string; rule: string; number: string }> = {
  dark: { wrap: 'bg-[color:var(--p-900)] text-primary-foreground', muted: 'text-primary-foreground/55', rule: 'border-white/12', number: 'text-accent' },
  light: { wrap: 'bg-background text-foreground', muted: 'text-muted-foreground', rule: 'border-border', number: 'text-[color:var(--p-600)]' },
  accent: { wrap: 'bg-accent text-accent-foreground', muted: 'text-accent-foreground/65', rule: 'border-accent-foreground/15', number: 'text-accent-foreground' },
}

export function ChapterHeader({ eyebrow, title, meta, tone = 'light', children }: {
  eyebrow: string
  title: React.ReactNode
  meta?: React.ReactNode
  tone?: ChapterTone
  children?: React.ReactNode
}) {
  const t = TONES[tone]
  const ref = useRef<HTMLElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); observer.disconnect() }
    }, { threshold: 0.35 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <header ref={ref} className={`home-chapter ${FULL_BLEED} ${t.wrap}`}>
      <div className="mx-auto max-w-[1480px] px-10 pb-8 pt-12 max-[900px]:px-6 max-[680px]:px-4 max-[680px]:pb-6 max-[680px]:pt-9">
        <div className={`flex items-center justify-between gap-4 border-b pb-3 font-mono-label text-[10.5px] ${t.rule} ${t.muted}`}>
          <span>(<span className="chapter-num" />) — {eyebrow}</span>
          {meta && <span className="text-right">{meta}</span>}
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <h2 className={`font-display text-[clamp(2.2rem,5vw,4.4rem)] font-semibold leading-[0.95] ${inView ? 'hero-word' : 'chapter-title-pending'}`}>
            <span className="flex items-baseline gap-4">
              <span aria-hidden className={`chapter-num font-mono text-[0.32em] font-semibold tracking-normal ${t.number}`} />
              <span>{title}</span>
            </span>
          </h2>
          {children}
        </div>
      </div>
    </header>
  )
}
