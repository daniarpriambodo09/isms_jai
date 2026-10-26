import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ query: async () => ({ rows: [] }) }))

describe('parseCompanions', async () => {
  const { parseCompanions } = await import('./registration-companions')

  it('keeps filled rows, drops blank rows, rejects half-filled and bad input', () => {
    expect(parseCompanions(undefined)).toBeNull()
    expect(parseCompanions([{ name: ' Budi ', idNo: '3171' }, { name: '', idNo: '' }])).toEqual([{ name: 'Budi', id_no: '3171' }])
    expect(parseCompanions([{ name: 'Budi', idNo: '' }])).toBeUndefined()
    expect(parseCompanions('x')).toBeUndefined()
    expect(parseCompanions(Array.from({ length: 21 }, () => ({ name: 'a', idNo: '1' })))).toBeUndefined()
  })
})
