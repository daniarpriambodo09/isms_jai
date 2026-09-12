import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isLoginLocked, recordLoginFailure, recordLoginSuccess } from './rate-limit'

describe('rate-limit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows a key with no recorded attempts', () => {
    expect(isLoginLocked('1.2.3.4:fresh-user')).toBeNull()
  })

  it('does not lock out before reaching the max attempt count', () => {
    const key = '1.2.3.4:almost-locked'
    for (let i = 0; i < 4; i++) recordLoginFailure(key)
    expect(isLoginLocked(key)).toBeNull()
  })

  it('locks out after the max attempt count within the window', () => {
    const key = '1.2.3.4:bad-actor'
    for (let i = 0; i < 5; i++) recordLoginFailure(key)
    expect(isLoginLocked(key)).not.toBeNull()
  })

  it('reports remaining lockout seconds that count down', () => {
    const key = '1.2.3.4:countdown'
    for (let i = 0; i < 5; i++) recordLoginFailure(key)
    const first = isLoginLocked(key)
    expect(first).toBeGreaterThan(0)

    vi.advanceTimersByTime(60_000)
    const later = isLoginLocked(key)
    expect(later).not.toBeNull()
    expect(later as number).toBeLessThan(first as number)
  })

  it('expires the lockout after the lockout window passes', () => {
    const key = '1.2.3.4:expires'
    for (let i = 0; i < 5; i++) recordLoginFailure(key)
    expect(isLoginLocked(key)).not.toBeNull()

    vi.advanceTimersByTime(16 * 60 * 1000) // past the 15-minute lockout
    expect(isLoginLocked(key)).toBeNull()
  })

  it('a successful login clears any prior failure count for that key', () => {
    const key = '1.2.3.4:recovers'
    for (let i = 0; i < 4; i++) recordLoginFailure(key)
    recordLoginSuccess(key)
    // Failing once more should not immediately lock out — the counter reset.
    recordLoginFailure(key)
    expect(isLoginLocked(key)).toBeNull()
  })

  it('tracks separate keys independently', () => {
    const keyA = '1.2.3.4:userA'
    const keyB = '1.2.3.4:userB'
    for (let i = 0; i < 5; i++) recordLoginFailure(keyA)
    expect(isLoginLocked(keyA)).not.toBeNull()
    expect(isLoginLocked(keyB)).toBeNull()
  })

  it('resets the attempt count once the sliding window elapses without a lockout', () => {
    const key = '1.2.3.4:slow-attempts'
    recordLoginFailure(key)
    recordLoginFailure(key)
    vi.advanceTimersByTime(6 * 60 * 1000) // past the 5-minute window
    recordLoginFailure(key)
    recordLoginFailure(key)
    // Only 2 failures inside the new window — should not be locked.
    expect(isLoginLocked(key)).toBeNull()
  })
})
