// components/portal-frame.tsx
'use client'

import { ChevronRight } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { titleFor } from '@/lib/portal-data'

export function PortalFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const pageTitle =
    pathname === '/'
      ? 'Home'
      : pathname === '/_not-found'
        ? 'Halaman Tidak Ditemukan'
        : titleFor(pathname.split('/').filter(Boolean).at(-1) ?? 'Home')

  return (
    <div className="min-h-screen bg-[#eef1f6] text-[#24364b]">
      <Navbar />

      <header className="border-b border-[#e2e9f0] bg-[#f5f7fa] px-[42px] py-5 max-[900px]:px-6 max-[680px]:px-[17px] max-[680px]:py-4">
        <div className="mx-auto max-w-[1480px]">
          <div className="flex items-center gap-[7px] mb-[7px] text-[11px] text-[#7e93a8] [&>svg]:w-[13px]">
            <span>ISMS Portal</span>
            <ChevronRight />
            <strong className="font-medium text-[#4f6579]">{pageTitle}</strong>
          </div>
          <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[#1e3147] max-[680px]:text-[18px]">
            {pageTitle}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-[42px] pt-9 pb-7 max-[900px]:px-6 max-[900px]:py-7 max-[680px]:px-4 max-[680px]:py-[25px]">
        {children}
      </main>

      <footer className="mx-auto flex max-w-[1480px] justify-between px-[42px] pt-[5px] pb-[21px] text-[10px] text-[#8fa0b2] max-[680px]:px-4 max-[680px]:pt-0 max-[680px]:pb-[17px]">
        <span>ISMS Portal</span>
        <span>Internal Use Only</span>
        <span>Last updated: 12 June 2025</span>
      </footer>
    </div>
  )
}