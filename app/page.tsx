'use client'

import Link from 'next/link'
import { CalendarDays, ChevronRight, FileText, Megaphone, ShieldCheck } from 'lucide-react'
import { announcements } from '@/lib/portal-data'
import { useAuth } from '@/context/AuthContext'

const stats = [
  ['Total documents', '248', '+12 this quarter', <FileText />, 'bg-accent/15 text-accent-foreground'],
  ['Active policies', '96', '92% of document library', <ShieldCheck />, 'bg-accent/15 text-accent-foreground'],
  ['Upcoming audits', '03', 'Next audit in 8 days', <CalendarDays />, 'bg-amber-500/15 text-amber-700'],
  ['New announcements', '07', '2 unread updates', <Megaphone />, 'bg-secondary text-primary'],
] as const

export default function Page() {
  const { isLoggedIn } = useAuth()
  return <>
    <section className="mb-8 flex items-end justify-between gap-6 rounded-2xl border border-border bg-primary p-7 text-primary-foreground portal-surface max-[680px]:flex-col max-[680px]:items-start max-[680px]:p-5">
      <div><div className="mb-3 flex flex-wrap items-center gap-3"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-foreground/60">MONDAY, 24 FEBRUARY 2025</span>{isLoggedIn && <span className="rounded-full bg-accent/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground"><ShieldCheck className="mr-1 inline size-3" />Admin Mode</span>}</div><h2 className="max-w-xl text-3xl font-bold tracking-tight text-balance max-[680px]:text-2xl">A clear view of your security workspace.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-primary-foreground/65">Find the latest policies, operational guidance, and audit activity maintained by the Information Security team.</p></div>
      <Link href="/audits" className="inline-flex flex-none items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/85"><CalendarDays className="size-4" />View audit schedule</Link>
    </section>
    <div className="mb-7 grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[680px]:gap-3">{stats.map(([label, value, detail, icon, tone]) => <article key={label} className="portal-surface rounded-xl border border-border bg-card p-4 transition-transform hover:-translate-y-0.5"><div className={`mb-5 grid size-9 place-items-center rounded-lg ${tone}`}>{icon}</div><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-3xl font-bold tracking-tight text-primary max-[680px]:text-2xl">{value}</div><div className="mt-2 text-[10px] text-muted-foreground">{detail}</div></article>)}</div>
    <div className="grid grid-cols-[1.45fr_1fr] gap-5 max-[900px]:grid-cols-1">
      <section className="portal-surface rounded-xl border border-border bg-card p-6 max-[680px]:p-4"><div className="mb-4 flex items-start justify-between gap-4"><div><p className="portal-eyebrow mb-2">Keep informed</p><h2 className="text-xl font-bold tracking-tight text-primary">Latest announcements</h2></div><Link className="flex items-center gap-1 text-xs font-semibold text-accent-foreground hover:underline" href="/news">View all <ChevronRight className="size-4" /></Link></div>{announcements.map((item, index) => <Link className="grid grid-cols-[34px_1fr_auto_16px] items-center gap-3 border-t border-border py-4 text-left hover:bg-secondary/40 max-[680px]:grid-cols-[30px_1fr_16px]" href="/news" key={item[0]}><div className="grid size-8 place-items-center rounded-md bg-secondary text-xs font-bold text-primary">0{index + 1}</div><div><strong className="block text-sm font-semibold text-foreground">{item[0]}</strong><span className="mt-1 block text-xs text-muted-foreground">{item[1]}</span></div><time className="text-[10px] text-muted-foreground max-[680px]:hidden">{item[2]}</time><ChevronRight className="size-4 text-muted-foreground" /></Link>)}</section>
      <section className="portal-surface rounded-xl border border-border bg-card p-6 max-[680px]:p-4"><p className="portal-eyebrow mb-2">Planning</p><h2 className="mb-5 text-xl font-bold tracking-tight text-primary">Next audit</h2><div className="mb-5 flex items-center gap-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4"><div className="flex size-14 flex-col items-center justify-center rounded-md bg-amber-500/15 text-amber-700"><span className="text-[9px] font-bold">MAR</span><strong className="text-2xl leading-none">03</strong></div><div><strong className="block text-sm text-foreground">Internal ISMS Audit</strong><span className="mt-1 block text-xs text-muted-foreground">Production &amp; QA</span></div></div><Link className="flex items-center gap-1 text-xs font-semibold text-accent-foreground hover:underline" href="/audits">View full schedule <ChevronRight className="size-4" /></Link></section>
    </div>
  </>
}
