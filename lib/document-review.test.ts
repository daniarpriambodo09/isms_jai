import { describe, it, expect } from 'vitest'
import { weekKey } from './document-review'

describe('weekKey (Monday of the week, WIB)', () => {
  it('maps every day of a week to its Monday', () => {
    // Mon 28 Sep 2026 … Sun 4 Oct 2026 (WIB noon)
    for (let d = 28; d <= 34; d++) {
      const day = new Date(Date.UTC(2026, 8, d, 5)) // 12:00 WIB
      expect(weekKey(day)).toBe('2026-09-28')
    }
  })

  it('uses the WIB date, not UTC', () => {
    // Sun 4 Oct 2026 20:00 UTC is already Mon 5 Oct 03:00 WIB → new week.
    expect(weekKey(new Date('2026-10-04T20:00:00Z'))).toBe('2026-10-05')
    // Sun 4 Oct 2026 16:00 UTC is Sun 23:00 WIB → still the old week.
    expect(weekKey(new Date('2026-10-04T16:00:00Z'))).toBe('2026-09-28')
  })
})
