// app/verifikasi/[id]/page.tsx

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { CheckCircle2, Download, ShieldCheck, XCircle } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

type VerifiedRequest = {
  id: number
  requester_name: string
  dept_or_company: string
  dept: string | null
  from_at: string
  to_at: string
  location: string
  objective: string
  status: 'approved' | 'rejected'
  decided_at: string
  decided_by: string
  verification_code: string
}

function fmt(value: string) {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function VerifikasiContent() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const code = searchParams.get('code') ?? ''
  const [data, setData] = useState<VerifiedRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/photo-video-requests/verify?id=${params.id}&code=${encodeURIComponent(code)}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body?.message ?? 'Gagal memuat data verifikasi.')
        setData(body.request)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan.'))
      .finally(() => setLoading(false))
  }, [params.id, code])

  if (loading) {
    return <div className="mx-auto max-w-lg py-16 text-center text-sm text-muted-foreground">Memuat verifikasi...</div>
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <XCircle className="mx-auto size-12 text-destructive" />
        <p className="mt-4 text-sm font-semibold text-foreground">{error ?? 'Dokumen tidak ditemukan.'}</p>
      </div>
    )
  }

  const isApproved = data.status === 'approved'

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 py-10">
      <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-md">
        {isApproved ? (
          <CheckCircle2 className="mx-auto size-14 text-[#1a6e3a]" />
        ) : (
          <XCircle className="mx-auto size-14 text-destructive" />
        )}
        <h1 className="mt-4 text-xl font-bold text-foreground">
          Pengajuan #{data.id} {isApproved ? 'Disetujui' : 'Ditolak'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Oleh <strong className="text-foreground">{data.decided_by}</strong> pada {fmt(data.decided_at)}
        </p>

        <div className="mt-6 rounded-2xl bg-secondary/40 p-4 text-left text-sm">
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="text-muted-foreground">Nama</dt><dd className="text-foreground">{data.requester_name}</dd>
            <dt className="text-muted-foreground">Company</dt><dd className="text-foreground">{data.dept_or_company}</dd>
            <dt className="text-muted-foreground">Lokasi</dt><dd className="text-foreground">{data.location}</dd>
            <dt className="text-muted-foreground">Waktu</dt><dd className="text-foreground">{fmt(data.from_at)} – {fmt(data.to_at)}</dd>
          </dl>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Kode verifikasi: <span className="font-mono">{data.verification_code}</span>
        </p>

        <a
          href={`${API_BASE_PATH}/api/photo-video-requests/${data.id}/pdf?code=${data.verification_code}`}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          <Download className="size-4" /> Unduh Surat Pengajuan PDF
        </a>
      </div>
    </div>
  )
}

export default function VerifikasiPage() {
  return (
    <Suspense fallback={null}>
      <VerifikasiContent />
    </Suspense>
  )
}
