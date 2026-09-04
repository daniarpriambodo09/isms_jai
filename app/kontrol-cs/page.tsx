import { FormCsRegisterPage } from '@/components/documents/FormCsRegisterPage'

export const metadata = {
  title: 'Kontrol CS — ISMS Portal',
  description: 'Daftar dokumen Kontrol CS PT. Jatim Autocomp Indonesia',
}

export default function KontrolCsPage() {
  return <FormCsRegisterPage category="kontrol-cs" title="Kontrol CS" />
}
