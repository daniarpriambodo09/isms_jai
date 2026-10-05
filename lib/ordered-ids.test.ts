import { describe, it, expect } from 'vitest'
import { moveItem, parseOrderedIds } from './ordered-ids'

describe('hand-ordered lists', () => {
  it('accepts a list of distinct positive integers only', () => {
    expect(parseOrderedIds([3, 1, 2])).toEqual([3, 1, 2])
    expect(parseOrderedIds([])).toBeNull()
    expect(parseOrderedIds('1,2')).toBeNull()
    expect(parseOrderedIds([1, 1])).toBeNull()
    expect(parseOrderedIds([1, -2])).toBeNull()
    expect(parseOrderedIds([1, '2'])).toBeNull()
    expect(parseOrderedIds([1, 2, 3], 2)).toBeNull()
  })

  it('moves an item without touching the original list', () => {
    const list = ['a', 'b', 'c', 'd']
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(list, 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(list).toEqual(['a', 'b', 'c', 'd'])
  })
})
