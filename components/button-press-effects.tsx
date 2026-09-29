'use client'

import { useEffect } from 'react'

// One global listener gives every button in the app the same press feedback
// (a quick squash-and-bounce plus a ripple from the touch point) without
// each component opting in. The actual motion lives in globals.css under
// [data-pressing]; this only positions the ripple and restarts it per press.
const PRESSABLE = 'button, [role="button"], a[class*="rounded"], input[type="submit"], input[type="button"]'

export function ButtonPressEffects() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const timers = new WeakMap<HTMLElement, number>()

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const el = (event.target as Element | null)?.closest<HTMLElement>(PRESSABLE)
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return

      const rect = el.getBoundingClientRect()
      el.style.setProperty('--press-x', `${event.clientX - rect.left}px`)
      el.style.setProperty('--press-y', `${event.clientY - rect.top}px`)
      // The ripple is an ::after at inset:0, so the button must be its own
      // positioning context. Relative with no offsets doesn't move anything.
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative'

      // Restart the animation even on rapid repeat presses.
      el.removeAttribute('data-pressing')
      void el.offsetWidth
      el.setAttribute('data-pressing', '')

      window.clearTimeout(timers.get(el))
      timers.set(el, window.setTimeout(() => el.removeAttribute('data-pressing'), 650))
    }

    document.addEventListener('pointerdown', onPointerDown, { passive: true })
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return null
}
