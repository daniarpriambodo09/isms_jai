// components/toast.tsx
//
// Small corner notifications ("Tersimpan", "Disembunyikan dari pengunjung")
// that slide in, stay a few seconds and leave on their own — instead of a
// message box that pushes the page content down.
//
//   import { toast } from '@/components/toast'
//   toast('Dokumen ditampilkan ke pengunjung.')           // success
//   toast('Gagal menyimpan.', 'error')
//
// <Toaster /> is mounted once in app/layout.tsx. toast() is a plain function
// (a window event), so it works from any client code without a provider.
'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'info'
type ToastItem = { id: number; message: string; kind: ToastKind; leaving?: boolean }

const EVENT = 'isms-toast'
const LIFETIME_MS: Record<ToastKind, number> = { success: 3500, info: 4000, error: 6000 }
const LEAVE_MS = 220

export function toast(message: string, kind: ToastKind = 'success') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind } }))
}

const ICON = { success: CheckCircle2, error: AlertTriangle, info: Info }
const TONE: Record<ToastKind, string> = {
  success: 'text-emerald-600',
  error: 'text-[#d6452f]',
  info: 'text-[color:var(--p-600)]',
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    let seq = 0
    const timers = new Set<number>()
    const later = (fn: () => void, ms: number) => {
      const t = window.setTimeout(() => { timers.delete(t); fn() }, ms)
      timers.add(t)
    }
    const dismiss = (id: number) => {
      setItems((current) => current.map((item) => item.id === id ? { ...item, leaving: true } : item))
      later(() => setItems((current) => current.filter((item) => item.id !== id)), LEAVE_MS)
    }
    const onToast = (event: Event) => {
      const { message, kind } = (event as CustomEvent<{ message: string; kind: ToastKind }>).detail
      const id = ++seq
      // Newest at the bottom; never more than four on screen.
      setItems((current) => [...current.slice(-3), { id, message, kind }])
      later(() => dismiss(id), LIFETIME_MS[kind])
    }
    const onDismiss = (event: Event) => dismiss((event as CustomEvent<number>).detail)
    window.addEventListener(EVENT, onToast)
    window.addEventListener(`${EVENT}-dismiss`, onDismiss)
    return () => {
      window.removeEventListener(EVENT, onToast)
      window.removeEventListener(`${EVENT}-dismiss`, onDismiss)
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [])

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end sm:p-6">
      {items.map((item) => {
        const Icon = ICON[item.kind]
        return (
          <div
            key={item.id}
            role={item.kind === 'error' ? 'alert' : 'status'}
            className={`toast-item pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-[0_18px_40px_-12px_color-mix(in_oklch,var(--p-950)_40%,transparent)] ${item.leaving ? 'toast-leave' : ''}`}
          >
            <Icon className={`mt-0.5 size-[18px] flex-none ${TONE[item.kind]}`} />
            <p className="min-w-0 flex-1 leading-5">{item.message}</p>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent(`${EVENT}-dismiss`, { detail: item.id }))}
              aria-label="Tutup notifikasi"
              className="-mr-1 grid size-6 flex-none place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
