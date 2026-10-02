// app/not-found.tsx
//
// Shown for an address that doesn't exist. Theme tokens only, so it follows
// Kelola Tema like every other page; the frame (components/portal-frame.tsx)
// leaves the heading to this page.

import Link from 'next/link'
import { ArrowUpRight, Compass, Home } from 'lucide-react'

const SUGGESTIONS: [string, string][] = [
  ['Prosedur ISMS', '/prosedur-isms'],
  ['Kebijakan Dasar ISMS', '/kebijakan-dasar-ISMS'],
  ['Education & Training', '/education'],
  ['Form Aplikasi', '/form-aplikasi'],
]

export default function NotFound() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 text-center shadow-sm sm:px-16 sm:py-20">
      {/* Oversized outlined "404" behind the message */}
      <p
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none font-display text-[clamp(9rem,34vw,26rem)] font-bold leading-none text-transparent opacity-[0.09]"
        style={{ WebkitTextStroke: '2px var(--foreground)' }}
      >
        404
      </p>

      <div className="relative mx-auto flex max-w-lg flex-col items-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Compass className="size-7" />
        </span>
        <p className="mt-6 font-mono-label text-[10.5px] text-[color:var(--p-600)]">Error 404</p>
        <h2 className="mt-2 font-display text-[clamp(1.9rem,4vw,2.9rem)] font-semibold leading-[1.02] text-foreground">
          Halaman tidak <span className="font-serif-accent text-[color:var(--p-600)]">ditemukan</span>.
        </h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Halaman yang Anda cari mungkin sudah dipindahkan, dihapus, atau alamatnya salah ketik.
        </p>

        <Link
          href="/"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-transform duration-200 hover:-translate-y-0.5"
        >
          <Home className="size-4" /> Kembali ke Home
        </Link>

        <div className="mt-9 w-full border-t border-border pt-5">
          <p className="font-mono-label text-[10px] text-muted-foreground">Atau buka</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map(([label, href]) => (
              <Link key={href} href={href} className="group inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:border-[color:var(--p-600)] hover:bg-secondary">
                {label} <ArrowUpRight className="size-3.5 text-muted-foreground transition group-hover:text-[color:var(--p-600)]" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
