'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Maximize, Minimize, Sparkles, Volume2, VolumeX } from 'lucide-react'
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

// The hero is video-only — image slides are shown separately in ImageShowcase
// (see components/home/ImageShowcase.tsx), both reading from the same
// /api/hero-slides list and just filtering by media_type on their own side.

const TRANSITION_MS = 1100

// Breaks the hero out of <main>'s centered max-width/padding so it spans the
// full browser width edge-to-edge, like a real hero banner instead of a card.
const FULL_BLEED = 'w-screen ml-[calc(50%-50vw)]'

function slideUrl(slide: Slide) {
  return `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(slide.file_path)}`
}

// One slide's full visual (backdrop blur + contained media + caption), rendered as
// either the incoming (fading in) or outgoing (fading out) layer. Keyed by the
// caller so each activation restarts the CSS animation from scratch.
function SlideLayer({
  slide,
  phase,
  loop,
  muted,
  isFullscreen,
  onDone,
  onVideoEnded,
}: {
  slide: Slide
  phase: 'in' | 'out'
  loop: boolean
  muted: boolean
  isFullscreen: boolean
  onDone?: () => void
  onVideoEnded?: () => void
}) {
  const url = slideUrl(slide)
  const fadeAnimation = phase === 'in'
    ? `hero-fade-in ${TRANSITION_MS}ms ease-out forwards`
    : `hero-fade-out ${TRANSITION_MS}ms ease-in forwards`

  return (
    <div className="absolute inset-0" style={{ animation: fadeAnimation }} onAnimationEnd={phase === 'out' ? onDone : undefined}>
      <div className="absolute inset-0 overflow-hidden">
        {/* Fills the whole frame edge-to-edge, cropping overflow instead of letterboxing. */}
        <video
          src={url}
          autoPlay
          muted={phase === 'out' ? true : muted}
          loop={loop}
          playsInline
          onEnded={phase === 'in' ? onVideoEnded : undefined}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      {!isFullscreen && (
        <>
          {/* Top gradient matches the navbar's color so it blends straight into the video below. */}
          <div className="absolute inset-x-0 top-0 h-12 sm:h-16" style={{ background: 'linear-gradient(180deg, var(--primary) 0%, transparent 100%)' }} />

          <div className="absolute inset-x-0 bottom-0 h-28 sm:h-40" style={{ background: 'linear-gradient(0deg, oklch(0.96 0.025 92 / 96%) 0%, oklch(0.96 0.025 92 / 60%) 55%, oklch(0.96 0.025 92 / 0%) 100%)' }} />

          <div className="relative z-10 flex h-full flex-col justify-end p-6 text-foreground sm:p-10">
            <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-3">
              <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-full border border-primary/25 bg-background/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary backdrop-blur-sm">
                <Sparkles className="size-3.5" /> Portal ISMS
              </div>
              <h1 className="max-w-2xl text-balance text-2xl font-semibold tracking-tight sm:text-4xl">{slide.title}</h1>
              {slide.description && <p className="max-w-xl text-sm leading-6 text-foreground/80 sm:text-base">{slide.description}</p>}
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
        </>
      )}
    </div>
  )
}

export function HeroCarousel() {
  const [slides, setSlides] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [outgoing, setOutgoing] = useState<{ index: number; key: number } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [muted, setMuted] = useState(true)
  const activeIndexRef = useRef(0)
  const transitionKeyRef = useRef(0)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/hero-slides`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { slides: [] }))
      .then((data: { slides: Slide[] }) => setSlides((data.slides ?? []).filter((slide) => slide.media_type === 'video')))
      .catch(() => setSlides([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { activeIndexRef.current = activeIndex }, [activeIndex])

  useEffect(() => {
    const handleChange = () => setIsFullscreen(document.fullscreenElement === sectionRef.current)
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  const goTo = (nextIndex: number) => {
    if (nextIndex === activeIndexRef.current) return
    transitionKeyRef.current += 1
    setOutgoing({ index: activeIndexRef.current, key: transitionKeyRef.current })
    setActiveIndex(nextIndex)
  }

  const goNext = () => { if (slides.length > 1) goTo((activeIndexRef.current + 1) % slides.length) }
  const goPrev = () => { if (slides.length > 1) goTo((activeIndexRef.current - 1 + slides.length) % slides.length) }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      sectionRef.current?.requestFullscreen()
    }
  }

  const current = slides[activeIndex] ?? null
  const loopVideo = slides.length <= 1

  if (loading) {
    return <div className={`h-[420px] bg-card sm:h-[520px] ${FULL_BLEED}`} />
  }

  if (!current) {
    return (
      <section
        className={`relative overflow-hidden p-6 text-primary-foreground sm:p-10 ${FULL_BLEED}`}
        style={{ background: 'linear-gradient(135deg, #1a3a52 0%, #1a5f7a 45%, #278e84 100%)' }}
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
        <div className="relative z-10 mx-auto max-w-2xl">
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
    <section
      ref={sectionRef}
      className={`relative overflow-hidden bg-[#1a3a52] ${isFullscreen ? 'h-screen w-screen' : `h-[420px] sm:h-[520px] ${FULL_BLEED}`}`}
    >
      {outgoing && slides[outgoing.index] && (
        <SlideLayer key={`out-${outgoing.key}`} slide={slides[outgoing.index]} phase="out" loop={loopVideo} muted={muted} isFullscreen={isFullscreen} onDone={() => setOutgoing((current) => (current?.key === outgoing.key ? null : current))} />
      )}
      <SlideLayer key={`in-${activeIndex}`} slide={current} phase="in" loop={loopVideo} muted={muted} isFullscreen={isFullscreen} onVideoEnded={goNext} />

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Slide sebelumnya"
            className="absolute left-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/25 sm:left-5"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Slide berikutnya"
            className="absolute right-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/25 sm:right-5"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}

      <div className="absolute right-3 top-3 z-20 flex items-center gap-2 sm:right-5 sm:top-5">
        <button
          type="button"
          onClick={() => setMuted((current) => !current)}
          aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'}
          title={muted ? 'Nyalakan suara' : 'Matikan suara'}
          className="grid size-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Keluar layar penuh' : 'Tampilkan layar penuh'}
          title={isFullscreen ? 'Keluar layar penuh' : 'Tampilkan layar penuh'}
          className="grid size-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
        >
          {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
        </button>
      </div>

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
