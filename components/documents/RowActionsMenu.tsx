'use client'

// A "⋯ Kelola" button that opens a small menu of row actions — used in the
// registers' Catatan Pengesahan cell so several buttons don't stack and make
// every row tall. The menu is drawn in a portal with a fixed position (the
// table scrolls sideways and would clip it), and closes on choosing an item,
// clicking elsewhere, Escape, scrolling or resizing.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, MoreHorizontal } from 'lucide-react'

export type RowAction = {
  key: string
  icon: ReactNode
  label: string
  /** Small text on the right (a count, a state). */
  detail?: string
  /** Draws attention: something here still needs doing. */
  attention?: boolean
  disabled?: boolean
  busy?: boolean
  onSelect: () => void
}

const MENU_WIDTH = 248

export function RowActionsMenu({ actions, label = 'Kelola' }: { actions: RowAction[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Under the button; flipped above it when there is no room below.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const r = buttonRef.current.getBoundingClientRect()
    const height = menuRef.current?.offsetHeight ?? actions.length * 40 + 12
    const below = r.bottom + 6 + height <= window.innerHeight - 8
    setPlace({
      top: below ? r.bottom + 6 : Math.max(8, r.top - 6 - height),
      left: Math.min(Math.max(8, r.left), window.innerWidth - MENU_WIDTH - 8),
    })
  }, [open, actions.length])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) close()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); buttonRef.current?.focus() } }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  if (!actions.length) return null
  const attention = actions.some((a) => a.attention)
  const busy = actions.some((a) => a.busy)

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`relative inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${open ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-secondary'}`}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <MoreHorizontal className="size-3.5" />} {label}
        {attention && <span title="Ada yang perlu dilengkapi" className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-amber-500" />}
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          className="fixed z-[70] flex flex-col rounded-xl border border-border bg-card p-1.5 shadow-xl"
          style={{ top: place?.top ?? -9999, left: place?.left ?? -9999, width: MENU_WIDTH }}
        >
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              disabled={action.disabled || action.busy}
              onClick={() => { setOpen(false); action.onSelect() }}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
            >
              <span className={`grid size-6 flex-none place-items-center rounded-md ${action.attention ? 'bg-amber-100 text-amber-800' : 'bg-secondary text-secondary-foreground'}`}>{action.busy ? <Loader2 className="size-3.5 animate-spin" /> : action.icon}</span>
              <span className="min-w-0 flex-1">{action.label}</span>
              {action.detail && <span className={`flex-none rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold ${action.attention ? 'bg-amber-100 text-amber-800' : 'bg-secondary text-muted-foreground'}`}>{action.detail}</span>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
