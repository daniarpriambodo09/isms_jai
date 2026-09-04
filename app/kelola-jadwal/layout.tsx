import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kelola Jadwal — ISMS Portal',
  description: 'Admin workspace untuk mengatur jadwal audit dan training',
}

export default function KelolaJadwalLayout({ children }: { children: React.ReactNode }) {
  return children
}
