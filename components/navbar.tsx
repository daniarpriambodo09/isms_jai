// components/navbar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronDown, LogOut, Menu, Settings, ShieldCheck, X } from 'lucide-react'
import { mainNav } from '@/lib/portal-data'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { cn } from '@/lib/utils'
import { LoginModal } from '@/components/login-modal'

type Section = { id: number; name: string; slug: string }
type Department = { id: number; name: string; slug: string; sections: Section[] }

export function Navbar() {
  const pathname = usePathname()
  const { isLoggedIn, adminUser, isLoading, logout } = useAuth()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [deptMenuOpen, setDeptMenuOpen] = useState(false)
  const [expandedDept, setExpandedDept] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { departments: [] }))
      .then((data: { departments: Department[] }) => setDepartments(data.departments ?? []))
      .catch(() => setDepartments([]))
  }, [])

  // Close menus on route change.
  useEffect(() => {
    setMobileOpen(false)
    setDeptMenuOpen(false)
    setExpandedDept(null)
  }, [pathname])

  const departmentHref = (dept: Department) => `/documents/department/${dept.slug}`
  const sectionHref = (dept: Department, section: Section) =>
    `/documents/department/${dept.slug}/${section.slug}`

  const navLink =
    'rounded-[6px] px-3 py-[8px] text-[13px] font-medium text-[#aebdd1] transition-colors hover:bg-white/[0.08] hover:text-white'
  const navLinkActive = 'bg-white/[0.12] text-white'

  return (
    <>
      <nav className="sticky top-0 z-30 border-b border-[#132234] bg-gradient-to-r from-[#1a2b42] to-[#20344f]">
        <div className="mx-auto flex h-[64px] max-w-[1480px] items-center gap-6 px-[42px] max-[900px]:px-6 max-[680px]:h-14 max-[680px]:px-4">
          <Link href="/" className="flex flex-none items-center gap-[10px]">
            <div className="grid h-8 w-8 place-items-center rounded-[8px] bg-[#2f8f86] text-[#e4faf5]">
              <ShieldCheck className="h-[18px] w-[18px]" />
            </div>
            <span className="text-[15px] font-bold tracking-[-0.02em] text-white max-[680px]:hidden">
              ISMS Portal
            </span>
          </Link>

          {/* Desktop menu */}
          <div className="hidden flex-1 items-center gap-1 md:flex">
            {mainNav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(navLink, pathname === item.href && navLinkActive)}
              >
                {item.label}
              </Link>
            ))}

            {/* Departemen / Section dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDeptMenuOpen((value) => !value)}
                className={cn(
                  'flex items-center gap-1',
                  navLink,
                  pathname.startsWith('/documents/department') && navLinkActive
                )}
              >
                Departemen / Section
                <ChevronDown className={cn('h-[14px] w-[14px] transition-transform', deptMenuOpen && 'rotate-180')} />
              </button>

              {deptMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDeptMenuOpen(false)} />
                  <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-[260px] rounded-[10px] border border-[#e4edf2] bg-white p-2 shadow-[0_16px_36px_rgba(14,34,53,0.22)]">
                    {departments.map((dept) =>
                      dept.sections.length === 0 ? (
                        <Link
                          key={dept.id}
                          href={departmentHref(dept)}
                          className="block rounded-[6px] px-3 py-[9px] text-[13px] text-[#3c5369] hover:bg-[#eef3f7]"
                        >
                          {dept.name}
                        </Link>
                      ) : (
                        <div key={dept.id}>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDept((value) => (value === dept.slug ? null : dept.slug))
                            }
                            className="flex w-full items-center justify-between rounded-[6px] px-3 py-[9px] text-left text-[13px] text-[#3c5369] hover:bg-[#eef3f7]"
                          >
                            {dept.name}
                            <ChevronDown
                              className={cn(
                                'h-[13px] w-[13px] transition-transform',
                                expandedDept === dept.slug && 'rotate-180'
                              )}
                            />
                          </button>
                          {expandedDept === dept.slug && (
                            <div className="ml-3 border-l border-[#dce8f0] pl-2">
                              {dept.sections.map((section) => (
                                <Link
                                  key={section.id}
                                  href={sectionHref(dept, section)}
                                  className="block rounded-[6px] px-3 py-[7px] text-[12px] text-[#62768a] hover:bg-[#eef3f7]"
                                >
                                  {section.name}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
            </div>

            {isLoggedIn && (
              <Link
                href="/kelola-departemen"
                className={cn(
                  'flex items-center gap-[6px]',
                  navLink,
                  pathname === '/kelola-departemen' && navLinkActive
                )}
              >
                <Settings className="h-[14px] w-[14px]" /> Kelola Departemen
              </Link>
            )}
          </div>

          {/* Right side: auth + mobile toggle */}
          <div className="ml-auto flex items-center gap-2">
            {!isLoading &&
              (isLoggedIn ? (
                <div className="hidden items-center gap-2 sm:flex">
                  <span className="flex items-center gap-[6px] rounded-full bg-[#48beb1]/[0.18] px-3 py-[6px] text-[11px] font-semibold text-[#8fe3d3]">
                    <ShieldCheck className="w-[13px]" />
                    {adminUser?.username}
                  </span>
                  <button
                    onClick={() => logout()}
                    className="flex items-center gap-[6px] rounded-[7px] border border-white/[0.16] px-3 py-[8px] text-[12px] font-medium text-[#dbe6f0] hover:bg-white/[0.08] [&>svg]:w-[14px]"
                  >
                    <LogOut /> Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setLoginOpen(true)}
                  className="hidden rounded-[7px] bg-[#2f8f86] px-4 py-[9px] text-[12px] font-medium text-white hover:bg-[#267c74] sm:block"
                >
                  Login Admin
                </button>
              ))}

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu"
              className="grid h-9 w-9 place-items-center rounded-[6px] text-[#c7d3e0] hover:bg-white/[0.08] md:hidden"
            >
              <Menu className="w-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile slide-in menu */}
      <div
        className={cn('fixed inset-0 z-40 bg-[rgba(14,34,53,0.45)] md:hidden', mobileOpen ? 'block' : 'hidden')}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={cn(
          'fixed right-0 top-0 z-50 flex h-screen w-[300px] max-w-[85vw] flex-col bg-[#f7f9fb] shadow-[-8px_0_30px_rgba(14,34,53,0.2)] transition-transform duration-200 md:hidden',
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between border-b border-[#e2e9f0] bg-[#1c2e46] px-4 py-4">
          <span className="text-[14px] font-bold text-white">Menu</span>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Tutup menu"
            className="grid h-8 w-8 place-items-center rounded-full text-[#c7d3e0] hover:bg-white/[0.1]"
          >
            <X className="w-[18px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {mainNav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="block rounded-[6px] px-3 py-[10px] text-[13px] font-medium text-[#3c5369] hover:bg-white"
            >
              {item.label}
            </Link>
          ))}

          <div className="mt-2 px-3 py-[9px] text-[10px] font-bold uppercase tracking-[0.12em] text-[#7590ac]">
            Departemen / Section
          </div>
          {departments.map((dept) =>
            dept.sections.length === 0 ? (
              <Link
                key={dept.id}
                href={departmentHref(dept)}
                className="block rounded-[6px] px-3 py-[9px] pl-6 text-[13px] text-[#3c5369] hover:bg-white"
              >
                {dept.name}
              </Link>
            ) : (
              <div key={dept.id}>
                <button
                  type="button"
                  onClick={() => setExpandedDept((value) => (value === dept.slug ? null : dept.slug))}
                  className="flex w-full items-center justify-between rounded-[6px] px-3 py-[9px] pl-6 text-left text-[13px] text-[#3c5369] hover:bg-white"
                >
                  {dept.name}
                  <ChevronDown
                    className={cn('h-[13px] w-[13px] transition-transform', expandedDept === dept.slug && 'rotate-180')}
                  />
                </button>
                {expandedDept === dept.slug && (
                  <div className="ml-6 border-l border-[#dce8f0] pl-2">
                    {dept.sections.map((section) => (
                      <Link
                        key={section.id}
                        href={sectionHref(dept, section)}
                        className="block rounded-[6px] px-3 py-[7px] text-[12px] text-[#62768a] hover:bg-white"
                      >
                        {section.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          )}

          {isLoggedIn && (
            <Link
              href="/kelola-departemen"
              className="mt-2 flex items-center gap-[6px] rounded-[6px] px-3 py-[10px] text-[13px] font-medium text-[#3c5369] hover:bg-white"
            >
              <Settings className="h-[14px] w-[14px]" /> Kelola Departemen
            </Link>
          )}
        </div>

        <div className="border-t border-[#e2e9f0] p-4">
          {!isLoading &&
            (isLoggedIn ? (
              <button
                onClick={() => logout()}
                className="flex w-full items-center justify-center gap-[6px] rounded-[7px] border border-[#dce6ed] bg-white px-3 py-[9px] text-[12px] font-medium text-[#3c5369] hover:bg-[#eef3f7] [&>svg]:w-[14px]"
              >
                <LogOut /> Logout ({adminUser?.username})
              </button>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                className="w-full rounded-[7px] bg-[#1c2e46] px-4 py-[10px] text-[13px] font-medium text-white hover:bg-[#26395a]"
              >
                Login Admin
              </button>
            ))}
        </div>
      </aside>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  )
}