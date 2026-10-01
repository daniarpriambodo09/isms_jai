import { Suspense } from 'react'
import { ProcedureRegisterPage } from '@/components/documents/ProcedureRegisterPage'

export const metadata = {
  title: 'Prosedur ISMS — ISMS Portal',
  description: 'Daftar dokumen prosedur ISMS PT. Jatim Autocomp Indonesia',
}

// Suspense: the register reads ?q= (useSearchParams) to open pre-filtered.
export default function ProcedureIsmsPage() {
  return (
    <Suspense fallback={null}>
      <ProcedureRegisterPage />
    </Suspense>
  )
}
