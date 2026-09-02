'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

type Slide = {
  id: number
  media_type: 'video' | 'image'
  file_path: string
  title: string
  description: string | null
  cta_label: string | null
  cta_href: string | null
}

const ROTATE_MS = 7000
const TRANSITION_MS = 1100

function slideUrl(slide: Slide) {
  return `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(slide.file_path)}`
}

// One slide's full visual (backdrop blur + contained media + caption), rendered as
// either the incoming (fading in, slow Ken Burns zoom) or outgoing (fading out) layer.
// Keyed by the caller so each activation restarts the CSS animation from scratch.
function SlideLayer({ slide, phase, onDone }: { slide: Slide; phase: 'in' | 'out'; onDone?: () => void }) {
  const url = slideUrl(slide)
  const fadeAnimation = phase === 'in'
    ? `hero-fade-in ${TRANSITION_MS}ms ease-out forwards`
    : `hero-fade-out ${TRANSITION_MS}ms ease-in forwards`
  const kenBurnsAnimation = phase === 'in' ? `hero-ken-burns ${ROTATE_MS + TRANSITION_MS}ms ease-out forwards` : undefined

  return (
    <div className="absolute inset-0" style={{ animation: fadeAnimation }} onAnimationEnd={phase === 'out' ? onDone : undefined}>
      <div className="absolute inset-0 overflow-hidden" style={{ animation: kenBurnsAnimation }}>
        {slide.media_type === 'video' ? (
          <>
            <video src={url} autoPlay muted loop playsInline aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
            <video src={url} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-contain" />
          </>
        ) : (
          <>
            <img src={url} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
            <img src={url} alt={slide.title} className="absolute inset-0 h-full w-full object-contain" />
          </>
        )}
      </div>

      <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(10,20,28,0.88) 0%, rgba(10,20,28,0.35) 45%, rgba(10,20,28,0.05) 75%)' }} />

      <div className="relative z-10 flex h-full flex-col justify-end gap-3 p-6 text-white sm:p-10">
        <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] backdrop-blur-sm">
          <Sparkles className="size-3.5" /> Portal ISMS
        </div>
        <h1 className="max-w-2xl text-balance text-2xl font-semibold tracking-tight drop-shadow-sm sm:text-4xl">{slide.title}</h1>
        {slide.description && <p className="max-w-xl text-sm leading-6 text-white/85 sm:text-base">{slide.description}</p>}
        {slide.cta_label && slide.cta_href && (
          <Link
            href={slide.cta_href}
            className="mt-2 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            style={{ background: 'linear-gradient(135deg, oklch(0.7 0.15 55) 0%, oklch(0.75 0.18 50) 100%)', color: '#1a2f1a' }}
          >
            {slide.cta_label}
          </Link>
        )}
      </div>
    </div>
  )
}

export function HeroCarousel() {
  const [slides, setSlides] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [outgoing, setOutgoing] = useState<{ index: number; key: number } | null>(null)
  const activeIndexRef = useRef(0)
  const transitionKeyRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/hero-slides`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { slides: [] }))
      .then((data: { slides: Slide[] }) => setSlides(data.slides ?? []))
      .catch(() => setSlides([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { activeIndexRef.current = activeIndex }, [activeIndex])

  const goTo = (nextIndex: number) => {
    if (nextIndex === activeIndexRef.current) return
    transitionKeyRef.current += 1
    setOutgoing({ index: activeIndexRef.current, key: transitionKeyRef.current })
    setActiveIndex(nextIndex)
  }

  useEffect(() => {
    if (slides.length < 2) return
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => goTo((activeIndexRef.current + 1) % slides.length), ROTATE_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length, activeIndex])

  const current = slides[activeIndex] ?? null

  if (loading) {
    return <div className="grid h-[420px] place-items-center rounded-[1.75rem] border border-border bg-card shadow-sm sm:h-[520px]" />
  }

  if (!current) {
    return (
      <section
        className="relative overflow-hidden rounded-[1.75rem] border border-border p-6 text-primary-foreground shadow-xl sm:p-10"
        style={{ background: 'linear-gradient(135deg, #1a3a52 0%, #1a5f7a 45%, #278e84 100%)' }}
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
        <div className="relative z-10 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
            <Sparkles className="size-3.5" /> Portal ISMS
          </div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Selamat Datang di Portal ISMS</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/72">Pusat informasi kebijakan, prosedur, dan materi keamanan informasi PT. Jatim Autocomp Indonesia.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="relative h-[420px] overflow-hidden rounded-[1.75rem] border border-border bg-[#0a141c] shadow-xl sm:h-[520px]">
      {outgoing && slides[outgoing.index] && (
        <SlideLayer key={`out-${outgoing.key}`} slide={slides[outgoing.index]} phase="out" onDone={() => setOutgoing((current) => (current?.key === outgoing.key ? null : current))} />
      )}
      <SlideLayer key={`in-${activeIndex}`} slide={current} phase="in" />

      {slides.length > 1 && (
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 sm:bottom-6 sm:right-8">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === activeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
