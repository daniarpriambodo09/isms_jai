// hooks/useEscapeClose.ts
'use client'

import { useEffect } from 'react'

// Closes a modal/dialog on Escape while it's open — every modal in this app
// otherwise had no keyboard way to dismiss besides clicking the backdrop or an X button.
export function useEscapeClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])
}
