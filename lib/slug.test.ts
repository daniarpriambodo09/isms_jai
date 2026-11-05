// lib/slug.test.ts
import { describe, it, expect } from 'vitest'
import { slugify } from '@/lib/slug'

describe('slugify helper', () => {
  it('converts names to clean URL slugs', () => {
    expect(slugify('PPC')).toBe('ppc')
    expect(slugify('IC')).toBe('ic')
    expect(slugify('FATP - EXIM')).toBe('fatp-exim')
    expect(slugify('DE - MTC')).toBe('de-mtc')
    expect(slugify('MPC - WHS')).toBe('mpc-whs')
    expect(slugify('PRODUKSI')).toBe('produksi')
    expect(slugify('Quality & Assurance')).toBe('quality-assurance')
  })

  it('handles empty or unusual characters safely', () => {
    expect(slugify('')).toBe('')
    expect(slugify('   ')).toBe('')
    expect(slugify('---hello---')).toBe('hello')
    expect(slugify('dept 123')).toBe('dept-123')
  })
})

