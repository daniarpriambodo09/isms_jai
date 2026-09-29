'use client'

// Home gallery as a fanned card deck (after the "Mariana" reference): the
// active image sits whole and readable in the middle, its neighbours tilt
// away behind it on either side. Swipe/drag, click a side card, use the
// arrows or the keyboard to move through it; it also advances on its own.
// As the section scrolls in, the cards start stacked and fan out (driven by
// one CSS var, --spread, so scrolling never re-renders React).

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { ChapterHeader } from '@/components/home/ChapterHeader'
import { useEscapeClose } from '@/hooks/useEscapeClose'

type Slide = {
  id: number
  media_type: 'video' | 'image'
  file_path: string
  title: string
  description: string | null
}

const ROTATE_MS = 6000
const DEFAULT_RATIO = 16 / 9
const SWIPE_PX = 60

// Breaks the gallery out of <main>'s centered max-width/padding so it spans the
// full browser width edge-to-edge, matching the hero above it.
const FULL_BLEED = 'w-screen ml-[calc(50%-50vw)]'

function slideUrl(slide: Slide) {
  return `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(slide.file_path)}`
}

// Card i's place relative to the active card, wrapped so the deck is circular.
function offsetOf(i: number, active: number, count: number) {
  let d = i - active
  if (count > 2) {
    if (d > count / 2) d -= count
    if (d < -count / 2) d += count
  }
  return d
}

// Card box: as large as fits (62vh / 620px tall, 84vw wide) at the image's
// own aspect ratio — so nothing is cropped or letterboxed.
function cardSize(ratio: number) {
  return {
    height: `min(62vh, 620px, calc(84vw / ${ratio}))`,
    width: `min(calc(62vh * ${ratio}), calc(620px * ${ratio}), 84vw)`,
  }
}

function useNarrow() {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 680px)')
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return narrow
}

export function ImageShowcase() {
  const [images, setImages] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(0)
  const [ratios, setRatios] = useState<Record<number, number>>({})
  const [drag, setDrag] = useState(0)
  const [hovering, setHovering] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<number | null>(null)
  const dragged = useRef(false)
  const narrow = useNarrow()

  useEscapeClose(lightbox, () => setLightbox(false))

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/hero-slides`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { slides: [] }))
      .then((data: { slides: Slide[] }) => setImages((data.slides ?? []).filter((slide) => slide.media_type === 'image')))
      .catch(() => setImages([]))
      .finally(() => setLoading(false))
  }, [])

  const count = images.length
  const goTo = useCallback((index: number) => { if (count) setActive(((index % count) + count) % count) }, [count])
  const next = useCallback(() => goTo(active + 1), [goTo, active])
  const prev = useCallback(() => goTo(active - 1), [goTo, active])

  // Auto-advance — paused while hovering, dragging or viewing full screen.
  useEffect(() => {
    if (count < 2 || hovering || lightbox || drag !== 0) return
    const timer = setTimeout(() => setActive((current) => (current + 1) % count), ROTATE_MS)
    return () => clearTimeout(timer)
  }, [active, count, hovering, lightbox, drag])

  // Scroll-linked fan-out: 0 = stacked, 1 = fully fanned.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { stage.style.setProperty('--spread', '1'); return }
    let frame = 0
    const update = () => {
      frame = 0
      const top = stage.getBoundingClientRect().top
      const vh = window.innerHeight
      const progress = Math.min(1, Math.max(0, (vh - top) / (vh * 0.75)))
      stage.style.setProperty('--spread', progress.toFixed(3))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [loading, count])

  // Lightbox arrow keys
  useEffect(() => {
    if (!lightbox) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') next()
      if (event.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, next, prev])

  const current = images[active] ?? null
  if (loading || !current) return null

  const endDrag = () => {
    if (dragStart.current === null) return
    dragStart.current = null
    if (drag < -SWIPE_PX) next()
    else if (drag > SWIPE_PX) prev()
    setDrag(0)
  }

  // The tallest card sets the stage height, so the deck never jumps.
  const minRatio = Math.min(...images.map((img) => ratios[img.id] ?? DEFAULT_RATIO))
  const spacing = narrow ? 42 : 27 // vw between neighbouring cards when fully fanned

  return (
    <section id="gallery" className="scroll-mt-24">
      <ChapterHeader
        eyebrow="Galeri"
        title={<>Galeri <span className="font-serif-accent text-accent">ISMS</span></>}
        meta={`${count} gambar`}
        tone="dark"
      >
        {count > 1 && (
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
            {images.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Tampilkan ${slide.title}`}
                className={`relative h-12 w-20 flex-none overflow-hidden rounded-lg ring-2 transition ${i === active ? 'ring-accent' : 'opacity-55 ring-transparent hover:opacity-100'}`}
              >
                <img src={slideUrl(slide)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </ChapterHeader>

      <div className={`relative overflow-hidden bg-[color:var(--p-900)] ${FULL_BLEED}`}>
        {/* Ambient backdrop: the active image, blurred, crossfading behind the deck */}
        {images.map((slide, i) => (
          <img
            key={slide.id}
            src={slideUrl(slide)}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover blur-3xl transition-opacity duration-1000"
            style={{ opacity: i === active ? 0.28 : 0 }}
          />
        ))}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'linear-gradient(0deg, var(--p-900), transparent)' }} />

        {/* The deck */}
        <div
          ref={stageRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Galeri ISMS"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') next()
            if (event.key === 'ArrowLeft') prev()
            if (event.key === 'Enter') setLightbox(true)
          }}
          onPointerEnter={() => setHovering(true)}
          onPointerLeave={() => { setHovering(false); endDrag() }}
          onPointerDown={(event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return
            dragStart.current = event.clientX
            dragged.current = false
          }}
          onPointerMove={(event) => {
            if (dragStart.current === null) return
            const dx = event.clientX - dragStart.current
            if (Math.abs(dx) > 6) dragged.current = true
            setDrag(dx)
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="relative mx-auto select-none outline-none [touch-action:pan-y]"
          style={{ height: `min(74vh, 720px, calc(84vw / ${minRatio} + 110px))`, cursor: drag ? 'grabbing' : 'grab' }}
        >
          {images.map((slide, i) => {
            const d = offsetOf(i, active, count)
            const distance = Math.abs(d)
            const ratio = ratios[slide.id] ?? DEFAULT_RATIO
            const dragPx = d === 0 ? drag : drag * 0.35
            const scale = distance === 0 ? 1 : distance === 1 ? 0.8 : 0.64
            return (
              <button
                key={slide.id}
                type="button"
                tabIndex={-1}
                aria-label={d === 0 ? `Perbesar ${slide.title}` : `Tampilkan ${slide.title}`}
                onClick={() => {
                  if (dragged.current) return
                  if (d === 0) setLightbox(true)
                  else goTo(i)
                }}
                className="absolute left-1/2 top-1/2 overflow-hidden rounded-2xl bg-card shadow-[0_30px_70px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
                style={{
                  ...cardSize(ratio),
                  zIndex: 10 - distance,
                  opacity: distance === 0 ? 1 : distance === 1 ? 0.8 : distance === 2 ? 0.4 : 0,
                  pointerEvents: distance > 2 ? 'none' : undefined,
                  filter: distance === 0 ? 'none' : 'brightness(0.72) saturate(0.9)',
                  transform: `translate(calc(-50% + var(--spread, 1) * ${d * spacing}vw + ${dragPx}px), calc(-50% + ${distance * 14}px)) rotate(calc(var(--spread, 1) * ${d * 5}deg + ${dragPx * 0.015}deg)) scale(${scale})`,
                  transition: drag !== 0 ? 'opacity 300ms, filter 300ms' : 'transform 800ms cubic-bezier(0.22, 1, 0.36, 1), opacity 500ms, filter 500ms',
                }}
              >
                <img
                  src={slideUrl(slide)}
                  alt={slide.title}
                  draggable={false}
                  className="h-full w-full object-contain"
                  onLoad={(event) => {
                    const r = event.currentTarget.naturalWidth / event.currentTarget.naturalHeight
                    if (Number.isFinite(r) && r > 0) setRatios((prevRatios) => (prevRatios[slide.id] === r ? prevRatios : { ...prevRatios, [slide.id]: r }))
                  }}
                />
                {d === 0 && (
                  <span className="pointer-events-none absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
                    <Maximize className="size-4" />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Caption, progress and controls */}
        <div className="relative mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-4 px-10 pb-10 pt-2 text-primary-foreground max-[900px]:px-6 max-[680px]:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="font-mono text-sm tabular-nums text-accent">{String(active + 1).padStart(2, '0')}</span>
            <span className="font-mono text-sm tabular-nums text-primary-foreground/40">/ {String(count).padStart(2, '0')}</span>
            <span className="truncate text-sm font-semibold">{current.title}</span>
          </div>
          {count > 1 && (
            <div className="order-last h-0.5 w-full overflow-hidden rounded-full bg-white/10 sm:order-none sm:w-48">
              <span
                key={`progress-${active}-${hovering || lightbox || drag !== 0 ? 'paused' : 'run'}`}
                className="block h-full origin-left bg-accent"
                style={{ animation: hovering || lightbox || drag !== 0 ? 'none' : `progress-fill ${ROTATE_MS}ms linear forwards`, transform: hovering || lightbox || drag !== 0 ? 'scaleX(0)' : undefined }}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            {count > 1 && (
              <>
                <button type="button" onClick={prev} aria-label="Gambar sebelumnya" className="grid size-10 place-items-center rounded-full border border-white/20 text-white transition hover:bg-white/10"><ChevronLeft className="size-5" /></button>
                <button type="button" onClick={next} aria-label="Gambar berikutnya" className="grid size-10 place-items-center rounded-full border border-white/20 text-white transition hover:bg-white/10"><ChevronRight className="size-5" /></button>
              </>
            )}
            <button type="button" onClick={() => setLightbox(true)} aria-label="Perbesar gambar galeri" className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground transition hover:scale-105"><Maximize className="size-4" /></button>
          </div>
        </div>
      </div>

      {/* Full-screen viewer */}
      {lightbox && (
        <div role="dialog" aria-modal="true" aria-label={current.title} className="fixed inset-0 z-[60] bg-black/95" onClick={() => setLightbox(false)}>
          <img src={slideUrl(current)} alt={current.title} className="absolute inset-0 h-full w-full object-contain" onClick={(event) => event.stopPropagation()} />
          <button type="button" onClick={() => setLightbox(false)} aria-label="Tutup" className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25"><X className="size-5" /></button>
          {count > 1 && (
            <>
              <button type="button" onClick={(event) => { event.stopPropagation(); prev() }} aria-label="Gambar sebelumnya" className="absolute left-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25"><ChevronLeft className="size-6" /></button>
              <button type="button" onClick={(event) => { event.stopPropagation(); next() }} aria-label="Gambar berikutnya" className="absolute right-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25"><ChevronRight className="size-6" /></button>
              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 font-mono text-xs text-white backdrop-blur-sm">{active + 1} / {count}</span>
            </>
          )}
        </div>
      )}
    </section>
  )
}
