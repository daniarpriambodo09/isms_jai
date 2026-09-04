import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pengaturan — ISMS Portal',
  description: 'Admin workspace untuk mengatur konten menu Portal ISMS',
}

export default function PengaturanLayout({ children }: { children: React.ReactNode }) {
  return children
}
