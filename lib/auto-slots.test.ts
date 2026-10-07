import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { signatureKey, slotsFromHeadings, type Heading } from './auto-slots'

describe('signatureKey', () => {
  it('reads box headings and position titles alike', () => {
    expect(signatureKey('PREPARED')).toBe('PREPARED')
    expect(signatureKey('Checked (SSA)')).toBe('CHECKED')
    expect(signatureKey('APPROVED 2')).toBe('APPROVED 2')
    expect(signatureKey('Approved 1')).toBe('APPROVED 1')
    expect(signatureKey('Dibuat oleh')).toBe('PREPARED')
  })

  it('ignores ordinary text that merely mentions them', () => {
    expect(signatureKey('- Change pada kolom Prepared, Checked, dan Approved')).toBeNull()
    expect(signatureKey('KATEGORI KERAHASIAAN')).toBeNull()
    expect(signatureKey('')).toBeNull()
  })
})

// The foot of the Working Standard template (landscape Letter, 792 × 612 pt), as pdf.js reads it.
const page = { page: 0, pageW: 792, pageH: 612, y: 0.8157, h: 0.0124 }
const template: Heading[] = [
  { key: 'APPROVED 2', cx: 0.7163, ...page },
  { key: 'APPROVED 1', cx: 0.7838, ...page },
  { key: 'CHECKED', cx: 0.8513, ...page },
  { key: 'PREPARED', cx: 0.9187, ...page },
]
const roles = [
  { code: 'WS-PREP', title: 'Prepared' },
  { code: 'WS-CHK', title: 'Checked' },
  { code: 'WS-APP1', title: 'Approved 1' },
  { code: 'WS-APP2', title: 'Approved 2' },
]

describe('slotsFromHeadings', () => {
  it('puts each position under its own heading, inside the page and without overlapping', () => {
    const slots = slotsFromHeadings(template, roles)
    expect(slots.map((s) => s.role_code)).toEqual(['WS-PREP', 'WS-CHK', 'WS-APP1', 'WS-APP2'])
    const byX = [...slots].sort((a, b) => a.x - b.x)
    expect(byX.map((s) => s.role_code)).toEqual(['WS-APP2', 'WS-APP1', 'WS-CHK', 'WS-PREP'])
    for (const [i, s] of byX.entries()) {
      expect(s.y).toBeGreaterThan(page.y) // below the heading
      expect(s.y + s.h).toBeLessThanOrEqual(0.985)
      expect(s.x + s.w).toBeLessThanOrEqual(1)
      if (i) expect(s.x).toBeGreaterThanOrEqual(byX[i - 1].x + byX[i - 1].w) // side by side
      // a square on the page: same size in points both ways
      expect(s.w * page.pageW).toBeCloseTo(s.h * page.pageH, 5)
    }
  })

  it('leaves out a position whose heading is not on the sheet', () => {
    const slots = slotsFromHeadings(template.filter((h) => h.key !== 'APPROVED 2'), roles)
    expect(slots.map((s) => s.role_code)).toEqual(['WS-PREP', 'WS-CHK', 'WS-APP1'])
  })

  it('matches a single "Approved" position to "APPROVED 1", and ignores a stray mention on another line', () => {
    const stray: Heading = { key: 'PREPARED', cx: 0.3, page: 1, pageW: 792, pageH: 612, y: 0.2, h: 0.0124 }
    const slots = slotsFromHeadings([stray, ...template], [{ code: 'A', title: 'Approved' }, { code: 'P', title: 'Prepared' }])
    expect(slots.find((s) => s.role_code === 'A')!.x).toBeCloseTo(0.7838 - slots[0].w / 2, 3)
    expect(slots.find((s) => s.role_code === 'P')!.page).toBe(0)
  })

  it('returns nothing when the sheet has no signature boxes', () => {
    expect(slotsFromHeadings([], roles)).toEqual([])
  })
})
