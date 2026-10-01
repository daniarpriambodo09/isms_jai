// components/route-transition.tsx
//
// Page-change animation for the portal (rendered by PortalFrame, so it
// covers every menu without touching each page). On each navigation to a
// different menu a two-layer curtain in the theme colours shows the
// destination's name, then wipes upward to reveal the new page, whose
// content rises in underneath (.route-enter in globals.css). Not shown on
// the first load, and reduced to a plain fade for prefers-reduced-motion.

'use client'

import { useEffect, useRef, useState } from 'react'

export function RouteCurtain({ pathname, label }: { pathname: string; label: string }) {
  // Compared against the previous route (not a "first run" flag), so the
  // double effect run of React Strict Mode never fakes a navigation.
  const previous = useRef(pathname)
  const [run, setRun] = useState<{ id: number; label: string } | null>(null)

  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setRun({ id: Date.now(), label })
    const timer = window.setTimeout(() => setRun(null), 1150)
    return () => window.clearTimeout(timer)
    // label changes together with pathname; only the route change matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (!run) return null
  return (
    <div key={run.id} aria-hidden className="pointer-events-none fixed inset-0 z-[25] overflow-hidden">
      <div className="route-curtain route-curtain-back absolute inset-0 bg-[color:var(--p-600)]" />
      <div className="route-curtain route-curtain-front absolute inset-0 grid place-items-center bg-[color:var(--p-950)]">
        <div className="route-curtain-label text-center text-white">
          <p className="font-mono-label text-[10.5px] text-white/55">ISMS Portal</p>
          <p className="mt-3 font-display text-[clamp(2.2rem,6vw,4.6rem)] font-semibold leading-none">
            {run.label}<span className="text-[color:color-mix(in_oklch,var(--accent)_75%,white)]">.</span>
          </p>
          <span className="route-curtain-line mx-auto mt-5 block h-[2px] w-24 origin-left bg-white/60" />
        </div>
      </div>
    </div>
  )
}
