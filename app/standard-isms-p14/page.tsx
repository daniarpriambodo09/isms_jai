import { Suspense } from 'react'
import { StandardIsmsP14RegisterPage } from '@/components/documents/StandardIsmsP14RegisterPage'

export const metadata = {
  title: 'Standard Requirement TMMIN — ISMS Portal',
  description: 'Standard Requirement TMMIN PT. Jatim Autocomp Indonesia',
}

export default function StandardIsmsP14Page() {
  // Suspense: the register reads ?q= (useSearchParams) to open pre-filtered.
  return (
    <Suspense fallback={null}>
      <StandardIsmsP14RegisterPage />
    </Suspense>
  )
}
