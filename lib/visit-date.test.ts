import { describe, expect, it } from 'vitest'
import { parseVisitDate } from './visit-date'

describe('parseVisitDate', () => {
  it('accepts real dates, treats empty as walk-in, rejects the rest', () => {
    expect(parseVisitDate('2026-10-27')).toBe('2026-10-27')
    expect(parseVisitDate('')).toBeNull()
    expect(parseVisitDate(undefined)).toBeNull()
    expect(parseVisitDate('2026-02-31')).toBeUndefined()
    expect(parseVisitDate('27-10-2026')).toBeUndefined()
    expect(parseVisitDate(20261027)).toBeUndefined()
  })
})
