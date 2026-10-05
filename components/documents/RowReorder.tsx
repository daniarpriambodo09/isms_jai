'use client'

// The "No." column of the document registers, and — where the ISM Admin may
// arrange the list by hand — the controls to do it: a grip to drag the row to
// another position (like moving a row in a spreadsheet) and up / down buttons
// (the way to do it on a phone, and across pages).

import { useState, type DragEvent } from 'react'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'

export { moveItem } from '@/lib/ordered-ids'

/**
 * Drag a row by its grip onto another row. `onDrop(fromKey, toKey)` runs when
 * it is dropped on a different row. Spread `handle(key)` on the grip and
 * `row(key)` on the <tr>.
 */
export function useDragReorder(onDrop: (fromKey: string, toKey: string) => void) {
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const end = () => { setDragKey(null); setOverKey(null) }
  return {
    dragKey,
    overKey,
    handle: (key: string) => ({
      draggable: true,
      onDragStart: (e: DragEvent<HTMLElement>) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', key)
        // The whole row follows the pointer, not just the grip.
        const row = e.currentTarget.closest('tr')
        if (row) e.dataTransfer.setDragImage(row, 24, 20)
        setDragKey(key)
      },
      onDragEnd: end,
    }),
    row: (key: string) => ({
      onDragOver: (e: DragEvent<HTMLElement>) => {
        if (!dragKey) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (overKey !== key) setOverKey(key)
      },
      onDrop: (e: DragEvent<HTMLElement>) => {
        if (!dragKey) return
        e.preventDefault()
        if (dragKey !== key) onDrop(dragKey, key)
        end()
      },
    }),
    /** Classes for a row: faded while dragged, a line where it would land. */
    rowClass: (key: string) => (dragKey === key ? 'opacity-40' : overKey === key && dragKey ? 'shadow-[inset_0_3px_0_0_var(--primary)]' : ''),
  }
}

export const NO_HEAD_CLASS = 'w-px whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground'

/** Content of a "No." cell: the number, with the reorder controls when `reorder` is given. */
export function OrderCell({
  number,
  label,
  reorder,
}: {
  number: number
  /** What the row is called, for the controls' accessible names. */
  label: string
  reorder?: {
    handleProps: ReturnType<ReturnType<typeof useDragReorder>['handle']>
    canUp: boolean
    canDown: boolean
    onUp: () => void
    onDown: () => void
  }
}) {
  const numberEl = <span className="min-w-[1.5rem] text-center font-mono text-[13px] font-semibold tabular-nums text-muted-foreground">{number}</span>
  if (!reorder) return numberEl
  const arrow = 'grid h-4 w-5 max-[680px]:h-7 max-[680px]:w-9 place-items-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent'
  return (
    <div className="flex items-center gap-1">
      <span
        {...reorder.handleProps}
        role="button"
        tabIndex={-1}
        aria-label={`Geser ${label} ke posisi lain`}
        title="Tarik untuk memindahkan baris"
        className="grid size-7 cursor-grab place-items-center rounded-md text-muted-foreground/70 transition hover:bg-secondary hover:text-foreground active:cursor-grabbing max-[680px]:hidden"
      >
        <GripVertical className="size-4" />
      </span>
      {numberEl}
      <span className="flex flex-col">
        <button type="button" disabled={!reorder.canUp} onClick={reorder.onUp} aria-label={`Naikkan ${label}`} title="Naikkan satu baris" className={arrow}><ChevronUp className="size-3.5" /></button>
        <button type="button" disabled={!reorder.canDown} onClick={reorder.onDown} aria-label={`Turunkan ${label}`} title="Turunkan satu baris" className={arrow}><ChevronDown className="size-3.5" /></button>
      </span>
    </div>
  )
}
