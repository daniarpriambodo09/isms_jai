import { Suspense } from 'react'
import { ProcedureRegisterPage } from '@/components/documents/ProcedureRegisterPage'

export const metadata = {
  title: 'Form Review & Revisi Dokumen — ISMS Portal',
  description: 'Form Review & Revisi Dokumen ISMS (ISMS-F-001-001) PT. Jatim Autocomp Indonesia',
}

// The form is filled in on the portal and signed by e-sign; its register is
// the shared one, in its 'review_form' kind (opened from Prosedur ISMS).
// Suspense: the register reads ?q= and the prefill parameters (useSearchParams).
export default function FormReviewDokumenPage() {
  return (
    <Suspense fallback={null}>
      <ProcedureRegisterPage kind="review_form" />
    </Suspense>
  )
}
