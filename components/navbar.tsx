//  components/navbar.tsx

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Aperture, ArrowUpRight, Building2, CalendarDays, Camera, ChevronDown, ClipboardCheck, FileSignature, Gauge, Images, LayoutList, LogOut, Mail, Menu, Palette, Search, Settings, ShieldAlert, UserCheck, Users, X } from 'lucide-react'
import { mainNav } from '@/lib/portal-data'
import { DEFAULT_NAV_LABELS } from '@/lib/nav-labels'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { cn } from '@/lib/utils'
import { LoginModal } from '@/components/login-modal'
import { NotificationBell } from '@/components/documents/NotificationBell'
import { SearchPalette } from '@/components/search-palette'

type Section = { id: number; name: string; slug: string }
type Department = { id: number; name: string; slug: string; sections: Section[] }

// Admin Settings mega-menu, one column per group. ismOnly groups are shown
// to ISM Admin accounts only.
const ADMIN_GROUPS: { title: string; ismOnly?: boolean; items: { href: string; label: string; hint: string; icon: typeof Settings }[] }[] = [
  {
    title: 'Monitoring',
    ismOnly: true,
    items: [
      { href: '/dashboard-admin', label: 'Dashboard', hint: 'Yang perlu ditindaklanjuti', icon: Gauge },
      { href: '/kelola-pernyataan-kebijakan', label: 'Policy Read Log', hint: 'Rekap baca kebijakan ISMS', icon: ClipboardCheck },
    ],
  },
  {
    title: 'Content',
    items: [
      { href: '/pengaturan', label: 'Manage Menu Content', hint: 'Isi & label menu portal', icon: LayoutList },
      { href: '/kelola-hero-slides', label: 'Manage Hero Slides', hint: 'Video & gambar di Home', icon: Images },
      { href: '/kelola-jadwal', label: 'Manage Schedules', hint: 'Jadwal audit & training', icon: CalendarDays },
    ],
  },
  {
    title: 'Organization & Requests',
    items: [
      { href: '/kelola-departemen', label: 'Manage Departments', hint: 'Departemen & section', icon: Building2 },
      { href: '/kelola-permintaan-foto-video', label: 'Photo/Video Requests', hint: 'Tinjau izin foto/video', icon: Camera },
      { href: '/kelola-izin-area-special', label: 'Special Area Access', hint: 'Izin masuk area special', icon: ShieldAlert },
      { href: '/kelola-kamera', label: 'Camera Equipment', hint: 'Kamera & ID photography', icon: Aperture },
      { href: '/kelola-pic-approve', label: 'PIC Approvers', hint: 'Penyetuju izin foto', icon: UserCheck },
    ],
  },
  {
    title: 'Accounts',
    ismOnly: true,
    items: [
      { href: '/kelola-admin', label: 'Manage Admin Accounts', hint: 'Akun, role & log aktivitas', icon: Users },
      { href: '/kelola-pengesahan', label: 'Approver Pengesahan', hint: 'Penyetuju prosedur ISMS', icon: FileSignature },
    ],
  },
  {
    title: 'System',
    ismOnly: true,
    items: [
      { href: '/kelola-smtp', label: 'SMTP Settings', hint: 'Email notifikasi & App URL', icon: Mail },
      { href: '/kelola-tema', label: 'Theme Colors', hint: 'Warna tema portal', icon: Palette },
    ],
  },
]

export function Navbar() {
  const pathname = usePathname()
  const { isLoggedIn, adminUser, isLoading, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [deptMenuOpen, setDeptMenuOpen] = useState(false)
  const [ismsStandardMenuOpen, setIsmsStandardMenuOpen] = useState(false)
  const [formCsMenuOpen, setFormCsMenuOpen] = useState(false)
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)
  const [expandedDept, setExpandedDept] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [navLabels, setNavLabels] = useState<Record<string, string>>(DEFAULT_NAV_LABELS)
  const [loginOpen, setLoginOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

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

  useEffect(() => { setMobileOpen(false); setDeptMenuOpen(false); setIsmsStandardMenuOpen(false); setFormCsMenuOpen(false); setSettingsMenuOpen(false); setExpandedDept(null) }, [pathname])

  // Close the desktop dropdowns on a click outside the menu that was clicked,
  // or on Escape. A full-screen click-catcher can't do this: once the page is
  // scrolled, the navbar's backdrop-filter traps position:fixed children
  // inside the bar, so clicks on the page never reached it.
  const anyMenuOpen = deptMenuOpen || ismsStandardMenuOpen || formCsMenuOpen || settingsMenuOpen
  useEffect(() => {
    if (!anyMenuOpen) return
    const closeExcept = (key: string | null) => {
      if (key !== 'isms') setIsmsStandardMenuOpen(false)
      if (key !== 'formcs') setFormCsMenuOpen(false)
      if (key !== 'dept') setDeptMenuOpen(false)
      if (key !== 'settings') setSettingsMenuOpen(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      closeExcept(target?.closest?.('[data-nav-menu]')?.getAttribute('data-nav-menu') ?? null)
    }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeExcept(null) }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [anyMenuOpen])

  // Ctrl/⌘+K (or "/" outside a text field) opens the global search.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      if ((event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !typing)) {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
      setIsmsStandardMenuOpen(false)
      setFormCsMenuOpen(false)
      setSettingsMenuOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  const departmentHref = (dept: Department) => `/documents/department/${dept.slug}`
  const sectionHref = (dept: Department, section: Section) => `/documents/department/${dept.slug}/${section.slug}`

  // Menu labels are set in capitals; Admin Settings (button and its menu) keeps normal case.
  const navLink = 'nav-wipe relative isolate overflow-hidden rounded-full px-2 py-2 2xl:px-3 text-[11px] uppercase tracking-[0.035em] font-semibold text-primary-foreground/70 transition-colors hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-accent'
  const navLinkActive = 'bg-accent text-white hover:text-white'
  const adminGroups = ADMIN_GROUPS.filter((group) => !group.ismOnly || adminUser?.role === 'ism_admin')
  const isAdminSectionActive = ADMIN_GROUPS.some((group) => group.items.some((item) => item.href === pathname))

  // Active items are already an acid pill — no extra underline needed.
  const activeIndicator = null

  const formCsItems = (
    <>
      <Link href="/form-aplikasi" className="nav-drop-item block rounded-md px-3 py-2.5 text-[12.5px] uppercase tracking-[0.04em] text-foreground">Application Form</Link>
      <Link href="/kontrol-cs" className="nav-drop-item block rounded-md px-3 py-2.5 text-[12.5px] uppercase tracking-[0.04em] text-foreground">CS Control</Link>
    </>
  )

  const renderMainNavItem = (item: (typeof mainNav)[number]) => {
    const key = item.href === '/' ? 'home'
      : item.href === '/kebijakan-dasar-ISMS' ? 'kebijakan'
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
  }

  const renderMobileNavItem = (item: (typeof mainNav)[number]) => {
    const key = item.href === '/' ? 'home'
      : item.href === '/kebijakan-dasar-ISMS' ? 'kebijakan'
        : item.href === '/education' ? 'edukasi'
          : null
    const label = key ? (navLabels[key] ?? item.label) : item.label
    return (
      <Link key={item.href} href={item.href} className={cn('nav-drawer-item block rounded-md px-3 py-2.5 text-[13px] font-medium uppercase tracking-[0.04em] text-foreground', pathname === item.href && 'bg-secondary font-semibold text-primary')}>
        {label}
      </Link>
    )
  }

  const ismsStandardRoutes = ['/prosedur-isms', '/standard-isms-p14', '/working-standard']
  const isIsmsStandardActive = ismsStandardRoutes.includes(pathname)
  const ismsStandardItems = (
    <>
      <Link href="/prosedur-isms" className="nav-drop-item block rounded-md px-3 py-2.5 text-[12.5px] uppercase tracking-[0.04em] text-foreground">{navLabels.prosedur ?? 'ISMS Procedures'}</Link>
      <Link href="/standard-isms-p14" className="nav-drop-item block rounded-md px-3 py-2.5 text-[12.5px] uppercase tracking-[0.04em] text-foreground">Standard Requirement TMMIN</Link>
      <Link href="/working-standard" className="nav-drop-item block rounded-md px-3 py-2.5 text-[12.5px] uppercase tracking-[0.04em] text-foreground">{navLabels.working_standard ?? 'Working Standard'}</Link>
    </>
  )

  const dropdownPanel = (children: React.ReactNode) => (
    <div
      role="menu"
      className="absolute left-0 top-[calc(100%+14px)] z-20 w-72 overflow-hidden rounded-[1.4rem] border border-border bg-popover text-popover-foreground"
      style={{
        animation: 'dropdown-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
        boxShadow: '0 20px 45px color-mix(in oklch, var(--p-950) 25%, transparent), 0 0 0 1px color-mix(in oklch, var(--p-550) 12%, transparent)',
      }}
    >
      <div className="nav-dropdown-bar h-[2.5px] w-full" />
      <div className="p-2">{children}</div>
    </div>
  )

  const departmentItems = departments.map((dept) =>
    dept.sections.length === 0 ? (
      <Link key={dept.id} href={departmentHref(dept)} className="nav-drop-item block rounded-md px-3 py-2.5 text-[12.5px] uppercase tracking-[0.04em] text-foreground">{dept.name}</Link>
    ) : (
      <div key={dept.id}>
        <button type="button" onClick={() => setExpandedDept((value) => value === dept.slug ? null : dept.slug)} className="nav-drop-item flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-[12.5px] uppercase tracking-[0.04em] text-foreground">
          {dept.name}<ChevronDown className={cn('size-4 transition-transform duration-200', expandedDept === dept.slug && 'rotate-180')} />
        </button>
        {expandedDept === dept.slug && (
          <div className="ml-3 border-l border-border pl-2">
            {dept.sections.map((section) => (
              <Link key={section.id} href={sectionHref(dept, section)} className="nav-drop-item block rounded-md px-3 py-2 text-[11.5px] uppercase tracking-[0.04em] text-muted-foreground hover:text-foreground">{section.name}</Link>
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
          background: linear-gradient(90deg, var(--p-600) 0%, var(--p-700) 40%, var(--p-600) 100%);
          background-size: 200% auto;
          animation: nav-bar-shimmer 3s linear infinite;
        }
        .nav-drop-item {
          border-radius: 0.8rem;
          font-weight: 500;
          transition: background 160ms, padding-left 200ms cubic-bezier(0.16, 1, 0.3, 1), color 160ms;
        }
        .nav-drop-item:hover {
          background: linear-gradient(90deg, color-mix(in oklch, var(--p-600) 12%, transparent) 0%, color-mix(in oklch, var(--p-700) 5%, transparent) 100%);
          padding-left: 18px;
        }
        .nav-drawer-item {
          border-radius: 0.8rem;
          transition: background 160ms, padding-left 200ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .nav-drawer-item:hover {
          background: linear-gradient(90deg, color-mix(in oklch, var(--p-600) 10%, transparent) 0%, transparent 100%);
          padding-left: 18px;
        }
      `}</style>

      {/* Floating ink pill — the sticky wrapper itself is click-through so the
          page behind the gutters stays usable while scrolling. */}
      <div className="pointer-events-none sticky top-0 z-30 px-4 pt-3 max-[680px]:px-2 max-[680px]:pt-2">
      <nav
        className="pointer-events-auto relative mx-auto max-w-[1480px] rounded-full bg-primary text-primary-foreground transition-all duration-300"
        style={{
          boxShadow: scrolled
            ? '0 18px 40px -14px color-mix(in oklch, var(--primary) 55%, transparent)'
            : '0 8px 24px -14px color-mix(in oklch, var(--primary) 45%, transparent)',
          background: scrolled ? 'color-mix(in oklch, var(--primary) 92%, transparent)' : undefined,
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'none',
        }}
      >
        <div className="flex min-h-[60px] items-center gap-3 pl-2.5 pr-3 max-[680px]:min-h-14 2xl:gap-5">
          <Link href="/" className="flex flex-none items-center gap-3" aria-label="ISMS Portal home">
            <span className="flex h-10 w-[128px] items-center overflow-hidden rounded-full bg-white px-3">
              <img
                src={`${API_BASE_PATH}/images/yazaki-logo.jpg`}
                alt="Yazaki PT. Jatim Autocomp Indonesia"
                width={132}
                height={40}
                className="h-auto w-full object-contain"
              />
            </span>
          </Link>

          <div className="hidden flex-1 items-center gap-1 md:flex">
            {mainNav
              .filter((item) => item.href === '/' || item.href === '/kebijakan-dasar-ISMS')
              .map(renderMainNavItem)}

            {/* ISMS Standard dropdown */}
            <div data-nav-menu="isms" className="relative">
              <button
                type="button"
                onClick={() => setIsmsStandardMenuOpen((v) => !v)}
                className={cn('flex items-center gap-1', navLink, isIsmsStandardActive && navLinkActive)}
              >
                ISMS Standard
                <ChevronDown className={cn('size-4 transition-transform duration-200', ismsStandardMenuOpen && 'rotate-180')} />
                {isIsmsStandardActive && activeIndicator}
              </button>
              {ismsStandardMenuOpen && (
                <>
                  {dropdownPanel(
                    <>
                      <div className="border-b border-border px-3 pb-2 pt-1">
                        <p className="portal-eyebrow">Document library</p>
                        <p className="mt-1 text-xs text-muted-foreground">Choose document category</p>
                      </div>
                      {ismsStandardItems}
                    </>
                  )}
                </>
              )}
            </div>

            {mainNav
              .filter((item) => item.href === '/education')
              .map(renderMainNavItem)}

            {/* Form CS dropdown */}
            <div data-nav-menu="formcs" className="relative">
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
            <div data-nav-menu="dept" className="relative">
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
              <div data-nav-menu="settings">
                <button
                  type="button"
                  onClick={() => setSettingsMenuOpen((v) => !v)}
                  className={cn(
                    'flex items-center gap-1',
                    navLink,
                    'text-[13px] font-medium normal-case tracking-normal',
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
                    {/* Mega-menu: the groups side by side instead of one long column. */}
                    <div
                      role="menu"
                      aria-label="Admin Settings"
                      className="absolute left-1/2 top-[calc(100%+12px)] z-20 w-[min(1180px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[1.4rem] border border-border bg-popover text-popover-foreground"
                      style={{
                        animation: 'dropdown-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
                        boxShadow: '0 24px 60px color-mix(in oklch, var(--p-950) 28%, transparent), 0 0 0 1px color-mix(in oklch, var(--p-550) 12%, transparent)',
                      }}
                    >
                      <div className="nav-dropdown-bar h-[2.5px] w-full" />
                      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
                        <div>
                          <p className="portal-eyebrow">Admin Panel</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">Pilih fitur yang ingin dikelola</p>
                        </div>
                        <span className="rounded-full bg-secondary px-2.5 py-1 font-mono-label text-[10px] text-muted-foreground">{adminUser?.username}</span>
                      </div>
                      <div className={cn('grid grid-cols-2 gap-x-2 gap-y-4 p-3 lg:grid-cols-3', adminGroups.length > 4 ? 'xl:grid-cols-5' : 'xl:grid-cols-4')}>
                        {adminGroups.map((group) => (
                          <div key={group.title}>
                            <p className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70">{group.title}</p>
                            <div className="flex flex-col">
                              {group.items.map(({ href, label, hint, icon: Icon }) => {
                                const active = pathname === href
                                return (
                                  <Link
                                    key={href}
                                    href={href}
                                    className={cn('nav-drop-item group flex items-center gap-2.5 rounded-xl px-2.5 py-2', active && 'bg-secondary')}
                                  >
                                    <span className={cn('grid size-8 flex-none place-items-center rounded-lg transition-colors', active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-[color:var(--p-600)] group-hover:bg-primary group-hover:text-primary-foreground')}>
                                      <Icon className="size-4" />
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate text-[13px] font-medium leading-tight text-foreground">{label}</span>
                                      <span className="block truncate text-[11px] leading-tight text-muted-foreground">{hint}</span>
                                    </span>
                                  </Link>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right side actions */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Cari dokumen (Ctrl+K)"
              title="Cari dokumen (Ctrl+K)"
              className="grid size-10 flex-none place-items-center rounded-full bg-primary-foreground/10 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/20 hover:text-primary-foreground"
            >
              <Search className="size-4" />
            </button>
            {!isLoading && isLoggedIn && <NotificationBell />}
            {!isLoading && (
              isLoggedIn ? (
                <div className="hidden items-center gap-2 sm:flex">
                  <span className="hidden items-center gap-1.5 rounded-full border border-primary-foreground/15 px-3 py-1.5 font-mono-label text-[10.5px] text-primary-foreground/85 2xl:flex">
                    <span className="size-1.5 rounded-full bg-accent" />
                    {adminUser?.username}
                  </span>
                  <button
                    onClick={() => logout()}
                    aria-label="Logout"
                    title="Logout"
                    className="flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 text-xs font-medium transition-colors hover:bg-primary-foreground/20"
                  >
                    <LogOut className="size-4" />
                    <span className="hidden 2xl:inline">Logout</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setLoginOpen(true)}
                  className="group hidden items-center gap-2 rounded-full py-2 pl-4 pr-2 text-[11.5px] font-semibold uppercase tracking-[0.045em] text-white transition-transform duration-200 hover:scale-[1.03] sm:flex"
                  style={{ background: 'linear-gradient(135deg, var(--p-550) 0%, var(--p-500) 100%)', boxShadow: '0 3px 12px color-mix(in oklch, var(--p-550) 40%, transparent)' }}
                >
                  Admin Login
                  <span className="grid size-6 place-items-center rounded-full bg-white/20 transition-transform duration-300 group-hover:rotate-45">
                    <ArrowUpRight className="size-3.5" />
                  </span>
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="grid size-10 place-items-center rounded-full bg-accent text-white transition-transform hover:scale-105 md:hidden"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </nav>
      </div>

      {/* Mobile backdrop */}
      <div
        className={cn('fixed inset-0 z-40 bg-primary/40 backdrop-blur-sm md:hidden transition-opacity duration-200', mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Portal navigation"
        aria-hidden={!mobileOpen}
        className={cn('fixed right-0 top-0 z-50 flex h-screen w-80 max-w-[85vw] flex-col shadow-2xl transition-transform duration-200 md:hidden', mobileOpen ? 'translate-x-0' : 'translate-x-full')}
        style={{ background: 'var(--background)' }}
      >
        <div className="relative flex items-center justify-between overflow-hidden bg-primary px-4 py-4 text-primary-foreground">
          <span className="relative flex items-center gap-2 font-mono-label text-[11px]">
            <span className="size-2 rounded-full bg-accent" /> Portal navigation
          </span>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="relative grid size-9 place-items-center rounded-full transition-colors hover:bg-white/15">
            <X className="size-5" />
          </button>
        </div>
        <div className="nav-dropdown-bar h-[3px] w-full flex-shrink-0" />
        <div className="flex-1 overflow-y-auto p-3">
          {mainNav.filter((item) => item.href === '/' || item.href === '/kebijakan-dasar-ISMS').map(renderMobileNavItem)}
          <div className="portal-eyebrow px-3 pb-2 pt-5">ISMS Standard</div>
          {ismsStandardItems}
          {mainNav.filter((item) => item.href === '/education').map(renderMobileNavItem)}
          <div className="portal-eyebrow px-3 pb-2 pt-5">{navLabels.form_cs ?? 'Forms & CS Control'}</div>
          {formCsItems}
          <div className="portal-eyebrow px-3 pb-2 pt-5">{navLabels.departemen ?? 'Departments'}</div>
          {departmentItems}
          {isLoggedIn && (
            <>
              <div className="portal-eyebrow px-3 pb-2 pt-5">Admin Settings</div>
              {adminGroups.map((group, gi) => (
                <div key={group.title}>
                  <p className={cn('px-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70', gi > 0 && 'pt-2.5')}>{group.title}</p>
                  {group.items.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href} className={cn('nav-drawer-item flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-foreground', pathname === href && 'bg-secondary font-semibold text-primary')}>
                      <Icon className="size-4" />{label}
                    </Link>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
        <div className="border-t border-border p-4">
          {!isLoading && (
            isLoggedIn ? (
              <button onClick={() => logout()} className="flex w-full items-center justify-center gap-2 rounded-full border border-border px-3 py-2.5 text-sm transition-colors hover:bg-secondary">
                <LogOut className="size-4" />Logout ({adminUser?.username})
              </button>
            ) : (
              <button
                onClick={() => { setMobileOpen(false); setLoginOpen(true) }}
                className="w-full rounded-full bg-primary py-3 text-[13px] font-semibold uppercase tracking-[0.04em] text-primary-foreground"
              >
                Admin Login
              </button>
            )
          )}
        </div>
      </aside>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}

