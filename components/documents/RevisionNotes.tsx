'use client'

// "Minta Revisi" notes on a procedure document, in two modes:
//
// - edit (approver, from the /pengesahan page): click anywhere on a page to
//   drop a numbered marker, write what needs fixing next to it; markers can
//   be dragged or removed; plus one general note. Nothing is signed.
// - view (ISM Admin from the register, and approvers of the resubmitted
//   document): the same markers and notes, read-only — click a note to jump
//   to its spot.
//
// Marker positions are fractions (0–1) of the page as displayed, top-left
// origin, like the QR placement editor.

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { ChevronLeft, ChevronRight, Loader2, MapPin, MessageSquareText, Send, Trash2, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'

export type RevisionPin = { page: number; x: number; y: number; note: string }
type Pin = RevisionPin & { key: string }

const PIN_COLOR = '#d6452f'
let keySeq = 0
const newKey = () => `pin-${Date.now().toString(36)}-${(keySeq++).toString(36)}`

export function RevisionNotesDialog({
  mode,
  filePath,
  heading,
  subheading,
  hint,
  initialGeneral = null,
  initialPins = [],
  onClose,
  onSubmit,
}: {
  mode: 'edit' | 'view'
  filePath: string
  heading: string
  subheading?: string
  hint?: string
  initialGeneral?: string | null
  initialPins?: RevisionPin[]
  onClose: () => void
  /** edit mode: sends the notes; resolve with an error message to keep the dialog open. */
  onSubmit?: (general: string, pins: RevisionPin[]) => Promise<string | null>
}) {
  const editing = mode === 'edit'
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(initialPins[0]?.page ?? 0)
  const [ratio, setRatio] = useState(1.414)
  const [pins, setPins] = useState<Pin[]>(() => initialPins.map((p) => ({ ...p, key: newKey() })))
  const [general, setGeneral] = useState(initialGeneral ?? '')
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const itemRefs = useRef<Record<string, HTMLElement | null>>({})
  const drag = useRef<{ key: string; startX: number; startY: number; orig: Pin; moved: boolean } | null>(null)

  useEscapeClose(true, onClose)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = `${API_BASE_PATH}/api/pdf-worker`
        const file = await fetch(`${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(filePath)}`)
        if (!file.ok) throw new Error('File PDF tidak dapat dimuat.')
        const loaded = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
        if (cancelled) return
        setPdf(loaded)
        setPageIndex((p) => Math.min(p, loaded.numPages - 1))
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Gagal memuat dokumen.')
      }
    })()
    return () => { cancelled = true }
  }, [filePath])

  useEffect(() => {
    if (!pdf || !canvasRef.current || !stageRef.current) return
    let cancelled = false
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null
    ;(async () => {
      const page = await pdf.getPage(pageIndex + 1)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: (stageRef.current!.clientWidth / base.width) * (window.devicePixelRatio || 1) })
      if (cancelled) return
      setRatio(base.height / base.width)
      const canvas = canvasRef.current!
      canvas.width = viewport.width
      canvas.height = viewport.height
      task = page.render({ canvasContext: canvas.getContext('2d')!, viewport })
      await task.promise.catch(() => {})
    })()
    return () => { cancelled = true; task?.cancel() }
  }, [pdf, pageIndex])

  const select = (key: string) => {
    setSelected(key)
    requestAnimationFrame(() => itemRefs.current[key]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }

  const addPin = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!editing || !stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    if (x < 0 || x > 1 || y < 0 || y > 1) return
    if (pins.length >= 30) { setError('Maksimal 30 penanda.'); return }
    const pin: Pin = { key: newKey(), page: pageIndex, x, y, note: '' }
    setPins((c) => [...c, pin])
    select(pin.key)
    // Let the new note's textarea take focus.
    requestAnimationFrame(() => (itemRefs.current[pin.key]?.querySelector('textarea') as HTMLTextAreaElement | null)?.focus())
  }

  const onPinDown = (e: ReactPointerEvent, pin: Pin) => {
    e.stopPropagation()
    select(pin.key)
    if (!editing) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { key: pin.key, startX: e.clientX, startY: e.clientY, orig: pin, moved: false }
  }

  const onPinMove = (e: ReactPointerEvent) => {
    const d = drag.current
    const stage = stageRef.current
    if (!d || !stage) return
    const rect = stage.getBoundingClientRect()
    if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 3) d.moved = true
    if (!d.moved) return
    const x = Math.min(Math.max(d.orig.x + (e.clientX - d.startX) / rect.width, 0), 1)
    const y = Math.min(Math.max(d.orig.y + (e.clientY - d.startY) / rect.height, 0), 1)
    setPins((c) => c.map((p) => (p.key === d.key ? { ...p, x, y } : p)))
  }

  const removePin = (key: string) => setPins((c) => c.filter((p) => p.key !== key))

  const submit = async () => {
    if (!onSubmit) return
    const empty = pins.findIndex((p) => !p.note.trim())
    if (empty >= 0) {
      setError(`Isi catatan untuk penanda ${empty + 1}, atau hapus penandanya.`)
      setPageIndex(pins[empty].page)
      select(pins[empty].key)
      return
    }
    if (!general.trim() && pins.length === 0) {
      setError('Tambahkan minimal satu catatan — klik bagian dokumen yang perlu direvisi, atau isi catatan umum.')
      return
    }
    setSending(true)
    setError(null)
    const message = await onSubmit(general.trim(), pins.map(({ page, x, y, note }) => ({ page, x, y, note: note.trim() })))
    setSending(false)
    if (message) setError(message)
  }

  const numberOf = (key: string) => pins.findIndex((p) => p.key === key) + 1
  const onThisPage = pins.filter((p) => p.page === pageIndex)

  return (
    <div className="fixed inset-0 z-[60] flex bg-[color-mix(in_oklch,_var(--p-950)_70%,_transparent)] p-0 sm:p-6">
      <div role="dialog" aria-modal="true" aria-label={heading} className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-mono-label text-[10px] text-[color:#b3361f]"><MessageSquareText className="size-3.5" /> {editing ? 'Minta revisi' : 'Catatan revisi'}</p>
            <h2 className="mt-1 truncate text-lg font-semibold text-foreground">{heading}</h2>
            {subheading && <p className="truncate text-xs text-muted-foreground">{subheading}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-9 flex-none place-items-center rounded-full text-muted-foreground hover:bg-secondary"><X className="size-5" /></button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[1fr_360px] lg:grid-rows-1">
          {/* Page */}
          <div className="flex min-h-0 flex-col bg-muted/40">
            <div className="flex items-center justify-center gap-3 border-b border-border bg-card/60 px-4 py-2 text-sm">
              <button type="button" disabled={pageIndex === 0} onClick={() => setPageIndex((p) => p - 1)} className="grid size-8 place-items-center rounded-full hover:bg-secondary disabled:opacity-30" aria-label="Halaman sebelumnya"><ChevronLeft className="size-4" /></button>
              <span className="font-mono text-xs text-muted-foreground">Halaman {pageIndex + 1} / {pdf?.numPages ?? '–'}</span>
              <button type="button" disabled={!pdf || pageIndex >= pdf.numPages - 1} onClick={() => setPageIndex((p) => p + 1)} className="grid size-8 place-items-center rounded-full hover:bg-secondary disabled:opacity-30" aria-label="Halaman berikutnya"><ChevronRight className="size-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
              {loadError ? (
                <p className="mx-auto mt-10 max-w-md rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-center text-sm text-destructive">{loadError}</p>
              ) : (
                <div
                  ref={stageRef}
                  className={`relative mx-auto w-full max-w-[760px] select-none bg-white shadow-lg ${editing ? 'cursor-crosshair' : ''}`}
                  style={{ aspectRatio: `1 / ${ratio}` }}
                  onClick={addPin}
                  onPointerMove={onPinMove}
                  onPointerUp={() => { drag.current = null }}
                  onPointerCancel={() => { drag.current = null }}
                >
                  <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
                  {!pdf && <div className="absolute inset-0 grid place-items-center text-muted-foreground"><Loader2 className="size-7 animate-spin" /></div>}
                  {onThisPage.map((pin) => {
                    const active = selected === pin.key
                    return (
                      <button
                        key={pin.key}
                        type="button"
                        onPointerDown={(e) => onPinDown(e, pin)}
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute grid size-7 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full border-2 border-white text-[12px] font-bold text-white shadow-md transition-transform ${editing ? 'cursor-move' : 'cursor-pointer'} ${active ? 'z-10 scale-125' : ''}`}
                        style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%`, background: PIN_COLOR, boxShadow: active ? `0 0 0 4px ${PIN_COLOR}55` : undefined }}
                        title={pin.note || 'Catatan belum diisi'}
                        aria-label={`Penanda ${numberOf(pin.key)}`}
                      >
                        {numberOf(pin.key)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <aside className="flex max-h-[50vh] min-h-0 flex-col gap-4 overflow-y-auto border-t border-border p-5 lg:max-h-none lg:border-l lg:border-t-0">
            {editing ? (
              <p className="rounded-xl bg-[#fdf0ec] px-3 py-2.5 text-xs leading-5 text-[#7a2a1c]">
                <MapPin className="mr-1 inline size-3.5" />
                <strong>Klik bagian dokumen</strong> yang perlu diperbaiki untuk menaruh penanda bernomor, lalu tulis catatannya. Penanda bisa digeser. Dokumen <strong>tidak</strong> ditandatangani — setelah diperbaiki, Anda akan menerima email baru.
              </p>
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
              <p className="text-xs font-semibold text-foreground">Catatan di dokumen <span className="font-normal text-muted-foreground">({pins.length})</span></p>
              {pins.length === 0 && (
                <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  {editing ? 'Belum ada penanda — klik bagian dokumen yang perlu direvisi.' : 'Tidak ada catatan yang ditandai di dokumen.'}
                </p>
              )}
              {pins.map((pin, i) => (
                <div
                  key={pin.key}
                  ref={(el) => { itemRefs.current[pin.key] = el }}
                  onClick={() => { setPageIndex(pin.page); setSelected(pin.key) }}
                  className={`rounded-xl border p-2.5 transition-colors ${selected === pin.key ? 'border-[#d6452f] bg-[#fdf0ec]' : 'border-border'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 flex-none place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: PIN_COLOR }}>{i + 1}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setPageIndex(pin.page); setSelected(pin.key) }} className="flex-1 text-left text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline">
                      Halaman {pin.page + 1}
                    </button>
                    {editing && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); removePin(pin.key) }} aria-label={`Hapus penanda ${i + 1}`} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                  {editing ? (
                    <textarea
                      value={pin.note}
                      onChange={(e) => setPins((c) => c.map((p) => (p.key === pin.key ? { ...p, note: e.target.value } : p)))}
                      onFocus={() => { setPageIndex(pin.page); setSelected(pin.key) }}
                      rows={2}
                      maxLength={500}
                      placeholder="Apa yang perlu direvisi di sini?"
                      className="mt-2 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
                    />
                  ) : (
                    <p className="mt-1.5 whitespace-pre-line text-sm text-foreground">{pin.note}</p>
                  )}
                </div>
              ))}
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
