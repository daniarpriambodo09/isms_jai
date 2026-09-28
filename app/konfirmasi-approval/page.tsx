// app/konfirmasi-approval/page.tsx
//
// Landing page for the Menyetujui/Tolak buttons in the Visitor approver's
// email. Opening the link only shows this page — the decision is recorded
// when the approver presses the button here (a POST), so mail scanners that
// merely open links can't decide a request by accident.

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, ShieldQuestion, XCircle } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

type Preview = {
  id: number
  status: 'pending' | 'approved' | 'rejected'
  requester_name: string
  dept_or_company: string
  dept: string | null
  from_at: string
  to_at: string
  location: string
  objective: string
  pic_jai: string | null
  verification_code: string | null
}

function fmt(value: string) {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function goToResult(id: number, code: string) {
  window.location.href = `${API_BASE_PATH}/verifikasi/${id}?code=${encodeURIComponent(code)}`
}

function KonfirmasiContent() {
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const preferred = params.get('action') === 'reject' ? 'reject' : 'approve'
  const [data, setData] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null)

  useEffect(() => {
    if (!token) { setError('Link tidak valid.'); setLoading(false); return }
    fetch(`${API_BASE_PATH}/api/photo-video-requests/approve?token=${encodeURIComponent(token)}&preview=1`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body?.message ?? 'Gagal memuat pengajuan.')
        const request: Preview = body.request
        // Decided already (e.g. reopening the same email later): go straight to the result.
        if (request.status !== 'pending' && request.verification_code) { goToResult(request.id, request.verification_code); return }
        setData(request)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan.'))
      .finally(() => setLoading(false))
  }, [token])

  const decide = async (action: 'approve' | 'reject') => {
    setSubmitting(action)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/photo-video-requests/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setError(body?.message ?? 'Gagal memproses keputusan.'); setSubmitting(null); return }
      goToResult(body.id, body.code)
    } catch {
      setError('Tidak dapat menghubungi server.')
      setSubmitting(null)
    }
  }

  if (loading) return <div className="mx-auto max-w-lg py-16 text-center text-sm text-muted-foreground">Memuat pengajuan...</div>

  if (!data) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <XCircle className="mx-auto size-12 text-destructive" />
        <p className="mt-4 text-sm font-semibold text-foreground">{error ?? 'Pengajuan tidak ditemukan.'}</p>
      </div>
    )
  }

  const primary = preferred
  const secondary = preferred === 'approve' ? 'reject' : 'approve'
  const label = { approve: 'Menyetujui', reject: 'Tolak' } as const
  const primaryClass = primary === 'approve' ? 'bg-[#1a6e3a] text-white' : 'bg-[#c7161e] text-white'

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 py-10">
      <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-md">
        <ShieldQuestion className="mx-auto size-14 text-primary" />
        <h1 className="mt-4 text-xl font-bold text-foreground">Konfirmasi Keputusan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Periksa rincian pengajuan izin foto/video berikut, lalu tentukan keputusan Anda.</p>

        <div className="mt-6 rounded-2xl bg-secondary/40 p-4 text-left text-sm">
          <dl className="grid grid-cols-[110px_1fr] gap-y-2">
            <dt className="text-muted-foreground">Nama</dt><dd className="text-foreground">{data.requester_name}</dd>
            <dt className="text-muted-foreground">Company</dt><dd className="text-foreground">{data.dept_or_company}</dd>
            <dt className="text-muted-foreground">Departemen</dt><dd className="text-foreground">{data.dept ?? '-'}</dd>
            <dt className="text-muted-foreground">Waktu</dt><dd className="text-foreground">{fmt(data.from_at)} – {fmt(data.to_at)}</dd>
            <dt className="text-muted-foreground">Lokasi</dt><dd className="text-foreground">{data.location}</dd>
            <dt className="text-muted-foreground">Tujuan</dt><dd className="text-foreground">{data.objective}</dd>
            <dt className="text-muted-foreground">PIC JAI</dt><dd className="text-foreground">{data.pic_jai ?? '-'}</dd>
          </dl>
        </div>

        {error && <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => decide(primary)}
            disabled={submitting !== null}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${primaryClass}`}
          >
            {primary === 'approve' ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
            {submitting === primary ? 'Memproses...' : `Ya, ${label[primary]}`}
          </button>
          <button
            type="button"
            onClick={() => decide(secondary)}
            disabled={submitting !== null}
            className="text-xs font-semibold text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting === secondary ? 'Memproses...' : `Bukan itu — saya ingin ${secondary === 'approve' ? 'menyetujui' : 'menolak'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function KonfirmasiApprovalPage() {
  return (
    <Suspense fallback={null}>
      <KonfirmasiContent />
    </Suspense>
  )
}
