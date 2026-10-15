// lib/clipboard.ts
//
// Cross-browser clipboard helper with fallback for insecure HTTP / intranet contexts.

/**
 * Copies text to the system clipboard, falling back to document.execCommand('copy')
 * if navigator.clipboard is unavailable or restricted.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false

  // 1. Try modern navigator.clipboard API
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Continue to fallback
    }
  }

  // 2. Fallback using invisible textarea
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, text.length)
    const successful = document.execCommand('copy')
    document.body.removeChild(textarea)
    return successful
  } catch {
    return false
  }
}

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
