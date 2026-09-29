'use client'

// Wraps a full-bleed image so it "opens" as it scrolls into view: it starts
// as a slightly smaller rounded card and widens to edge-to-edge by the time
// its top reaches the upper part of the viewport. Drives a single CSS var
// (--ap, 0→1); the look lives in .scroll-aperture in app/globals.css. When
// the var is unset (SSR, reduced motion) the image simply shows fully open.

import { useEffect, useRef } from 'react'

export function ScrollAperture({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const update = () => {
      frame = 0
      const top = el.getBoundingClientRect().top
      const vh = window.innerHeight
      const progress = Math.min(1, Math.max(0, (vh - top) / (vh * 0.7)))
      el.style.setProperty('--ap', progress.toFixed(3))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return <div ref={ref} className={`scroll-aperture ${className}`}>{children}</div>
}
