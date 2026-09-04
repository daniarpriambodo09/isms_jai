import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kelola Permintaan Foto/Video — ISMS Portal',
  description: 'Admin workspace untuk meninjau pengajuan izin foto/video',
}

export default function KelolaPermintaanFotoVideoLayout({ children }: { children: React.ReactNode }) {
  return children
}
