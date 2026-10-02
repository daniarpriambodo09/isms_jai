import { Suspense } from 'react'
import { ProcedureRegisterPage } from '@/components/documents/ProcedureRegisterPage'

export const metadata = {
  title: 'Working Standard — ISMS Portal',
  description: 'Working Standard PT. Jatim Autocomp Indonesia',
}

// Working standards go through the same e-sign approval as procedures, so the
// page is the shared register in its 'working_standard' kind.
// Suspense: the register reads ?q= (useSearchParams) to open pre-filtered.
export default function WorkingStandardPage() {
  return (
    <Suspense fallback={null}>
      <ProcedureRegisterPage kind="working_standard" />
    </Suspense>
  )
}
