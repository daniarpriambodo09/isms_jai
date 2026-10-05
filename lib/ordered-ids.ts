// lib/ordered-ids.ts
//
// "Save this order" requests of the hand-ordered registers (department
// documents, Education & Training): the body carries the ids of one list,
// top to bottom.

/** The ids of such a request; null unless it is a non-empty list of distinct positive integers. */
export function parseOrderedIds(raw: unknown, max = 2000): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > max) return null
  const ids = raw.filter((id): id is number => Number.isInteger(id) && id > 0)
  return ids.length === raw.length && new Set(ids).size === ids.length ? ids : null
}

/** A copy of `list` with the item at `from` moved to position `to`. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
