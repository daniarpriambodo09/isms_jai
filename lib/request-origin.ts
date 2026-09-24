// lib/request-origin.ts
//
// Resolving the base URL for links meant to be opened by SOMEONE ELSE'S
// device — email approve/reject buttons, the redirect after clicking one,
// a QR code printed on a PDF. These always use the admin-configured App
// URL (see the field's help text in /kelola-smtp: include the scheme and
// port, e.g. http://192.168.1.40:3009) rather than whatever host the
// current request happened to arrive on — that origin depends on how
// *this one* device reached the app (could be localhost, a dev port,
// anything), which has nothing to do with what's reachable for whoever
// opens the email or scans the QR code later. A fallback origin is only
// used if the App URL hasn't been configured at all.
export function resolveAppBaseUrl(appUrl: string | null | undefined, fallbackOrigin?: string): string {
  const trimmed = (appUrl ?? '').trim()
  if (!trimmed) return fallbackOrigin ?? ''
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  return withScheme.replace(/\/$/, '')
}
