// components/home/QuickAccess.tsx
//
// Home chapter right after the statement: shortcuts to the registers people
// open most, and the latest uploads across all of them (/api/home-latest) —
// so Home is a way in, not only a cover. Theme tokens throughout.

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, BookMarked, BookOpen, CalendarDays, Camera, ClipboardList, FileText, GraduationCap, Shield } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { ChapterHeader } from '@/components/home/ChapterHeader'

const SHORTCUTS = [
  { href: '/kebijakan-dasar-ISMS', label: 'Kebijakan Dasar ISMS', hint: 'Baca & konfirmasi kebijakan', icon: Shield },
  { href: '/prosedur-isms', label: 'Prosedur ISMS', hint: 'Prosedur yang sudah disahkan', icon: BookOpen },
  { href: '/standard-isms-p14', label: 'Standard TMMIN', hint: 'Standard requirement', icon: BookMarked },
  { href: '/working-standard', label: 'Working Standard', hint: 'Standar kerja lapangan', icon: ClipboardList },
  { href: '/education', label: 'Education & Training', hint: 'Materi edukasi keamanan', icon: GraduationCap },
  { href: '/form-aplikasi', label: 'Form Aplikasi', hint: 'Form pengajuan & kontrol CS', icon: FileText },
  { href: '/ijin-foto-video', label: 'Ijin Foto/Video', hint: 'Ajukan izin dokumentasi', icon: Camera },
  { href: '/audits', label: 'Jadwal Audit', hint: 'Jadwal audit internal', icon: CalendarDays },
]

type Latest = { kind: string; kindLabel: string; title: string; code: string | null; uploadedAt: string; href: string }

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function QuickAccess() {
  const [latest, setLatest] = useState<Latest[] | null>(null)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/home-latest`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { documents: [] }))
      .then((data: { documents: Latest[] }) => setLatest(data.documents ?? []))
      .catch(() => setLatest([]))
  }, [])

  return (
    <section>
      <ChapterHeader eyebrow="Akses cepat" title="Mulai dari sini" meta="Menu yang paling sering dibuka" />
      <div className="grid gap-8 pb-14 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] max-[680px]:pb-10">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {SHORTCUTS.map(({ href, label, hint, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group relative flex min-h-[132px] flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-4 transition duration-300 hover:-translate-y-1 hover:border-[color:var(--p-600)] hover:shadow-lg"
            >
              <span className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-secondary text-[color:var(--p-600)] transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground/50 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[color:var(--p-600)]" />
              </span>
              <span>
                <span className="block text-[15px] font-semibold leading-tight text-foreground">{label}</span>
                <span className="mt-1 block text-xs leading-snug text-muted-foreground">{hint}</span>
              </span>
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 bg-[color:var(--p-600)] transition-transform duration-500 group-hover:scale-x-100" />
            </Link>
          ))}
        </div>

        <div className="flex flex-col rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <h3 className="font-display text-lg font-semibold text-foreground">Dokumen terbaru</h3>
            <span className="flex items-center gap-1.5 font-mono-label text-[10px] text-muted-foreground"><span className="size-1.5 rounded-full bg-[color:var(--p-600)]" /> Baru diunggah</span>
          </div>
          {latest === null ? (
            <div className="flex flex-col gap-4 p-5" aria-busy="true">
              {[70, 55, 82, 60, 74].map((width, i) => <span key={i} className="skeleton h-4" style={{ width: `${width}%`, animationDelay: `${i * 90}ms` }} />)}
            </div>
          ) : latest.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Belum ada dokumen.</p>
          ) : (
            <ul className="divide-y divide-border">
              {latest.map((doc, i) => (
                <li key={`${doc.kind}-${doc.code ?? doc.title}-${i}`}>
                  <Link href={doc.href} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-secondary/50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{doc.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {doc.kindLabel}{doc.code ? ` · ${doc.code}` : ''} · {formatDate(doc.uploadedAt)}
                      </span>
                    </span>
                    <ArrowUpRight className="size-4 flex-none text-muted-foreground/50 transition group-hover:text-[color:var(--p-600)]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
