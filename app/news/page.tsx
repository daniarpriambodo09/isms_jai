import { Bell, ChevronRight, Sparkles } from 'lucide-react'
import { news } from '@/lib/portal-data'

export const metadata = {
  title: 'Informasi Baru — ISMS Portal',
  description: 'News, notices, and updates from the Information Security team.',
}

export default function NewsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
              <Sparkles className="size-3.5" /> Newsroom / Security communications
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Informasi Baru</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">News, notices, and updates from the Information Security team.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            style={{ background: 'linear-gradient(135deg, oklch(0.48 0.12 180) 0%, oklch(0.58 0.14 165) 100%)' }}
          >
            <Bell className="size-4" /> Mark all read
          </button>
        </div>
      </header>

      <section className="portal-surface rounded-xl border border-border bg-card p-7 max-[680px]:p-4">
        <div className="flex flex-col gap-3">
          {news.map((item, index) => (
            <article
              className="group grid grid-cols-[42px_1fr_16px] items-center gap-4 rounded-lg border border-border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-secondary/30 hover:shadow-md max-[680px]:grid-cols-[34px_1fr_14px] max-[680px]:gap-3 max-[680px]:p-3"
              key={item[0]}
            >
              <div
                className="grid size-9 place-items-center rounded-md text-xs font-bold text-white max-[680px]:size-8"
                style={{ background: 'linear-gradient(135deg, oklch(0.39 0.09 205) 0%, oklch(0.48 0.12 180) 100%)' }}
              >
                0{index + 1}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent-foreground">{item[3]}</span>
                <h3 className="mt-1.5 text-sm font-semibold text-foreground group-hover:text-accent-foreground">{item[0]}</h3>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{item[1]}</p>
                <time className="mt-2 block text-[10px] text-muted-foreground">{item[2]}</time>
              </div>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
