import { describe, it, expect } from 'vitest'
import {
  APPROVAL_LINK_DAYS, MAX_SLOTS_PER_ROLE, QR_ADJUST_HOURS,
  canPlaceOwnSlots, linkExpired, parseRevisionNotes, parseSlots, qrAdjustableUntil, summarizeRevisionNotes,
  type TokenView,
} from './procedure-approval'

const DAY = 86_400_000
const NOW = new Date('2026-10-01T03:00:00Z').getTime()

describe('parseSlots', () => {
  const slot = { role_code: 'MGR', page: 0, x: 0.1, y: 0.2, w: 0.1, h: 0.05 }

  it('keeps valid placements and drops unknown roles, bad pages and out-of-range fractions', () => {
    const slots = parseSlots([
      slot,
      { ...slot, role_code: 'HACKER' },
      { ...slot, page: -1 },
      { ...slot, page: 1.5 },
      { ...slot, x: 1.2 },
      { ...slot, w: 0.001 },
      { ...slot, y: Number.NaN },
      'garbage',
    ], ['MGR'])
    expect(slots).toEqual([{ ...slot, date: null }])
  })

  it('caps placements per role', () => {
    const many = Array.from({ length: MAX_SLOTS_PER_ROLE + 3 }, () => slot)
    expect(parseSlots(many, ['MGR'])).toHaveLength(MAX_SLOTS_PER_ROLE)
  })

  it('keeps a valid date box and clears an invalid one', () => {
    const date = { x: 0.3, y: 0.3, w: 0.08, h: 0.02 }
    expect(parseSlots([{ ...slot, date }], ['MGR'])[0].date).toEqual(date)
    expect(parseSlots([{ ...slot, date: { ...date, w: 2 } }], ['MGR'])[0].date).toBeNull()
  })

  it('treats non-arrays as empty', () => {
    expect(parseSlots(null, ['MGR'])).toEqual([])
    expect(parseSlots({ role_code: 'MGR' }, ['MGR'])).toEqual([])
  })
})

describe('revision notes', () => {
  it('keeps pinned notes, turns bad pins into general notes, drops empty text', () => {
    const notes = parseRevisionNotes([
      { page: 1, x: 0.5, y: 0.5, note: '  Ganti nomor revisi  ' },
      { page: 1, x: 3, y: 0.5, note: 'pin di luar halaman' },
      { page: 0, x: 0.1, y: 0.1, note: '   ' },
    ])
    expect(notes).toEqual([
      { page: 1, x: 0.5, y: 0.5, note: 'Ganti nomor revisi' },
      { page: null, x: null, y: null, note: 'pin di luar halaman' },
    ])
  })

  it('limits note length and count', () => {
    const notes = parseRevisionNotes(Array.from({ length: 50 }, () => ({ note: 'x'.repeat(900) })))
    expect(notes).toHaveLength(30)
    expect(notes[0].note).toHaveLength(500)
  })

  it('summarizes the general note first, then pinned notes with 1-based pages', () => {
    const summary = summarizeRevisionNotes('Mohon cek ulang', [
      { page: 0, x: 0.1, y: 0.1, note: 'Typo judul' },
      { page: null, x: null, y: null, note: 'umum' },
      { page: 2, x: 0.1, y: 0.1, note: 'Tabel salah' },
    ])
    expect(summary).toBe('Mohon cek ulang\n1) Hal. 1: Typo judul\n2) Hal. 3: Tabel salah')
  })
})

describe('approval link expiry & QR lock', () => {
  const issued = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString()

  it('expires a pending link after APPROVAL_LINK_DAYS', () => {
    expect(linkExpired({ status: 'pending', token_issued_at: issued(APPROVAL_LINK_DAYS - 1) }, NOW)).toBe(false)
    expect(linkExpired({ status: 'pending', token_issued_at: issued(APPROVAL_LINK_DAYS + 1) }, NOW)).toBe(true)
  })

  it('never expires decided steps or links without an issue date', () => {
    expect(linkExpired({ status: 'approved', token_issued_at: issued(400) }, NOW)).toBe(false)
    expect(linkExpired({ status: 'pending', token_issued_at: null }, NOW)).toBe(false)
  })

  it('lets an approver adjust their QR only within QR_ADJUST_HOURS of approving', () => {
    const decided = (hoursAgo: number) => new Date(NOW - hoursAgo * 3_600_000).toISOString()
    const until = qrAdjustableUntil({ status: 'approved', decided_at: decided(1) }, NOW)
    expect(until?.getTime()).toBe(NOW - 3_600_000 + QR_ADJUST_HOURS * 3_600_000)
    expect(qrAdjustableUntil({ status: 'approved', decided_at: decided(QR_ADJUST_HOURS + 1) }, NOW)).toBeNull()
    expect(qrAdjustableUntil({ status: 'rejected', decided_at: decided(1) }, NOW)).toBeNull()
  })

  it('canPlaceOwnSlots: current revision + live link or recent approval', () => {
    const view = (step: Record<string, unknown>, docRevision = 2) => ({
      step: { revision: 2, status: 'pending', token_issued_at: issued(1), decided_at: null, ...step },
      document: { revision: docRevision },
    }) as unknown as TokenView
    expect(canPlaceOwnSlots(view({}), NOW)).toBe(true)
    expect(canPlaceOwnSlots(view({}, 3), NOW)).toBe(false) // superseded by a newer revision
    expect(canPlaceOwnSlots(view({ token_issued_at: issued(APPROVAL_LINK_DAYS + 2) }), NOW)).toBe(false)
    expect(canPlaceOwnSlots(view({ status: 'approved', decided_at: new Date(NOW - 3_600_000).toISOString() }), NOW)).toBe(true)
    expect(canPlaceOwnSlots(view({ status: 'approved', decided_at: new Date(NOW - 2 * DAY).toISOString() }), NOW)).toBe(false)
    expect(canPlaceOwnSlots(view({ status: 'rejected', decided_at: new Date(NOW - 60_000).toISOString() }), NOW)).toBe(false)
  })
})
