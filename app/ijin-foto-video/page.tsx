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
    <div className="flex flex-col gap-2 rounded-2xl border border-emerald-500/40 bg-black/75 p-3.5 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-2">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <span className="font-mono text-[10.5px] font-black uppercase tracking-wider text-emerald-300">
            Admin ISMS Control
          </span>
        </div>
        <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-200 border border-emerald-500/30">
          Form Setting &amp; Master
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <Link
          href="/kelola-permintaan-foto-video"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-600 hover:border-emerald-500 active:scale-95"
        >
          <Camera className="size-3 text-emerald-300" />
          <span>Tinjau Permintaan &amp; USB</span>
        </Link>
        <Link
          href="/kelola-kamera"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-600 hover:border-emerald-500 active:scale-95"
        >
          <Aperture className="size-3 text-emerald-300" />
          <span>Master Kamera &amp; USB</span>
        </Link>
        <Link
          href="/kelola-pic-approve"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-600 hover:border-emerald-500 active:scale-95"
        >
          <UserCheck className="size-3 text-emerald-300" />
          <span>PIC Approvers</span>
        </Link>
        {adminUser.role === 'ism_admin' && (
          <VisitorApproverSettings
            triggerButton={
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-600 hover:text-white cursor-pointer active:scale-95"
              >
                <Settings className="size-3 text-emerald-300" />
                <span>Approver Tamu</span>
              </button>
            }
          />
        )}
      </div>
    </div>
  ) : null

  return (
    <div className="flex flex-col gap-6">
      <ViewfinderHero adminSlot={adminSlot} />
      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-center gap-3">
        <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setLocale('internal')}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${locale === 'internal' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Internal
          </button>
          <button
            type="button"
            onClick={() => setLocale('visitor')}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${locale === 'visitor' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Visitor
          </button>
        </div>
        <Link href="/rekap-foto-video" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <ClipboardList className="size-3.5" /> Lihat rekap semua dept.
        </Link>
        {locale === 'visitor' && adminUser?.role === 'ism_admin' && <VisitorApproverSettings />}
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
