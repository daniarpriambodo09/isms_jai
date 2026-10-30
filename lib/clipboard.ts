// lib/clipboard.ts
//
// Cross-browser clipboard helper with fallback for insecure HTTP / intranet contexts.

/**
 * Copies text to the system clipboard, falling back to document.execCommand('copy')
 * if navigator.clipboard is unavailable or restricted.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false

  // 1. Try modern navigator.clipboard API if available and document is focused
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Continue to fallback
    }
  }

  // 2. Fallback using temporary textarea (works on HTTP intranet / non-secure contexts)
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '-9999px'
    textarea.style.fontSize = '12pt'
    textarea.style.border = '0'
    textarea.style.padding = '0'
    textarea.style.margin = '0'
    textarea.setAttribute('readonly', '')
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)
    let successful = false
    try {
      successful = document.execCommand('copy')
    } catch {
      successful = false
    }
    document.body.removeChild(textarea)
    return successful
  } catch {
    return false
  }
}

export const copyToClipboard = copyText

/**
 * Attempts to read text from the system clipboard.
 * Returns null if permissions are denied, unsupported, or if on an insecure context.
 */
export async function readClipboardText(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  if (navigator?.clipboard?.readText) {
    try {
      return await navigator.clipboard.readText()
    } catch {
      return null
    }
  }
  return null
}
