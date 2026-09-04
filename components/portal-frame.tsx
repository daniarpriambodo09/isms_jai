// components/portal-frame.tsx

'use client'

import { useEffect } from 'react'
import { ChevronRight, LockKeyhole, FileText, ClipboardList, BookOpen, Shield, LayoutGrid, Home, BookMarked, Settings } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { titleFor } from '@/lib/portal-data'
import { useAuth } from '@/context/AuthContext'

// These two routes are standalone kiosk pages (vendor gate management at
// Lobby / Pos Security) — they render with none of the portal's chrome,
// and the "lobby"/"security" admin roles are confined to their one page
// no matter what URL they try to reach.
const KIOSK_ROUTES: Record<'lobby' | 'security', string> = {
  lobby: '/admin-lobby',
  security: '/admin-pos-security',
}

const PAGE_ICONS: Record<string, React.ReactNode> = {
  '/': <Home className="size-5" />,
  '/audits': <ClipboardList className="size-5" />,
  '/prosedur-isms': <BookOpen className="size-5" />,
  '/working-standard': <BookMarked className="size-5" />,
  '/form-aplikasi': <FileText className="size-5" />,
  '/kontrol-cs': <LayoutGrid className="size-5" />,
  '/kebijakan-dasar-ISMS': <Shield className="size-5" />,
  '/news': <FileText className="size-5" />,
  '/kelola-departemen': <Settings className="size-5" />,
}

export function PortalFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { adminUser, isLoading } = useAuth()
  const isKioskRoute = pathname === KIOSK_ROUTES.lobby || pathname === KIOSK_ROUTES.security

  // Confine the lobby/security kiosk roles to their one page, regardless of
  // what URL they navigate to — the actual guarantee, not just a hidden menu.
  useEffect(() => {
    if (isLoading || !adminUser) return
    const home = adminUser.role === 'lobby' ? KIOSK_ROUTES.lobby : adminUser.role === 'security' ? KIOSK_ROUTES.security : null
    if (home && pathname !== home) router.replace(home)
  }, [isLoading, adminUser, pathname, router])

  if (isKioskRoute) return <>{children}</>

  const isHome = pathname === '/'

  const segments = pathname.split('/').filter(Boolean)
  const isSectionPage = segments[0] === 'documents' && segments[1] === 'department' && segments.length === 4
  const pageTitle =
    pathname === '/'
      ? 'Home'
      : pathname === '/_not-found'
        ? 'Halaman Tidak Ditemukan'
        : pathname === '/prosedur-isms'
          ? 'Prosedur ISMS'
          : pathname === '/working-standard'
            ? 'Working Standard & Standard Requirements TMMIN'
            : pathname === '/form-aplikasi'
              ? 'Form Aplikasi'
              : pathname === '/kontrol-cs'
                ? 'Kontrol CS'
                : isSectionPage
                  ? decodeURIComponent(segments.at(-1) ?? '').replaceAll('-', ' ').toUpperCase()
                  : titleFor(segments.at(-1) ?? 'Home')

  const pageIcon = PAGE_ICONS[pathname] ?? <FileText className="size-5" />

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* ─── Page Header ─── */}
      {/* Home skips this bar entirely so the hero video sits flush against the navbar. */}
      {!isHome && <header
        className="relative border-b border-border backdrop-blur-sm"
        style={{
          background: 'linear-gradient(135deg, var(--card) 0%, color-mix(in oklch, var(--secondary) 60%, var(--card)) 100%)',
        }}
      >
        {/* Top gradient accent bar */}
        <div
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{
            background: 'linear-gradient(90deg, oklch(0.45 0.12 180) 0%, oklch(0.58 0.14 165) 50%, oklch(0.45 0.12 180) 100%)',
          }}
        />

        <div className="mx-auto max-w-[1480px] px-10 pb-7 pt-6 max-[900px]:px-6 max-[680px]:px-4 max-[680px]:pb-5 max-[680px]:pt-4">
          {/* Breadcrumb */}
          <div className="mb-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <span className="font-medium">ISMS Portal</span>
            <ChevronRight className="size-3 opacity-50" />
            <strong className="font-semibold text-foreground/80">{pageTitle}</strong>
          </div>

          {/* Title row */}
          <div className="flex items-end justify-between gap-6 max-[680px]:items-start">
            <div className="flex items-center gap-4">
              {/* Accent bar + icon */}
              <div
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl max-[680px]:hidden"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.39 0.09 205) 0%, oklch(0.48 0.12 180) 100%)',
                  boxShadow: '0 4px 14px oklch(0.39 0.09 205 / 30%)',
                  color: 'white',
                }}
              >
                {pageIcon}
              </div>

              <div>
                <p className="portal-eyebrow mb-1.5">Information security management system</p>
                <div className="flex items-center gap-3">
                  {/* Vertical teal accent */}
                  <div
                    className="h-8 w-[3px] flex-shrink-0 rounded-full max-[680px]:hidden"
                    style={{ background: 'linear-gradient(to bottom, oklch(0.58 0.14 165), oklch(0.45 0.12 180))' }}
                  />
                  <h1
                    className="text-3xl font-bold tracking-tight text-primary max-[680px]:text-2xl"
                  >
                    {pageTitle}
                  </h1>
                </div>
              </div>
            </div>

            {/* Badge */}
            <div
              className="hidden flex-shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider sm:flex"
              style={{
                background: 'linear-gradient(135deg, oklch(0.39 0.09 205 / 8%) 0%, oklch(0.48 0.12 180 / 12%) 100%)',
                borderColor: 'oklch(0.48 0.12 180 / 25%)',
                color: 'oklch(0.39 0.09 205)',
              }}
            >
              <LockKeyhole className="size-3" />
              Internal knowledge base
            </div>
          </div>
        </div>
      </header>}

      {/* ─── Main content ─── */}
      <main className={`page-fade-in mx-auto max-w-[1480px] px-10 pb-10 max-[900px]:px-6 max-[900px]:pb-7 max-[680px]:px-4 max-[680px]:pb-6 ${isHome ? 'pt-0 max-[900px]:pt-0 max-[680px]:pt-0' : 'pt-9 max-[900px]:pt-7 max-[680px]:pt-6'}`}>
        {children}
      </main>

      {/* ─── Footer ─── */}
      <footer
        className="relative mt-6 overflow-hidden border-t border-border"
        style={{
          background: 'linear-gradient(135deg, var(--card) 0%, color-mix(in oklch, var(--muted) 40%, var(--card)) 100%)',
        }}
      >
        {/* Top gradient accent */}
        <div
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, oklch(0.48 0.12 180 / 50%) 30%, oklch(0.58 0.14 165 / 70%) 50%, oklch(0.48 0.12 180 / 50%) 70%, transparent 100%)',
          }}
        />
        {/* Dot-grid texture, echoing the hero banners */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: 'radial-gradient(circle, oklch(0.39 0.09 205) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
        />

        <div className="relative mx-auto max-w-[1480px] px-10 py-8 max-[680px]:px-4 max-[680px]:py-6">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {/* Column 1 — Brand */}
            <div>
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: 'linear-gradient(135deg, oklch(0.39 0.09 205), oklch(0.48 0.12 180))', boxShadow: '0 4px 14px oklch(0.39 0.09 205 / 30%)' }}
                >
                  <Shield className="size-4 text-white" />
                </div>
                <span className="text-[13px] font-bold text-primary">ISMS Portal</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Information Security Management System — PT. Jatim Autocomp Indonesia
              </p>
            </div>

            {/* Column 2 — Quick links */}
            <div>
              <p className="mb-2.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Navigasi Cepat
              </p>
              <div className="flex flex-col gap-1.5">
                {[
                  ['Kebijakan Dasar ISMS', '/kebijakan-dasar-ISMS'],
                  ['Prosedur ISMS', '/prosedur-isms'],
                  ['Jadwal Audit', '/audits'],
                  ['Working Standard', '/working-standard'],
                ].map(([label, href]) => (
                  <a
                    key={href}
                    href={href}
                    className="group flex items-center gap-1.5 text-[11.5px] text-muted-foreground transition-colors hover:text-primary"
                  >
                    <ChevronRight className="size-3 flex-none -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                    {label}
                  </a>
                ))}
              </div>
            </div>

            {/* Column 3 — Info */}
            <div>
              <p className="mb-2.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Informasi Sistem
              </p>
              <div className="flex flex-col gap-1.5">
                <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold"
                    style={{ background: 'oklch(0.58 0.14 165 / 15%)', color: 'oklch(0.45 0.12 180)' }}
                  >
                    v
                  </span>
                  Versi 1.0 · ISO/IEC 27001
                </p>
                <p className="text-[11.5px] text-muted-foreground">
                  <LockKeyhole className="mr-1 inline size-3 opacity-60" />
                  Akses terbatas — Internal only
                </p>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <p className="text-[10.5px] text-muted-foreground">
              © {new Date().getFullYear()} PT. Jatim Autocomp Indonesia. All rights reserved.
            </p>
            <p className="text-[10.5px] text-muted-foreground">
              ISMS Portal — Confidential & Internal Use Only
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}