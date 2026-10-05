'use client'

// "Atur Posisi QR": places approvers' QR signatures on the document's OWN
// signature column, whatever the template looks like. Used in two modes:
//
// - Admin (documentId): ISM Admin arranges every role's QR.
// - Approver (token): the approver — who has no portal account — places only
//   their own QR from the /pengesahan page opened from their email; the
//   other approvers' spots are shown faded and can't be touched.
//
// - Deteksi otomatis reads the PDF text layer (pdf.js) on every page and
//   looks for either a "Unit Kerja | Nama | Tanda Tangan | Tanggal" table
//   (row found by the role's title) or an "Approval / Checked / Prepared" box
//   (found by the role code printed in it, e.g. IAA / SSA).
// - Anything it can't find — or any scanned PDF without a text layer — is
//   placed by hand: drag the box onto the column, drag the corner to resize.
// - One role can sign in several spots (e.g. a signature table on two
//   pages): select a box, Ctrl+C, go to the page, Ctrl+V — or use the copy
//   button on the box. Delete removes the selected box.
// - Each QR box may have a companion TGL box where the approval date is
//   printed. On a page with a TANGGAL column it starts in that column on the
//   QR's row and follows the QR; elsewhere a new QR has no date until it is
//   switched on. Once the TGL box is dragged by hand it stays exactly where
//   it was put. It can be removed from the box itself (trash / Delete), per
//   QR in the list, or for every QR at once.
//
// Positions are fractions (0–1) of the page as displayed, top-left origin,
// so they don't depend on the zoom level.

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { ChevronLeft, ChevronRight, Copy, Crosshair, Eye, Loader2, Lock, MousePointerClick, Save, Trash2, Wand2, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { loadPdfJs } from '@/lib/pdfjs-loader'
import { PdfPages, loadPageRatios, scrollToPage, scrollToSpot } from '@/components/documents/PdfPages'
import { useEscapeClose } from '@/hooks/useEscapeClose'

type Box = { x: number; y: number; w: number; h: number }
// A QR placement as stored; date = where the approval date is printed.
type Placement = { role_code: string; page: number; x: number; y: number; w: number; h: number; date?: Box | null }
// In the editor every placement also gets a client-side key (a role may have several).
type Slot = Placement & { key: string }
type DateCol = { left: number; right: number }
type Role = { code: string; title: string; person_name: string }

const COLORS = ['#e4572e', '#2e86ab', '#7b2cbf', '#2a9d8f', '#d4a017', '#c2185b']
const MAX_PER_ROLE = 8

let keySeq = 0
const newKey = (role: string) => `${role}-${Date.now().toString(36)}-${(keySeq++).toString(36)}`

// ─── auto-detection ───

type Phrase = { text: string; compact: string; x: number; y: number; w: number; h: number; cx: number; cy: number }

const compact = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

const ROLE_KEYWORDS: Record<string, string[]> = {
  SSA: ['SYSTEMSECURITYADMIN'],
  IAA: ['INFORMATIONASSETSADMIN', 'INFORMATIONASSETADMIN'],
  PJU: ['PENANGGUNGJAWABUMUM', 'PRESIDENDIRECTOR', 'PRESIDENTDIRECTOR'],
}

async function pagePhrases(pdf: PDFDocumentProxy, pageIndex: number): Promise<Phrase[]> {
  const pdfjs = await loadPdfJs()
  const page = await pdf.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()
  type Raw = { str: string; x: number; y: number; w: number; h: number }
  const raws: Raw[] = []
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue
    const t = pdfjs.Util.transform(viewport.transform, item.transform)
    const h = Math.hypot(t[2], t[3]) || 8
    raws.push({ str: item.str, x: t[4], y: t[5] - h, w: Math.max(item.width, 1), h })
  }
  // Merge pieces on the same line that sit close together into phrases
  // ("N A M A" and "Tanda" + "Tangan" often arrive as separate items).
  raws.sort((a, b) => (Math.abs(a.y - b.y) < Math.min(a.h, b.h) * 0.5 ? a.x - b.x : a.y - b.y))
  const phrases: Raw[] = []
  for (const r of raws) {
    const last = phrases[phrases.length - 1]
    const gap = last ? r.x - (last.x + last.w) : Infinity
    if (last && Math.abs(r.y - last.y) < Math.min(r.h, last.h) * 0.5 && gap < Math.max(r.h, last.h) * 1.2 && gap > -last.h) {
      last.str += gap > r.h * 0.15 ? ` ${r.str}` : r.str
      last.w = r.x + r.w - last.x
      last.h = Math.max(last.h, r.h)
    } else phrases.push({ ...r })
  }
  const W = viewport.width, H = viewport.height
  return phrases.map((p) => ({
    text: p.str, compact: compact(p.str),
    x: p.x / W, y: p.y / H, w: p.w / W, h: p.h / H,
    cx: (p.x + p.w / 2) / W, cy: (p.y + p.h / 2) / H,
  }))
}

const sameLine = (a: Phrase, b: Phrase) => Math.abs(a.cy - b.cy) < Math.max(a.h, b.h) * 0.8

// The TANGGAL column of a "… | Tanda Tangan | Tanggal" table on this page:
// it starts halfway between the two headers and is taken as symmetric
// around the TANGGAL header.
function findDateColumn(phrases: Phrase[]): DateCol | null {
  for (const tt of phrases.filter((p) => p.compact === 'TANDATANGAN' || p.compact === 'SIGNATURE')) {
    const tgl = phrases.filter((p) => p !== tt && sameLine(p, tt) && p.cx > tt.cx && /^(TANGGAL|DATE)$/.test(p.compact)).sort((a, b) => a.cx - b.cx)[0]
    if (!tgl) continue
    const left = (tt.cx + tgl.cx) / 2
    return { left, right: Math.min(1, tgl.cx + (tgl.cx - left)) }
  }
  return null
}

// Date box for a QR box: same row, inside the TANGGAL column.
function dateInColumn(slot: Box, col: DateCol): Box {
  const w = col.right - col.left
  return { x: col.left + w * 0.05, y: slot.y, w: w * 0.9, h: slot.h }
}

function detectOnPage(phrases: Phrase[], page: number, roles: Role[]): Placement[] {
  const found: Placement[] = []
  const dateCol = findDateColumn(phrases)

  // A) "Unit Kerja | NAMA | Tanda Tangan | TANGGAL" table
  for (const tt of phrases.filter((p) => p.compact === 'TANDATANGAN' || p.compact === 'SIGNATURE')) {
    const row = phrases.filter((p) => p !== tt && sameLine(p, tt))
    const nama = row.filter((p) => p.cx < tt.cx && /^(NAMA|NAME)$/.test(p.compact)).sort((a, b) => b.cx - a.cx)[0]
    const tgl = row.filter((p) => p.cx > tt.cx && /^(TANGGAL|DATE)$/.test(p.compact)).sort((a, b) => a.cx - b.cx)[0]
    const colLeft = nama ? (nama.cx + tt.cx) / 2 : tt.x - tt.w * 0.6
    const colRight = tgl ? (tt.cx + tgl.cx) / 2 : tt.x + tt.w * 1.6
    const below = phrases.filter((p) => p.cy > tt.cy + tt.h && p.cx < colLeft)
    const hits: { role: Role; p: Phrase }[] = []
    for (const role of roles) {
      const keys = ROLE_KEYWORDS[role.code] ?? [compact(role.title).slice(0, 18)]
      const p = below.filter((q) => keys.some((k) => q.compact.includes(k))).sort((a, b) => a.cy - b.cy)[0]
      if (p) hits.push({ role, p })
    }
    if (!hits.length) continue
    const ys = hits.map((h) => h.p.cy).sort((a, b) => a - b)
    const gaps = ys.slice(1).map((y, i) => y - ys[i]).filter((g) => g > 0.004)
    const rowH = gaps.length ? Math.min(...gaps) : Math.max((ys[0] - tt.cy) * 1.1, 0.03)
    const colW = colRight - colLeft
    for (const { role, p } of hits) {
      // Names sit vertically centred in their row — use one as the row centre
      // (the role title may wrap onto two lines).
      const name = nama && phrases
        .filter((q) => Math.abs(q.cx - nama.cx) < colW / 2 && Math.abs(q.cy - p.cy) < rowH * 0.6 && q.cy > tt.cy + tt.h)
        .sort((a, b) => Math.abs(a.cy - p.cy) - Math.abs(b.cy - p.cy))[0]
      const cy = name ? name.cy : p.cy
      const h = rowH * 0.86
      const qr = { x: colLeft + colW * 0.05, y: cy - h / 2, w: colW * 0.9, h }
      found.push({ role_code: role.code, page, ...qr, date: dateCol ? dateInColumn(qr, dateCol) : null })
    }
  }

  // B) "Approval | Checked | Prepared" signature boxes with the role code inside
  const heads = phrases.filter((p) => /^(APPROVAL|APPROVED|CHECKED|PREPARED|MENYETUJUI|DIPERIKSA|DIBUAT)$/.test(p.compact))
  if (heads.length >= 2) {
    const centers = heads.map((h) => h.cx).sort((a, b) => a - b)
    const spacing = Math.min(...centers.slice(1).map((c, i) => c - centers[i]).filter((d) => d > 0.01), 0.3)
    for (const role of roles) {
      if (found.some((f) => f.role_code === role.code)) continue
      for (const head of heads) {
        const code = phrases.find((p) => p.compact === role.code && Math.abs(p.cx - head.cx) < spacing / 2 && p.cy > head.cy && p.cy - head.cy < spacing * 1.2)
        if (!code) continue
        const w = spacing * 0.8
        const h = Math.min(spacing * 0.62, (code.cy - head.cy) * 1.7)
        found.push({ role_code: role.code, page, x: code.cx - w / 2, y: code.cy - h / 2, w, h })
        break
      }
    }
  }
  return found
}

// Every signature spot for these roles, on every page (a document may carry
// its signature table more than once).
async function autoDetect(pdf: PDFDocumentProxy, roles: Role[]): Promise<{ slots: Placement[]; hasText: boolean }> {
  const slots: Placement[] = []
  let hasText = false
  for (let i = 0; i < pdf.numPages; i++) {
    const phrases = await pagePhrases(pdf, i)
    if (phrases.length) hasText = true
    for (const s of detectOnPage(phrases, i, roles)) {
      if (slots.filter((x) => x.role_code === s.role_code).length < MAX_PER_ROLE) slots.push(s)
    }
  }
  return { slots, hasText }
}

// ─── editor ───

type EditorProps = {
  onClose: () => void
  /** Runs after a successful save (e.g. to approve right after placing). */
  onSaved?: () => void | Promise<void>
  /** Save button label; when set, saving is allowed even without changes. */
  saveLabel?: string
  /** Optional second action under the save button (e.g. approve without placing). */
  secondaryAction?: { label: string; run: () => void }
} & ({ documentId: number; token?: undefined } | { token: string; documentId?: undefined })

export function SignatureSlotEditor({ documentId, token, onClose, onSaved, saveLabel, secondaryAction }: EditorProps) {
  const approverMode = token !== undefined
  const [doc, setDoc] = useState<{ control_no: string; title: string; revision: number; file_path: string } | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [editableRoles, setEditableRoles] = useState<string[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  // The page currently in view (all pages are shown in one scrolling column).
  const [pageIndex, setPageIndex] = useState(0)
  const [ratios, setRatios] = useState<number[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<'detect' | 'save' | null>(null)
  const [dirty, setDirty] = useState(false)
  // TANGGAL column per page (null = none found / scanned page).
  const [dateCols, setDateCols] = useState<Record<number, DateCol | null>>({})
  const dateColsRef = useRef<Record<number, DateCol | null>>({})
  // Placements whose date box was dragged by hand: it then keeps its own
  // column and only follows the QR's row.
  const manualDate = useRef<Set<string>>(new Set())
  const clipboard = useRef<Slot | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const initialPage = useRef<number | null>(null)
  const drag = useRef<{ key: string; target: 'qr' | 'date'; mode: 'move' | 'resize'; startX: number; startY: number; orig: Slot } | null>(null)
  // Which part of the selected placement is selected: its QR or its TGL box.
  const [selectedPart, setSelectedPart] = useState<'qr' | 'date'>('qr')

  const goToPage = (index: number) => scrollToPage(scrollRef, pageRefs, index)

  useEscapeClose(true, onClose)

  const canEdit = useCallback((role: string) => editableRoles.includes(role), [editableRoles])

  // Load document info, saved slots and the PDF itself.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const url = approverMode
          ? `${API_BASE_PATH}/api/prosedur-isms/approval/slots?token=${encodeURIComponent(token!)}`
          : `${API_BASE_PATH}/api/prosedur-isms/${documentId}/slots`
        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message)
        if (cancelled) return
        const editable: string[] = approverMode ? (data.editable ? [data.ownRole] : []) : data.roles.map((r: Role) => r.code)
        const saved: Slot[] = (data.slots as Placement[]).map((s) => ({ ...s, key: newKey(s.role_code) }))
        setDoc(data.document)
        setRoles(data.roles)
        setEditableRoles(editable)
        setSlots(saved)
        if (approverMode && !data.editable) setMessage({ ok: false, text: 'Posisi tanda tangan tidak dapat diubah lagi untuk link ini.' })
        const pdfjs = await loadPdfJs()
        // Approvers have no session: their token opens the not-yet-published file.
        const file = await fetch(`${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(data.document.file_path)}${approverMode ? `&token=${encodeURIComponent(token!)}` : ''}`)
        if (!file.ok) throw new Error('File PDF tidak dapat dimuat.')
        const loaded = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
        if (cancelled) return
        const pageRatios = await loadPageRatios(loaded)
        if (cancelled) return
        setPdf(loaded)
        setRatios(pageRatios)
        // Open scrolled to a page holding one of my spots (else any spot);
        // otherwise at the top, so the whole document reads from page 1.
        const mine = saved.find((s) => editable.includes(s.role_code)) ?? saved[0]
        initialPage.current = mine?.page ?? 0

        // Find the TANGGAL column on every page. A saved QR without a date box
        // stays without one — the date may have been switched off on purpose.
        const cols: Record<number, DateCol | null> = {}
        for (let i = 0; i < loaded.numPages; i++) {
          cols[i] = findDateColumn(await pagePhrases(loaded, i).catch(() => []))
          if (cancelled) return
        }
        dateColsRef.current = cols
        setDateCols(cols)
        // A saved date box that isn't where the TANGGAL column would put it
        // was placed by hand — it keeps its own spot.
        for (const s of saved) {
          const col = cols[s.page]
          if (!s.date || !col) continue
          const auto = dateInColumn(s, col)
          if (Math.abs(auto.x - s.date.x) + Math.abs(auto.y - s.date.y) + Math.abs(auto.w - s.date.w) > 0.003) manualDate.current.add(s.key)
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Gagal memuat dokumen.')
      }
    })()
    return () => { cancelled = true }
  }, [documentId, token, approverMode])

  // Once the pages are laid out, jump to the starting page.
  useEffect(() => {
    if (!ratios.length || initialPage.current === null) return
    const target = initialPage.current
    initialPage.current = null
    if (target > 0) requestAnimationFrame(() => scrollToPage(scrollRef, pageRefs, target, false))
  }, [ratios])

  // Where the date box goes after the QR box changed from `prev` to `next`:
  // snapped into the page's TANGGAL column on the QR's row; without a
  // detected column moved along with the QR; once dragged by hand, left alone.
  const followDate = (prev: Slot, next: Slot): Box | null => {
    if (!prev.date) return null
    if (manualDate.current.has(prev.key)) return prev.date
    const col = dateColsRef.current[next.page]
    if (col) return dateInColumn(next, col)
    // Keep matching the QR's height while the two were the same size.
    const h = Math.abs(prev.date.h - prev.h) < 1e-6 ? next.h : prev.date.h
    const x = prev.date.x + (next.x - prev.x)
    return {
      x: Math.min(Math.max(x, 0), 1 - prev.date.w),
      y: Math.min(Math.max(prev.date.y + (next.y - prev.y), 0), 1 - h),
      w: prev.date.w,
      h,
    }
  }

  // A new QR gets a date box only where the page has a TANGGAL column;
  // anywhere else the date is switched on by hand when wanted.
  const autoDate = (slot: Placement): Box | null => {
    const col = dateColsRef.current[slot.page]
    return col ? dateInColumn(slot, col) : null
  }

  // Date box when switched on by hand: its row's TANGGAL cell, else just right of it.
  const defaultDate = (slot: Placement): Box => {
    const col = dateColsRef.current[slot.page]
    if (col) return dateInColumn(slot, col)
    const w = Math.min(slot.w * 1.2, 0.2)
    return { x: Math.min(slot.x + slot.w + 0.01, 1 - w), y: slot.y, w, h: slot.h }
  }

  const updateSlot = (key: string, next: Partial<Slot>) => {
    setSlots((current) => current.map((s) => {
      if (s.key !== key) return s
      const moved = { ...s, ...next }
      return 'date' in next ? moved : { ...moved, date: followDate(s, moved) }
    }))
    setDirty(true)
  }

  const countFor = (role: string, list = slots) => list.filter((s) => s.role_code === role).length

  // A new placement of `role` on the current page. Copies the size (and the
  // spot, when coming from another page — signature tables usually sit in
  // the same place) of `template`; on the same page it goes just below.
  const addPlacement = (role: string, template?: Slot | null) => {
    if (!canEdit(role)) return
    if (countFor(role) >= MAX_PER_ROLE) {
      setMessage({ ok: false, text: `Maksimal ${MAX_PER_ROLE} QR per approver.` })
      return
    }
    let base: Placement
    if (template) {
      const samePage = template.page === pageIndex
      const dy = samePage ? template.h + 0.012 : 0
      const y = Math.min(template.y + dy, 1 - template.h)
      base = { role_code: role, page: pageIndex, x: template.x, y, w: template.w, h: template.h }
      if (template.date) {
        base.date = dateColsRef.current[pageIndex] ? dateInColumn(base, dateColsRef.current[pageIndex]!) : { ...template.date, y: Math.min(template.date.y + (y - template.y), 1 - template.date.h) }
      } else base.date = null
    } else {
      const size = 0.14
      const ratio = ratios[pageIndex] ?? 1.414
      // Centred in the part of the page that's on screen right now.
      const pageEl = pageRefs.current[pageIndex]
      const view = scrollRef.current?.getBoundingClientRect()
      let cy = 0.5
      if (pageEl && view) {
        const r = pageEl.getBoundingClientRect()
        const top = Math.max(r.top, view.top), bottom = Math.min(r.bottom, view.bottom)
        if (bottom > top) cy = ((top + bottom) / 2 - r.top) / r.height
      }
      const h = size / ratio
      base = { role_code: role, page: pageIndex, x: 0.5 - size / 2, y: Math.min(Math.max(cy - h / 2, 0), 1 - h), w: size, h }
      base.date = autoDate(base)
    }
    const slot: Slot = { ...base, key: newKey(role) }
    // A hand-placed date box stays hand-placed on its copies.
    if (template && manualDate.current.has(template.key) && !dateColsRef.current[pageIndex]) manualDate.current.add(slot.key)
    setSlots((current) => [...current, slot])
    setSelected(slot.key)
    setSelectedPart('qr')
    setDirty(true)
  }

  const removeSlot = (key: string) => {
    setSlots((c) => c.filter((s) => s.key !== key))
    if (selected === key) setSelected(null)
    setDirty(true)
  }

  const toggleDate = (key: string, on: boolean) => {
    manualDate.current.delete(key)
    setSlots((current) => current.map((s) => (s.key === key ? { ...s, date: on ? defaultDate(s) : null } : s)))
    if (!on && selected === key) setSelectedPart('qr')
    setDirty(true)
  }

  // Every QR this person may edit: print the approval date on all of them, or on none.
  const setAllDates = (on: boolean) => {
    setSlots((current) => current.map((s) => {
      if (!canEdit(s.role_code) || !!s.date === on) return s
      manualDate.current.delete(s.key)
      return { ...s, date: on ? defaultDate(s) : null }
    }))
    setSelectedPart('qr')
    setDirty(true)
  }

  // Keyboard: Ctrl/Cmd+C copies the selected box, Ctrl/Cmd+V pastes it onto
  // the current page, Delete/Backspace removes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const current = slots.find((s) => s.key === selected)
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'c' && current) {
        clipboard.current = current
        setMessage({ ok: true, text: `QR ${current.role_code} disalin — gulir ke halaman tujuan lalu tekan Ctrl+V.` })
        e.preventDefault()
      } else if (mod && e.key.toLowerCase() === 'v' && clipboard.current) {
        addPlacement(clipboard.current.role_code, clipboard.current)
        e.preventDefault()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && current && canEdit(current.role_code)) {
        // With the TGL box selected only the date goes; the QR stays.
        if (selectedPart === 'date' && current.date) toggleDate(current.key, false)
        else removeSlot(current.key)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onPointerDown = (e: ReactPointerEvent, key: string, mode: 'move' | 'resize', target: 'qr' | 'date' = 'qr') => {
    e.preventDefault()
    e.stopPropagation()
    const slot = slots.find((s) => s.key === key)
    if (!slot || !canEdit(slot.role_code) || (target === 'date' && !slot.date)) return
    setSelected(key)
    setSelectedPart(target)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { key, target, mode, startX: e.clientX, startY: e.clientY, orig: slot }
  }

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const d = drag.current
    const stage = d ? pageRefs.current[d.orig.page] : null
    if (!d || !stage) return
    const rect = stage.getBoundingClientRect()
    const dx = (e.clientX - d.startX) / rect.width
    const dy = (e.clientY - d.startY) / rect.height
    if (d.target === 'date' && d.orig.date) {
      const o = d.orig.date
      manualDate.current.add(d.key)
      updateSlot(d.key, {
        date: d.mode === 'move'
          ? { ...o, x: Math.min(Math.max(o.x + dx, 0), 1 - o.w), y: Math.min(Math.max(o.y + dy, 0), 1 - o.h) }
          : { ...o, w: Math.min(Math.max(o.w + dx, 0.02), 1 - o.x), h: Math.min(Math.max(o.h + dy, 0.012), 1 - o.y) },
      })
      return
    }
    const o = d.orig
    if (d.mode === 'move') {
      updateSlot(d.key, { x: Math.min(Math.max(o.x + dx, 0), 1 - o.w), y: Math.min(Math.max(o.y + dy, 0), 1 - o.h) })
    } else {
      updateSlot(d.key, { w: Math.min(Math.max(o.w + dx, 0.02), 1 - o.x), h: Math.min(Math.max(o.h + dy, 0.015), 1 - o.y) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPointerUp = () => { drag.current = null }

  const runDetect = async () => {
    if (!pdf) return
    const targets = roles.filter((r) => canEdit(r.code))
    setBusy('detect')
    setMessage(null)
    try {
      const { slots: detected, hasText } = await autoDetect(pdf, targets)
      if (!hasText) {
        setMessage({ ok: false, text: 'PDF ini tidak memiliki lapisan teks (kemungkinan hasil scan) — tempatkan kotak QR secara manual.' })
        return
      }
      if (!detected.length) {
        setMessage({ ok: false, text: 'Kolom tanda tangan tidak ditemukan otomatis — tempatkan kotak QR secara manual.' })
        return
      }
      const foundRoles = new Set(detected.map((d) => d.role_code))
      const fresh = detected.map((d) => ({ ...d, key: newKey(d.role_code) }))
      manualDate.current.clear()
      // Detection only adds a date where the page has a TANGGAL column.
      setSlots((current) => [...current.filter((s) => !foundRoles.has(s.role_code)), ...fresh.map((f) => ({ ...f, date: f.date ?? null }))])
      goToPage(fresh[0].page)
      setSelected(null)
      setDirty(true)
      const missing = targets.filter((r) => !foundRoles.has(r.code)).map((r) => r.code)
      const pages = [...new Set(fresh.map((f) => f.page + 1))].sort((a, b) => a - b)
      setMessage({
        ok: true,
        text: `Ditemukan ${fresh.length} posisi QR di halaman ${pages.join(', ')}.${missing.length ? ` Belum ketemu: ${missing.join(', ')} — tempatkan manual.` : ''} Periksa, lalu Simpan.`,
      })
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Deteksi gagal.' })
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    setBusy('save')
    setMessage(null)
    try {
      const payload = slots
        .filter((s) => canEdit(s.role_code))
        .map(({ role_code, page, x, y, w, h, date }) => ({ role_code, page, x, y, w, h, date: date ?? null }))
      const res = approverMode
        ? await fetch(`${API_BASE_PATH}/api/prosedur-isms/approval/slots`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, slots: payload }),
        })
        : await fetch(`${API_BASE_PATH}/api/prosedur-isms/${documentId}/slots`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slots: payload }),
        })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message ?? 'Gagal menyimpan.')
      setDirty(false)
      setMessage({ ok: true, text: `Posisi QR disimpan (${payload.length}).` })
      await onSaved?.()
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Gagal menyimpan.' })
    } finally {
      setBusy(null)
    }
  }

  const colorOf = (code: string) => COLORS[Math.max(0, roles.findIndex((r) => r.code === code)) % COLORS.length]
  const sampleDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  const indexOf = (slot: Slot) => slots.filter((s) => s.role_code === slot.role_code).indexOf(slot) + 1
  const myRoles = roles.filter((r) => canEdit(r.code))
  const otherRoles = roles.filter((r) => !canEdit(r.code))

  return (
    <div className="fixed inset-0 z-[60] flex bg-[color-mix(in_oklch,_var(--p-950)_70%,_transparent)] p-0 sm:p-6">
      <div role="dialog" aria-modal="true" aria-label="Atur posisi QR tanda tangan" className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-card shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-mono-label text-[10px] text-muted-foreground">
              <Crosshair className="size-3.5" /> {approverMode ? 'Tempatkan tanda tangan QR Anda' : 'Atur posisi QR tanda tangan'}
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold text-foreground">{doc ? `${doc.control_no} — ${doc.title}` : 'Memuat…'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-9 flex-none place-items-center rounded-full text-muted-foreground hover:bg-secondary"><X className="size-5" /></button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[1fr_330px] lg:grid-rows-1">
          {/* Page */}
          <div className="flex min-h-0 flex-col bg-muted/40">
            <div className="flex items-center justify-center gap-3 border-b border-border bg-card/60 px-4 py-2 text-sm">
              <button type="button" disabled={pageIndex === 0} onClick={() => goToPage(pageIndex - 1)} className="grid size-8 place-items-center rounded-full hover:bg-secondary disabled:opacity-30" aria-label="Halaman sebelumnya"><ChevronLeft className="size-4" /></button>
              <span className="font-mono text-xs text-muted-foreground">Halaman {pageIndex + 1} / {pdf?.numPages ?? '–'}</span>
              <button type="button" disabled={!pdf || pageIndex >= pdf.numPages - 1} onClick={() => goToPage(pageIndex + 1)} className="grid size-8 place-items-center rounded-full hover:bg-secondary disabled:opacity-30" aria-label="Halaman berikutnya"><ChevronRight className="size-4" /></button>
            </div>
            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-auto p-3 sm:p-4"
              onPointerDown={() => setSelected(null)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
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
                  renderOverlay={(page) => (<>
                  {/* Date boxes */}
                  {slots.filter((s) => s.page === page && s.date).map((s) => {
                    const color = colorOf(s.role_code)
                    const editable = canEdit(s.role_code)
                    const b = s.date!
                    const isSelected = selected === s.key && selectedPart === 'date'
                    return (
                      <div
                        key={`date-${s.key}`}
                        onPointerDown={editable ? (e) => onPointerDown(e, s.key, 'move', 'date') : undefined}
                        className={`absolute grid touch-none place-items-center ${editable ? 'cursor-move' : 'pointer-events-none opacity-45'}`}
                        style={{
                          left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`,
                          border: `2px dashed ${color}`, background: `${color}14`,
                          boxShadow: isSelected ? `0 0 0 3px #fff, 0 0 0 5px ${color}` : undefined,
                          zIndex: isSelected ? 5 : undefined,
                        }}
                        title="Tanggal persetujuan dicetak di sini — geser bebas, atau hapus bila tidak perlu"
                      >
                        <span className="absolute left-0 top-0 flex -translate-y-full items-center gap-0.5 whitespace-nowrap rounded-t font-mono text-[10px] font-bold text-white" style={{ background: color }}>
                          <span className="pointer-events-none px-1.5 py-0.5">TGL {s.role_code}</span>
                          {editable && (
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); toggleDate(s.key, false) }}
                              className="mr-0.5 grid size-5 place-items-center rounded hover:bg-white/25"
                              aria-label={`Hapus tanggal ${s.role_code}`}
                              title="Hapus kotak tanggal (tanggal tidak dicetak)"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          )}
                        </span>
                        <span className="pointer-events-none font-mono text-[10px] font-semibold" style={{ color }}>{sampleDate}</span>
                        {editable && (
                          <span
                            onPointerDown={(e) => onPointerDown(e, s.key, 'resize', 'date')}
                            className="absolute -bottom-1.5 -right-1.5 size-3.5 cursor-nwse-resize touch-none rounded-sm border-2 border-white"
                            style={{ background: color }}
                            aria-label="Ubah ukuran kotak tanggal"
                          />
                        )}
                      </div>
                    )
                  })}

                  {/* QR boxes */}
                  {slots.filter((s) => s.page === page).map((s) => {
                    const role = roles.find((r) => r.code === s.role_code)
                    const color = colorOf(s.role_code)
                    const editable = canEdit(s.role_code)
                    const isSelected = selected === s.key && selectedPart === 'qr'
                    const multiple = countFor(s.role_code) > 1
                    return (
                      <div
                        key={s.key}
                        onPointerDown={editable ? (e) => onPointerDown(e, s.key, 'move') : undefined}
                        className={`absolute touch-none ${editable ? 'cursor-move' : 'pointer-events-none opacity-45'}`}
                        style={{
                          left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%`, height: `${s.h * 100}%`,
                          border: `2px solid ${color}`, background: `${color}22`,
                          boxShadow: isSelected ? `0 0 0 3px #fff, 0 0 0 5px ${color}` : undefined,
                          zIndex: isSelected ? 5 : undefined,
                        }}
                        title={role ? `${role.code} — ${role.person_name}` : s.role_code}
                      >
                        <span
                          className="absolute left-0 top-0 flex -translate-y-full items-center gap-0.5 whitespace-nowrap rounded-t font-mono text-[10px] font-bold text-white"
                          style={{ background: color }}
                        >
                          <span className="pointer-events-none px-1.5 py-0.5">
                            {!editable && <Lock className="mr-0.5 inline size-2.5" />}QR {s.role_code}{multiple ? ` ${indexOf(s)}` : ''}
                          </span>
                          {editable && isSelected && (
                            <>
                              <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); addPlacement(s.role_code, s) }}
                                className="grid size-5 place-items-center rounded hover:bg-white/25"
                                aria-label="Salin QR ini"
                                title="Salin QR (Ctrl+C lalu Ctrl+V di halaman lain)"
                              >
                                <Copy className="size-3" />
                              </button>
                              <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); removeSlot(s.key) }}
                                className="mr-0.5 grid size-5 place-items-center rounded hover:bg-white/25"
                                aria-label="Hapus QR ini"
                                title="Hapus (Delete)"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </>
                          )}
                        </span>
                        {editable && (
                          <span
                            onPointerDown={(e) => onPointerDown(e, s.key, 'resize')}
                            className="absolute -bottom-1.5 -right-1.5 size-3.5 cursor-nwse-resize touch-none rounded-sm border-2 border-white"
                            style={{ background: color }}
                            aria-label="Ubah ukuran"
                          />
                        )}
                      </div>
                    )
                  })}
                </>)}
                />
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="flex max-h-[46vh] min-h-0 flex-col gap-4 overflow-y-auto border-t border-border p-5 lg:max-h-none lg:border-l lg:border-t-0">
            {myRoles.length > 0 && (
              <button type="button" onClick={runDetect} disabled={!pdf || busy !== null} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {busy === 'detect' ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Deteksi otomatis
              </button>
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              Geser kotak <strong>QR</strong> ke kolom tanda tangan, tarik sudutnya untuk ukuran. Kotak <strong>TGL</strong> (putus-putus) tempat tanggal approve dicetak — geser ke mana saja, atau hapus dengan ikon <Trash2 className="inline size-3" /> bila tidak perlu.
              {' '}Perlu tanda tangan di lebih dari satu tempat? Klik kotak, tekan <kbd className="rounded border border-border px-1 font-mono text-[10px]">Ctrl</kbd>+<kbd className="rounded border border-border px-1 font-mono text-[10px]">C</kbd>, gulir ke halaman tujuan, lalu <kbd className="rounded border border-border px-1 font-mono text-[10px]">Ctrl</kbd>+<kbd className="rounded border border-border px-1 font-mono text-[10px]">V</kbd> — atau pakai tombol salin.
            </p>

            {message && <p className={`rounded-xl border px-3 py-2.5 text-xs leading-5 ${message.ok ? 'border-emerald-600/25 bg-emerald-600/10 text-emerald-800' : 'border-amber-500/40 bg-amber-50 text-amber-900'}`}>{message.text}</p>}

            {(() => {
              const mineAll = slots.filter((s) => canEdit(s.role_code))
              if (!mineAll.length) return null
              const withDate = mineAll.filter((s) => s.date).length
              return (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">Tanggal approve</p>
                    <p className="text-[11px] text-muted-foreground">{withDate === 0 ? 'Tidak dicetak di QR mana pun' : `Dicetak di ${withDate} dari ${mineAll.length} QR`}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={withDate > 0}
                    aria-label="Cetak tanggal approve di semua QR"
                    onClick={() => setAllDates(withDate === 0)}
                    className={`relative h-6 w-11 flex-none rounded-full transition ${withDate > 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${withDate > 0 ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
              )
            })()}

            <div className="flex flex-col gap-2">
              {myRoles.map((role) => {
                const mine = slots.filter((s) => s.role_code === role.code)
                const color = colorOf(role.code)
                const template = mine.find((s) => s.key === selected) ?? mine[mine.length - 1]
                return (
                  <div key={role.code} className="rounded-xl border border-border p-3">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-1 size-3 flex-none rounded-sm" style={{ background: color }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{role.person_name} <span className="font-mono text-[10px] text-muted-foreground">{role.code}</span></p>
                        <p className="truncate text-xs text-muted-foreground">{role.title}</p>
                        {mine.length === 0 && <p className="mt-1 text-xs font-medium text-amber-700">Belum ditempatkan — QR tidak akan tercetak di dokumen</p>}
                      </div>
                    </div>

                    {mine.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {mine.map((s, i) => (
                          <li key={s.key} className={`rounded-lg border px-2.5 py-2 ${selected === s.key ? 'border-[color:var(--p-600)] bg-[color:var(--p-600)]/5' : 'border-border'}`}>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => { scrollToSpot(scrollRef, pageRefs, s.page, s.y + s.h / 2); setSelected(s.key) }} className="min-w-0 flex-1 text-left text-xs font-semibold text-foreground hover:underline">
                                QR {i + 1} · Halaman {s.page + 1}
                              </button>
                              <button type="button" onClick={() => removeSlot(s.key)} aria-label={`Hapus QR ${i + 1}`} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3.5" /></button>
                            </div>
                            <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-[11px] text-foreground">
                              <input type="checkbox" checked={!!s.date} onChange={(e) => toggleDate(s.key, e.target.checked)} className="size-3.5 accent-[color:var(--primary)]" />
                              Cetak tanggal approve
                              {s.date && <span className="text-muted-foreground">{dateCols[s.page] && !manualDate.current.has(s.key) ? '· kolom TANGGAL' : '· posisi bebas'}</span>}
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => addPlacement(role.code, template)} disabled={!pdf} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-secondary disabled:opacity-50">
                        {template ? <Copy className="size-3" /> : <MousePointerClick className="size-3" />}
                        {template ? `Salin QR ke halaman ${pageIndex + 1}` : 'Taruh di halaman ini'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {otherRoles.length > 0 && (
              <div className="rounded-xl border border-dashed border-border px-3 py-2.5">
                <p className="font-mono-label text-[10px] text-muted-foreground">{approverMode ? 'Approver lain (lihat saja)' : 'Lainnya'}</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {otherRoles.map((role) => (
                    <li key={role.code} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="size-2.5 flex-none rounded-sm opacity-60" style={{ background: colorOf(role.code) }} />
                      <span className="min-w-0 flex-1 truncate">{role.person_name} · {role.code}</span>
                      <span>{countFor(role.code)} QR</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-auto flex flex-col gap-2 pt-2">
              {myRoles.length > 0 && (
                <button type="button" onClick={save} disabled={busy !== null || (!dirty && !saveLabel)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {busy === 'save' ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {saveLabel ?? 'Simpan posisi'}
                </button>
              )}
              {secondaryAction && (
                <button type="button" onClick={secondaryAction.run} disabled={busy !== null} className="text-center text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50">
                  {secondaryAction.label}
                </button>
              )}
              {!approverMode && (
                <>
                  <a
                    href={`${API_BASE_PATH}/api/prosedur-isms/${documentId}/pdf?preview=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={dirty}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary ${dirty ? 'pointer-events-none opacity-50' : ''}`}
                  >
                    <Eye className="size-4" /> Pratinjau PDF dengan QR contoh
                  </a>
                  {dirty && <p className="text-center text-[11px] text-muted-foreground">Simpan dulu untuk melihat pratinjau.</p>}
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
