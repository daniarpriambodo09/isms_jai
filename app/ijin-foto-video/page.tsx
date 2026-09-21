// app/ijin-foto-video/page.tsx

'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { PhotoVideoRequestForm } from '@/components/documents/PhotoVideoRequestForm'
import { VisitorApproverSettings } from '@/components/documents/VisitorApproverSettings'

function IjinFotoVideoContent() {
  const searchParams = useSearchParams()
  const initial = searchParams.get('type') === 'visitor' ? 'visitor' : 'internal'
  const [locale, setLocale] = useState<'internal' | 'visitor'>(initial)
  const { adminUser } = useAuth()

  return (
    <div className="flex flex-col gap-6">
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

      <PhotoVideoRequestForm locale={locale} />
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
