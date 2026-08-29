// components/portal-frame.tsx

'use client'

import { ChevronRight, LockKeyhole } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { titleFor } from '@/lib/portal-data'

export function PortalFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const isSectionPage = segments[0] === 'documents' && segments[1] === 'department' && segments.length === 4
  const pageTitle = pathname === '/' ? 'Home' : pathname === '/_not-found' ? 'Halaman Tidak Ditemukan' : pathname === '/prosedur-isms' ? 'Prosedur ISMS' : pathname === '/working-standard' ? 'Working Standard & Standard Requirements TMMIN' : pathname === '/form-aplikasi' ? 'Form Aplikasi' : pathname === '/kontrol-cs' ? 'Kontrol CS' : isSectionPage ? decodeURIComponent(segments.at(-1) ?? '').replaceAll('-', ' ').toUpperCase() : titleFor(segments.at(-1) ?? 'Home')

  return <div className="min-h-screen bg-background text-foreground">
    <Navbar />
    <header className="border-b border-border bg-card/90 px-10 py-7 backdrop-blur-sm max-[900px]:px-6 max-[680px]:px-4 max-[680px]:py-5">
      <div className="mx-auto max-w-[1480px]">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><span>ISMS Portal</span><ChevronRight className="size-3.5" /><strong className="font-medium text-foreground">{pageTitle}</strong></div>
        <div className="flex items-end justify-between gap-6 max-[680px]:items-start"><div><p className="portal-eyebrow mb-2">Information security management system</p><h1 className="text-3xl font-bold tracking-tight text-primary max-[680px]:text-2xl">{pageTitle}</h1></div><div className="hidden items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:flex"><LockKeyhole className="size-3.5 text-accent-foreground" />Internal knowledge base</div></div>
      </div>
    </header>
    <main className="mx-auto max-w-[1480px] px-10 pb-10 pt-9 max-[900px]:px-6 max-[900px]:py-7 max-[680px]:px-4 max-[680px]:py-6">{children}</main>
    <footer className="mx-auto flex max-w-[1480px] flex-wrap justify-between gap-3 border-t border-border px-10 py-5 text-[10px] text-muted-foreground max-[680px]:px-4"><span className="font-semibold text-primary">ISMS Portal</span></footer>
  </div>
}