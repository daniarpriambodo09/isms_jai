'use client'

// Home, for the ISM Admin only: "what needs my attention" before anything
// else on the page — documents waiting for an approver, documents sent back
// for revision, requests not yet decided, e-mails that could not be sent,
// documents overdue for review. Each links to where it is handled. Visitors
// and the kiosk roles never see (or fetch) any of it.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Camera, CheckCircle2, Clock, FileClock, Gauge, MailWarning, PencilLine, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { docKindInfo } from '@/lib/document-kinds'

type Dashboard = {
  procedures: {
    pending: { kind: string; controlNo: string; emailError: string | null }[]
    revision: number
    revisionDocs: { kind: string; control_no: string }[]
  }
  requests: { photoPending: number; specialPending: number }
  review: { overdue: unknown[]; soon: unknown[] }
}

type Todo = { key: string; icon: React.ReactNode; count: number; label: string; hint: string; href: string; tone: 'alert' | 'warn' | 'info' }

const TONE: Record<Todo['tone'], string> = {
  alert: 'border-[#c2412c]/35 bg-[#fdf3ef] text-[#8a2d1d]',
  warn: 'border-amber-500/40 bg-amber-50 text-amber-900',
  info: 'border-border bg-card text-foreground',
}

export function AdminTodo() {
  const { adminUser, isLoading } = useAuth()
  const isAdmin = adminUser?.role === 'ism_admin'
  const [data, setData] = useState<Dashboard | null>(null)

  useEffect(() => {
    if (!isAdmin) { setData(null); return }
    let cancelled = false
    fetch(`${API_BASE_PATH}/api/admin/dashboard`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled) setData(json) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isAdmin])

  if (isLoading || !isAdmin || !data) return null

  const pending = data.procedures.pending
  const undelivered = pending.filter((step) => step.emailError)
  // Straight to the register (already searched) when it is about one document.
  const registerOf = (kind: string, controlNo?: string) => `${docKindInfo(kind).path}${controlNo ? `?q=${encodeURIComponent(controlNo)}` : ''}`
  const revisionDocs = data.procedures.revisionDocs

  const todos: Todo[] = ([
    {
      key: 'revision', icon: <PencilLine className="size-4" />, count: data.procedures.revision, tone: 'alert',
      label: 'Dokumen perlu revisi', hint: 'Unggah perbaikan lalu ajukan ulang',
      href: revisionDocs.length === 1 ? registerOf(revisionDocs[0].kind, revisionDocs[0].control_no) : revisionDocs[0] ? registerOf(revisionDocs[0].kind) : '/dashboard-admin',
    },
    {
      key: 'undelivered', icon: <MailWarning className="size-4" />, count: undelivered.length, tone: 'alert',
      label: 'Email pengesahan gagal terkirim', hint: 'Periksa email approver & SMTP', href: '/kelola-pengesahan',
    },
    {
      key: 'photo', icon: <Camera className="size-4" />, count: data.requests.photoPending, tone: 'warn',
      label: 'Izin Foto/Video menunggu', hint: 'Tinjau dan putuskan', href: '/kelola-permintaan-foto-video',
    },
    {
      key: 'special', icon: <ShieldAlert className="size-4" />, count: data.requests.specialPending, tone: 'warn',
      label: 'Izin Area Special menunggu', hint: 'Menunggu approver', href: '/kelola-izin-area-special',
    },
    {
      key: 'overdue', icon: <FileClock className="size-4" />, count: data.review.overdue.length, tone: 'warn',
      label: 'Dokumen lewat jadwal review', hint: 'Review ulang isi dokumen', href: '/dashboard-admin',
    },
    {
      key: 'pending', icon: <Clock className="size-4" />, count: pending.length, tone: 'info',
      label: 'Dokumen menunggu approver', hint: 'Pengingat otomatis berjalan', href: '/kelola-pengesahan',
    },
  ] satisfies Todo[]).filter((todo) => todo.count > 0)

  return (
    <section aria-label="Yang perlu dikerjakan" className="mb-6 rounded-2xl border border-border bg-secondary/30 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="portal-eyebrow">Untuk Admin ISM</p>
          <h2 className="mt-0.5 text-lg font-bold text-foreground">Yang perlu dikerjakan</h2>
        </div>
        <Link href="/dashboard-admin" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary">
          <Gauge className="size-3.5" /> Dashboard lengkap <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {todos.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-600/25 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="size-4 flex-none" /> Tidak ada yang menunggu tindakan Anda saat ini.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {todos.map((todo) => (
            <li key={todo.key}>
              <Link href={todo.href} className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-md ${TONE[todo.tone]}`}>
                <span className="grid min-w-10 place-items-center font-display text-3xl font-bold leading-none tabular-nums">{todo.count}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">{todo.icon}{todo.label}</span>
                  <span className="mt-0.5 block text-xs opacity-75">{todo.hint}</span>
                </span>
                <ArrowRight className="size-4 flex-none opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
