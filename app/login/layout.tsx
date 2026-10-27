import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login Otorisasi · Portal ISMS PT. JAI',
  description: 'Halaman masuk resmi pengelola dan approver ISMS ISO/IEC 27001 PT. Jatim Autocomp Indonesia',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
