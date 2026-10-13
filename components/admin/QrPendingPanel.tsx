// components/admin/QrPendingPanel.tsx
'use client'

// Dashboard: documents whose approver(s) have signed but whose QR the Admin
// ISM has not put on the page yet ("Atur posisi QR" in the register). Until
// that is done the document shows without the QR.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, QrCode } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

type Doc = {
  documentId: number; controlNo: string; title: string; revision: number; kindLabel: string; href: string; approved: boolean
  signatures: { roleCode: string; roleTitle: string; name: string | null; signedAt: string }[]
  waitingSince: string
}

function waited(since: string) {
  const hours = Math.floor((Date.now() - new Date(since).getTime()) / 3_600_000)
  if (hours < 1) return 'baru saja'
  if (hours < 24) return `${hours} jam`
  return `${Math.floor(hours / 24)} hari`
}

export function QrPendingPanel() {
  const [docs, setDocs] = useState<Doc[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api/admin/followups?what=qr`, { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setDocs(data.documents ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal memuat daftar QR.')
    }
  }, [])
  useEffect(() => {
    load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load() }, 60_000)
    window.addEventListener('focus', load)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', load) }
  }, [load])

  const count = docs?.reduce((n, doc) => n + doc.signatures.length, 0) ?? 0

  return (
    <section aria-label="QR belum ditempatkan" className={`flex flex-col rounded-2xl border bg-card ${docs && docs.length ? 'border-amber-300/70' : 'border-border'}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3.5">
        <span className={`grid size-8 place-items-center rounded-lg ${docs && docs.length ? 'bg-amber-500/15 text-amber-700' : 'bg-primary/10 text-primary'}`}><QrCode className="size-4" /></span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">QR belum ditempatkan</h2>
          <p className="text-xs text-muted-foreground">Approver sudah menyetujui — tinggal Anda yang mengatur posisi QR-nya di dokumen.</p>
        </div>
        {docs && docs.length > 0 && <span className="ml-auto rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-800">{count} QR · {docs.length} dokumen</span>}
      </div>
      <div className="px-5 py-2">
        {error && <p className="py-3 text-xs text-destructive">{error}</p>}
        {!docs && !error && <p className="py-6 text-center text-sm text-muted-foreground">Memuat…</p>}
        {docs && docs.length === 0 && (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-emerald-600" />Semua tanda tangan sudah punya QR di dokumennya.</p>
        )}
        {docs && docs.length > 0 && (
          <ul className="divide-y divide-border">
            {docs.map((doc) => (
              <li key={doc.documentId} data-testid="qr-pending-doc" className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="font-mono text-[12px]">{doc.controlNo}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-secondary-foreground">{doc.kindLabel}</span>
                    {doc.approved && <span className="rounded-full bg-[#fbe6e0] px-2 py-0.5 text-[10.5px] font-semibold text-[#b3361f]" title="Dokumen sudah disahkan dan tampil ke pengunjung, tetapi QR-nya belum lengkap">sudah terbit tanpa QR</span>}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{doc.title} · Rev. {doc.revision}</p>
                  <p className="mt-1 text-xs text-foreground">
                    {doc.signatures.map((signature) => `${signature.name ?? signature.roleTitle} (${signature.roleTitle})`).join(' · ')}
                    <span className="text-muted-foreground"> — menunggu {waited(doc.waitingSince)}</span>
                  </p>
                </div>
                <Link href={doc.href} className="inline-flex flex-shrink-0 items-center gap-1.5 self-start rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 sm:self-center">
                  Atur posisi QR <ArrowUpRight className="size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
