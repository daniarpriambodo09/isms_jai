import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kelola Hero Slides — ISMS Portal',
  description: 'Admin workspace untuk mengatur video dan gambar hero halaman Home',
}

export default function KelolaHeroSlidesLayout({ children }: { children: React.ReactNode }) {
  return children
}
