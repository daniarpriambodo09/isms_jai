// app/verifikasi-pengesahan/page.tsx
//
// What a scanned signature QR opens: confirms whether that person's
// e-signature on a Prosedur ISMS document is genuine and still in force.

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, CheckCircle2, FileSignature, Loader2, ShieldCheck, XCircle } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

type Signature = {
  code: string
  approver_name: string | null
  role_title: string
  decided_at: string
  revision: number
  document: { id: number; control_no: string; title: string; revision: number; elf_date: string; approval_status: string }
  validity: 'valid' | 'superseded' | 'voided'
}

function fmt(value: string, withTime = true) {
  return new Date(value).toLocaleString('id-ID', withTime ? { dateStyle: 'long', timeStyle: 'short' } : { dateStyle: 'long' })
}

const VALIDITY = {
  valid: { icon: CheckCircle2, color: 'text-emerald-600', ring: 'ring-emerald-600/25 bg-emerald-50', title: 'Tanda tangan sah', note: 'Tanda tangan elektronik ini asli dan berlaku untuk revisi dokumen yang berlaku saat ini.' },
  superseded: { icon: AlertTriangle, color: 'text-amber-600', ring: 'ring-amber-500/30 bg-amber-50', title: 'Sah untuk revisi lama', note: 'Tanda tangan ini asli, tetapi diberikan untuk revisi sebelumnya. Dokumen telah direvisi sejak itu.' },
  voided: { icon: XCircle, color: 'text-red-600', ring: 'ring-red-600/25 bg-red-50', title: 'Tidak berlaku lagi', note: 'Tanda tangan ini pernah diberikan, tetapi proses pengesahannya kemudian dimulai ulang sehingga tidak berlaku lagi.' },
} as const

function VerifikasiContent() {
  const code = useSearchParams().get('code') ?? ''
  const [signature, setSignature] = useState<Signature | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/prosedur-isms/verify?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body?.message ?? 'Gagal memuat data verifikasi.')
        setSignature(body.signature)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan.'))
  }, [code])

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-border bg-card p-10 text-center shadow-sm">
        <XCircle className="mx-auto size-14 text-destructive" />
        <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">Tidak dapat diverifikasi</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{code || '-'}</p>
      </div>
    )
  }
  if (!signature) return <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="size-7 animate-spin" /></div>

  const v = VALIDITY[signature.validity]
  const Icon = v.icon
  const rows: [string, string][] = [
    ['Nama', signature.approver_name ?? '-'],
    ['Jabatan', signature.role_title],
    ['Disetujui', fmt(signature.decided_at)],
    ['No. Kontrol', signature.document.control_no],
    ['Nama Dokumen', signature.document.title],
    ['Revisi ditandatangani', `Rev. ${signature.revision}${signature.revision !== signature.document.revision ? ` (terkini: Rev. ${signature.document.revision})` : ''}`],
  ]

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <section className={`rounded-3xl p-8 text-center ring-1 ${v.ring}`}>
        <Icon className={`mx-auto size-16 ${v.color}`} />
        <h2 className="mt-4 font-display text-3xl font-semibold text-foreground">{v.title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{v.note}</p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3 font-mono-label text-[10px] text-muted-foreground"><ShieldCheck className="size-3.5 text-[color:var(--p-600)]" /> Detail tanda tangan · Prosedur ISMS</div>
        <dl className="divide-y divide-border">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[150px_1fr] gap-3 px-5 py-3 text-sm max-[480px]:grid-cols-1 max-[480px]:gap-0.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/30 px-5 py-3">
          <span className="font-mono text-xs text-muted-foreground">{signature.code}</span>
          <a href={`${API_BASE_PATH}/api/prosedur-isms/${signature.document.id}/pdf`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
            <FileSignature className="size-3.5" /> PDF bertanda tangan
          </a>
        </div>
      </section>
    </div>
  )
}

export default function VerifikasiPengesahanPage() {
  return (
    <Suspense fallback={null}>
      <VerifikasiContent />
    </Suspense>
  )
}
