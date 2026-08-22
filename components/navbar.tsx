'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
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

  useEffect(() => { setMobileOpen(false); setDeptMenuOpen(false); setExpandedDept(null) }, [pathname])
  const departmentHref = (dept: Department) => `/documents/department/${dept.slug}`
  const sectionHref = (dept: Department, section: Section) => `/documents/department/${dept.slug}/${section.slug}`
  const navLink = 'rounded-md px-3 py-2 text-[13px] font-medium text-primary-foreground/70 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring'
  const navLinkActive = 'bg-primary-foreground/15 text-primary-foreground'

  const departmentItems = departments.map((dept) => dept.sections.length === 0 ? (
    <Link key={dept.id} href={departmentHref(dept)} className="block rounded-md px-3 py-2.5 text-sm text-foreground hover:bg-secondary">{dept.name}</Link>
  ) : (
    <div key={dept.id}>
      <button type="button" onClick={() => setExpandedDept((value) => value === dept.slug ? null : dept.slug)} className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm text-foreground hover:bg-secondary">
        {dept.name}<ChevronDown className={cn('size-4 transition-transform', expandedDept === dept.slug && 'rotate-180')} />
      </button>
      {expandedDept === dept.slug && <div className="ml-3 border-l border-border pl-2">{dept.sections.map((section) => <Link key={section.id} href={sectionHref(dept, section)} className="block rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">{section.name}</Link>)}</div>}
    </div>
  ))

  return <>
    <nav className="sticky top-0 z-30 border-b border-primary-foreground/10 bg-primary text-primary-foreground shadow-lg shadow-primary/10">
      <div className="mx-auto flex min-h-16 max-w-[1480px] items-center gap-6 px-10 max-[900px]:px-6 max-[680px]:min-h-14 max-[680px]:px-4">
        <Link href="/" className="flex flex-none items-center gap-3" aria-label="ISMS Portal home">
          <span className="flex h-10 w-[132px] items-center overflow-hidden rounded-md bg-primary-foreground px-2 shadow-sm"><Image src="/images/yazaki-logo.jpg" alt="Yazaki PT. Jatim Autocomp Indonesia" width={132} height={40} className="h-auto w-full object-contain" priority /></span>
          <span className="max-[680px]:hidden"><strong className="block text-[15px] tracking-tight">ISMS Portal</strong><small className="block text-[9px] uppercase tracking-[0.18em] text-primary-foreground/55">Secure knowledge base</small></span>
        </Link>
        <div className="hidden flex-1 items-center gap-1 md:flex">
          {mainNav.map((item) => <Link key={item.label} href={item.href} className={cn(navLink, pathname === item.href && navLinkActive)}>{item.label}</Link>)}
          <div className="relative"><button type="button" onClick={() => setDeptMenuOpen((value) => !value)} className={cn('flex items-center gap-1', navLink, pathname.startsWith('/documents/department') && navLinkActive)}>Departemen / Section<ChevronDown className={cn('size-4 transition-transform', deptMenuOpen && 'rotate-180')} /></button>{deptMenuOpen && <><div className="fixed inset-0 z-10" onClick={() => setDeptMenuOpen(false)} /><div className="absolute left-0 top-[calc(100%+10px)] z-20 w-72 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl"><div className="border-b border-border px-3 pb-2 pt-1"><p className="portal-eyebrow">Document library</p><p className="mt-1 text-xs text-muted-foreground">Browse by department</p></div>{departmentItems}</div></>}</div>
          {isLoggedIn && <Link href="/kelola-departemen" className={cn('flex items-center gap-1.5', navLink, pathname === '/kelola-departemen' && navLinkActive)}><Settings className="size-4" />Kelola Departemen</Link>}
        </div>
        <div className="ml-auto flex items-center gap-2">{!isLoading && (isLoggedIn ? <div className="hidden items-center gap-2 sm:flex"><span className="rounded-full border border-accent/30 bg-accent/15 px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"><ShieldCheck className="mr-1 inline size-3.5" />{adminUser?.username}</span><button onClick={() => logout()} className="flex items-center gap-1.5 rounded-md border border-primary-foreground/20 px-3 py-2 text-xs hover:bg-primary-foreground/10"><LogOut className="size-4" />Logout</button></div> : <button onClick={() => setLoginOpen(true)} className="hidden rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent/85 sm:block">Login Admin</button>)}<button type="button" onClick={() => setMobileOpen(true)} aria-label="Buka menu" className="grid size-10 place-items-center rounded-md text-primary-foreground/80 hover:bg-primary-foreground/10 md:hidden"><Menu className="size-5" /></button></div>
      </div>
    </nav>
    <div className={cn('fixed inset-0 z-40 bg-primary/50 md:hidden', mobileOpen ? 'block' : 'hidden')} onClick={() => setMobileOpen(false)} />
    <aside className={cn('fixed right-0 top-0 z-50 flex h-screen w-80 max-w-[85vw] flex-col bg-background shadow-2xl transition-transform duration-200 md:hidden', mobileOpen ? 'translate-x-0' : 'translate-x-full')}>
      <div className="flex items-center justify-between bg-primary px-4 py-4 text-primary-foreground"><span className="font-semibold">Portal navigation</span><button type="button" onClick={() => setMobileOpen(false)} aria-label="Tutup menu" className="grid size-9 place-items-center rounded-md hover:bg-primary-foreground/10"><X className="size-5" /></button></div>
      <div className="flex-1 overflow-y-auto p-3">{mainNav.map((item) => <Link key={item.label} href={item.href} className="block rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-secondary">{item.label}</Link>)}<div className="portal-eyebrow px-3 pb-2 pt-5">Departments</div>{departmentItems}{isLoggedIn && <Link href="/kelola-departemen" className="mt-2 flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"><Settings className="size-4" />Kelola Departemen</Link>}</div>
      <div className="border-t border-border p-4">{!isLoading && (isLoggedIn ? <button onClick={() => logout()} className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm"><LogOut className="size-4" />Logout ({adminUser?.username})</button> : <button onClick={() => setLoginOpen(true)} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Login Admin</button>)}</div>
    </aside>
    <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
  </>
}
