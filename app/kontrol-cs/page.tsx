import { Suspense } from 'react'
import { FormCsRegisterPage } from '@/components/documents/FormCsRegisterPage'

export const metadata = {
  title: 'Kontrol CS — ISMS Portal',
  description: 'Daftar dokumen Kontrol CS PT. Jatim Autocomp Indonesia',
}

export default function KontrolCsPage() {
  // Suspense: the register reads ?q= (useSearchParams) to open pre-filtered.
  return (
    <Suspense fallback={null}>
      <FormCsRegisterPage category="kontrol-cs" title="Kontrol CS" />
    </Suspense>
  )
}
