// app/ijin-foto-video/page.tsx

'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Aperture, Camera, ClipboardList, Settings, UserCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { PhotoVideoRequestForm } from '@/components/documents/PhotoVideoRequestForm'
import { VisitorApproverSettings } from '@/components/documents/VisitorApproverSettings'
import { ViewfinderHero } from '@/components/page-hero'

function IjinFotoVideoContent() {
  const searchParams = useSearchParams()
  const initial = searchParams.get('type') === 'visitor' ? 'visitor' : 'internal'
  const [locale, setLocale] = useState<'internal' | 'visitor'>(initial)
  const { adminUser } = useAuth()

  const adminSlot = adminUser ? (
    <div className="flex flex-col gap-2 rounded-xl border border-white/15 bg-black/45 p-3.5 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-white/90">
          Admin ISMS Control
        </span>
        <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-white/80">
          Form Setting &amp; Master
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <Link
          href="/kelola-permintaan-foto-video"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/20 active:scale-95"
        >
          <Camera className="size-3 text-white/80" />
          <span>Tinjau Permintaan &amp; Device</span>
        </Link>
        <Link
          href="/kelola-kamera"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/20 active:scale-95"
        >
          <Aperture className="size-3 text-white/80" />
          <span>Master Kamera, USB &amp; Smart Device</span>
        </Link>
        <Link
          href="/kelola-pic-approve"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/20 active:scale-95"
        >
          <UserCheck className="size-3 text-white/80" />
          <span>PIC Approvers</span>
        </Link>
        {adminUser.role === 'ism_admin' && (
          <VisitorApproverSettings
            triggerButton={
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/25 cursor-pointer active:scale-95"
              >
                <Settings className="size-3 text-white/80" />
                <span>Setting Approver Foto/Video</span>
              </button>
            }
          />
        )}
      </div>
    </div>
  ) : null

  return (
    <div className="flex flex-col gap-6 pb-16">
      <ViewfinderHero adminSlot={adminSlot} />
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-2xs">
        <div className="inline-flex rounded-lg border border-border bg-secondary/50 p-1">
          <button
            type="button"
            onClick={() => setLocale('internal')}
            className={`rounded-md px-4 py-1.5 text-xs font-bold transition-colors cursor-pointer ${locale === 'internal' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Internal (Karyawan PT. JAI)
          </button>
          <button
            type="button"
            onClick={() => setLocale('visitor')}
            className={`rounded-md px-4 py-1.5 text-xs font-bold transition-colors cursor-pointer ${locale === 'visitor' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Visitor / Tamu Eksternal
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/rekap-foto-video" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
            <ClipboardList className="size-3.5" /> Lihat rekap semua dept.
          </Link>
          {locale === 'visitor' && adminUser?.role === 'ism_admin' && <VisitorApproverSettings />}
        </div>
      </div>

      {/* ?ref=… (status link from the e-mail / after submitting) opens the status check right away. */}
      <PhotoVideoRequestForm locale={locale} initialRef={searchParams.get('ref')} />
    </div>
  )
}

export default function IjinFotoVideoPage() {
  return (
    <Suspense fallback={null}>
      <IjinFotoVideoContent />
    </Suspense>
  )
}
