import { ArrowUpRight, Bell } from 'lucide-react'
import { news } from '@/lib/portal-data'
import { MastheadHero } from '@/components/page-hero'

export const metadata = {
  title: 'Informasi Baru — ISMS Portal',
  description: 'News, notices, and updates from the Information Security team.',
}

export default function NewsPage() {
  const [lead, ...rest] = news

  return (
    <div className="flex flex-col gap-8">
      <MastheadHero
        action={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-foreground px-4 py-1.5 font-mono-label text-[10px] font-semibold text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            <Bell className="size-3.5" /> Tandai semua dibaca
          </button>
        }
      />

      {lead && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.35fr_1fr] lg:divide-x lg:divide-border">
          {/* Lead story */}
          <article className="group lg:pr-8">
            <p className="font-mono-label text-[10px] font-semibold text-[color:var(--p-600)]">{lead[3]} · Berita utama</p>
            <h3 className="mt-3 text-balance font-display text-[clamp(1.9rem,3.6vw,3rem)] font-semibold leading-[1] text-foreground transition-colors group-hover:text-[color:var(--p-600)]">
              {lead[0]}
            </h3>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-5xl first-letter:font-bold first-letter:leading-[0.85] first-letter:text-foreground">
              {lead[1]}
            </p>
            <time className="mt-5 block font-mono-label text-[10px] text-muted-foreground">{lead[2]}</time>
          </article>

          {/* Other stories — newspaper column with rules */}
          <div className="flex flex-col divide-y divide-border lg:pl-8">
            {rest.map((item, index) => (
              <article key={item[0]} className="group grid grid-cols-[auto_1fr_auto] items-start gap-4 py-5 first:pt-0">
                <span className="font-display text-3xl font-bold leading-none tabular-nums text-border transition-colors group-hover:text-accent">
                  {String(index + 2).padStart(2, '0')}
                </span>
                <div>
                  <p className="font-mono-label text-[9.5px] font-semibold text-[color:var(--p-600)]">{item[3]}</p>
                  <h3 className="mt-1.5 font-semibold leading-snug text-foreground">{item[0]}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{item[1]}</p>
                  <time className="mt-2 block font-mono text-[10px] text-muted-foreground">{item[2]}</time>
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
