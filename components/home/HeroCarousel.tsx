'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChevronLeft, ChevronRight, Maximize, Minimize, Volume2, VolumeX } from 'lucide-react'
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
//
// Layout follows the "Tundra" reference: a light, calm hero — centered
// two-tone headline on a cream mist at the top, the video filling the lower
// part like a landscape, a small info/CTA card bottom-left and a compact
// player card bottom-right.

const TRANSITION_MS = 1100

// Breaks the hero out of <main>'s centered max-width/padding so it spans the
// full browser width edge-to-edge, like a real hero banner instead of a boxed card.
const FULL_BLEED = 'w-screen ml-[calc(50%-50vw)]'

// Cream mist over the top of the video (headline area) and a lighter one at
// the bottom so the glass cards stay legible.
const TOP_MIST = 'linear-gradient(180deg, var(--background) 0%, var(--background) 20%, color-mix(in oklch, var(--background) 82%, transparent) 32%, color-mix(in oklch, var(--background) 35%, transparent) 44%, transparent 56%)'
const BOTTOM_MIST = 'linear-gradient(0deg, color-mix(in oklch, var(--background) 70%, transparent) 0%, transparent 26%)'

function slideUrl(slide: Slide) {
  return `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(slide.file_path)}`
}

// Two-tone headline: the first half of the words in deep brand ink, the rest
// in a lighter tint of the same hue — each word rising in on its own delay.
function TwoToneHeadline({ text, className = '' }: { text: string; className?: string }) {
  const words = text.trim().split(/\s+/)
  const split = Math.ceil(words.length / 2)
  return (
    <h1 className={`text-balance font-display font-semibold leading-[0.95] ${className}`}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`}>
          <span
            className="hero-word"
            style={{
              animationDelay: `${120 + i * 90}ms`,
              color: i < split ? 'var(--p-850)' : 'color-mix(in oklch, var(--p-600) 72%, var(--background))',
            }}
          >
            {word}
          </span>
          {i < words.length - 1 && ' '}
        </span>
      ))}
    </h1>
  )
}

// One slide's full visual (video + mist + headline + CTA card), rendered as
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
      {/* The video sits in the lower part of the frame like a landscape; in
          true fullscreen it takes the whole screen. */}
      <div className={`absolute inset-x-0 bottom-0 overflow-hidden ${isFullscreen ? 'top-0 bg-black' : 'top-[16%] hero-parallax-media'}`}>
        <video
          src={url}
          autoPlay
          muted={phase === 'out' ? true : muted}
          loop={loop}
          playsInline
          onEnded={phase === 'in' ? onVideoEnded : undefined}
          className={`absolute inset-0 h-full w-full ${isFullscreen ? 'object-contain' : 'hero-drift object-cover'}`}
        />
      </div>

      {!isFullscreen && (
        <>
          <div className="pointer-events-none absolute inset-0" style={{ background: TOP_MIST }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: BOTTOM_MIST }} />
        </>
      )}

      {!isFullscreen && phase === 'in' && (
        <>
          {/* Centered headline on the cream mist */}
          <div className="hero-parallax-text absolute inset-x-0 top-0 z-10 mx-auto max-w-5xl px-6 pt-[clamp(2.2rem,7vh,4.5rem)] text-center">
            <TwoToneHeadline text={slide.title} className="text-[clamp(2.6rem,7.4vw,6.6rem)]" />
            {slide.description && (
              <p className="hero-word mx-auto mt-5 max-w-xl text-sm leading-6 text-[color:var(--p-ink2)] sm:text-base" style={{ animationDelay: '520ms' }}>
                {slide.description}
              </p>
            )}
          </div>

          {/* Bottom-left info + CTA card */}
          <div className="hero-word absolute bottom-5 left-4 z-20 flex max-w-[calc(100%-8rem)] flex-col items-start gap-3 sm:bottom-9 sm:left-10 sm:max-w-sm" style={{ animationDelay: '700ms' }}>
            <div className="hidden rounded-2xl bg-background/75 px-4 py-3 shadow-lg ring-1 ring-border/60 backdrop-blur-md sm:block">
              <p className="flex items-center gap-2 font-mono-label text-[10px] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-accent" /> Portal ISMS
              </p>
              <p className="mt-1.5 text-sm font-medium text-foreground">PT. Jatim Autocomp Indonesia</p>
            </div>
            {slide.cta_label && slide.cta_href && (
              <Link
                href={slide.cta_href}
                className="group inline-flex w-fit items-center gap-2.5 rounded-full bg-[color:var(--p-850)] py-2 pl-5 pr-2 text-sm font-semibold text-white shadow-lg transition-transform duration-200 hover:scale-[1.03]"
              >
                {slide.cta_label}
                <span className="grid size-7 place-items-center rounded-full bg-accent text-accent-foreground transition-transform duration-300 group-hover:rotate-45">
                  <ArrowUpRight className="size-4" />
                </span>
              </Link>
            )}
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

  // Scroll parallax: headline lifts and fades, video eases forward.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const update = () => {
      frame = 0
      const section = sectionRef.current
      if (!section) return
      const progress = Math.min(1, Math.max(0, window.scrollY / Math.max(1, section.offsetHeight)))
      section.style.setProperty('--hero-p', progress.toFixed(3))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [loading])

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
    return <div className={`h-[72vh] max-h-[880px] min-h-[520px] sm:h-[86vh] sm:min-h-[560px] bg-background ${FULL_BLEED}`} />
  }

  if (!current) {
    return (
      <section ref={sectionRef} className={`relative isolate overflow-hidden bg-background ${FULL_BLEED}`}>
        {/* Soft brand-tinted "landscape" of glows in place of a video */}
        <div aria-hidden className="pointer-events-none absolute -bottom-40 left-[8%] -z-10 size-[520px] rounded-full bg-[color:var(--p-600)] opacity-20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 right-[6%] -z-10 size-[560px] rounded-full bg-accent opacity-20 blur-3xl" />
        <p aria-hidden className="pointer-events-none absolute -bottom-8 left-1/2 -z-10 -translate-x-1/2 select-none font-display text-[clamp(6rem,22vw,20rem)] font-bold leading-none tracking-[-0.06em] text-[color:var(--p-700)] opacity-[0.06]">ISMS</p>
        <div className="hero-parallax-text mx-auto flex max-w-5xl flex-col items-center px-6 pb-28 pt-[clamp(3rem,10vh,6rem)] text-center sm:pb-36">
          <p className="hero-word flex items-center gap-2 font-mono-label text-[10.5px] text-muted-foreground"><span className="size-1.5 rounded-full bg-accent" /> Portal ISMS · PT. Jatim Autocomp Indonesia</p>
          <TwoToneHeadline text="Selamat datang di Portal ISMS." className="mt-6 text-[clamp(2.8rem,7vw,6.2rem)]" />
          <p className="hero-word mt-6 max-w-xl text-base leading-7 text-[color:var(--p-ink2)]" style={{ animationDelay: '520ms' }}>
            Pusat informasi kebijakan, prosedur, dan materi keamanan informasi PT. Jatim Autocomp Indonesia.
          </p>
        </div>
      </section>
    )
  }

  const glassButton = 'grid size-8 place-items-center rounded-full text-foreground transition-colors hover:bg-foreground/10'

  return (
    <section
      ref={sectionRef}
      className={`relative isolate overflow-hidden bg-background ${isFullscreen ? 'h-screen w-screen' : `h-[72vh] max-h-[880px] min-h-[520px] sm:h-[86vh] sm:min-h-[560px] ${FULL_BLEED}`}`}
    >
      {outgoing && slides[outgoing.index] && (
        <SlideLayer key={`out-${outgoing.key}`} slide={slides[outgoing.index]} phase="out" loop={loopVideo} muted={muted} isFullscreen={isFullscreen} onDone={() => setOutgoing((current) => (current?.key === outgoing.key ? null : current))} />
      )}
      <SlideLayer key={`in-${activeIndex}`} slide={current} phase="in" loop={loopVideo} muted={muted} isFullscreen={isFullscreen} onVideoEnded={goNext} />

      {/* Compact player card — bottom-right, like Tundra's video thumbnail */}
      <div
        className={`absolute z-20 flex items-center gap-1 rounded-2xl p-1.5 shadow-lg backdrop-blur-md ${
          isFullscreen ? 'bottom-5 right-5 bg-black/40 text-white [&_button]:text-white' : 'bottom-5 right-4 bg-background/75 ring-1 ring-border/60 sm:bottom-9 sm:right-10'
        }`}
      >
        {slides.length > 1 && (
          <>
            <button type="button" onClick={goPrev} aria-label="Slide sebelumnya" className={glassButton}><ChevronLeft className="size-4" /></button>
            <span className="px-1 font-mono text-[11px] tabular-nums opacity-70">
              {String(activeIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
            </span>
            <button type="button" onClick={goNext} aria-label="Slide berikutnya" className={glassButton}><ChevronRight className="size-4" /></button>
            <span className="mx-1 h-5 w-px bg-current opacity-15" />
          </>
        )}
        <button
          type="button"
          onClick={() => setMuted((current) => !current)}
          aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'}
          title={muted ? 'Nyalakan suara' : 'Matikan suara'}
          className={glassButton}
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Keluar layar penuh' : 'Tampilkan layar penuh'}
          title={isFullscreen ? 'Keluar layar penuh' : 'Tampilkan layar penuh'}
          className={glassButton}
        >
          {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
        </button>
      </div>

      {!isFullscreen && (
        <a
          href="#gallery"
          aria-label="Gulir ke konten"
          className="absolute bottom-6 left-1/2 z-20 hidden -translate-x-1/2 flex-col items-center gap-2 font-mono-label text-[9.5px] text-foreground/60 transition-colors hover:text-foreground lg:flex"
        >
          Gulir
          <span className="relative block h-9 w-px bg-foreground/15"><span className="scroll-cue-line absolute inset-0 bg-accent" /></span>
        </a>
      )}
    </section>
  )
}
