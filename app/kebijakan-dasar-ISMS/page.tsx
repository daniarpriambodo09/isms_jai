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
  const pointerStart = useRef<number | null>(null)
  const justSwiped = useRef(false)
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

  // Swipe to change image. No pointer capture here — capturing the pointer on
  // the container used to swallow clicks on the buttons inside it (the delete
  // X never fired).
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointerStart.current = event.clientX
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerStart.current === null) return
    const distance = event.clientX - pointerStart.current
    justSwiped.current = Math.abs(distance) > 40
    if (justSwiped.current) moveImage(distance < 0 ? 1 : -1)
    pointerStart.current = null
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
        className={`relative overflow-hidden ${FULL_BLEED} h-[70vh] min-h-[420px] max-h-[780px]`}
        style={{ background: 'linear-gradient(180deg, var(--card) 0%, var(--background) 55%, var(--muted) 100%)' }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {activeImage && (
          <button
            type="button"
            onClick={() => {
              // A swipe ends with a click on this same button — don't open the preview for it.
              if (justSwiped.current) { justSwiped.current = false; return }
              setIsImageOpen(true)
            }}
            className="absolute inset-0 cursor-zoom-in"
            aria-label="Perbesar gambar policy"
          >
            <Image
              src={activeImage.url}
              alt="Policy visual"
              fill
              unoptimized
              className="object-contain"
            />
          </button>
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
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 sm:bottom-6 sm:right-8">
              {images.map((image, i) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={(event) => { event.stopPropagation(); setActiveIndex(i) }}
                  aria-label={`Gambar ${i + 1}`}
                  className={`h-1.5 rounded-full shadow-sm transition-all duration-300 ${i === activeIndex ? 'w-6 bg-primary' : 'w-1.5 bg-foreground/25 hover:bg-foreground/50'}`}
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

      {/* Slim control bar — one row instead of a separate boxed sidebar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid size-10 flex-shrink-0 place-items-center rounded-lg bg-accent/15 text-accent-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <strong className="block text-sm text-foreground">Information Security Committee</strong>
            <span className="text-xs text-muted-foreground">{images.length} gambar kebijakan</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/#gallery"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            <GalleryHorizontal className="size-4" /> Lihat Gallery di Home
          </Link>
          {isLoggedIn && (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
              <Upload className="size-4" /> Tambah gambar
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImages}
                className="sr-only"
              />
            </label>
          )}
        </div>
      </div>

      {/* Admin — every uploaded image with its own delete button */}
      {isLoggedIn && images.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="portal-eyebrow">Kelola gambar</p>
              <p className="mt-1 text-sm text-muted-foreground">Klik gambar untuk menampilkannya di atas, atau hapus yang tidak dipakai lagi.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {images.map((image, i) => (
              <div
                key={image.id}
                className={`group overflow-hidden rounded-lg border bg-background transition ${i === activeIndex ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}
              >
                <button type="button" onClick={() => setActiveIndex(i)} className="relative block aspect-[4/3] w-full bg-muted" aria-label={`Tampilkan gambar ${i + 1}`}>
                  <Image src={image.url} alt={image.file_name} fill unoptimized className="object-contain" />
                  <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[10px] text-white">{String(i + 1).padStart(2, '0')}</span>
                </button>
                <div className="flex items-center gap-2 border-t border-border px-2.5 py-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={image.file_name}>{image.file_name}</span>
                  <button
                    type="button"
                    onClick={() => setRemovingImage(image)}
                    aria-label={`Hapus ${image.file_name}`}
                    title="Hapus gambar"
                    className="grid size-7 flex-none place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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