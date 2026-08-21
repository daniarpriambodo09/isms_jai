// components/portal-frame.tsx
'use client'

import { ChevronRight, LogOut, Menu, ShieldCheck } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { LoginModal } from '@/components/login-modal'
import { titleFor } from '@/lib/portal-data'
import { useAuth } from '@/context/AuthContext'

export function PortalFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const { isLoggedIn, adminUser, isLoading, logout } = useAuth()

  const pageTitle =
    pathname === '/'
      ? 'Home'
      : titleFor(pathname.split('/').filter(Boolean).at(-1) ?? 'Home')

  return (
    <div className="flex min-h-screen bg-[#f5f8fb] text-[#24364b]">
      <Sidebar open={open} setOpen={setOpen} />

      <main className="flex-1 min-w-0">
        <header className="flex h-[86px] items-center justify-between border-b border-[#e6edf3] bg-white px-[42px] max-[900px]:px-6 max-[680px]:h-[74px] max-[680px]:justify-start max-[680px]:px-[17px]">
          <button
            className="mr-[13px] hidden cursor-pointer border-0 bg-transparent text-[#58758d] max-[680px]:grid max-[680px]:place-items-center [&>svg]:w-5"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-[7px] mb-[7px] text-[11px] text-[#8294a7] max-[680px]:mb-1 [&>svg]:w-[13px]">
              <span>ISMS Portal</span>
              <ChevronRight />
              <strong className="font-medium text-[#53677d]">{pageTitle}</strong>
            </div>
            <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[#1e3147] max-[680px]:text-[18px]">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3 max-[680px]:ml-auto max-[680px]:gap-2">
            {!isLoading && (
              isLoggedIn ? (
                <div className="flex items-center gap-2">
                  <span className="hidden items-center gap-[6px] rounded-full bg-[#e1f4f0] px-3 py-[6px] text-[11px] font-semibold text-[#278e84] sm:flex">
                    <ShieldCheck className="w-[13px]" />
                    {adminUser?.username}
                  </span>
                  <button
                    onClick={() => logout()}
                    className="flex items-center gap-[6px] rounded-[7px] border border-[#dbe6ec] px-3 py-[8px] text-[12px] font-medium text-[#3c5369] hover:bg-[#f7fafc] [&>svg]:w-[14px]"
                  >
                    <LogOut />
                    <span className="max-[680px]:hidden">Logout</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setLoginOpen(true)}
                  className="rounded-[7px] bg-[#20354a] px-4 py-[9px] text-[12px] font-medium text-white hover:bg-[#284360] max-[680px]:px-3 max-[680px]:text-[11px]"
                >
                  Login Admin
                </button>
              )
            )}

            <div className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#d7ebe9] text-[11px] font-bold text-[#1e6670]">
              {isLoggedIn ? (adminUser?.username.slice(0, 2).toUpperCase() ?? 'AD') : 'GU'}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1480px] px-[42px] pt-9 pb-7 max-[900px]:px-6 max-[900px]:py-7 max-[680px]:px-4 max-[680px]:py-[25px]">
          {children}
        </div>

        <footer className="mx-auto flex max-w-[1480px] justify-between px-[42px] pt-[5px] pb-[21px] text-[10px] text-[#9aaab5] max-[680px]:px-4 max-[680px]:pt-0 max-[680px]:pb-[17px]">
          <span>ISMS Portal</span>
          <span>Internal Use Only</span>
          <span>Last updated: 12 June 2025</span>
        </footer>
      </main>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  )
}