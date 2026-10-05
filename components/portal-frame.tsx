// components/portal-frame.tsx

'use client'

import { useEffect, useRef } from 'react'
import { ChevronRight, LockKeyhole, FileText, ClipboardCheck, ClipboardList, BookOpen, Gauge, Shield, LayoutGrid, Home, BookMarked, Settings, Users } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { PortalFooter } from '@/components/portal-footer'
import { ScrollReveal } from '@/components/scroll-reveal'
import { RouteCurtain } from '@/components/route-transition'
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
  '/dashboard-admin': <Gauge className="size-5" />,
  '/kelola-pernyataan-kebijakan': <ClipboardCheck className="size-5" />,
}

// Page names for the breadcrumb, the big page title and the route curtain —
// written out so they read the same as the menus instead of echoing the URL
// ("audits", "ijin foto video"). Anything not listed falls back to the slug.
const PAGE_TITLES: Record<string, string> = {
  '/': 'Home',
  '/_not-found': 'Halaman Tidak Ditemukan',
  '/kebijakan-dasar-ISMS': 'Kebijakan Dasar ISMS',
  '/prosedur-isms': 'Prosedur ISMS',
  '/standard-isms-p14': 'Standard Requirement TMMIN',
  '/working-standard': 'Working Standard',
  '/education': 'Education & Training',
  '/form-aplikasi': 'Form Aplikasi',
  '/kontrol-cs': 'Kontrol CS',
  '/audits': 'Jadwal Audit',
  '/news': 'Berita',
  '/ijin-foto-video': 'Ijin Foto/Video',
  '/foto-video-internal': 'Ijin Foto/Video Internal',
  '/foto-video-visitor': 'Ijin Foto/Video Visitor',
  '/rekap-foto-video': 'Rekap Foto/Video',
  '/pengesahan': 'Pengesahan Dokumen',
  '/verifikasi-pengesahan': 'Verifikasi Pengesahan',
  '/konfirmasi-approval': 'Konfirmasi Persetujuan',
  '/persetujuan-area-special': 'Persetujuan Area Special',
  '/verifikasi-area-special': 'Verifikasi Area Special',
  '/dashboard-admin': 'Dashboard Admin',
  '/pengaturan': 'Kelola Isi Menu',
  '/kelola-hero-slides': 'Kelola Hero Slides',
  '/kelola-jadwal': 'Kelola Jadwal',
  '/kelola-departemen': 'Kelola Departemen',
  '/kelola-permintaan-foto-video': 'Permintaan Foto/Video',
  '/kelola-izin-area-special': 'Izin Area Special',
  '/kelola-kamera': 'Kelola Kamera',
  '/kelola-pic-approve': 'PIC Approver',
  '/kelola-admin': 'Kelola Akun Admin',
  '/kelola-pengesahan': 'Approver Pengesahan',
  '/kelola-pernyataan-kebijakan': 'Pernyataan Kebijakan',
  '/kelola-smtp': 'Pengaturan SMTP',
  '/pratinjau-email': 'Pratinjau Email',
  '/kelola-tema': 'Warna Tema',
}

// Menu pages that render their own themed hero (components/page-hero.tsx);
// the frame then shows only the breadcrumb row, not a duplicate giant title.
const OWN_HERO_PREFIXES = [
  '/kebijakan-dasar-ISMS', '/prosedur-isms', '/standard-isms-p14', '/working-standard', '/education',
  '/form-aplikasi', '/kontrol-cs', '/audits', '/news', '/documents', '/ijin-foto-video', '/rekap-foto-video', '/pengesahan', '/verifikasi-pengesahan', '/persetujuan-area-special', '/verifikasi-area-special',
  // Admin pages open with their own "Admin workspace" header or page heading.
  '/dashboard-admin', '/pengaturan', '/kelola-hero-slides', '/kelola-jadwal', '/kelola-departemen', '/kelola-permintaan-foto-video',
  '/kelola-izin-area-special', '/kelola-kamera', '/kelola-pic-approve', '/kelola-admin', '/kelola-pengesahan',
  '/kelola-pernyataan-kebijakan', '/kelola-smtp', '/kelola-tema', '/pratinjau-email',
]

// Routes that exist without being listed in PAGE_TITLES (dynamic segments).
// Anything else that isn't in PAGE_TITLES is a mistyped address → 404 page.
const DYNAMIC_PREFIXES = ['/documents/', '/verifikasi/']

export function PortalFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { adminUser, isLoading } = useAuth()
  const isKioskRoute = pathname === KIOSK_ROUTES.lobby || pathname === KIOSK_ROUTES.security
  // First page of the visit gets a short rise; every later route change gets
  // the full curtain + rise (see components/route-transition.tsx).
  const initialPath = useRef(pathname)
  const navigated = useRef(false)
  if (pathname !== initialPath.current) navigated.current = true

  // Confine the lobby/security kiosk roles to their one page, regardless of
  // what URL they navigate to — the actual guarantee, not just a hidden menu.
  useEffect(() => {
    if (isLoading || !adminUser) return
    const home = adminUser.role === 'lobby' ? KIOSK_ROUTES.lobby : adminUser.role === 'security' ? KIOSK_ROUTES.security : null
    if (home && pathname !== home) router.replace(home)
  }, [isLoading, adminUser, pathname, router])

  if (isKioskRoute) return <>{children}</>

  const isHome = pathname === '/'
  // A mistyped address: app/not-found.tsx shows the message, so the frame
  // neither echoes the wrong URL as a title nor adds a second heading.
  const isNotFound = !(pathname in PAGE_TITLES) && !DYNAMIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  const hasOwnHero = isNotFound || OWN_HERO_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))

  const segments = pathname.split('/').filter(Boolean)
  const isSectionPage = segments[0] === 'documents' && segments[1] === 'department' && segments.length === 4
  const pageTitle =
    PAGE_TITLES[pathname]
      ?? (isNotFound ? PAGE_TITLES['/_not-found'] : isSectionPage
        ? decodeURIComponent(segments.at(-1) ?? '').replaceAll('-', ' ').toUpperCase()
        : titleFor(segments.at(-1) ?? 'Home'))

  const pageIcon = PAGE_ICONS[pathname] ?? <FileText className="size-5" />

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <RouteCurtain pathname={pathname} label={pageTitle} />

      {/* Keyed by route so the header + content replay their entrance on
          every menu change (rising in as the curtain lifts). */}
      <div key={pathname} className={navigated.current ? 'route-enter' : 'route-enter-first'}>
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
      <main id="portal-main" className={`mx-auto max-w-[1480px] px-10 pb-16 max-[900px]:px-6 max-[900px]:pb-10 max-[680px]:px-4 max-[680px]:pb-8 ${isHome ? 'pt-0 max-[900px]:pt-0 max-[680px]:pt-0' : 'pt-9 max-[900px]:pt-7 max-[680px]:pt-6'}`}>
        {children}
      </main>
      </div>
      <ScrollReveal rootId="portal-main" />

      <PortalFooter />
    </div>
  )
}
