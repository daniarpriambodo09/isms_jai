'use client'

// Every page of a PDF stacked in one scrolling column (like a PDF reader),
// each with an overlay layer for whatever the caller places on it — QR
// boxes in the placement editor, markers in the revision notes. Pages are
// drawn lazily as they near the viewport and redrawn when the width changes.
// The page closest to the top third of the view is reported as "current".

import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode, type RefObject } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

// Height/width of every page as displayed (rotation applied).
export async function loadPageRatios(pdf: PDFDocumentProxy): Promise<number[]> {
  const ratios: number[] = []
  for (let i = 0; i < pdf.numPages; i++) {
    const vp = (await pdf.getPage(i + 1)).getViewport({ scale: 1 })
    ratios.push(vp.height / vp.width)
  }
  return ratios
}

const MAX_CANVAS_WIDTH = 3200
// Width of the page column at 100%.
const BASE_WIDTH = 760

function PageCanvas({ pdf, index, root }: { pdf: PDFDocumentProxy; index: number; root: RefObject<HTMLDivElement | null> }) {
  const holderRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(false)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = holderRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setNear(true) }, { root: root.current, rootMargin: '900px 0px' })
    io.observe(el)
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => { io.disconnect(); ro.disconnect() }
  }, [root])

  useEffect(() => {
    if (!near || !width || !canvasRef.current) return
    let cancelled = false
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null
    const timer = window.setTimeout(async () => {
      const page = await pdf.getPage(index + 1)
      if (cancelled) return
      const base = page.getViewport({ scale: 1 })
      // Sharp on dense screens, but never a canvas wider than MAX_CANVAS_WIDTH (zoomed-in pages).
      const pixelWidth = Math.min(width * Math.min(window.devicePixelRatio || 1, 2), MAX_CANVAS_WIDTH)
      const viewport = page.getViewport({ scale: pixelWidth / base.width })
      const canvas = canvasRef.current!
      canvas.width = viewport.width
      canvas.height = viewport.height
      task = page.render({ canvasContext: canvas.getContext('2d')!, viewport })
      await task.promise.catch(() => {})
    }, 60)
    return () => { cancelled = true; window.clearTimeout(timer); task?.cancel() }
  }, [near, width, pdf, index])

  return (
    <div ref={holderRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}

export function PdfPages({
  pdf,
  ratios,
  scrollRef,
  pageRefs,
  onCurrentPage,
  renderOverlay,
  pageProps,
  zoom = 1,
}: {
  pdf: PDFDocumentProxy
  ratios: number[]
  /** The scrolling container these pages live in. */
  scrollRef: RefObject<HTMLDivElement | null>
  /** Filled with each page's element (for coordinates and scrolling to a page). */
  pageRefs: React.MutableRefObject<(HTMLDivElement | null)[]>
  onCurrentPage?: (index: number) => void
  renderOverlay: (index: number) => ReactNode
  pageProps?: (index: number) => HTMLAttributes<HTMLDivElement>
  /** 1 = fits the container (up to 760px); above that the column grows and the container scrolls sideways. */
  zoom?: number
}) {
  const report = useCallback(() => {
    const root = scrollRef.current
    if (!root || !onCurrentPage) return
    const probe = root.getBoundingClientRect().top + root.clientHeight / 3
    let best = 0
    pageRefs.current.forEach((el, i) => {
      if (el && el.getBoundingClientRect().top <= probe) best = i
    })
    onCurrentPage(best)
  }, [scrollRef, pageRefs, onCurrentPage])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    let frame = 0
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; report() }) }
    root.addEventListener('scroll', onScroll, { passive: true })
    report()
    return () => { root.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame) }
  }, [scrollRef, report])

  return (
    <div className="mx-auto flex flex-col gap-3" style={{ width: `${zoom * 100}%`, maxWidth: BASE_WIDTH * zoom }}>
      {ratios.map((ratio, i) => {
        const extra = pageProps?.(i) ?? {}
        return (
          <div key={i}>
            <p className="mb-1.5 text-center font-mono text-[10.5px] text-muted-foreground">Halaman {i + 1} / {ratios.length}</p>
            <div
              {...extra}
              ref={(el) => { pageRefs.current[i] = el }}
              className={`relative w-full select-none bg-white shadow-lg ${extra.className ?? ''}`}
              style={{ aspectRatio: `1 / ${ratio}`, ...extra.style }}
            >
              <PageCanvas pdf={pdf} index={i} root={scrollRef} />
              {renderOverlay(i)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Scrolls the container so a spot on a page (y = fraction of its height)
// sits in the middle of the view.
export function scrollToSpot(scrollRef: RefObject<HTMLDivElement | null>, pageRefs: React.MutableRefObject<(HTMLDivElement | null)[]>, index: number, y: number) {
  const root = scrollRef.current
  const el = pageRefs.current[index]
  if (!root || !el) return
  const r = el.getBoundingClientRect()
  const top = r.top - root.getBoundingClientRect().top + root.scrollTop + y * r.height - root.clientHeight / 2
  root.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

// Scrolls the container so page `index` starts at its top.
export function scrollToPage(scrollRef: RefObject<HTMLDivElement | null>, pageRefs: React.MutableRefObject<(HTMLDivElement | null)[]>, index: number, smooth = true) {
  const root = scrollRef.current
  const el = pageRefs.current[index]
  if (!root || !el) return
  const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 28
  root.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
}
