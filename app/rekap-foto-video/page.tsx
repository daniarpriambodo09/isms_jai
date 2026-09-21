// app/rekap-foto-video/page.tsx

import { LedgerFotoVideoPage } from '@/components/documents/LedgerFotoVideoPage'

export const metadata = {
  title: 'Rekap Pengajuan Foto/Video — ISMS Portal',
  description: 'Rekap seluruh pengajuan izin pengambilan foto/video dari semua departemen PT. Jatim Autocomp Indonesia',
}

export default function RekapFotoVideoPage() {
  return <LedgerFotoVideoPage />
}
