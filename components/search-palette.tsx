// components/search-palette.tsx
//
// Global search (navbar button or Ctrl/⌘+K): every published document by
// control number or title, plus the portal's pages. Enter opens the
// highlighted result — a document opens its file in a new tab, a page
// navigates. Arrow keys move the highlight.
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CornerDownLeft, FileText, Loader2, Search, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

type Hit = { group: string; title: string; subtitle: string; href: string; filePath: string | null; mimeType: string | null }

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!open) return
    setQ('')
    setResults([])
    setActive(0)
    const t = window.setTimeout(() => inputRef.current?.focus(), 30)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.clearTimeout(t); document.body.style.overflow = prevOverflow }
  }, [open])

  // Debounced fetch; a newer query aborts the older request.
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setResults([]); setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true)
    const t = window.setTimeout(() => {
      fetch(`${API_BASE_PATH}/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal, cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d) => { setResults(d.results ?? []); setActive(0); setLoading(false) })
        .catch((e) => { if (e?.name !== 'AbortError') setLoading(false) })
    }, 180)
    return () => { window.clearTimeout(t); ctrl.abort() }
  }, [q])

  const groups = useMemo(() => {
    const map = new Map<string, { hit: Hit; index: number }[]>()
    results.forEach((hit, index) => map.set(hit.group, [...(map.get(hit.group) ?? []), { hit, index }]))
    return [...map.entries()]
  }, [results])

  const openHit = (hit: Hit, newTabForPage = false) => {
    onClose()
    if (hit.filePath) {
      window.open(`${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(hit.filePath)}`, '_blank', 'noopener')
    } else if (newTabForPage) {
      window.open(`${API_BASE_PATH}${hit.href}`, '_blank', 'noopener')
    } else {
      router.push(hit.href)
    }
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose() }
    else if (event.key === 'ArrowDown') { event.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (event.key === 'Enter' && results[active]) { event.preventDefault(); openHit(results[active], event.ctrlKey || event.metaKey) }
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/45 px-4 pt-[12vh] backdrop-blur-sm max-[680px]:pt-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cari dokumen"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="flex max-h-[72vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-popover text-popover-foreground shadow-2xl max-[680px]:max-h-[calc(100vh-2rem)]"
        style={{ animation: 'dropdown-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
      >
        <div className="flex items-center gap-3 border-b border-border px-5">
          {loading ? <Loader2 className="size-5 flex-none animate-spin text-muted-foreground" /> : <Search className="size-5 flex-none text-muted-foreground" />}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nomor dokumen, judul prosedur, form, materi…"
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
            aria-controls="search-results"
            aria-activedescendant={results[active] ? `search-hit-${active}` : undefined}
          />
          <button type="button" onClick={onClose} className="grid size-8 flex-none place-items-center rounded-full text-muted-foreground hover:bg-secondary" aria-label="Tutup pencarian"><X className="size-4" /></button>
        </div>

        <div ref={listRef} id="search-results" role="listbox" className="flex-1 overflow-y-auto p-2">
          {q.trim().length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Ketik minimal 2 huruf — mis. <span className="font-mono">ISMS-P-005</span>, &ldquo;password&rdquo;, &ldquo;foto&rdquo;.</p>
          ) : !loading && !results.length ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Tidak ada hasil untuk &ldquo;{q.trim()}&rdquo;.</p>
          ) : (
            groups.map(([group, hits]) => (
              <div key={group} className="pb-1">
                <p className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70">{group}</p>
                {hits.map(({ hit, index }) => (
                  <button
                    key={`${group}-${index}`}
                    id={`search-hit-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={index === active}
                    type="button"
                    onMouseMove={() => setActive(index)}
                    onClick={(e) => openHit(hit, e.ctrlKey || e.metaKey)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${index === active ? 'bg-secondary' : ''}`}
                  >
                    <span className={`grid size-9 flex-none place-items-center rounded-lg ${index === active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-[color:var(--p-600)]'}`}>
                      {hit.filePath ? <FileText className="size-4" /> : <ArrowRight className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{hit.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{hit.subtitle}</span>
                    </span>
                    {index === active && <CornerDownLeft className="size-4 flex-none text-muted-foreground" />}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">
          <span><kbd className="rounded border border-border px-1 font-mono">↑</kbd> <kbd className="rounded border border-border px-1 font-mono">↓</kbd> pilih</span>
          <span><kbd className="rounded border border-border px-1 font-mono">Enter</kbd> buka (dokumen di tab baru)</span>
          <span><kbd className="rounded border border-border px-1 font-mono">Esc</kbd> tutup</span>
        </div>
      </div>
    </div>
  )
}
