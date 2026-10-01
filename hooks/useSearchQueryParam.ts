// hooks/useSearchQueryParam.ts
//
// Pre-fills a register's search box from ?q= in the URL — used by links in
// admin emails, the notification bell, the dashboard and the global search
// to open a register already filtered to one document. Follows the URL, so it
// also works when the user is already on that page. Pages using it must be
// wrapped in <Suspense> (useSearchParams).
'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export function useSearchQueryParam(setQuery: (value: string) => void) {
  const q = useSearchParams().get('q')
  useEffect(() => {
    if (q) setQuery(q)
  }, [q, setQuery])
}
