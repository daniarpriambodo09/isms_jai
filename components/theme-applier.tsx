'use client'

import { useEffect } from 'react'
import { API_BASE_PATH } from '@/lib/config'
import { applyThemeVars, computeThemeVars, THEME_STORAGE_KEY, type ThemeParams } from '@/lib/theme'

// The inline script in app/layout.tsx paints the last-known theme from
// localStorage before first paint (no flash of the default colors). This
// then fetches the current site theme and applies/caches it, so a change an
// admin saved elsewhere reaches everyone on their next page load.
export function ThemeApplier() {
  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_PATH}/api/theme`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { theme?: { params: ThemeParams } } | null) => {
        if (cancelled || !data?.theme) return
        const vars = computeThemeVars(data.theme.params)
        applyThemeVars(vars)
        try { localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(vars)) } catch { /* storage unavailable */ }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  return null
}
