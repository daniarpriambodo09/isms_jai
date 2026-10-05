import { Suspense } from 'react'
import { ProcedureRegisterPage } from '@/components/documents/ProcedureRegisterPage'

export const metadata = {
  title: 'Standard Requirement TMMIN — ISMS Portal',
  description: 'Standard Requirement TMMIN PT. Jatim Autocomp Indonesia',
}

// TMMIN standards go through the same e-sign approval as procedures, so the
// page is the shared register in its 'tmmin_standard' kind.
// Suspense: the register reads ?q= (useSearchParams) to open pre-filtered.
export default function StandardIsmsP14Page() {
  return (
    <Suspense fallback={null}>
      <ProcedureRegisterPage kind="tmmin_standard" />
    </Suspense>
  )
}
