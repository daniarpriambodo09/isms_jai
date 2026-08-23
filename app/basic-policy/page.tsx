'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, ImagePlus, ShieldCheck, Upload, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

type PolicyImage = { url: string; name: string }

export default function PolicyPage() {
  const { isLoggedIn } = useAuth()
  const [images, setImages] = useState<PolicyImage[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isImageOpen, setIsImageOpen] = useState(false)
  const pointerStart = useRef<number | null>(null)
  const activeImage = images[activeIndex]

  useEffect(() => {
    if (images.length < 2) return
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % images.length), 5000)
    return () => window.clearInterval(timer)
  }, [images.length])

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsImageOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  function handleImages(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'))
    if (!files.length) return
    setImages((current) => [...current, ...files.map((file) => ({ url: URL.createObjectURL(file), name: file.name }))])
    event.target.value = ''
  }

  function removeImage(index: number) {
    const image = images[index]
    if (image) URL.revokeObjectURL(image.url)
    setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))
    setActiveIndex((current) => Math.max(0, Math.min(current, images.length - 2)))
  }

  function moveImage(direction: 1 | -1) {
    setActiveIndex((current) => (current + direction + images.length) % images.length)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointerStart.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerStart.current === null || images.length < 2) return
    const distance = event.clientX - pointerStart.current
    if (Math.abs(distance) > 40) moveImage(distance < 0 ? 1 : -1)
    pointerStart.current = null
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <article className="min-w-0 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-9 lg:p-11">
        <div className="relative mt-5 aspect-[2.65] min-h-40 w-full overflow-hidden rounded-xl border border-border bg-muted/35 shadow-inner sm:min-h-52" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
          {activeImage && <button type="button" onClick={() => setIsImageOpen(true)} className="absolute inset-0 cursor-zoom-in" aria-label="Perbesar gambar policy"><Image src={activeImage.url} alt="Policy visual" fill unoptimized className="object-contain transition duration-300 hover:scale-[1.02]" /></button>}
          {images.length > 1 && <><button type="button" onClick={() => moveImage(-1)} aria-label="Gambar sebelumnya" className="absolute left-3 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-background/85 text-foreground shadow-sm transition hover:bg-background"><ChevronLeft className="size-5" /></button><button type="button" onClick={() => moveImage(1)} aria-label="Gambar berikutnya" className="absolute right-3 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-background/85 text-foreground shadow-sm transition hover:bg-background"><ChevronRight className="size-5" /></button></>}
          {isLoggedIn && activeImage && <button type="button" onClick={(event) => { event.stopPropagation(); removeImage(activeIndex) }} aria-label="Hapus gambar policy" className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-foreground/85 text-background shadow-sm transition hover:bg-foreground"><X className="size-4" /></button>}
        </div>
      </article>

      <aside className="flex h-fit flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-lg bg-accent/15 text-accent-foreground"><ShieldCheck className="size-5" /></div><div><strong className="block text-sm text-foreground">Policy owner</strong><span className="text-xs text-muted-foreground">Information Security Committee</span></div></div>
        <div className="flex flex-col gap-1 border-t border-border pt-4"><span className="text-xs text-muted-foreground">Last reviewed</span><strong className="text-sm text-foreground">12 February 2025</strong></div>
        <button type="button" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"><Download className="size-4" /> Download PDF</button>
        <div className="mt-2 border-t border-border pt-4"><div className="mb-3 flex items-center justify-between"><div><strong className="block text-sm text-foreground">Policy visual</strong><span className="text-xs text-muted-foreground">{images.length} gambar</span></div><ImagePlus className="size-5 text-muted-foreground" /></div>{isLoggedIn && <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><Upload className="size-4" /> Tambah gambar<input type="file" accept="image/*" multiple onChange={handleImages} className="sr-only" /></label>}{!isLoggedIn && <p className="text-center text-xs text-muted-foreground">Login admin untuk mengubah gambar.</p>}</div>
      </aside>

      {isImageOpen && activeImage && <div role="dialog" aria-modal="true" aria-label="Preview gambar policy" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 p-4 backdrop-blur-sm" onClick={() => setIsImageOpen(false)}><div className="relative max-h-[92vh] w-full max-w-6xl" onClick={(event) => event.stopPropagation()}><Image src={activeImage.url} alt="Policy visual" width={1600} height={1000} unoptimized className="max-h-[88vh] w-full rounded-xl object-contain shadow-2xl" /><button type="button" onClick={() => setIsImageOpen(false)} aria-label="Tutup preview gambar" className="absolute right-2 top-2 grid size-10 place-items-center rounded-full bg-background/90 text-foreground shadow-lg transition hover:bg-background"><X className="size-5" /></button></div></div>}
    </section>
  )
}
