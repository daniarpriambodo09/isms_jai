// components/portal-footer.tsx
//
// Portal footer in the motionsites "NOX Grid Footer" style: a brand column
// plus link columns separated by hairline grid rules (each column lights up
// on hover), and a line-art skyline of the plant — offices, saw-tooth
// production halls, water tower, security gate — that draws itself stroke by
// stroke when the footer scrolls into view (.footer-draw in globals.css).
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

// Stroke-only skyline, 1440×240 user units, ground at y=228. Every shape
// carries pathLength=1 so one dash rule animates them all; --d staggers
// groups left to right.
function PlantSkyline() {
  const p = { pathLength: 1 } as const
  return (
    <svg viewBox="0 0 1440 240" preserveAspectRatio="xMidYMax slice" className="block h-auto w-full max-[680px]:h-[140px]" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* Far hills */}
      <g style={{ '--d': '0s' } as React.CSSProperties} className="opacity-40">
        <path {...p} d="M0 196 C120 150 220 170 330 142 C450 112 560 160 680 138 C800 116 900 150 1020 128 C1140 106 1260 150 1440 120" />
        <circle {...p} cx="1318" cy="46" r="16" />
      </g>

      {/* Trees, left */}
      <g style={{ '--d': '0.15s' } as React.CSSProperties}>
        <path {...p} d="M40 228 V206 M26 208 L40 172 L54 208 Z" />
        <path {...p} d="M76 228 V212 M64 214 L76 186 L88 214 Z" />
      </g>

      {/* Office block with window grid */}
      <g style={{ '--d': '0.3s' } as React.CSSProperties}>
        <path {...p} d="M120 228 V104 H300 V228" />
        <path {...p} d="M112 104 H308" />
        <path {...p} d="M150 124 V210 M180 124 V210 M210 124 V210 M240 124 V210 M270 124 V210" className="opacity-50" />
        <path {...p} d="M134 136 H286 M134 160 H286 M134 184 H286" className="opacity-50" />
        <path {...p} d="M192 228 V206 H228 V228" />
        <path {...p} d="M210 104 V84 M204 84 H216" />
      </g>

      {/* Saw-tooth production hall */}
      <g style={{ '--d': '0.55s' } as React.CSSProperties}>
        <path {...p} d="M340 228 V150 L380 118 V150 L420 118 V150 L460 118 V150 L500 118 V150 L540 118 V150 L580 118 V150 L620 118 V150 L660 118 V150 L700 118 V150 L740 118 V228" />
        <path {...p} d="M340 150 H740" className="opacity-50" />
        <path {...p} d="M380 228 V186 H440 V228 M476 228 V186 H536 V228 M572 228 V186 H632 V228" />
        <path {...p} d="M380 200 H440 M380 214 H440 M476 200 H536 M476 214 H536 M572 200 H632 M572 214 H632" className="opacity-50" />
        <path {...p} d="M660 172 H716 V192 H660 Z" className="opacity-60" />
      </g>

      {/* Water tower */}
      <g style={{ '--d': '0.8s' } as React.CSSProperties}>
        <path {...p} d="M790 228 L800 128 M842 228 L832 128 M794 184 H838 M797 156 H835" />
        <path {...p} d="M786 128 H846 V96 H786 Z" />
        <path {...p} d="M782 96 L816 76 L850 96" />
      </g>

      {/* Main plant, flat roof with rooftop panels */}
      <g style={{ '--d': '1s' } as React.CSSProperties}>
        <path {...p} d="M880 228 V132 H1160 V228" />
        <path {...p} d="M872 132 H1168" />
        <path {...p} d="M900 132 L912 118 H952 L940 132 M968 132 L980 118 H1020 L1008 132 M1036 132 L1048 118 H1088 L1076 132 M1104 132 L1116 118 H1148 L1140 132" className="opacity-60" />
        <path {...p} d="M904 156 H1136 M904 172 H1136" className="opacity-40" />
        <path {...p} d="M940 228 V192 H1020 V228 M1048 228 V192 H1128 V228" />
      </g>

      {/* Security gate: post, barrier, shield */}
      <g style={{ '--d': '1.25s' } as React.CSSProperties}>
        <path {...p} d="M1200 228 V168 H1250 V228" />
        <path {...p} d="M1194 168 H1256" />
        <path {...p} d="M1210 180 H1240 V200 H1210 Z" className="opacity-60" />
        <path {...p} d="M1262 228 V196 M1256 196 H1268 M1262 200 L1372 200" />
        <path {...p} d="M1290 200 V206 M1320 200 V206 M1350 200 V206" className="opacity-50" />
        <path {...p} d="M1225 124 L1243 131 V144 C1243 153 1236 159 1225 163 C1214 159 1207 153 1207 144 V131 Z" />
        <path {...p} d="M1218 144 L1223 149 L1233 138" />
      </g>

      {/* Trees, right */}
      <g style={{ '--d': '1.45s' } as React.CSSProperties}>
        <path {...p} d="M1396 228 V208 M1384 210 L1396 180 L1408 210 Z" />
        <path {...p} d="M1426 228 V214 M1416 216 L1426 192 L1436 216 Z" />
      </g>

      {/* Ground */}
      <path {...p} d="M0 228 H1440" style={{ '--d': '0s' } as React.CSSProperties} />
    </svg>
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

        {/* Line-art plant skyline, drawn on scroll */}
        <div ref={ref} className={`footer-draw mt-10 text-primary-foreground/35 ${inView ? 'is-in' : ''}`}>
          <PlantSkyline />
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
