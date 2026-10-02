'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Fades each top-level block of the current page in as it scrolls into view.
// Works on whatever the page renders — no per-page opt-in — by marking the
// direct children of the page root (main > *), including ones mounted later
// (a table replacing its loading placeholder, etc.).
//
// On the first page of a visit the markup comes from the server and React is
// still hydrating it (pages inside <Suspense> hydrate a moment later). Marking
// those elements right away changes attributes React is about to compare — a
// hydration mismatch — so the first run waits until the page has settled, and
// then only takes blocks still below the fold (what is on screen is already
// shown by the frame's own entrance). Later navigations start immediately.
const HYDRATION_SETTLE_MS = 700
let hydrating = true

export function ScrollReveal({ rootId }: { rootId: string }) {
  const pathname = usePathname()

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!hydrating) return startReveal(rootId, false)

    let stop: (() => void) | undefined
    const timer = window.setTimeout(() => {
      hydrating = false
      stop = startReveal(rootId, true)
    }, HYDRATION_SETTLE_MS)
    return () => { window.clearTimeout(timer); stop?.() }
  }, [pathname, rootId])

  return null
}

function startReveal(rootId: string, belowFoldOnly: boolean) {
  const main = document.getElementById(rootId)
  const pageRoot = main?.firstElementChild as HTMLElement | null
  if (!main || !pageRoot) return

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const el = entry.target as HTMLElement
        el.dataset.reveal = 'shown'
        observer.unobserve(el)
        const onEnd = (event: AnimationEvent) => {
          if (event.target !== el) return // ignore animations bubbling up from children
          delete el.dataset.reveal
          el.style.animationDelay = ''
          el.removeEventListener('animationend', onEnd)
        }
        el.addEventListener('animationend', onEnd)
      })
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
  )

  let staggerIndex = 0
  // First run only: leave what is already on screen alone.
  let skipVisible = belowFoldOnly
  const mark = (el: Element) => {
    // 'pending' from a previous (torn-down) run still needs observing here.
    if (!(el instanceof HTMLElement) || el.dataset.reveal === 'shown') return
    // Modals/overlays rendered inline must never be hidden behind a pending reveal.
    if (getComputedStyle(el).position === 'fixed') return
    if (skipVisible && el.getBoundingClientRect().top < window.innerHeight) return
    el.dataset.reveal = 'pending'
    el.style.animationDelay = `${Math.min(staggerIndex++, 5) * 70}ms`
    observer.observe(el)
  }

  // Reveal targets: the page root's own children — or, for a page that is
  // a single wrapper, that wrapper's children.
  const targets = pageRoot.children.length > 1 ? pageRoot : (pageRoot.firstElementChild as HTMLElement | null) ?? pageRoot
  Array.from(targets.children).forEach(mark)
  skipVisible = false // blocks mounted from here on animate wherever they are

  const mutation = new MutationObserver((records) => {
    staggerIndex = 0
    records.forEach((record) => record.addedNodes.forEach((node) => node instanceof Element && mark(node)))
  })
  mutation.observe(targets, { childList: true })

  return () => {
    observer.disconnect()
    mutation.disconnect()
    // Never leave anything invisible once nothing is watching it anymore.
    targets.querySelectorAll<HTMLElement>(':scope > [data-reveal="pending"]').forEach((el) => {
      delete el.dataset.reveal
      el.style.animationDelay = ''
    })
  }
}
