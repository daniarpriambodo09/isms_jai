// components/documents/LedgerFotoVideoPage.tsx
'use client'

import Link from 'next/link'
import { Camera } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { FilmStripHero } from '@/components/page-hero'
import { PhotoVideoLedgerTable } from '@/components/documents/PhotoVideoLedgerTable'

export function LedgerFotoVideoPage() {
  const { adminUser } = useAuth()
  const canViewPdf = adminUser?.role === 'ism_admin' || adminUser?.role === 'lobby' || adminUser?.role === 'security'

  return (
    <div className="flex flex-col gap-6">
      <FilmStripHero
        action={
          <Link href="/ijin-foto-video" className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5">
            <Camera className="size-4" /> Ajukan Izin Baru
          </Link>
        }
      />

      <PhotoVideoLedgerTable canViewPdf={canViewPdf} />
    </div>
  )
}
