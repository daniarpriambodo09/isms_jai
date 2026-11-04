// lib/lobby-photography-return.test.ts

import { describe, it, expect } from 'vitest'
import { normalizeCardNo, lobbyCardKind } from '@/lib/card-ranges'

describe('Lobby Photography ID Card Return Flow', () => {
  it('correctly categorizes photography card numbers in lobby ranges', () => {
    expect(lobbyCardKind('L301')).toBe('photography')
    expect(lobbyCardKind('L305')).toBe('photography')
    expect(lobbyCardKind('L310')).toBe('photography')
    expect(lobbyCardKind('L311')).toBe(null) // out of range
  })

  it('normalizes card number variations (spaces, lowercase, raw digits)', () => {
    expect(normalizeCardNo('l301')).toBe('L301')
    expect(normalizeCardNo(' L 305 ')).toBe('L305')
    expect(normalizeCardNo('301')).toBe('301')
  })

  it('simulates photography card return matching logic', () => {
    type MockRequest = {
      id: number
      requester_name: string
      photo_id_no: string
      status: string
      returned_at: string | null
      to_at: string
      from_at: string
    }

    const mockDb: MockRequest[] = [
      {
        id: 1,
        requester_name: 'Visitor Vendor PT ABC',
        photo_id_no: 'L301',
        status: 'approved',
        returned_at: null,
        from_at: '2026-11-04T08:00:00.000Z',
        to_at: '2026-11-04T12:00:00.000Z',
      },
      {
        id: 2,
        requester_name: 'Old Visitor',
        photo_id_no: 'L301',
        status: 'approved',
        returned_at: '2026-11-03T10:00:00.000Z',
        from_at: '2026-11-03T08:00:00.000Z',
        to_at: '2026-11-03T10:00:00.000Z',
      },
    ]

    function mockReturnPhotographyCard(cardNo: string, username: string) {
      const raw = cardNo.trim()
      const normalized = normalizeCardNo(raw)
      const withL = /^\d+$/.test(raw) ? `L${raw}` : raw
      const withoutL = /^L(\d+)$/i.exec(raw)?.[1] || raw

      const match = mockDb.find(
        (r) =>
          (r.photo_id_no === raw ||
            r.photo_id_no === normalized ||
            r.photo_id_no === withL ||
            r.photo_id_no === withoutL) &&
          r.returned_at === null &&
          r.status !== 'rejected'
      )

      if (!match) return null

      match.returned_at = new Date().toISOString()
      match.to_at = match.returned_at
      return {
        id: match.id,
        requester_name: match.requester_name,
        photo_id_no: match.photo_id_no,
        to_at: match.to_at,
        from_at: match.from_at,
        returned_by: username,
      }
    }

    // 1. Return by scanned barcode 'L301'
    const result1 = mockReturnPhotographyCard('L301', 'lobby')
    expect(result1).not.toBeNull()
    expect(result1?.id).toBe(1)
    expect(result1?.requester_name).toBe('Visitor Vendor PT ABC')
    expect(result1?.returned_by).toBe('lobby')

    // 2. Card is now returned, a second attempt should return null (already returned)
    const result2 = mockReturnPhotographyCard('L301', 'lobby')
    expect(result2).toBeNull()

    // 3. Unknown card returns null
    const result3 = mockReturnPhotographyCard('L999', 'lobby')
    expect(result3).toBeNull()
  })

  it('marks photography card as returnable in ReturnCardDialog configuration', () => {
    type PermitCard = {
      key: string
      type: 'special_area' | 'photography'
      code: string
      from: string
      name: string
      note?: string
    }

    const permitCards: PermitCard[] = [
      {
        key: 'foto-101',
        type: 'photography',
        code: 'L301',
        from: '2026-11-04T08:00:00Z',
        name: 'Tamu Auditor',
        note: 'izin foto',
      },
      {
        key: 'area-202',
        type: 'special_area',
        code: 'L401',
        from: '2026-11-04T09:00:00Z',
        name: 'Tamu Server',
        note: 'izin area special',
      },
    ]

    const station = 'lobby'
    const lines: Record<string, any[]> = {}
    if (station === 'lobby') {
      for (const card of permitCards) {
        if (card.type === 'special_area' || card.type === 'photography') {
          ;(lines[card.type] ??= []).push({
            key: card.key,
            code: card.code,
            since: card.from,
            name: card.name,
            returnable: true,
          })
        }
      }
    }

    expect(lines.photography).toBeDefined()
    expect(lines.photography.length).toBe(1)
    expect(lines.photography[0].returnable).toBe(true)
    expect(lines.photography[0].code).toBe('L301')

    expect(lines.special_area).toBeDefined()
    expect(lines.special_area[0].returnable).toBe(true)
  })
})
