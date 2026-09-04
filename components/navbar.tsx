//  components/navbar.tsx

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronDown, LogOut, Menu, Settings, ShieldCheck, X } from 'lucide-react'
import { mainNav } from '@/lib/portal-data'
import { DEFAULT_NAV_LABELS } from '@/lib/nav-labels'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { cn } from '@/lib/utils'
import { LoginModal } from '@/components/login-modal'
import { NotificationBell } from '@/components/documents/NotificationBell'

type Section = { id: number; name: string; slug: string }
type Department = { id: number; name: string; slug: string; sections: Section[] }

export function Navbar() {
  const pathname = usePathname()
  const { isLoggedIn, adminUser, isLoading, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [deptMenuOpen, setDeptMenuOpen] = useState(false)
  const [formCsMenuOpen, setFormCsMenuOpen] = useState(false)
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)
  const [expandedDept, setExpandedDept] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [navLabels, setNavLabels] = useState<Record<string, string>>(DEFAULT_NAV_LABELS)
  const [loginOpen, setLoginOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { departments: [] }))
      .then((data: { departments: Department[] }) => setDepartments(data.departments ?? []))
      .catch(() => setDepartments([]))
  }, [])

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/nav-labels`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { labels: DEFAULT_NAV_LABELS }))
      .then((data: { labels: Record<string, string> }) => setNavLabels({ ...DEFAULT_NAV_LABELS, ...data.labels }))
      .catch(() => { })
  }, [])

  // Scroll-triggered glass effect
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMobileOpen(false); setDeptMenuOpen(false); setFormCsMenuOpen(false); setSettingsMenuOpen(false); setExpandedDept(null) }, [pathname])

  // Lets any page (e.g. the AdminGate empty-state) open the login modal without lifting its state.
  useEffect(() => {
    const handler = () => setLoginOpen(true)
    window.addEventListener('open-admin-login', handler)
    return () => window.removeEventListener('open-admin-login', handler)
  }, [])

  // Escape closes whichever dropdown/drawer is currently open.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMobileOpen(false)
      setDeptMenuOpen(false)
      setFormCsMenuOpen(false)
      setSettingsMenuOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  const departmentHref = (dept: Department) => `/documents/department/${dept.slug}`
  const sectionHref = (dept: Department, section: Section) => `/documents/department/${dept.slug}/${section.slug}`

  const navLink = 'nav-wipe relative isolate overflow-hidden rounded-md px-3 py-2 text-[13px] font-medium text-primary-foreground/70 transition-colors hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring'
  const navLinkActive = 'bg-accent text-white hover:text-white'
  const isAdminSectionActive = ['/pengaturan', '/kelola-departemen', '/kelola-permintaan-foto-video', '/kelola-hero-slides', '/kelola-jadwal'].includes(pathname)

  // Active underline indicator
  const activeIndicator = (
    <span
      className="absolute -bottom-[1px] left-1/2 h-[2px] w-4/5 -translate-x-1/2 rounded-full"
      style={{ background: 'linear-gradient(90deg, oklch(0.7 0.15 55), oklch(0.75 0.18 50))' }}
    />
  )

  const formCsItems = (
    <>
      <Link href="/form-aplikasi" className="nav-drop-item block rounded-md px-3 py-2.5 text-sm text-foreground">Application Form</Link>
      <Link href="/kontrol-cs" className="nav-drop-item block rounded-md px-3 py-2.5 text-sm text-foreground">CS Control</Link>
      <Link href="/ijin-foto-video" className="nav-drop-item block rounded-md px-3 py-2.5 text-sm text-foreground">Photo/Video Permit</Link>
    </>
  )

  const dropdownPanel = (children: React.ReactNode) => (
    <div
      role="menu"
      className="absolute left-0 top-[calc(100%+10px)] z-20 w-72 overflow-hidden rounded-2xl text-popover-foreground"
      style={{
        animation: 'dropdown-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both',
        background: 'linear-gradient(160deg, rgba(255,255,255,0.97) 0%, rgba(240,247,251,0.98) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 20px 45px oklch(0.2 0.05 220 / 25%), 0 0 0 1px oklch(0.48 0.12 180 / 12%), inset 0 1px 0 rgba(255,255,255,0.85)',
      }}
    >
      <div className="nav-dropdown-bar h-[2.5px] w-full" />
      <div className="p-2">{children}</div>
    </div>
  )

  const departmentItems = departments.map((dept) =>
    dept.sections.length === 0 ? (
      <Link key={dept.id} href={departmentHref(dept)} className="nav-drop-item block rounded-md px-3 py-2.5 text-sm text-foreground">{dept.name}</Link>
    ) : (
      <div key={dept.id}>
        <button type="button" onClick={() => setExpandedDept((value) => value === dept.slug ? null : dept.slug)} className="nav-drop-item flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm text-foreground">
          {dept.name}<ChevronDown className={cn('size-4 transition-transform duration-200', expandedDept === dept.slug && 'rotate-180')} />
        </button>
        {expandedDept === dept.slug && (
          <div className="ml-3 border-l border-border pl-2">
            {dept.sections.map((section) => (
              <Link key={section.id} href={sectionHref(dept, section)} className="nav-drop-item block rounded-md px-3 py-2 text-xs text-muted-foreground hover:text-foreground">{section.name}</Link>
            ))}
          </div>
        )}
      </div>
    )
  )

  return (
    <>
      <style>{`
        @keyframes dropdown-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes nav-bar-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .nav-dropdown-bar {
          background: linear-gradient(90deg, #278e84 0%, #1a5f7a 40%, #278e84 100%);
          background-size: 200% auto;
          animation: nav-bar-shimmer 3s linear infinite;
        }
        .nav-drop-item {
          transition: background 160ms, padding-left 160ms, color 160ms;
        }
        .nav-drop-item:hover {
          background: linear-gradient(90deg, rgba(39,142,132,0.12) 0%, rgba(26,95,122,0.05) 100%);
          padding-left: 16px;
        }
        .nav-drawer-item {
          transition: background 160ms, padding-left 160ms;
        }
        .nav-drawer-item:hover {
          background: linear-gradient(90deg, rgba(39,142,132,0.1) 0%, transparent 100%);
          padding-left: 16px;
        }
      `}</style>

      <nav
        className="sticky top-0 z-30 border-b border-primary-foreground/10 bg-primary text-primary-foreground transition-all duration-300"
        style={{
          boxShadow: scrolled
            ? '0 4px 24px oklch(0.39 0.09 205 / 30%), 0 1px 4px oklch(0.39 0.09 205 / 20%)'
            : '0 1px 8px oklch(0.39 0.09 205 / 15%)',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          background: scrolled
            ? 'oklch(0.39 0.09 205 / 92%)'
            : undefined,
        }}
      >
        <div className="mx-auto flex min-h-16 max-w-[1480px] items-center gap-6 px-10 max-[900px]:px-6 max-[680px]:min-h-14 max-[680px]:px-4">
          <Link href="/" className="flex flex-none items-center gap-3" aria-label="ISMS Portal home">
            <span className="flex h-10 w-[132px] items-center overflow-hidden rounded-md bg-primary-foreground px-2 shadow-sm">
              <img
                src={`${API_BASE_PATH}/images/yazaki-logo.jpg`}
                alt="Yazaki PT. Jatim Autocomp Indonesia"
                width={132}
                height={40}
                className="h-auto w-full object-contain"
              />
            </span>
            {/* Vertical separator */}
            <span className="hidden h-6 w-px bg-primary-foreground/20 md:block" />
          </Link>

          <div className="hidden flex-1 items-center gap-1 md:flex">
            {mainNav
              .filter((item) => item.href !== '/documents/forms')
              .map((item) => {
                // Map href to navLabels key
                const key = item.href === '/' ? 'home'
                  : item.href === '/kebijakan-dasar-ISMS' ? 'kebijakan'
                    : item.href === '/prosedur-isms' ? 'prosedur'
                      : item.href === '/working-standard' ? 'working_standard'
                        : item.href === '/education' ? 'edukasi'
                          : null
                const label = key ? (navLabels[key] ?? item.label) : item.label
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(navLink, pathname === item.href && navLinkActive)}
                  >
                    {label}
                    {pathname === item.href && activeIndicator}
                  </Link>
                )
              })}

            {/* Form CS dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setFormCsMenuOpen((v) => !v)}
                className={cn('flex items-center gap-1', navLink, (pathname === '/form-aplikasi' || pathname === '/kontrol-cs') && navLinkActive)}
              >
                {navLabels.form_cs ?? 'Forms & CS Control'}
                <ChevronDown className={cn('size-4 transition-transform duration-200', formCsMenuOpen && 'rotate-180')} />
                {(pathname === '/form-aplikasi' || pathname === '/kontrol-cs') && activeIndicator}
              </button>
              {formCsMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFormCsMenuOpen(false)} />
                  {dropdownPanel(
                    <>
                      <div className="border-b border-border px-3 pb-2 pt-1">
                        <p className="portal-eyebrow">Document library</p>
                        <p className="mt-1 text-xs text-muted-foreground">Choose document category</p>
                      </div>
                      {formCsItems}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Department dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDeptMenuOpen((v) => !v)}
                className={cn('flex items-center gap-1', navLink, pathname.startsWith('/documents/department') && navLinkActive)}
              >
                {navLabels.departemen ?? 'Departments'}
                <ChevronDown className={cn('size-4 transition-transform duration-200', deptMenuOpen && 'rotate-180')} />
                {pathname.startsWith('/documents/department') && activeIndicator}
              </button>
              {deptMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDeptMenuOpen(false)} />
                  {dropdownPanel(
                    <>
                      <div className="border-b border-border px-3 pb-2 pt-1">
                        <p className="portal-eyebrow">Document library</p>
                        <p className="mt-1 text-xs text-muted-foreground">Browse by department</p>
                      </div>
                      {departmentItems}
                    </>
                  )}
                </>
              )}
            </div>

            {isLoggedIn && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSettingsMenuOpen((v) => !v)}
                  className={cn(
                    'flex items-center gap-1',
                    navLink,
                    isAdminSectionActive && navLinkActive,
                  )}
                >
                  <Settings className="size-4" />
                  Admin Settings
                  <ChevronDown className={cn('size-4 transition-transform duration-200', settingsMenuOpen && 'rotate-180')} />
                  {isAdminSectionActive && activeIndicator}
                </button>
                {settingsMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSettingsMenuOpen(false)} />
                    {dropdownPanel(
                      <>
                        <div className="border-b border-border px-3 pb-2 pt-1">
                          <p className="portal-eyebrow">Admin Panel</p>
                          <p className="mt-1 text-xs text-muted-foreground">Choose a feature to manage</p>
                        </div>
                        <Link
                          href="/pengaturan"
                          className="nav-drop-item block rounded-md px-3 py-2.5 text-sm text-foreground"
                        >
                          Manage Menu Content
                        </Link>
                        <Link
                          href="/kelola-departemen"
                          className="nav-drop-item block rounded-md px-3 py-2.5 text-sm text-foreground"
                        >
                          Manage Departments
                        </Link>
                        <Link
                          href="/kelola-permintaan-foto-video"
                          className="nav-drop-item block rounded-md px-3 py-2.5 text-sm text-foreground"
                        >
                          Photo/Video Requests
                        </Link>
                        <Link
                          href="/kelola-hero-slides"
                          className="nav-drop-item block rounded-md px-3 py-2.5 text-sm text-foreground"
                        >
                          Manage Hero Slides
                        </Link>
                        <Link
                          href="/kelola-jadwal"
                          className="nav-drop-item block rounded-md px-3 py-2.5 text-sm text-foreground"
                        >
                          Manage Schedules
                        </Link>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right side actions */}
          <div className="ml-auto flex items-center gap-2">
            {!isLoading && isLoggedIn && <NotificationBell />}
            {!isLoading && (
              isLoggedIn ? (
                <div className="hidden items-center gap-2 sm:flex">
                  <span
                    className="rounded-full border px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"
                    style={{ borderColor: 'oklch(0.7 0.15 55 / 35%)', background: 'oklch(0.7 0.15 55 / 14%)' }}
                  >
                    <ShieldCheck className="mr-1 inline size-3.5" />
                    {adminUser?.username}
                  </span>
                  <button
                    onClick={() => logout()}
                    className="flex items-center gap-1.5 rounded-md border border-primary-foreground/20 px-3 py-2 text-xs transition-colors hover:bg-primary-foreground/10"
                  >
                    <LogOut className="size-4" />
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setLoginOpen(true)}
                  className="hidden rounded-lg px-4 py-2 text-[12px] font-semibold text-white transition-all duration-200 hover:scale-[1.03] sm:block"
                  style={{
                    background: 'linear-gradient(135deg, oklch(0.48 0.12 180) 0%, oklch(0.58 0.14 165) 100%)',
                    boxShadow: '0 3px 12px oklch(0.48 0.12 180 / 40%)',
                  }}
                >
                  Admin Login
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="grid size-10 place-items-center rounded-md text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 md:hidden"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile backdrop */}
      <div
        className={cn('fixed inset-0 z-40 bg-primary/50 backdrop-blur-sm md:hidden transition-opacity duration-200', mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Portal navigation"
        aria-hidden={!mobileOpen}
        className={cn('fixed right-0 top-0 z-50 flex h-screen w-80 max-w-[85vw] flex-col shadow-2xl transition-transform duration-200 md:hidden', mobileOpen ? 'translate-x-0' : 'translate-x-full')}
        style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #eef4f6 100%)' }}
      >
        <div
          className="relative flex items-center justify-between overflow-hidden px-4 py-4 text-primary-foreground"
          style={{ background: 'linear-gradient(135deg, #0e2235 0%, #1a5f7a 55%, #278e84 100%)' }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '16px 16px' }}
          />
          <span className="relative flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-4" /> Portal navigation
          </span>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="relative grid size-9 place-items-center rounded-full transition-colors hover:bg-white/15">
            <X className="size-5" />
          </button>
        </div>
        <div className="nav-dropdown-bar h-[3px] w-full flex-shrink-0" />
        <div className="flex-1 overflow-y-auto p-3">
          {mainNav.filter((item) => item.href !== '/documents/forms').map((item) => {
            const key = item.href === '/' ? 'home'
              : item.href === '/kebijakan-dasar-ISMS' ? 'kebijakan'
                : item.href === '/prosedur-isms' ? 'prosedur'
                  : item.href === '/working-standard' ? 'working_standard'
                    : item.href === '/education' ? 'edukasi'
                      : null
            const label = key ? (navLabels[key] ?? item.label) : item.label
            return (
              <Link key={item.href} href={item.href} className={cn('nav-drawer-item block rounded-md px-3 py-2.5 text-sm font-medium text-foreground', pathname === item.href && 'bg-secondary font-semibold text-primary')}>
                {label}
              </Link>
            )
          })}
          <div className="portal-eyebrow px-3 pb-2 pt-5">{navLabels.form_cs ?? 'Forms & CS Control'}</div>
          {formCsItems}
          <div className="portal-eyebrow px-3 pb-2 pt-5">{navLabels.departemen ?? 'Departments'}</div>
          {departmentItems}
          {isLoggedIn && (
            <>
              <div className="portal-eyebrow px-3 pb-2 pt-5">Admin Settings</div>
              <Link href="/pengaturan" className="nav-drawer-item flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-foreground">
                <Settings className="size-4" />Manage Menu Content
              </Link>
              <Link href="/kelola-departemen" className="nav-drawer-item flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-foreground">
                <Settings className="size-4" />Manage Departments
              </Link>
              <Link href="/kelola-permintaan-foto-video" className="nav-drawer-item flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-foreground">
                <Settings className="size-4" />Photo/Video Requests
              </Link>
              <Link href="/kelola-hero-slides" className="nav-drawer-item flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-foreground">
                <Settings className="size-4" />Manage Hero Slides
              </Link>
              <Link href="/kelola-jadwal" className="nav-drawer-item flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-foreground">
                <Settings className="size-4" />Manage Schedules
              </Link>
            </>
          )}
        </div>
        <div className="border-t border-border p-4">
          {!isLoading && (
            isLoggedIn ? (
              <button onClick={() => logout()} className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:bg-secondary">
                <LogOut className="size-4" />Logout ({adminUser?.username})
              </button>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                className="w-full rounded-lg py-2.5 text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, oklch(0.39 0.09 205) 0%, oklch(0.48 0.12 180) 100%)' }}
              >
                Admin Login
              </button>
            )
          )}
        </div>
      </aside>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  )
}

