// lib/rate-limit.ts
//
// In-memory brute-force guard for the admin login endpoint. Keyed by
// IP + username so a lockout on one account doesn't block a different
// admin logging in from the same IP, and an attacker can't dodge it by
// switching usernames. In-memory means it resets on server restart and
// doesn't share state across multiple server instances — an acceptable
// tradeoff for this app's single-instance deployment; swap for a shared
// store (Redis) if that ever changes.

const WINDOW_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000

type Bucket = { count: number; windowStart: number; lockedUntil: number }
const buckets = new Map<string, Bucket>()

/** Returns seconds remaining if locked out, or null if the key may proceed. */
export function isLoginLocked(key: string): number | null {
  const bucket = buckets.get(key)
  if (!bucket) return null
  const now = Date.now()
  if (bucket.lockedUntil > now) return Math.ceil((bucket.lockedUntil - now) / 1000)
  if (bucket.lockedUntil) buckets.delete(key)
  return null
}

export function recordLoginFailure(key: string): void {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now, lockedUntil: 0 })
    return
  }
  bucket.count += 1
  if (bucket.count >= MAX_ATTEMPTS) {
    bucket.lockedUntil = now + LOCKOUT_MS
  }
}

export function recordLoginSuccess(key: string): void {
  buckets.delete(key)
}
