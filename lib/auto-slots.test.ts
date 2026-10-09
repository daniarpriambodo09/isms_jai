import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { effDateCells, initialsCells, signatureKey, slotsFromHeadings, type Heading, type TextItem } from './auto-slots'

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

describe('initialsCells', () => {
  const text = (str: string, cx: number, y: number, pageNo = 0): TextItem => ({ str, page: pageNo, pageW: 792, pageH: 612, cx, y, h: 0.0124 })

  it('finds the initials printed under each box, in the same column', () => {
    const items = [text('TWC', 0.7163, 0.9548), text('MRA', 0.7838, 0.9548), text('HMA', 0.8513, 0.9548), text('ISR', 0.9187, 0.9548), text('SSA', 0.44, 0.86), text('PIC', 0.44, 0.8157)]
    const cells = initialsCells(items, template)
    expect(cells.map((c) => [c.key, c.page, c.baseline])).toEqual([['APPROVED 2', 0, 0.9548], ['APPROVED 1', 0, 0.9548], ['CHECKED', 0, 0.9548], ['PREPARED', 0, 0.9548]])
  })

  it('follows the row to the top of the next page when the sheet was exported that way', () => {
    const items = [text('TWC', 0.7163, 0.0902, 1), text('MRA', 0.7838, 0.0902, 1), text('HMA', 0.8513, 0.0902, 1), text('ISR', 0.9187, 0.0902, 1)]
    expect(initialsCells(items, template).every((c) => c.page === 1 && c.baseline === 0.0902)).toBe(true)
  })

  it('gives an empty box the same place as its neighbours, or the template offset when the row is empty', () => {
    const one = initialsCells([text('ISR', 0.9187, 0.9548)], template)
    expect(one).toHaveLength(4)
    expect(one.every((c) => c.baseline === 0.9548)).toBe(true)
    const none = initialsCells([], template)
    expect(none).toHaveLength(4)
    expect(none[0].baseline).toBeCloseTo(0.8157 + 73 / 612, 5)
  })
})

describe('effDateCells', () => {
  // The ISMS header box: Doc. No. / Tanggal / Revisi / Eff. Date, values to the right.
  const at = (str: string, cx: number, y: number, w = 0.05): TextItem => ({ str, page: 0, pageW: 842, pageH: 1190, cx, y, h: 0.01, w })
  const header = [at('Doc. No.', 0.789, 0.041), at('ISMS-B-001', 0.868, 0.041, 0.063), at('Tanggal', 0.791, 0.065), at('07-Jul-26', 0.875, 0.065), at('Revisi', 0.796, 0.088, 0.031), at('15', 0.893, 0.088, 0.014), at('Eff. Date', 0.789, 0.112, 0.047)]

  it('finds the empty Eff. Date cell, in the column of the values above it', () => {
    const [cell] = effDateCells(header)
    expect(cell.page).toBe(0)
    expect(cell.baseline).toBeCloseTo(0.112)
    expect(cell.cx).toBeCloseTo(0.875)
  })

  it('leaves a cell that already has a date alone', () => {
    expect(effDateCells([...header, at('01-Aug-26', 0.875, 0.112)])).toEqual([])
  })

  it('ignores a lone colon after the label', () => {
    expect(effDateCells([...header.slice(0, 6), at('Effective Date', 0.789, 0.112), at(':', 0.82, 0.112, 0.004)])).toHaveLength(1)
  })

  it("leaves the Form Review's \"Tanggal efektif\" alone (the reviewed document's date)", () => {
    expect(effDateCells([...header.slice(0, 6), at('Tanggal efektif :', 0.789, 0.112)])).toEqual([])
  })

  it('finds nothing on a sheet without the label', () => {
    expect(effDateCells(header.slice(0, 6))).toEqual([])
  })
})
