import { describe, expect, it } from 'vitest'
import { lobbyCardKind, lobbyCardProblem, lobbyCardRangeText, normalizeCardNo } from './card-ranges'

describe('card ranges', () => {
  it('tells the kind of a Lobby card from its number', () => {
    expect(lobbyCardKind('L1001')).toBe('vendor')
    expect(lobbyCardKind('L1100')).toBe('vendor')
    expect(lobbyCardKind('L1101')).toBe('vendor')
    expect(lobbyCardKind('L1208')).toBe('vendor')
    expect(lobbyCardKind('L2001')).toBe('visitor')
    expect(lobbyCardKind('L2030')).toBe('visitor')
    expect(lobbyCardKind('L4001')).toBe('affiliate')
    expect(lobbyCardKind('L4030')).toBe('affiliate')
    expect(lobbyCardKind('L401')).toBe('special_area')
    expect(lobbyCardKind('L410')).toBe('special_area')
    expect(lobbyCardKind('L301')).toBe('photography')
    expect(lobbyCardKind('L310')).toBe('photography')
  })

  it('knows the edges of each block', () => {
    for (const no of ['L1000', 'L1209', 'L2000', 'L2031', 'L4000', 'L4031', 'L400', 'L411', 'L300', 'L311', 'L050', 'L0401', '1001', 'X1001', '', 'L']) {
      expect(lobbyCardKind(no), no).toBeNull()
    }
  })

  it('writes a number the one way the cards have it', () => {
    expect(normalizeCardNo(' l1001 ')).toBe('L1001')
    expect(normalizeCardNo('L 2005')).toBe('L2005')
    expect(lobbyCardKind('l4002')).toBe('affiliate')
    // not an L-number: left as typed (Pos Security's cards, older entries)
    expect(normalizeCardNo(' SEC-V-12 ')).toBe('SEC-V-12')
    expect(normalizeCardNo(undefined)).toBe('')
  })

  it('refuses a card of another kind, naming both', () => {
    expect(lobbyCardProblem('L1005', 'vendor')).toBeNull()
    expect(lobbyCardProblem('L2005', 'vendor')).toMatch(/kartu Visitor, bukan kartu Vendor/)
    expect(lobbyCardProblem('L2005', 'vendor')).toContain(lobbyCardRangeText('vendor'))
    expect(lobbyCardProblem('ABC', 'visitor')).toMatch(/bukan nomor kartu Visitor Lobby/)
  })

  it('on a permit only a number of another kind is refused', () => {
    expect(lobbyCardProblem('L405', 'special_area', false)).toBeNull()
    expect(lobbyCardProblem('KARTU-LAMA-7', 'special_area', false)).toBeNull()
    expect(lobbyCardProblem('L2005', 'special_area', false)).toMatch(/kartu Visitor/)
    expect(lobbyCardProblem('L405', 'photography', false)).toMatch(/kartu Special Area/)
  })
})
