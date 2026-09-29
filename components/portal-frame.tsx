// components/portal-frame.tsx

'use client'

import { useEffect } from 'react'
import { ArrowUpRight, ChevronRight, LockKeyhole, FileText, ClipboardList, BookOpen, Shield, LayoutGrid, Home, BookMarked, Settings, Users } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { ScrollReveal } from '@/components/scroll-reveal'
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
  '/standard-isms-p14': <BookMarked className="size-5" />,
  '/working-standard': <BookMarked className="size-5" />,
  '/form-aplikasi': <FileText className="size-5" />,
  '/kontrol-cs': <LayoutGrid className="size-5" />,
  '/kebijakan-dasar-ISMS': <Shield className="size-5" />,
  '/news': <FileText className="size-5" />,
  '/kelola-departemen': <Settings className="size-5" />,
  '/kelola-admin': <Users className="size-5" />,
}

// Menu pages that render their own themed hero (components/page-hero.tsx);
// the frame then shows only the breadcrumb row, not a duplicate giant title.
const OWN_HERO_PREFIXES = [
  '/kebijakan-dasar-ISMS', '/prosedur-isms', '/standard-isms-p14', '/working-standard', '/education',
  '/form-aplikasi', '/kontrol-cs', '/audits', '/news', '/documents', '/ijin-foto-video', '/rekap-foto-video', '/pengesahan', '/verifikasi-pengesahan',
]

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
  const hasOwnHero = OWN_HERO_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))

  const segments = pathname.split('/').filter(Boolean)
  const isSectionPage = segments[0] === 'documents' && segments[1] === 'department' && segments.length === 4
  const pageTitle =
    pathname === '/'
      ? 'Home'
      : pathname === '/_not-found'
        ? 'Halaman Tidak Ditemukan'
        : pathname === '/prosedur-isms'
          ? 'Prosedur ISMS'
          : pathname === '/standard-isms-p14'
            ? 'Standard Requirement TMMIN'
            : pathname === '/working-standard'
              ? 'Working Standard'
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
      {!isHome && (
        <header className={`relative ${hasOwnHero ? '' : 'border-b border-border'}`}>
          <div className={`mx-auto max-w-[1480px] px-10 pt-8 max-[900px]:px-6 max-[680px]:px-4 max-[680px]:pt-5 ${hasOwnHero ? 'pb-0' : 'pb-8 max-[680px]:pb-6'}`}>
            {/* Index row — mono breadcrumb left, context right */}
            <div className={`flex items-center justify-between gap-4 border-b border-border pb-3 font-mono-label text-[10.5px] text-muted-foreground ${hasOwnHero ? '' : 'mb-5 max-[680px]:mb-3'}`}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid size-6 flex-none place-items-center rounded-full bg-primary text-primary-foreground [&>svg]:size-3.5">{pageIcon}</span>
                <span>ISMS Portal</span>
                <ChevronRight className="size-3 flex-none opacity-50" />
                <span className="truncate text-foreground">{pageTitle}</span>
              </div>
              <span className="hidden items-center gap-1.5 sm:flex">
                <LockKeyhole className="size-3" /> Internal · ISO/IEC 27001
              </span>
            </div>

            {hasOwnHero ? (
              <h1 className="sr-only">{pageTitle}</h1>
            ) : (
              <h1 className="font-display text-balance text-[clamp(2.3rem,5.4vw,4.75rem)] font-semibold leading-[0.95] text-foreground">
                {pageTitle}
                <span className="text-[color:var(--ring)]">.</span>
              </h1>
            )}
          </div>
        </header>
      )}

      {/* ─── Main content ─── */}
      <main id="portal-main" className={`page-fade-in mx-auto max-w-[1480px] px-10 pb-16 max-[900px]:px-6 max-[900px]:pb-10 max-[680px]:px-4 max-[680px]:pb-8 ${isHome ? 'pt-0 max-[900px]:pt-0 max-[680px]:pt-0' : 'pt-9 max-[900px]:pt-7 max-[680px]:pt-6'}`}>
        {children}
      </main>
      <ScrollReveal rootId="portal-main" />

      {/* ─── Footer ─── */}
      <footer className="relative mt-10 overflow-hidden bg-primary text-primary-foreground">
        {/* Acid ticker band */}
        <div className="overflow-hidden border-b border-primary-foreground/10 bg-accent py-2.5 text-accent-foreground">
          <div className="marquee-track flex w-max gap-10 whitespace-nowrap font-mono-label text-[11px] font-semibold">
            {Array.from({ length: 2 }).map((_, copy) => (
              <div key={copy} className="flex gap-10" aria-hidden={copy === 1}>
                {['Confidentiality', 'Integrity', 'Availability', 'ISO/IEC 27001', 'Information Security Committee', 'PT. Jatim Autocomp Indonesia'].map((word) => (
                  <span key={word} className="flex items-center gap-10">{word}<span className="size-1.5 rounded-full bg-accent-foreground" /></span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto max-w-[1480px] px-10 pb-8 pt-14 max-[900px]:px-6 max-[680px]:px-4 max-[680px]:pt-10">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
            {/* Column 1 — Brand statement */}
            <div>
              <p className="font-mono-label text-[10.5px] text-primary-foreground/50">(01) — Portal</p>
              <p className="mt-4 max-w-md font-display text-[clamp(1.6rem,2.6vw,2.2rem)] font-semibold leading-[1.05]">
                Keamanan informasi adalah <span className="font-serif-accent text-accent">tanggung jawab</span> kita bersama.
              </p>
            </div>

            {/* Column 2 — Quick links */}
            <div>
              <p className="font-mono-label text-[10.5px] text-primary-foreground/50">(02) — Navigasi</p>
              <div className="mt-4 flex flex-col gap-2">
                {[
                  ['Kebijakan Dasar ISMS', '/kebijakan-dasar-ISMS'],
                  ['Prosedur ISMS', '/prosedur-isms'],
                  ['Jadwal Audit', '/audits'],
                  ['Working Standard', '/working-standard'],
                ].map(([label, href]) => (
                  <a
                    key={href}
                    href={href}
                    className="group flex w-fit items-center gap-2 text-sm text-primary-foreground/75 transition-colors hover:text-accent"
                  >
                    <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    {label}
                  </a>
                ))}
              </div>
            </div>

            {/* Column 3 — Info */}
            <div>
              <p className="font-mono-label text-[10.5px] text-primary-foreground/50">(03) — Sistem</p>
              <div className="mt-4 flex flex-col gap-2 text-sm text-primary-foreground/75">
                <p>Versi 1.0 · ISO/IEC 27001</p>
                <p className="flex items-center gap-1.5"><LockKeyhole className="size-3.5 opacity-70" /> Akses terbatas — Internal only</p>
              </div>
            </div>
          </div>

          {/* Oversized wordmark */}
          <p
            aria-hidden
            className="mt-14 select-none font-display text-[clamp(4rem,15.5vw,15rem)] font-bold leading-[0.8] tracking-[-0.06em] text-primary-foreground/[0.07] max-[680px]:mt-10"
          >
            ISMS PORTAL
          </p>

          {/* Bottom bar */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-primary-foreground/12 pt-5 font-mono-label text-[10px] text-primary-foreground/50">
            <p>© {new Date().getFullYear()} PT. Jatim Autocomp Indonesia</p>
            <p>Confidential & Internal Use Only</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
