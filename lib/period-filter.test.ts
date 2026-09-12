import { describe, it, expect } from 'vitest'
import { MONTH_LABELS, availableYears, matchesPeriod } from './period-filter'

describe('period-filter', () => {
  it('has exactly 12 month labels', () => {
    expect(MONTH_LABELS).toHaveLength(12)
  })

  describe('availableYears', () => {
    it('returns distinct years, newest first', () => {
      const items = [
        { d: '2026-01-15T00:00:00Z' },
        { d: '2024-06-01T00:00:00Z' },
        { d: '2026-09-01T00:00:00Z' },
        { d: '2025-03-01T00:00:00Z' },
      ]
      expect(availableYears(items, (i) => i.d)).toEqual([2026, 2025, 2024])
    })

    it('returns an empty array for an empty list', () => {
      expect(availableYears([] as { d: string }[], (i) => i.d)).toEqual([])
    })

    it('collapses duplicate years into one entry', () => {
      const items = [{ d: '2026-01-01T00:00:00Z' }, { d: '2026-12-31T00:00:00Z' }]
      expect(availableYears(items, (i) => i.d)).toEqual([2026])
    })
  })

  describe('matchesPeriod', () => {
    const date = '2026-09-08T10:00:00Z'

    it('matches when no month or year filter is set', () => {
      expect(matchesPeriod(date, '', '')).toBe(true)
    })

    it('matches on the correct year', () => {
      expect(matchesPeriod(date, '', '2026')).toBe(true)
    })

    it('rejects a different year', () => {
      expect(matchesPeriod(date, '', '2025')).toBe(false)
    })

    it('matches on the correct month (0-indexed, September = 8)', () => {
      expect(matchesPeriod(date, '8', '')).toBe(true)
    })

    it('rejects a different month', () => {
      expect(matchesPeriod(date, '0', '')).toBe(false)
    })

    it('requires both month and year to match when both are set', () => {
      expect(matchesPeriod(date, '8', '2026')).toBe(true)
      expect(matchesPeriod(date, '8', '2025')).toBe(false)
      expect(matchesPeriod(date, '0', '2026')).toBe(false)
    })
  })
})
