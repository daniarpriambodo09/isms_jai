import { Suspense } from 'react'
import { WorkingStandardRegisterPage } from '@/components/documents/WorkingStandardRegisterPage'

export const metadata = {
  title: 'Working Standard — ISMS Portal',
  description: 'Working Standard PT. Jatim Autocomp Indonesia',
}

export default function WorkingStandardPage() {
  // Suspense: the register reads ?q= (useSearchParams) to open pre-filtered.
  return (
    <Suspense fallback={null}>
      <WorkingStandardRegisterPage />
    </Suspense>
  )
}
