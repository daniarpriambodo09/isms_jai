'use client'

// "Minta Revisi" notes on a procedure document, in two modes:
//
// - edit (approver, from the /pengesahan page): two kinds of marks, made
//   straight on the page —
//     · strike: drag across the words to cross them out, the way it is done
//       on a hardcopy, then write what to put instead (leave it empty when
//       the words simply have to go);
//     · marker: click once to drop a numbered marker and write what needs
//       fixing there.
//   Marks can be moved (a strike also by its two ends) or removed; plus one
//   general note. Nothing is signed.
// - view (ISM Admin from the register, and approvers of the resubmitted
//   document): the same marks and notes, read-only — click a note to jump
//   to its spot.
//
// Positions are fractions (0–1) of the page as displayed, top-left origin,
// like the QR placement editor. A strike runs from (x, y) to (x2, y2).
//
// view + compare: the file the marks were made on and a later file side by
// side (one at a time on a phone), scrolling together — to see what changed.

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { ChevronLeft, ChevronRight, Hand, Loader2, MapPin, MessageSquareText, Send, Strikethrough, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { loadPdfJs } from '@/lib/pdfjs-loader'
import { PdfPages, loadPageRatios, scrollToPage, scrollToSpot } from '@/components/documents/PdfPages'
import { useEscapeClose } from '@/hooks/useEscapeClose'

export type RevisionPin = { page: number; x: number; y: number; note: string; x2?: number | null; y2?: number | null }
type Pin = RevisionPin & { key: string }
type Strike = Pin & { x2: number; y2: number }
type Line = { page: number; x: number; y: number; x2: number; y2: number }

const isStrike = (pin: RevisionPin): pin is RevisionPin & { x2: number; y2: number } => typeof pin.x2 === 'number' && typeof pin.y2 === 'number'

const PIN_COLOR = '#d6452f'
const MAX_MARKS = 30
// A drag shorter than this (px) is a click, not a strike.
const DRAG_START = 5
const MIN_STRIKE = 10
// Small print needs enlarging before single words can be struck.
const ZOOM_STEPS = [1, 1.5, 2, 2.5]
let keySeq = 0
const newKey = () => `pin-${Date.now().toString(36)}-${(keySeq++).toString(36)}`
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1)

async function loadPdf(filePath: string, token?: string) {
  const pdfjs = await loadPdfJs()
  const file = await fetch(`${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(filePath)}${token ? `&token=${encodeURIComponent(token)}` : ''}`)
  if (!file.ok) throw new Error('File PDF tidak dapat dimuat.')
  const loaded = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  return { pdf: loaded, ratios: await loadPageRatios(loaded) }
}

// Label strip on top of each side of a comparison.
function PaneLabel({ tone, children }: { tone: 'before' | 'after'; children: React.ReactNode }) {
  return (
    <p className={`flex-none truncate border-b px-3 py-1.5 text-[11px] font-semibold ${tone === 'before' ? 'border-[#c2412c]/25 bg-[#fdf0ec] text-[#a83522]' : 'border-emerald-600/25 bg-emerald-50 text-emerald-800'}`}>
      {children}
    </p>
  )
}

// The later file of a comparison, plain; its scroll follows `partner` (and
// leads it) in proportion, so both sides show the same part of the document.
function ComparePane({ filePath, token, zoom, partner, label }: { filePath: string; token?: string; zoom: number; partner: RefObject<HTMLDivElement | null>; label: string }) {
  const [doc, setDoc] = useState<{ pdf: PDFDocumentProxy; ratios: number[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    let cancelled = false
    loadPdf(filePath, token).then((d) => { if (!cancelled) setDoc(d) }).catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Gagal memuat dokumen.') })
    return () => { cancelled = true }
  }, [filePath, token])

  useEffect(() => {
    const a = partner.current
    const b = scrollRef.current
    if (!a || !b || !doc) return
    // Whichever side the reader scrolls leads; the echo it causes is ignored.
    let leader: HTMLElement | null = null
    let release = 0
    const follow = (from: HTMLElement, to: HTMLElement) => () => {
      if (leader && leader !== from) return
      leader = from
      window.clearTimeout(release)
      release = window.setTimeout(() => { leader = null }, 120)
      const ratioY = from.scrollTop / Math.max(from.scrollHeight - from.clientHeight, 1)
      const ratioX = from.scrollLeft / Math.max(from.scrollWidth - from.clientWidth, 1)
      to.scrollTop = ratioY * (to.scrollHeight - to.clientHeight)
      to.scrollLeft = ratioX * (to.scrollWidth - to.clientWidth)
    }
    const fromA = follow(a, b)
    const fromB = follow(b, a)
    a.addEventListener('scroll', fromA, { passive: true })
    b.addEventListener('scroll', fromB, { passive: true })
    return () => { a.removeEventListener('scroll', fromA); b.removeEventListener('scroll', fromB); window.clearTimeout(release) }
  }, [partner, doc])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneLabel tone="after">{label}</PaneLabel>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
        {error ? (
          <p className="mx-auto mt-10 max-w-md rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-center text-sm text-destructive">{error}</p>
        ) : !doc ? (
          <div className="grid h-full place-items-center text-muted-foreground"><Loader2 className="size-7 animate-spin" /></div>
        ) : (
          <PdfPages pdf={doc.pdf} ratios={doc.ratios} scrollRef={scrollRef} pageRefs={pageRefs} zoom={zoom} renderOverlay={() => null} />
        )}
      </div>
    </div>
  )
}

export function RevisionNotesDialog({
  mode,
  filePath,
  token,
  heading,
  subheading,
  hint,
  initialGeneral = null,
  initialPins = [],
  baseLabel,
  compare,
  onClose,
  onSubmit,
}: {
  mode: 'edit' | 'view'
  filePath: string
  /** Approver's link token — opens the file before it is published. */
  token?: string
  heading: string
  subheading?: string
  hint?: string
  initialGeneral?: string | null
  initialPins?: RevisionPin[]
  /** view + compare: label over the file the marks were made on. */
  baseLabel?: string
  /** view only: a later file shown beside it, scrolling together. */
  compare?: { filePath: string; label: string }
  onClose: () => void
  /** edit mode: sends the notes; resolve with an error message to keep the dialog open. */
  onSubmit?: (general: string, pins: RevisionPin[]) => Promise<string | null>
}) {
  const editing = mode === 'edit'
  const comparing = !editing && !!compare
  // Phone: which side of the comparison is shown.
  const [side, setSide] = useState<'before' | 'after'>('before')
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // The page currently in view (all pages are shown in one scrolling column).
  const [pageIndex, setPageIndex] = useState(0)
  const [ratios, setRatios] = useState<number[]>([])
  const [pins, setPins] = useState<Pin[]>(() => initialPins.map((p) => ({ ...p, key: newKey() })))
  const [general, setGeneral] = useState(initialGeneral ?? '')
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  // The strike being drawn right now (pointer still down).
  const [draft, setDraft] = useState<Line | null>(null)
  const [zoom, setZoom] = useState(1)
  // Touch screens: one finger either marks the page ('mark': a sideways drag
  // strikes, a tap drops a marker, up/down still scrolls) or just moves
  // around it ('pan' — needed once the page is zoomed in). A mouse always marks.
  const [coarse, setCoarse] = useState(false)
  const [touchTool, setTouchTool] = useState<'mark' | 'pan'>('mark')
  const marking = editing && (!coarse || touchTool === 'mark')
  const zoomAnchor = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const initialPage = useRef<number | null>(initialPins[0]?.page ?? 0)
  const itemRefs = useRef<Record<string, HTMLElement | null>>({})
  // Moving an existing mark: the whole thing, or one end of a strike.
  const drag = useRef<{ key: string; startX: number; startY: number; orig: Pin; moved: boolean; part: 'move' | 'a' | 'b' } | null>(null)
  // A press on the page itself: becomes a strike when dragged, a marker when not.
  const draw = useRef<{ page: number; pointerId: number; x: number; y: number; startX: number; startY: number; moved: boolean; touch: boolean } | null>(null)

  useEscapeClose(true, onClose)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { pdf: loaded, ratios: pageRatios } = await loadPdf(filePath, token)
        if (cancelled) return
        setPdf(loaded)
        setRatios(pageRatios)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Gagal memuat dokumen.')
      }
    })()
    return () => { cancelled = true }
  }, [filePath, token])

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)')
    const update = () => setCoarse(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const goToPage = (index: number) => scrollToPage(scrollRef, pageRefs, index)

  // Zooming keeps the same part of the document in the middle of the view.
  const changeZoom = (direction: 1 | -1) => {
    const next = ZOOM_STEPS[ZOOM_STEPS.indexOf(zoom) + direction]
    const root = scrollRef.current
    if (!next || !root) return
    zoomAnchor.current = (root.scrollTop + root.clientHeight / 2) / Math.max(root.scrollHeight, 1)
    setZoom(next)
  }

  useLayoutEffect(() => {
    const root = scrollRef.current
    if (!root || zoomAnchor.current === null) return
    root.scrollTop = zoomAnchor.current * root.scrollHeight - root.clientHeight / 2
    root.scrollLeft = (root.scrollWidth - root.clientWidth) / 2
    zoomAnchor.current = null
  }, [zoom])

  // Once the pages are laid out, jump to the first marker's page.
  useEffect(() => {
    if (!ratios.length || initialPage.current === null) return
    const target = Math.min(initialPage.current, ratios.length - 1)
    initialPage.current = null
    if (target > 0) requestAnimationFrame(() => scrollToPage(scrollRef, pageRefs, target, false))
  }, [ratios])

  const select = (key: string) => {
    setSelected(key)
    requestAnimationFrame(() => itemRefs.current[key]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }

  const addMark = (mark: Omit<Pin, 'key' | 'note'>) => {
    if (pins.length >= MAX_MARKS) { setError(`Maksimal ${MAX_MARKS} coretan/penanda.`); return }
    const pin: Pin = { ...mark, key: newKey(), note: '' }
    setError(null)
    setPins((c) => [...c, pin])
    select(pin.key)
    // Let the new note's textarea take focus.
    requestAnimationFrame(() => (itemRefs.current[pin.key]?.querySelector('textarea') as HTMLTextAreaElement | null)?.focus({ preventScroll: true }))
  }

  // ── drawing on the page: drag = strike, click = marker ──

  // Where the strike being drawn ends: kept level when the drag is close to
  // horizontal (a line through a row of text), free otherwise.
  const strikeEnd = (d: NonNullable<typeof draw.current>, e: ReactPointerEvent, rect: DOMRect) => {
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    const level = d.touch || Math.abs(dy) <= Math.abs(dx) * 0.3
    return { x2: clamp01(d.x + dx / rect.width), y2: level ? d.y : clamp01(d.y + dy / rect.height) }
  }

  const onPageDown = (page: number, e: ReactPointerEvent<HTMLDivElement>) => {
    const el = pageRefs.current[page]
    if (!el || (e.pointerType === 'mouse' && e.button !== 0)) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    if (x < 0 || x > 1 || y < 0 || y > 1) return
    el.setPointerCapture(e.pointerId)
    draw.current = { page, pointerId: e.pointerId, x, y, startX: e.clientX, startY: e.clientY, moved: false, touch: e.pointerType === 'touch' }
  }

  const onPageMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = draw.current
    const el = d ? pageRefs.current[d.page] : null
    if (!d || !el || e.pointerId !== d.pointerId) return
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_START) return
    d.moved = true
    setDraft({ page: d.page, x: d.x, y: d.y, ...strikeEnd(d, e, el.getBoundingClientRect()) })
  }

  const onPageUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = draw.current
    const el = d ? pageRefs.current[d.page] : null
    if (!d || !el || e.pointerId !== d.pointerId) return
    draw.current = null
    setDraft(null)
    if (!d.moved) { addMark({ page: d.page, x: d.x, y: d.y }); return }
    const rect = el.getBoundingClientRect()
    const end = strikeEnd(d, e, rect)
    if (Math.hypot((end.x2 - d.x) * rect.width, (end.y2 - d.y) * rect.height) < MIN_STRIKE) return
    addMark({ page: d.page, x: d.x, y: d.y, ...end })
  }

  const cancelDraw = () => { draw.current = null; setDraft(null) }

  // ── moving existing marks ──

  const onPinDown = (e: ReactPointerEvent, pin: Pin, part: 'move' | 'a' | 'b' = 'move') => {
    e.stopPropagation()
    select(pin.key)
    if (!editing) return
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    drag.current = { key: pin.key, startX: e.clientX, startY: e.clientY, orig: pin, moved: false, part }
  }

  const onPinMove = (e: ReactPointerEvent) => {
    const d = drag.current
    const stage = d ? pageRefs.current[d.orig.page] : null
    if (!d || !stage) return
    const rect = stage.getBoundingClientRect()
    if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 3) d.moved = true
    if (!d.moved) return
    const dx = (e.clientX - d.startX) / rect.width
    const dy = (e.clientY - d.startY) / rect.height
    const o = d.orig
    let next: Partial<Pin>
    if (!isStrike(o)) {
      next = { x: clamp01(o.x + dx), y: clamp01(o.y + dy) }
    } else if (d.part === 'a') {
      next = { x: clamp01(o.x + dx), y: clamp01(o.y + dy) }
    } else if (d.part === 'b') {
      next = { x2: clamp01(o.x2 + dx), y2: clamp01(o.y2 + dy) }
    } else {
      // The whole strike moves as one; it stops when either end reaches the page edge.
      const mx = Math.min(Math.max(dx, -Math.min(o.x, o.x2)), 1 - Math.max(o.x, o.x2))
      const my = Math.min(Math.max(dy, -Math.min(o.y, o.y2)), 1 - Math.max(o.y, o.y2))
      next = { x: o.x + mx, y: o.y + my, x2: o.x2 + mx, y2: o.y2 + my }
    }
    setPins((c) => c.map((p) => (p.key === d.key ? { ...p, ...next } : p)))
  }

  const removePin = (key: string) => setPins((c) => c.filter((p) => p.key !== key))

  const submit = async () => {
    if (!onSubmit) return
    // A strike may go without text (= remove the words); a marker may not.
    const empty = pins.findIndex((p) => !isStrike(p) && !p.note.trim())
    if (empty >= 0) {
      setError(`Isi catatan untuk penanda ${empty + 1}, atau hapus penandanya.`)
      scrollToSpot(scrollRef, pageRefs, pins[empty].page, pins[empty].y)
      select(pins[empty].key)
      return
    }
    if (!general.trim() && pins.length === 0) {
      setError('Tambahkan minimal satu catatan — coret kata yang salah, klik bagian dokumen yang perlu direvisi, atau isi catatan umum.')
      return
    }
    setSending(true)
    setError(null)
    const message = await onSubmit(general.trim(), pins.map((p) => (
      isStrike(p)
        ? { page: p.page, x: p.x, y: p.y, x2: p.x2, y2: p.y2, note: p.note.trim() }
        : { page: p.page, x: p.x, y: p.y, note: p.note.trim() }
    )))
    setSending(false)
    if (message) setError(message)
  }

  const numberOf = (key: string) => pins.findIndex((p) => p.key === key) + 1
  const strikeCount = pins.filter(isStrike).length

  const strikeLine = (line: Line, key: string, opts: { active?: boolean; dashed?: boolean; pin?: Pin } = {}) => {
    const coords = { x1: line.x * 100, y1: line.y * 100, x2: line.x2 * 100, y2: line.y2 * 100 }
    return (
      <g key={key}>
        {opts.active && <line {...coords} stroke={PIN_COLOR} strokeOpacity={0.22} strokeWidth={10} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        <line {...coords} stroke={PIN_COLOR} strokeWidth={opts.active ? 3 : 2.5} strokeLinecap="round" strokeDasharray={opts.dashed ? '6 5' : undefined} vectorEffect="non-scaling-stroke" />
        {/* wide invisible line: what the pointer actually grabs */}
        {opts.pin && (
          <line
            {...coords}
            stroke="transparent"
            strokeWidth={18}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: 'stroke', touchAction: 'none', cursor: editing ? 'move' : 'pointer' }}
            onPointerDown={(e) => onPinDown(e, opts.pin!)}
          />
        )}
      </g>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex bg-[color-mix(in_oklch,_var(--p-950)_70%,_transparent)] p-0 sm:p-6">
      <div role="dialog" aria-modal="true" aria-label={heading} className={`mx-auto flex h-full w-full ${comparing ? 'max-w-[1680px]' : 'max-w-6xl'} flex-col overflow-hidden bg-card shadow-2xl sm:rounded-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-mono-label text-[10px] text-[color:#b3361f]"><MessageSquareText className="size-3.5" /> {editing ? 'Minta revisi' : comparing ? 'Bandingkan revisi' : 'Catatan revisi'}</p>
            <h2 className="mt-1 truncate text-lg font-semibold text-foreground">{heading}</h2>
            {subheading && <p className="truncate text-xs text-muted-foreground">{subheading}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-9 flex-none place-items-center rounded-full text-muted-foreground hover:bg-secondary"><X className="size-5" /></button>
        </div>

        <div className={`grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-rows-1 ${comparing ? 'lg:grid-cols-[1fr_320px]' : 'lg:grid-cols-[1fr_360px]'}`}>
          {/* Page */}
          <div className="flex min-h-0 flex-col bg-muted/40">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-border bg-card/60 px-3 py-2 text-sm">
              <div className="flex items-center gap-1.5">
                <button type="button" disabled={pageIndex === 0} onClick={() => goToPage(pageIndex - 1)} className="grid size-8 place-items-center rounded-full hover:bg-secondary disabled:opacity-30" aria-label="Halaman sebelumnya"><ChevronLeft className="size-4" /></button>
                <span className="font-mono text-xs text-muted-foreground">Halaman {pageIndex + 1} / {pdf?.numPages ?? '–'}</span>
                <button type="button" disabled={!pdf || pageIndex >= pdf.numPages - 1} onClick={() => goToPage(pageIndex + 1)} className="grid size-8 place-items-center rounded-full hover:bg-secondary disabled:opacity-30" aria-label="Halaman berikutnya"><ChevronRight className="size-4" /></button>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" disabled={zoom === ZOOM_STEPS[0]} onClick={() => changeZoom(-1)} className="grid size-8 place-items-center rounded-full hover:bg-secondary disabled:opacity-30" aria-label="Perkecil"><ZoomOut className="size-4" /></button>
                <span className="w-10 text-center font-mono text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
                <button type="button" disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]} onClick={() => changeZoom(1)} className="grid size-8 place-items-center rounded-full hover:bg-secondary disabled:opacity-30" aria-label="Perbesar"><ZoomIn className="size-4" /></button>
              </div>
              {comparing && (
                <div role="tablist" aria-label="Sisi perbandingan" className="flex rounded-full border border-border bg-card p-0.5 text-xs font-semibold lg:hidden">
                  {([['before', 'Sebelum'], ['after', 'Sesudah']] as const).map(([value, label]) => (
                    <button key={value} type="button" role="tab" aria-selected={side === value} onClick={() => setSide(value)} className={`rounded-full px-3 py-1 transition ${side === value ? (value === 'before' ? 'bg-[#c2412c] text-white' : 'bg-emerald-600 text-white') : 'text-muted-foreground'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {editing && coarse && (
                <div role="group" aria-label="Fungsi sentuhan" className="flex rounded-full border border-border bg-card p-0.5 text-xs font-semibold">
                  {([['mark', 'Coret / tandai', Strikethrough], ['pan', 'Geser', Hand]] as const).map(([tool, label, Icon]) => (
                    <button
                      key={tool}
                      type="button"
                      aria-pressed={touchTool === tool}
                      onClick={() => setTouchTool(tool)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition ${touchTool === tool ? 'bg-[#c2412c] text-white' : 'text-muted-foreground'}`}
                    >
                      <Icon className="size-3.5" /> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={comparing ? 'flex min-h-0 flex-1 lg:divide-x lg:divide-border' : 'flex min-h-0 flex-1'}>
            <div className={`min-h-0 flex-1 flex-col ${comparing && side === 'after' ? 'hidden lg:flex' : 'flex'}`}>
            {comparing && <PaneLabel tone="before">{baseLabel ?? 'Sebelum'}</PaneLabel>}
            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-auto p-3 sm:p-4"
              onPointerMove={onPinMove}
              onPointerUp={() => { drag.current = null }}
              onPointerCancel={() => { drag.current = null }}
            >
              {loadError ? (
                <p className="mx-auto mt-10 max-w-md rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-center text-sm text-destructive">{loadError}</p>
              ) : !pdf || !ratios.length ? (
                <div className="grid h-full place-items-center text-muted-foreground"><Loader2 className="size-7 animate-spin" /></div>
              ) : (
                <PdfPages
                  pdf={pdf}
                  ratios={ratios}
                  scrollRef={scrollRef}
                  pageRefs={pageRefs}
                  onCurrentPage={setPageIndex}
                  zoom={zoom}
                  pageProps={(page) => (marking ? {
                    className: 'cursor-crosshair',
                    // Touch: a sideways drag strikes, an up/down drag still scrolls.
                    style: { touchAction: 'pan-y' },
                    onPointerDown: (e) => onPageDown(page, e),
                    onPointerMove: onPageMove,
                    onPointerUp: onPageUp,
                    onPointerCancel: cancelDraw,
                  } : {})}
                  renderOverlay={(page) => {
                    const onPage = pins.filter((p) => p.page === page)
                    const strikes = onPage.filter((p): p is Strike => isStrike(p))
                    const drawing = draft?.page === page ? draft : null
                    return (
                      <>
                        {(strikes.length > 0 || drawing) && (
                          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {strikes.map((s) => strikeLine(s, s.key, { active: selected === s.key, pin: s }))}
                            {drawing && strikeLine(drawing, 'draft', { dashed: true })}
                          </svg>
                        )}
                        {onPage.map((pin) => {
                          const active = selected === pin.key
                          if (!isStrike(pin)) {
                            return (
                              <button
                                key={pin.key}
                                type="button"
                                onPointerDown={(e) => onPinDown(e, pin)}
                                className={`absolute grid size-7 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full border-2 border-white text-[12px] font-bold text-white shadow-md transition-transform ${editing ? 'cursor-move' : 'cursor-pointer'} ${active ? 'z-10 scale-125' : ''}`}
                                style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%`, background: PIN_COLOR, boxShadow: active ? `0 0 0 4px ${PIN_COLOR}55` : undefined }}
                                title={pin.note || 'Catatan belum diisi'}
                                aria-label={`Penanda ${numberOf(pin.key)}`}
                              >
                                {numberOf(pin.key)}
                              </button>
                            )
                          }
                          // The number sits above the strike's left end, off the struck words themselves.
                          const [lx, ly] = pin.x <= pin.x2 ? [pin.x, pin.y] : [pin.x2, pin.y2]
                          return (
                            <span key={pin.key}>
                              <button
                                type="button"
                                onPointerDown={(e) => onPinDown(e, pin)}
                                className={`absolute grid size-[18px] -translate-x-1/2 -translate-y-[calc(100%+5px)] touch-none place-items-center rounded-full border border-white text-[9.5px] font-bold leading-none text-white shadow-md ${editing ? 'cursor-move' : 'cursor-pointer'} ${active ? 'z-10' : ''}`}
                                style={{ left: `${lx * 100}%`, top: `${ly * 100}%`, background: PIN_COLOR, boxShadow: active ? `0 0 0 3px ${PIN_COLOR}55` : undefined }}
                                title={pin.note || 'Coretan — hapus bagian ini'}
                                aria-label={`Coretan ${numberOf(pin.key)}`}
                              >
                                {numberOf(pin.key)}
                              </button>
                              {editing && active && (['a', 'b'] as const).map((part) => (
                                <span
                                  key={part}
                                  role="presentation"
                                  onPointerDown={(e) => onPinDown(e, pin, part)}
                                  className="absolute z-20 size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 bg-white shadow"
                                  style={{ left: `${(part === 'a' ? pin.x : pin.x2) * 100}%`, top: `${(part === 'a' ? pin.y : pin.y2) * 100}%`, borderColor: PIN_COLOR }}
                                />
                              ))}
                            </span>
                          )
                        })}
                      </>
                    )
                  }}
                />
              )}
            </div>
            </div>
            {comparing && (
              <div className={`min-h-0 flex-1 flex-col ${side === 'after' ? 'flex' : 'hidden lg:flex'}`}>
                <ComparePane filePath={compare!.filePath} token={token} zoom={zoom} partner={scrollRef} label={compare!.label} />
              </div>
            )}
            </div>
          </div>

          {/* Notes */}
          <aside className="flex max-h-[50vh] min-h-0 flex-col gap-4 overflow-y-auto border-t border-border p-5 lg:max-h-none lg:border-l lg:border-t-0">
            {editing ? (
              <div className="flex flex-col gap-1.5 rounded-xl bg-[#fdf0ec] px-3 py-2.5 text-xs leading-5 text-[#7a2a1c]">
                <p><Strikethrough className="mr-1 inline size-3.5" /><strong>Coret:</strong> tarik garis melewati kata yang salah — seperti di hardcopy — lalu tulis penggantinya.</p>
                <p><MapPin className="mr-1 inline size-3.5" /><strong>Penanda:</strong> klik sekali di bagian dokumen untuk menaruh nomor dan catatan.</p>
                <p>Tulisan terlalu kecil? Perbesar dulu dengan tombol <ZoomIn className="inline size-3.5" />{coarse ? <>, dan pilih <strong>Geser</strong> untuk berpindah tanpa mencoret</> : null}. Coretan dan penanda bisa digeser.</p>
                <p>Dokumen <strong>tidak</strong> ditandatangani — setelah diperbaiki, Anda akan menerima email baru.</p>
              </div>
            ) : hint ? (
              <p className="rounded-xl bg-secondary px-3 py-2.5 text-xs leading-5 text-muted-foreground">{hint}</p>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="rn-general" className="text-xs font-semibold text-foreground">Catatan umum</label>
              {editing ? (
                <textarea
                  id="rn-general"
                  value={general}
                  onChange={(e) => setGeneral(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Mis. mohon sesuaikan nama PIC dengan struktur organisasi terbaru"
                  className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
                />
              ) : (
                <p className="whitespace-pre-line rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">{general || <span className="text-muted-foreground">—</span>}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-foreground">
                Catatan di dokumen{' '}
                <span className="font-normal text-muted-foreground">
                  ({pins.length}{pins.length > 0 ? ` · ${strikeCount} coretan, ${pins.length - strikeCount} penanda` : ''})
                </span>
              </p>
              {pins.length === 0 && (
                <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  {editing ? 'Belum ada coretan atau penanda — tarik garis melewati kata yang salah, atau klik bagian yang perlu direvisi.' : 'Tidak ada catatan yang ditandai di dokumen.'}
                </p>
              )}
              {pins.map((pin, i) => {
                const strike = isStrike(pin)
                return (
                  <div
                    key={pin.key}
                    ref={(el) => { itemRefs.current[pin.key] = el }}
                    onClick={() => setSelected(pin.key)}
                    className={`rounded-xl border p-2.5 transition-colors ${selected === pin.key ? 'border-[#d6452f] bg-[#fdf0ec]' : 'border-border'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="grid size-6 flex-none place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: PIN_COLOR }}>{i + 1}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); scrollToSpot(scrollRef, pageRefs, pin.page, pin.y); setSelected(pin.key) }} className="flex flex-1 items-center gap-1.5 text-left text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline">
                        Halaman {pin.page + 1}
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${strike ? 'bg-[#f6ddd6] text-[#a83522]' : 'bg-secondary text-secondary-foreground'}`}>
                          {strike ? <Strikethrough className="size-3" /> : <MapPin className="size-3" />} {strike ? 'Coret' : 'Penanda'}
                        </span>
                      </button>
                      {editing && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); removePin(pin.key) }} aria-label={`Hapus ${strike ? 'coretan' : 'penanda'} ${i + 1}`} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                    {editing ? (
                      <textarea
                        value={pin.note}
                        onChange={(e) => setPins((c) => c.map((p) => (p.key === pin.key ? { ...p, note: e.target.value } : p)))}
                        onFocus={() => setSelected(pin.key)}
                        rows={2}
                        maxLength={500}
                        placeholder={strike ? 'Ganti dengan… (kosongkan bila cukup dihapus)' : 'Apa yang perlu direvisi di sini?'}
                        className="mt-2 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
                      />
                    ) : (
                      <p className="mt-1.5 whitespace-pre-line text-sm text-foreground">{pin.note}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {error && <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}

            {editing && (
              <div className="mt-auto flex flex-col gap-2 pt-2">
                <button type="button" onClick={submit} disabled={sending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c2412c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#a83522] disabled:opacity-50">
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Kirim permintaan revisi
                </button>
                <button type="button" onClick={onClose} disabled={sending} className="text-center text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline">Batal</button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
