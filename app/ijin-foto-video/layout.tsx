import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ijin Foto/Video — ISMS Portal',
  description: 'Formulir pengajuan izin foto/video PT. Jatim Autocomp Indonesia',
}

export default function IjinFotoVideoLayout({ children }: { children: React.ReactNode }) {
  return children
}
