// app/kebijakan-dasar-ISMS/page.tsx

'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  GalleryHorizontal,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ManifestoHero } from '@/components/page-hero'
import { API_BASE_PATH } from '@/lib/config'
import { ConfirmDialog } from '@/components/confirm-dialog'

// Breaks the image out of <main>'s centered max-width/padding so it spans the
// full browser width edge-to-edge, matching the Home hero's full-bleed treatment.
const FULL_BLEED = 'w-screen ml-[calc(50%-50vw)]'

// "kebijakan_keamanan-informasi.png" → "kebijakan keamanan informasi". Names
// that are really upload IDs (UUID/hash runs like "b44b6ce3-6ae2-…") or
// camera defaults ("IMG_2031") fall back to "Visual Kebijakan 01".
function policyTitle(fileName: string, index: number) {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '').replace(/\s*\(\d+\)$/, '')
  const title = base.replace(/[-_]+/g, ' ').trim()
  const meaningless = !title || /[0-9a-f]{8}/i.test(base) || /^(img|dsc|image|screenshot|whatsapp image)\b/i.test(title)
  return meaningless ? `Visual Kebijakan ${String(index + 1).padStart(2, '0')}` : title
}

type PolicyImage = {
  id: number
  url: string
  file_name: string
  file_path?: string
}

export default function PolicyPage() {
  const { isLoggedIn } = useAuth()
  const [images, setImages] = useState<PolicyImage[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isImageOpen, setIsImageOpen] = useState(false)
  const [removingImage, setRemovingImage] = useState<PolicyImage | null>(null)
  const [removePending, setRemovePending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragPx, setDragPx] = useState(0)
  const pointerStart = useRef<number | null>(null)
  const justSwiped = useRef(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const activeImage = images[activeIndex]

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/policy-images`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setImages(data.images ?? []))
      .catch(() => setImages([]))
  }, [])

  useEffect(() => {
    if (images.length < 2) return
    const timer = window.setInterval(() => {
      if (pointerStart.current !== null) return // mid-drag
      setActiveIndex((current) => (current + 1) % images.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [images.length])

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsImageOpen(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])

  function moveImage(direction: 1 | -1) {
    if (images.length > 1) {
      setActiveIndex((current) => (current + direction + images.length) % images.length)
    }
  }

  async function handleImages(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith('image/')
    )
    if (!files.length) return

    const form = new FormData()
    files.forEach((file) => form.append('files', file))

    setError(null)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/policy-images`, {
        method: 'POST',
        body: form,
      })

      if (response.ok) {
        const data = await response.json()
        setImages((current) => [
          ...current,
          ...(data.images ?? []).map((image: PolicyImage) => ({
            ...image,
            url: `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(image.file_path ?? '')}`,
          })),
        ])
      } else {
        const data = await response.json().catch(() => ({}))
        setError(data.message ?? 'Gagal mengunggah gambar.')
      }
    } catch {
      setError('Tidak dapat menghubungi server.')
    }

    event.target.value = ''
  }

  async function confirmRemoveImage() {
    if (!removingImage) return
    setRemovePending(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_PATH}/api/policy-images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: removingImage.id }),
      })

      if (response.ok) {
        setImages((current) => current.filter((image) => image.id !== removingImage.id))
        setActiveIndex((current) => Math.max(0, Math.min(current, images.length - 2)))
      } else {
        const data = await response.json().catch(() => ({}))
        setError(data.message ?? 'Gagal menghapus gambar.')
      }
    } catch {
      setError('Tidak dapat menghubungi server.')
    }

    setRemovePending(false)
    setRemovingImage(null)
  }

  // Drag to change image (motionsites "Lunar Carousel"): the slides follow the
  // pointer live, tilting in 3D, and settle on release. No pointer capture
  // here — capturing the pointer on the container used to swallow clicks on
  // the buttons inside it (the delete X never fired).
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointerStart.current = event.clientX
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerStart.current === null || images.length < 2) return
    setDragPx(event.clientX - pointerStart.current)
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerStart.current === null) return
    const distance = event.clientX - pointerStart.current
    justSwiped.current = Math.abs(distance) > 40
    if (justSwiped.current) moveImage(distance < 0 ? 1 : -1)
    pointerStart.current = null
    setDragPx(0)
  }

  // Slide i's position relative to the active one, wrapped so the carousel
  // is circular, plus the live drag as a fraction of the stage width.
  function slideOffset(i: number) {
    const count = images.length
    let d = i - activeIndex
    if (count > 2) {
      if (d > count / 2) d -= count
      if (d < -count / 2) d += count
    }
    const width = stageRef.current?.offsetWidth || 1
    return d + dragPx / width
  }

  return (
    <div className="flex flex-col gap-6">
      <ManifestoHero />

      {/* Full-bleed image — spans the full browser width like the Home hero, so nothing
          feels boxed-in. object-contain (never object-cover) keeps the whole image
          visible with no cropping/distortion; the backdrop is a soft gradient using
          the page's own background tokens (not a colored blur or flat white) so any
          letterboxing blends with the page instead of standing out as its own box. */}
      <div
        ref={stageRef}
        className={`relative touch-pan-y select-none overflow-hidden [perspective:1600px] ${FULL_BLEED} h-[70vh] min-h-[420px] max-h-[780px] ${images.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ background: 'linear-gradient(180deg, var(--card) 0%, var(--background) 55%, var(--muted) 100%)' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={(event) => { if (pointerStart.current !== null) handlePointerUp(event) }}
      >
        {images.map((image, i) => {
          const f = slideOffset(i)
          const distance = Math.abs(f)
          if (distance >= 1.9) return null
          const isActive = i === activeIndex
          return (
            <div
              key={image.id}
              className={`absolute inset-x-0 top-0 ${images.length > 1 ? "bottom-[76px]" : "bottom-0"}`}
              style={{
                transform: `translateX(${f * 100}%) rotateY(${f * -24}deg) scale(${1 - Math.min(1, distance) * 0.18})`,
                opacity: Math.max(0, 1 - distance * 0.7),
                zIndex: 10 - Math.round(distance * 5),
                transition: dragPx !== 0 ? 'none' : 'transform 0.9s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.9s ease',
                pointerEvents: isActive ? 'auto' : 'none',
              }}
              aria-hidden={!isActive}
            >
              <button
                type="button"
                tabIndex={isActive ? 0 : -1}
                onClick={() => {
                  // A swipe ends with a click on this same button — don't open the preview for it.
                  if (justSwiped.current) { justSwiped.current = false; return }
                  setIsImageOpen(true)
                }}
                className="absolute inset-0 cursor-zoom-in"
                aria-label="Perbesar gambar policy"
              >
                <Image src={image.url} alt="Policy visual" fill unoptimized draggable={false} className="object-contain" />
              </button>
            </div>
          )
        })}

        {activeImage && images.length > 1 && (
          <div className="pointer-events-none absolute bottom-0 left-0 z-20 flex h-[76px] max-w-[55%] flex-col justify-center px-4 sm:px-8">
            <p className="font-mono-label text-[10px] text-muted-foreground">
              <span className="text-[color:var(--p-600)]">P/{String(activeIndex + 1).padStart(2, '0')}</span> <span className="text-border">/</span> {String(images.length).padStart(2, '0')}
            </p>
            <p key={activeImage.id} className="lunar-title mt-1 truncate font-display text-[clamp(1rem,1.6vw,1.35rem)] font-semibold leading-tight text-foreground">
              {policyTitle(activeImage.file_name, activeIndex)}
            </p>
          </div>
        )}

        {!activeImage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <div className="grid size-16 place-items-center rounded-2xl bg-muted">
              <GalleryHorizontal className="size-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Belum ada gambar kebijakan.</p>
            {isLoggedIn && (
              <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                <Upload className="size-4" /> Tambah gambar
                <input type="file" accept="image/*" multiple onChange={handleImages} className="sr-only" />
              </label>
            )}
          </div>
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                moveImage(-1)
              }}
              aria-label="Gambar sebelumnya"
              className="absolute left-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-foreground shadow-md transition hover:scale-105 hover:bg-background active:scale-95 sm:left-5"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                moveImage(1)
              }}
              aria-label="Gambar berikutnya"
              className="absolute right-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-foreground shadow-md transition hover:scale-105 hover:bg-background active:scale-95 sm:right-5"
            >
              <ChevronRight className="size-5" />
            </button>
            {/* Thumbnail strip (dots on phones) */}
            <div
              className="absolute bottom-[14px] right-4 z-20 flex max-w-[40%] items-center gap-2 overflow-x-auto p-1 max-[680px]:hidden sm:right-8"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
            >
              {images.map((image, i) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={(event) => { event.stopPropagation(); setActiveIndex(i) }}
                  aria-label={`Gambar ${i + 1}`}
                  aria-current={i === activeIndex}
                  className={`relative h-10 w-14 flex-none overflow-hidden rounded-md transition-all duration-300 ${i === activeIndex ? 'ring-2 ring-[color:var(--p-600)] ring-offset-1 ring-offset-background' : 'opacity-55 grayscale hover:opacity-100 hover:grayscale-0'}`}
                >
                  <Image src={image.url} alt="" fill unoptimized draggable={false} className="object-cover" />
                </button>
              ))}
            </div>
            <div className="absolute bottom-[34px] right-4 z-20 hidden items-center gap-1.5 max-[680px]:flex">
              {images.map((image, i) => (
                <button
                  key={image.id}
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={(event) => { event.stopPropagation(); setActiveIndex(i) }}
                  aria-label={`Gambar ${i + 1}`}
                  className={`h-1.5 rounded-full shadow-sm transition-all duration-300 ${i === activeIndex ? 'w-6 bg-primary' : 'w-1.5 bg-foreground/25'}`}
                />
              ))}
            </div>
          </>
        )}

        {isLoggedIn && activeImage && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setRemovingImage(activeImage)
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            aria-label="Hapus gambar policy"
            className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-destructive px-3.5 py-2 text-xs font-semibold text-white shadow-md transition hover:scale-105 hover:opacity-90 active:scale-95 sm:right-5 sm:top-5"
          >
            <Trash2 className="size-3.5" /> Hapus gambar ini
          </button>
        )}
      </div>

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {/* Policy index (motionsites "Sentinel"): mono header row, then one
          numbered card per policy visual. Thumbnails sit in a halftone
          monochrome (.sentinel-thumb in globals.css) and come to full colour
          on hover or when shown above. Admins also get a delete per card. */}
      <section className="border-t border-foreground/80 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-4 font-mono-label text-[10.5px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-[color:var(--p-600)]" />
            Information Security Committee <span className="text-border">/</span>
            <span className="text-foreground">{String(images.length).padStart(2, '0')} visual kebijakan</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/#gallery"
              className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-[10.5px] text-foreground transition-colors hover:bg-secondary"
            >
              <GalleryHorizontal className="size-3.5" /> Gallery di Home
            </Link>
            {isLoggedIn && (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-3.5 py-2 text-[10.5px] text-primary-foreground transition-opacity hover:opacity-90">
                <Upload className="size-3.5" /> Tambah gambar
                <input type="file" accept="image/*" multiple onChange={handleImages} className="sr-only" />
              </label>
            )}
          </div>
        </div>

        {images.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image, i) => {
              const active = i === activeIndex
              return (
                <div key={image.id} className={`sentinel-card group relative flex flex-col bg-card ${active ? 'is-active' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    aria-label={`Tampilkan ${policyTitle(image.file_name, i)}`}
                    aria-pressed={active}
                    className="flex flex-1 flex-col p-4 text-left"
                  >
                    <span className="flex items-center justify-between font-mono-label text-[10px]">
                      <span className={active ? 'text-[color:var(--p-600)]' : 'text-muted-foreground'}>P/{String(i + 1).padStart(2, '0')}</span>
                      <span className={`size-1.5 rounded-full transition-colors ${active ? 'bg-[color:var(--p-600)]' : 'bg-border'}`} />
                    </span>
                    <span className="sentinel-thumb relative mt-3 block aspect-[4/3] w-full overflow-hidden bg-muted">
                      <Image src={image.url} alt="" fill unoptimized className="object-cover" />
                    </span>
                    <span className="mt-3 line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">{policyTitle(image.file_name, i)}</span>
                  </button>
                  {isLoggedIn && (
                    <button
                      type="button"
                      onClick={() => setRemovingImage(image)}
                      aria-label={`Hapus ${image.file_name}`}
                      title="Hapus gambar"
                      className="absolute right-3 top-[3.1rem] z-10 grid size-8 place-items-center rounded-full bg-card/90 text-muted-foreground shadow-sm transition hover:bg-destructive hover:text-white"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                  <span aria-hidden className={`absolute inset-x-0 bottom-0 h-[3px] origin-left bg-[color:var(--p-600)] transition-transform duration-500 ${active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
                </div>
              )
            })}
          </div>
        )}
      </section>

      {isImageOpen && activeImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Preview gambar policy"
          className="fixed inset-0 z-50 bg-black"
          onClick={() => setIsImageOpen(false)}
        >
          <Image
            src={activeImage.url}
            alt="Policy visual"
            fill
            unoptimized
            className="object-contain"
          />
          <button
            type="button"
            onClick={() => setIsImageOpen(false)}
            aria-label="Tutup preview gambar"
            className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            <X className="size-5" />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!removingImage}
        title="Hapus gambar policy?"
        message="Gambar ini akan dihapus permanen dari carousel kebijakan. Tindakan ini tidak dapat dibatalkan."
        pending={removePending}
        onConfirm={confirmRemoveImage}
        onCancel={() => setRemovingImage(null)}
      />
    </div>
  )
}