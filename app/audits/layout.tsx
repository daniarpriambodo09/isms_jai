import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Jadwal Audit — ISMS Portal',
  description: 'Jadwal audit internal ISMS PT. Jatim Autocomp Indonesia',
}

export default function AuditsLayout({ children }: { children: React.ReactNode }) {
  return children
}
