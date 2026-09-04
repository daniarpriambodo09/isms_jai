// hooks/usePagination.ts
'use client'

import { useEffect, useMemo, useState } from 'react'

// Client-side pagination over an already-fetched/filtered list — keeps existing
// search/highlight behavior untouched (still operates over the full list), just
// bounds how many rows actually render into the DOM at once.
export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  // Snap back to a valid page whenever the filtered list shrinks (e.g. a search
  // narrows the results) so the user doesn't land on a now-empty page.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  return { page, setPage, totalPages, pageItems, pageSize }
}
