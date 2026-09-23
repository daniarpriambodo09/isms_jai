// components/documents/LedgerFotoVideoPage.tsx
'use client'

import Link from 'next/link'
import { Camera } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { PhotoVideoLedgerTable } from '@/components/documents/PhotoVideoLedgerTable'

export function LedgerFotoVideoPage() {
  const { adminUser } = useAuth()
  const canViewPdf = adminUser?.role === 'ism_admin' || adminUser?.role === 'lobby' || adminUser?.role === 'security'

  return (
    <div className="flex flex-col gap-6">
      <section
        className="relative overflow-hidden rounded-[1.25rem] p-6 text-primary-foreground shadow-xl sm:p-8"
        style={{ background: 'linear-gradient(135deg, #1a3a52 0%, #1a5f7a 45%, #278e84 100%)' }}
      >
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
              <Camera className="size-3.5" /> Ledger — All Dept./Section
            </div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Rekap Pengajuan Foto/Video</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/72">Daftar seluruh pengajuan izin pengambilan foto/video dari semua departemen — bisa dilihat siapa saja.</p>
          </div>
          <Link href="/ijin-foto-video" className="inline-flex items-center gap-2 rounded-lg border border-primary-foreground/25 bg-primary-foreground/10 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/20">
            <Camera className="size-4" /> Ajukan Izin Baru
          </Link>
        </div>
      </section>

      <PhotoVideoLedgerTable canViewPdf={canViewPdf} />
    </div>
  )
}
