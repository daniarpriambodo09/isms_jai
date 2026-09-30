// app/verifikasi-area-special/page.tsx
// What the QR on the special area form opens: is this permit genuine?
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, FileSignature, Loader2, XCircle } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import type { SpecialAreaRequest } from '@/lib/special-area-shared'

function fmt(value: string) {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })
}

function Content() {
  const code = useSearchParams().get('code') ?? ''
  const [req, setReq] = useState<SpecialAreaRequest | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/special-area-requests/verify?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
      .then(async (res) => { const b = await res.json(); if (!res.ok) throw new Error(b.message); setReq(b.request) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan.'))
  }, [code])

  if (error) return <div className="mx-auto max-w-lg rounded-3xl border border-border bg-card p-10 text-center"><XCircle className="mx-auto size-14 text-destructive" /><h2 className="mt-4 text-xl font-bold">Tidak dapat diverifikasi</h2><p className="mt-2 text-sm text-muted-foreground">{error}</p></div>
  if (!req) return <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="size-7 animate-spin" /></div>

  const approved = req.status === 'approved'
  const now = Date.now()
  const active = approved && now <= Date.parse(req.to_at)
  const rows: [string, string][] = [
    ['Nama', req.requester_name],
    ['Organisasi / Perusahaan', req.org_company],
    ['Area Special Security', req.area],
    ['Berlaku', `${fmt(req.from_at)} – ${fmt(req.to_at)}`],
    ['ID Card No.', req.id_card_no ?? '-'],
    [approved ? 'Disetujui oleh' : 'Diputuskan oleh', `${req.approver_name ?? '-'}${req.approver_title ? ` (${req.approver_title})` : ''}`],
    ['Tanggal keputusan', req.decided_at ? fmt(req.decided_at) : '-'],
  ]

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <section className={`rounded-3xl p-8 text-center ring-1 ${approved ? 'bg-emerald-50 ring-emerald-600/25' : 'bg-red-50 ring-red-600/25'}`}>
        {approved ? <CheckCircle2 className="mx-auto size-16 text-emerald-600" /> : <XCircle className="mx-auto size-16 text-red-600" />}
        <h2 className="mt-4 font-display text-3xl font-semibold text-foreground">{approved ? 'Izin sah' : 'Izin ditolak'}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {approved ? (active ? 'Izin masuk area special security ini asli dan masih dalam periode berlaku.' : 'Izin ini asli, tetapi periode berlakunya sudah lewat.') : 'Pengajuan ini tidak disetujui — bukan izin masuk yang sah.'}
        </p>
      </section>
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <dl className="divide-y divide-border">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[170px_1fr] gap-3 px-5 py-3 text-sm max-[480px]:grid-cols-1 max-[480px]:gap-0.5"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium text-foreground">{v}</dd></div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/30 px-5 py-3">
          <span className="font-mono text-xs text-muted-foreground">{req.verification_code}</span>
          <a href={`${API_BASE_PATH}/api/special-area-requests/${req.id}/pdf?code=${req.verification_code}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"><FileSignature className="size-3.5" /> Form PDF</a>
        </div>
      </section>
    </div>
  )
}

export default function VerifikasiAreaSpecialPage() {
  return <Suspense fallback={null}><Content /></Suspense>
}
