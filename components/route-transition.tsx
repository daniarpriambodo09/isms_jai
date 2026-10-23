// components/route-transition.tsx
//
// Page-change animation for the portal (rendered by PortalFrame, so it
// covers every menu without touching each page). On each navigation to a
// different menu the screen is covered by six strips in the theme colours.
// While covered, a blueprint field names the destination — its title rises
// letter by letter while a rule and a counter fill to 100% — then the strips
// lift left to right, a band of the brand colour trailing each one, and the
// new page rises in underneath (.route-enter in globals.css). Not shown on
// the first load, and reduced to a plain fade for prefers-reduced-motion.

'use client'

import { useEffect, useRef, useState } from 'react'

const STRIPS = 6
// Last strip of the back layer finishes lifting at ~1140ms (see globals.css).
const TOTAL_MS = 1200

function Title({ text }: { text: string }) {
  const letters = Array.from(text).length
  const step = Math.min(24, 280 / Math.max(letters, 1))
  let index = 0
  return (
    <span aria-label={text}>
      {text.split(' ').map((word, w) => (
        <span key={`${word}-${w}`} aria-hidden className="inline-block whitespace-nowrap">
          {w > 0 && <span className="inline-block w-[0.28em]" />}
          <span className="inline-block overflow-hidden pb-[0.12em] align-bottom">
            {Array.from(word).map((letter, l) => (
              <span key={l} className="route-letter" style={{ animationDelay: `${60 + index++ * step}ms` }}>{letter}</span>
            ))}
          </span>
        </span>
      ))}
      <span aria-hidden className="route-letter text-[color:color-mix(in_oklch,var(--accent)_75%,white)]" style={{ animationDelay: `${60 + letters * step}ms` }}>.</span>
    </span>
  )
}

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
    const timer = window.setTimeout(() => setRun(null), TOTAL_MS)
    return () => window.clearTimeout(timer)
    // label changes together with pathname; only the route change matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (!run) return null
  const strips = Array.from({ length: STRIPS }, (_, i) => i)
  return (
    <div key={run.id} aria-hidden className="pointer-events-none fixed inset-0 z-[25] overflow-hidden">
      <div className="absolute inset-0 flex">
        {strips.map((i) => (
          <span key={i} className="route-strip route-strip-back h-full flex-1" style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>
      <div className="absolute inset-0 flex">
        {strips.map((i) => (
          <span key={i} className="route-strip route-strip-front h-full flex-1" style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>

      <div className="route-curtain-content absolute inset-0 grid place-items-center text-white">
        <div className="route-curtain-grid absolute inset-0" />
        <div className="relative w-[min(92vw,56rem)] px-2">
          <p className="route-fade font-mono-label flex items-center gap-2 text-[10.5px] text-white/55">
            <span className="size-1.5 bg-accent" /> ISMS Portal
          </p>
          <p className="mt-4 font-display text-[clamp(2.2rem,6.4vw,5.2rem)] font-semibold leading-[1.02]">
            <Title text={run.label} />
          </p>
          <div className="mt-8 flex items-center gap-4">
            <span className="relative block h-px flex-1 bg-white/15">
              <span className="route-progress absolute inset-0 bg-accent" />
            </span>
            <span className="route-count font-mono text-[11px] tabular-nums text-white/60" />
          </div>
        </div>
      </div>
    </div>
  )
}
