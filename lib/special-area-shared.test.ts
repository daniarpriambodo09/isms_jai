import { describe, it, expect } from 'vitest'
import { AREA_LIST_MAX, AREA_NAME_MAX, parseAreaList, parseEscort, parseEscortList } from './special-area-shared'

describe('parseAreaList', () => {
  it('trims names, collapses spaces and drops empty rows, keeping the order', () => {
    expect(parseAreaList(['  Server Room ', '', 'Office   EXIM', '   '])).toEqual({ areas: ['Server Room', 'Office EXIM'] })
  })

  it('rejects an empty list', () => {
    expect(parseAreaList([])).toHaveProperty('error')
    expect(parseAreaList(['', '  '])).toHaveProperty('error')
  })

  it('rejects duplicates regardless of case', () => {
    const result = parseAreaList(['Server Room', 'server room'])
    expect(result).toHaveProperty('error')
    expect('error' in result && result.error).toContain('dua kali')
  })

  it('rejects names that are too long and lists that are too long', () => {
    expect(parseAreaList(['x'.repeat(AREA_NAME_MAX + 1)])).toHaveProperty('error')
    expect(parseAreaList(Array.from({ length: AREA_LIST_MAX + 1 }, (_, i) => `Area ${i}`))).toHaveProperty('error')
    expect(parseAreaList(Array.from({ length: AREA_LIST_MAX }, (_, i) => `Area ${i}`))).toHaveProperty('areas')
  })

  it('rejects anything that is not a list of strings', () => {
    expect(parseAreaList('Server Room')).toHaveProperty('error')
    expect(parseAreaList(['Server Room', 42])).toHaveProperty('error')
    expect(parseAreaList(null)).toHaveProperty('error')
  })
})

describe('parseEscort', () => {
  it('trims the picked PIC pendamping, and drops the department without a name', () => {
    expect(parseEscort({ escortName: '  Teguh   Sunjoyo ', escortDept: ' PGA - IT ' })).toEqual({ name: 'Teguh Sunjoyo', dept: 'PGA - IT' })
    expect(parseEscort({ escortName: '   ', escortDept: 'PGA' })).toEqual({ name: null, dept: null })
    expect(parseEscort({ escortName: 'Heny' })).toEqual({ name: 'Heny', dept: null })
  })
})

describe('parseEscortList', () => {
  it('keeps name + department rows, dropping rows without a name', () => {
    expect(parseEscortList([{ name: ' Heny ', dept: 'QA' }, { name: '', dept: 'IT' }, { name: 'Naufal', dept: '' }]))
      .toEqual({ escorts: [{ name: 'Heny', dept: 'QA' }, { name: 'Naufal', dept: null }] })
  })

  it('allows an empty list, refuses duplicates and non-lists', () => {
    expect(parseEscortList([])).toEqual({ escorts: [] })
    expect(parseEscortList([{ name: 'Heny', dept: 'QA' }, { name: 'heny', dept: 'qa' }])).toHaveProperty('error')
    expect(parseEscortList('Heny')).toHaveProperty('error')
  })
})
