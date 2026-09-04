import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kelola Departemen — ISMS Portal',
  description: 'Admin workspace untuk mengatur direktori departemen dan section dokumen',
}

export default function KelolaDepartemenLayout({ children }: { children: React.ReactNode }) {
  return children
}
