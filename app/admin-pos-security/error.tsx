'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCw, Home, ShieldCheck } from 'lucide-react'

export default function AdminPosSecurityError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Pos Security route error:', error)
  }, [error])

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-md">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
          <ShieldCheck className="size-7" />
        </div>

        <h1 className="mt-4 font-display text-xl font-bold text-foreground">
          Pos Security Gagal Dimuat
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Terjadi kendala saat memuat halaman Pos Security. Coba muat ulang atau kembali ke beranda.
        </p>

        {error?.message && (
          <p className="mt-3 rounded-lg bg-secondary/50 p-2 font-mono text-[11px] text-muted-foreground">
            {error.message}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 cursor-pointer"
          >
            <RotateCw className="size-3.5" />
            Coba Lagi
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary cursor-pointer"
          >
            <Home className="size-3.5" />
            Beranda Portal
          </Link>
        </div>
      </div>
    </div>
  )
}
