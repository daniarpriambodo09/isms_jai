import { Suspense } from 'react'
import { FormCsRegisterPage } from '@/components/documents/FormCsRegisterPage'

export const metadata = {
  title: 'Form Aplikasi — ISMS Portal',
  description: 'Daftar Form Aplikasi PT. Jatim Autocomp Indonesia',
}

export default function FormAplikasiPage() {
  // Suspense: the register reads ?q= (useSearchParams) to open pre-filtered.
  return (
    <Suspense fallback={null}>
      <FormCsRegisterPage category="form-aplikasi" title="Form Aplikasi" />
    </Suspense>
  )
}
