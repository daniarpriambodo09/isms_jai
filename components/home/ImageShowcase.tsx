'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize, Minimize } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

type Slide = {
  id: number
  media_type: 'video' | 'image'
  file_path: string
  title: string
  description: string | null
}

const ROTATE_MS = 6000
const TRANSITION_MS = 900
const DEFAULT_ASPECT = 16 / 9

// Breaks the gallery out of <main>'s centered max-width/padding so it spans the
// full browser width edge-to-edge, matching the hero video above it.
const FULL_BLEED = 'w-screen ml-[calc(50%-50vw)]'

function slideUrl(slide: Slide) {
  return `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(slide.file_path)}`
}

// One image's full visual, rendered as either the incoming (fading in) or
// outgoing (fading out) layer. Keyed by the caller so each activation
// restarts the CSS animation from scratch.
//
// Outside true fullscreen, the box below sizes itself to each image's own
// aspect ratio (reported here via onLoadAspect), so there's no letterbox
// gap to fill — no blurred backdrop needed, the image just fills the box.
// Inside true fullscreen the viewport size is fixed and can't adapt to the
// image, so that case keeps the blurred-backdrop + object-contain fallback.
function ImageLayer({ slide, phase, isFullscreen, onDone, onLoadAspect }: {
  slide: Slide
  phase: 'in' | 'out'
  isFullscreen: boolean
  onDone?: () => void
  onLoadAspect?: (ratio: number) => void
}) {
  const url = slideUrl(slide)
  const fadeAnimation = phase === 'in'
    ? `hero-fade-in ${TRANSITION_MS}ms ease-out forwards`
    : `hero-fade-out ${TRANSITION_MS}ms ease-in forwards`

  return (
    <div className="absolute inset-0" style={{ animation: fadeAnimation }} onAnimationEnd={phase === 'out' ? onDone : undefined}>
      {isFullscreen && (
        <img src={url} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
      )}
      <img
        src={url}
        alt={slide.title}
        className="absolute inset-0 h-full w-full object-contain"
        onLoad={(event) => onLoadAspect?.(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)}
      />
    </div>
  )
}

export function ImageShowcase() {
  const [images, setImages] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [outgoing, setOutgoing] = useState<{ index: number; key: number } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [aspect, setAspect] = useState(DEFAULT_ASPECT)
  const activeIndexRef = useRef(0)
  const transitionKeyRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/hero-slides`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { slides: [] }))
      .then((data: { slides: Slide[] }) => setImages((data.slides ?? []).filter((slide) => slide.media_type === 'image')))
      .catch(() => setImages([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { activeIndexRef.current = activeIndex }, [activeIndex])

  useEffect(() => {
    const handleChange = () => setIsFullscreen(document.fullscreenElement === boxRef.current)
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      boxRef.current?.requestFullscreen()
    }
  }

  const goTo = (nextIndex: number) => {
    if (nextIndex === activeIndexRef.current) return
    transitionKeyRef.current += 1
    setOutgoing({ index: activeIndexRef.current, key: transitionKeyRef.current })
    setActiveIndex(nextIndex)
  }

  const goNext = () => { if (images.length > 1) goTo((activeIndexRef.current + 1) % images.length) }
  const goPrev = () => { if (images.length > 1) goTo((activeIndexRef.current - 1 + images.length) % images.length) }

  useEffect(() => {
    if (images.length < 2) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => goTo((activeIndexRef.current + 1) % images.length), ROTATE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length, activeIndex])

  const current = images[activeIndex] ?? null

  if (loading || !current) return null

  return (
    <section id="gallery" className="scroll-mt-24">
      <div
        ref={boxRef}
        className={`relative overflow-hidden bg-[#1a3a52] ${isFullscreen ? 'h-screen w-screen' : `w-full min-h-[280px] max-h-[780px] ${FULL_BLEED}`}`}
        style={isFullscreen ? undefined : { aspectRatio: aspect }}
      >
        {outgoing && images[outgoing.index] && (
          <ImageLayer key={`out-${outgoing.key}`} slide={images[outgoing.index]} phase="out" isFullscreen={isFullscreen} onDone={() => setOutgoing((prev) => (prev?.key === outgoing.key ? null : prev))} />
        )}
        <ImageLayer key={`in-${activeIndex}`} slide={current} phase="in" isFullscreen={isFullscreen} onLoadAspect={setAspect} />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Gambar sebelumnya"
              className="absolute left-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/25 sm:left-5"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Gambar berikutnya"
              className="absolute right-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/25 sm:right-5"
            >
              <ChevronRight className="size-5" />
            </button>
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 sm:bottom-6 sm:right-8">
              {images.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Gambar ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === activeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'}`}
                />
              ))}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Keluar layar penuh' : 'Tampilkan layar penuh'}
          title={isFullscreen ? 'Keluar layar penuh' : 'Tampilkan layar penuh'}
          className="absolute right-3 top-3 z-20 grid size-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/25 sm:right-5 sm:top-5"
        >
          {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
        </button>
      </div>
    </section>
  )
}
