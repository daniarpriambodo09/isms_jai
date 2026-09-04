'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react'
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

function slideUrl(slide: Slide) {
  return `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(slide.file_path)}`
}

// One image's full visual (backdrop blur + contained image), rendered as either
// the incoming (fading in) or outgoing (fading out) layer. Keyed by the caller
// so each activation restarts the CSS animation from scratch.
function ImageLayer({ slide, phase, onDone }: { slide: Slide; phase: 'in' | 'out'; onDone?: () => void }) {
  const url = slideUrl(slide)
  const fadeAnimation = phase === 'in'
    ? `hero-fade-in ${TRANSITION_MS}ms ease-out forwards`
    : `hero-fade-out ${TRANSITION_MS}ms ease-in forwards`

  return (
    <div className="absolute inset-0" style={{ animation: fadeAnimation }} onAnimationEnd={phase === 'out' ? onDone : undefined}>
      {/* Blurred backdrop fills the frame without cropping the real image below. */}
      <img src={url} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
      {/* Real image, always shown at 1:1 fit — never cropped. */}
      <img src={url} alt={slide.title} className="absolute inset-0 h-full w-full object-contain" />
    </div>
  )
}

export function ImageShowcase() {
  const [images, setImages] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [outgoing, setOutgoing] = useState<{ index: number; key: number } | null>(null)
  const activeIndexRef = useRef(0)
  const transitionKeyRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/hero-slides`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { slides: [] }))
      .then((data: { slides: Slide[] }) => setImages((data.slides ?? []).filter((slide) => slide.media_type === 'image')))
      .catch(() => setImages([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { activeIndexRef.current = activeIndex }, [activeIndex])

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
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span
          className="grid size-8 place-items-center rounded-full text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, oklch(0.39 0.09 205) 0%, oklch(0.48 0.12 180) 100%)' }}
        >
          <ImageIcon className="size-4" />
        </span>
        <p className="portal-eyebrow">Gallery</p>
      </div>

      <div
        className="relative rounded-[1.85rem] p-[2px]"
        style={{ background: 'linear-gradient(135deg, oklch(0.48 0.12 180 / 45%) 0%, oklch(0.7 0.15 55 / 35%) 50%, oklch(0.58 0.14 165 / 45%) 100%)' }}
      >
        <div className="relative h-[280px] overflow-hidden rounded-[1.75rem] bg-[#1a3a52] shadow-sm sm:h-[380px]">
        {outgoing && images[outgoing.index] && (
          <ImageLayer key={`out-${outgoing.key}`} slide={images[outgoing.index]} phase="out" onDone={() => setOutgoing((prev) => (prev?.key === outgoing.key ? null : prev))} />
        )}
        <ImageLayer key={`in-${activeIndex}`} slide={current} phase="in" />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Gambar sebelumnya"
              className="absolute left-3 top-1/2 z-20 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Gambar berikutnya"
              className="absolute right-3 top-1/2 z-20 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="absolute bottom-3 right-4 z-20 flex items-center gap-1.5">
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
        </div>
      </div>

      <p className="mt-3 text-sm font-medium text-foreground">{current.title}</p>
      {current.description && <p className="mt-0.5 text-xs text-muted-foreground">{current.description}</p>}
    </section>
  )
}
