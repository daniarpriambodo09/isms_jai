// components/kiosk/KioskTheme.tsx
'use client'

// Admin Lobby and Pos Security can each have their own colour theme (Kelola
// Tema → Admin Lobby / Pos Security) instead of the portal's. While the post's
// page is open its colours are put on <html> — so dialogs and menus drawn
// outside the page get them too — and the portal's come back on leaving.

import { useEffect, useLayoutEffect } from 'react'
import { API_BASE_PATH } from '@/lib/config'
import { KIOSK_THEME_ATTR, THEME_STORAGE_KEY, applyThemeVars, computeThemeVars, kioskThemeStorageKey, type KioskThemeTarget, type ThemeParams } from '@/lib/theme'

const readVars = (key: string): Record<string, string> | null => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null } catch { return null }
}
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function KioskTheme({ station }: { station: KioskThemeTarget }) {
  // Last known colours of this post, before the first paint (no flash of the portal's).
  useIsoLayoutEffect(() => {
    const cached = readVars(kioskThemeStorageKey(station))
    if (cached) { document.documentElement.setAttribute(KIOSK_THEME_ATTR, station); applyThemeVars(cached) }
    return () => {
      document.documentElement.removeAttribute(KIOSK_THEME_ATTR)
      applyThemeVars(readVars(THEME_STORAGE_KEY) ?? {})
    }
  }, [station])

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_PATH}/api/theme?target=${station}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { theme?: { params: ThemeParams; own: boolean } } | null) => {
        if (cancelled || !data?.theme) return
        const key = kioskThemeStorageKey(station)
        if (data.theme.own) {
          const vars = computeThemeVars(data.theme.params)
          document.documentElement.setAttribute(KIOSK_THEME_ATTR, station)
          applyThemeVars(vars)
          try { localStorage.setItem(key, JSON.stringify(vars)) } catch { /* storage unavailable */ }
        } else {
          // follows the portal: hand the page back to the portal's theme
          document.documentElement.removeAttribute(KIOSK_THEME_ATTR)
          applyThemeVars(computeThemeVars(data.theme.params))
          try { localStorage.removeItem(key) } catch { /* storage unavailable */ }
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [station])

  return null
}
