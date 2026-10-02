// components/image-zoom-viewer.tsx
//
// Full-screen image viewer with zoom: policy visuals and schedules are wide
// pages of small text, unreadable on a phone at "fit to screen". Opens fitted;
// + / − (or a double tap / double click) zoom in up to 5×, then the image
// pans by scrolling or dragging a finger. Escape or the X closes it.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Minus, Plus, RotateCcw, X } from 'lucide-react'
import { useEscapeClose } from '@/hooks/useEscapeClose'

const STEPS = [1, 1.5, 2, 3, 4, 5]

export function ImageZoomViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [zoom, setZoom] = useState(1)
  // Width in px at which the whole image fits the viewing area.
  const [fitWidth, setFitWidth] = useState<number | null>(null)

  useEscapeClose(true, onClose)

  const measure = useCallback(() => {
    const area = scrollRef.current
    const img = imgRef.current
    if (!area || !img || !img.naturalWidth) return
    const scale = Math.min(area.clientWidth / img.naturalWidth, area.clientHeight / img.naturalHeight)
    setFitWidth(Math.max(1, Math.floor(img.naturalWidth * scale)))
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('resize', measure); document.body.style.overflow = previousOverflow }
  }, [measure])

  // Keep the middle of the picture in the middle of the screen when the zoom changes.
  useEffect(() => {
    const area = scrollRef.current
    if (!area) return
    area.scrollLeft = (area.scrollWidth - area.clientWidth) / 2
    area.scrollTop = (area.scrollHeight - area.clientHeight) / 2
  }, [zoom, fitWidth])

  const step = (direction: 1 | -1) => setZoom((current) => {
    const index = STEPS.findIndex((value) => value >= current)
    return STEPS[Math.min(STEPS.length - 1, Math.max(0, index + direction))]
  })

  const button = 'grid size-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-35'

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={alt} className="modal-backdrop fixed inset-0 z-[80] flex flex-col bg-black">
      <div className="flex flex-none items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
        <p className="min-w-0 truncate text-sm text-white/80">{alt}</p>
        <div className="flex flex-none items-center gap-1.5">
          <button type="button" onClick={() => step(-1)} disabled={zoom <= 1} aria-label="Perkecil" className={button}><Minus className="size-4" /></button>
          <span className="w-12 text-center font-mono text-xs tabular-nums text-white/80">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => step(1)} disabled={zoom >= STEPS[STEPS.length - 1]} aria-label="Perbesar" className={button}><Plus className="size-4" /></button>
          <button type="button" onClick={() => setZoom(1)} disabled={zoom === 1} aria-label="Ukuran pas layar" title="Pas layar" className={button}><RotateCcw className="size-4" /></button>
          <button type="button" onClick={onClose} aria-label="Tutup" className={`${button} ml-1.5`}><X className="size-5" /></button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-auto ${zoom > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
        onDoubleClick={() => setZoom((current) => (current > 1 ? 1 : 2.5))}
        onClick={(event) => { if (event.target === event.currentTarget && zoom === 1) onClose() }}
      >
        <div className="grid min-h-full w-max min-w-full place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            draggable={false}
            onLoad={measure}
            className="block max-w-none select-none"
            style={fitWidth ? { width: Math.round(fitWidth * zoom), height: 'auto' } : { maxWidth: '100%', maxHeight: '100%' }}
          />
        </div>
      </div>

      <p className="flex-none px-4 pb-3 pt-2 text-center text-[11px] text-white/45">
        Ketuk dua kali atau tekan + untuk memperbesar, lalu geser untuk melihat bagian lain.
      </p>
    </div>,
    document.body
  )
}
