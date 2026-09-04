// app/kebijakan-dasar-ISMS/page.tsx

'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImagePlus,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { ConfirmDialog } from '@/components/confirm-dialog'

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
  const pointerStart = useRef<number | null>(null)
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
    }

    event.target.value = ''
  }

  async function confirmRemoveImage() {
    if (!removingImage) return
    setRemovePending(true)

    const response = await fetch(`${API_BASE_PATH}/api/policy-images`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: removingImage.id }),
    })

    if (response.ok) {
      setImages((current) => current.filter((image) => image.id !== removingImage.id))
      setActiveIndex((current) => Math.max(0, Math.min(current, images.length - 2)))
    }

    setRemovePending(false)
    setRemovingImage(null)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointerStart.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerStart.current === null) return
    const distance = event.clientX - pointerStart.current
    if (Math.abs(distance) > 40) moveImage(distance < 0 ? 1 : -1)
    pointerStart.current = null
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
            <Sparkles className="size-3.5" /> Information security policy
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Kebijakan Dasar ISMS</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">Visual kebijakan keamanan informasi PT. Jatim Autocomp Indonesia — dikelola oleh Information Security Committee.</p>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <article className="min-w-0 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-9 lg:p-11">
        <div
          className="relative aspect-[2.65] min-h-40 w-full overflow-hidden rounded-xl border border-border bg-muted/35 shadow-inner"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          {activeImage && (
            <button
              type="button"
              onClick={() => setIsImageOpen(true)}
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
                className="absolute left-3 top-1/2 z-20 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-foreground shadow-md transition hover:scale-105 hover:bg-background active:scale-95"
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
                className="absolute right-3 top-1/2 z-20 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-foreground shadow-md transition hover:scale-105 hover:bg-background active:scale-95"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}

          {isLoggedIn && activeImage && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setRemovingImage(activeImage)
              }}
              aria-label="Hapus gambar policy"
              className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-foreground/85 text-background"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </article>

      <aside className="flex h-fit flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-accent/15 text-accent-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <strong className="block text-sm text-foreground">Policy owner</strong>
            <span className="text-xs text-muted-foreground">Information Security Committee</span>
          </div>
        </div>

        <div className="mt-2 border-t border-border pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <strong className="block text-sm text-foreground">Policy visual</strong>
              <span className="text-xs text-muted-foreground">{images.length} gambar</span>
            </div>
            <ImagePlus className="size-5 text-muted-foreground" />
          </div>

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
      </aside>

      {isImageOpen && activeImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Preview gambar policy"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 p-4"
          onClick={() => setIsImageOpen(false)}
        >
          <div
            className="relative max-h-[92vh] w-full max-w-6xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={activeImage.url}
              alt="Policy visual"
              width={1600}
              height={1000}
              unoptimized
              className="max-h-[88vh] w-full rounded-xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setIsImageOpen(false)}
              aria-label="Tutup preview gambar"
              className="absolute right-2 top-2 grid size-10 place-items-center rounded-full bg-background/90 text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}
      </section>

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