// components/portal-footer.tsx
//
// Portal footer in the motionsites "NOX Grid Footer" style: a brand column
// plus link columns separated by hairline grid rules (each column lights up
// on hover), and the portal's name set as wide as the footer, its letters
// rising and filling in when the footer scrolls into view (.footer-mark in
// globals.css).
// Colours come from theme tokens, so it follows Kelola Tema.

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, LockKeyhole } from 'lucide-react'

const TICKER = ['Confidentiality', 'Integrity', 'Availability', 'ISO/IEC 27001', 'Information Security Committee', 'PT. Jatim Autocomp Indonesia']

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Dokumen',
    links: [
      ['Kebijakan Dasar ISMS', '/kebijakan-dasar-ISMS'],
      ['Prosedur ISMS', '/prosedur-isms'],
      ['Standard Requirement TMMIN', '/standard-isms-p14'],
      ['Working Standard', '/working-standard'],
      ['Form Review Dokumen', '/form-review-dokumen'],
    ],
  },
  {
    title: 'Edukasi & Form',
    links: [
      ['Education & Training', '/education'],
      ['Application Form', '/form-aplikasi'],
      ['CS Control', '/kontrol-cs'],
      ['Jadwal Audit', '/audits'],
    ],
  },
  {
    title: 'Keamanan',
    links: [
      ['Ijin Foto/Video', '/ijin-foto-video'],
      ['Verifikasi Pengesahan', '/verifikasi-pengesahan'],
      ['Verifikasi Area Special', '/verifikasi-area-special'],
    ],
  },
]

// Rules per link column when the grid wraps to 2 columns (brand + Dokumen on
// the first row, Edukasi + Keamanan on the second).
const CELL_RULES = ['', 'max-[1000px]:border-l-0 max-[1000px]:border-t', 'max-[1000px]:border-t']

// The portal's name as wide as the footer: outlined letters that rise out of a
// mask one by one, then fill with colour from the bottom up — "ISMS" in light
// ink, "Portal" in the accent serif, like the small logo above. The font size
// is fitted to the container so it spans edge to edge at any width.
// (.footer-mark in globals.css)
const MARK: { text: string; className: string }[] = [
  { text: 'ISMS', className: 'font-display font-semibold tracking-[-0.045em]' },
  { text: 'Portal', className: 'font-serif-accent' },
]

function FooterWordmark({ inView }: { inView: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const line = lineRef.current
    if (!wrap || !line) return
    let fittedFor = 0
    const fit = (force = false) => {
      // Only the width matters — refitting changes the height, which would
      // otherwise call this again through the observer.
      if (!force && wrap.clientWidth === fittedFor) return
      fittedFor = wrap.clientWidth
      wrap.style.fontSize = '100px'
      const width = line.scrollWidth
      if (width) wrap.style.fontSize = `${(wrap.clientWidth / width) * 100}px`
    }
    fit(true)
    const observer = new ResizeObserver(() => fit())
    observer.observe(wrap)
    document.fonts?.ready.then(() => fit(true)).catch(() => {})
    return () => observer.disconnect()
  }, [])

  const layer = (fill: boolean) => {
    let index = 0
    return MARK.map((word, w) => (
      <span key={word.text} className={`${word.className} ${fill && w === 1 ? 'text-accent' : ''}`}>
        {w > 0 && <span className="inline-block w-[0.16em]" />}
        {word.text.split('').map((letter) => {
          const delay = index++ * 55
          return <span key={`${letter}-${delay}`} className="footer-mark-letter inline-block" style={{ transitionDelay: `${delay}ms` }}>{letter}</span>
        })}
      </span>
    ))
  }

  return (
    <div ref={wrapRef} aria-hidden className={`footer-mark relative mt-12 select-none overflow-hidden whitespace-nowrap text-[17vw] leading-[0.86] ${inView ? 'is-in' : ''}`}>
      <p ref={lineRef} className="footer-mark-outline w-max">{layer(false)}</p>
      <p className="footer-mark-fill absolute inset-0 w-max text-primary-foreground/90">{layer(true)}</p>
    </div>
  )
}

export function PortalFooter() {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); observer.disconnect() }
    }, { threshold: 0.2 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <footer className="relative mt-10 overflow-hidden bg-[color:var(--p-950)] text-primary-foreground">
      {/* Acid ticker band */}
      <div className="overflow-hidden border-b border-primary-foreground/10 bg-accent py-2.5 text-accent-foreground">
        <div className="marquee-track flex w-max gap-10 whitespace-nowrap font-mono-label text-[11px] font-semibold">
          {Array.from({ length: 2 }).map((_, copy) => (
            <div key={copy} className="flex gap-10" aria-hidden={copy === 1}>
              {TICKER.map((word) => (
                <span key={word} className="flex items-center gap-10">{word}<span className="size-1.5 rounded-full bg-accent-foreground" /></span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1480px] px-10 max-[900px]:px-6 max-[680px]:px-4">
        {/* Grid: brand + link columns, hairline rules between them */}
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-x border-b border-primary-foreground/10 max-[1000px]:grid-cols-2 max-[560px]:grid-cols-1">
          <div className="flex flex-col justify-between gap-10 p-8 max-[680px]:p-6">
            <div>
              <p className="font-display text-[22px] font-semibold tracking-tight">
                ISMS <span className="font-serif-accent text-accent">Portal</span>
              </p>
              <p className="mt-3 max-w-[300px] text-[13.5px] leading-relaxed text-primary-foreground/60">
                Keamanan informasi adalah tanggung jawab kita bersama — PT. Jatim Autocomp Indonesia.
              </p>
            </div>
            <p className="flex items-center gap-1.5 font-mono-label text-[10px] text-primary-foreground/45">
              <LockKeyhole className="size-3" /> Internal · ISO/IEC 27001
            </p>
          </div>

          {COLUMNS.map((column, i) => (
            <div
              key={column.title}
              className={`border-l border-primary-foreground/10 p-8 transition-colors duration-300 hover:bg-primary-foreground/[0.035] max-[680px]:p-6 ${CELL_RULES[i]} max-[560px]:border-l-0 max-[560px]:border-t`}
            >
              <p className="font-mono-label text-[10.5px] text-primary-foreground/45">
                ({String(i + 1).padStart(2, '0')}) — {column.title}
              </p>
              <ul className="mt-5 flex flex-col gap-2.5">
                {column.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="group flex w-fit items-center gap-2 text-[13.5px] text-primary-foreground/75 transition-colors hover:text-accent">
                      <ArrowUpRight className="size-3.5 opacity-50 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Giant wordmark, revealed on scroll */}
        <div ref={ref}>
          <FooterWordmark inView={inView} />
        </div>

        {/* Bottom bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary-foreground/12 py-5 font-mono-label text-[10px] text-primary-foreground/50">
          <p>© {new Date().getFullYear()} PT. Jatim Autocomp Indonesia</p>
          <p>Confidential & Internal Use Only</p>
        </div>
      </div>
    </footer>
  )
}
