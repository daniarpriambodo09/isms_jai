// lib/row-click.ts
//
// Lets a whole table row open its document: runs `open` unless the click
// landed on something that has its own action (a button, link, checkbox…) or
// the user was selecting text.

import type { MouseEvent } from 'react'

export function onRowClick(event: MouseEvent<HTMLElement>, open: () => void) {
  const target = event.target as HTMLElement
  if (target.closest('button, a, input, label, select, textarea, summary, [role="switch"], [role="dialog"], [role="menu"]')) return
  if (window.getSelection()?.toString()) return
  open()
}
