'use client'

// Tells the boot script (lib/browser-boot.ts) that the app has started: once
// this effect runs, React is alive in this browser, so the "halaman tidak
// dapat dimuat" notice is not shown (and is removed if it already was).

import { useEffect } from 'react'

export function AppReady() {
  useEffect(() => {
    ;(window as unknown as { __ismsReady?: boolean }).__ismsReady = true
    document.getElementById('isms-boot-notice')?.remove()
  }, [])
  return null
}
