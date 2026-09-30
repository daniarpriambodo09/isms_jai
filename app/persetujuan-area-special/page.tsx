// app/persetujuan-area-special/page.tsx
//
// Opened from the approver's email: the request details, then Setujui/Tolak.
// No login — the ?token= is the credential (app/api/special-area-requests/approval).
'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, FileSignature, Loader2, ShieldAlert, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import type { SpecialAreaRequest } from '@/lib/special-area-shared'

function fmt(value: string) {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })
}

function Content() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  // The email's Menyetujui / Tolak buttons preselect a choice; it is still
  // confirmed here with a click (POST), never decided by just opening the link.
  const preset = searchParams.get('action')
  const [req, setReq] = useState<SpecialAreaRequest | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(preset === 'reject')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api/special-area-requests/approval?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setReq(data.request)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Gagal memuat data.')
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const decide = async (action: 'approve' | 'reject') => {
    setSubmitting(action)
    const res = await fetch(`${API_BASE_PATH}/api/special-area-requests/approval`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action, note: action === 'reject' ? reason : null }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    setResult({ ok: !!res?.ok, message: data.message ?? 'Gagal memproses.' })
    setSubmitting(null)
    setRejecting(false)
    load()
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <X className="mx-auto size-10 text-destructive" />
        <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">Link tidak dapat dibuka</h2>
        <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
      </div>
    )
  }
  if (!req) return <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="size-7 animate-spin" /></div>

  const rows: [string, string][] = [
    ['Nama', req.requester_name],
    ['Organisasi / Perusahaan', req.org_company],
    ['Departemen', req.department ?? '-'],
    ['Masuk', fmt(req.from_at)],
    ['Keluar', fmt(req.to_at)],
    ['Area Special Security', req.area],
    ['Tujuan', req.purpose],
    ['Diajukan', `${fmt(req.submitted_at)}${req.submitted_by ? ` oleh ${req.submitted_by}` : ''}`],
  ]

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="h-2" style={{ background: 'repeating-linear-gradient(-45deg, #c7161e 0 10px, #8f0f15 10px 20px)' }} />
        <div className="px-6 py-5">
          <p className="flex items-center gap-1.5 font-mono-label text-[10px] font-semibold text-red-700"><ShieldAlert className="size-3.5" /> ISMS-F-006-001 · Persetujuan</p>
          <h2 className="mt-2 font-display text-[clamp(1.6rem,3.5vw,2.3rem)] font-semibold leading-tight text-foreground">Ijin Masuk Area Special Security</h2>
          <p className="mt-1 text-sm text-muted-foreground">Diminta kepada <strong className="text-foreground">{req.approver_name}</strong>{req.approver_title ? ` (${req.approver_title})` : ''}</p>
        </div>
        <dl className="divide-y divide-border border-t border-border">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[170px_1fr] gap-3 px-6 py-3 text-sm max-[520px]:grid-cols-1 max-[520px]:gap-0.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className={`font-medium ${k.startsWith('Area') ? 'text-red-700' : 'text-foreground'}`}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {result && <p className={`rounded-xl border px-4 py-3 text-sm ${result.ok ? 'border-emerald-600/20 bg-emerald-600/10 text-emerald-800' : 'border-red-600/20 bg-red-600/10 text-red-800'}`}>{result.message}</p>}

      {req.status === 'pending' ? (
        <section className="rounded-2xl border-2 border-red-600/30 bg-card p-5 shadow-sm">
          {rejecting ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="reason" className="text-xs font-semibold text-foreground">Alasan penolakan</label>
              <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring" />
              <div className="flex gap-2">
                <button type="button" onClick={() => decide('reject')} disabled={!reason.trim() || submitting !== null} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {submitting === 'reject' ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Kirim penolakan
                </button>
                <button type="button" onClick={() => setRejecting(false)} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold">Batal</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
            {preset === 'approve' && (
              <p className="text-sm leading-6 text-foreground">
                Anda memilih <strong className="text-emerald-700">Menyetujui</strong>. Tekan <strong>Setujui</strong> untuk mengonfirmasi — form PDF ber-QR (e-sign) atas nama <strong>{req.approver_name}</strong> akan diterbitkan.
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => decide('approve')} disabled={submitting !== null} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                {submitting === 'approve' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={3} />} Setujui
              </button>
              <button type="button" onClick={() => setRejecting(true)} disabled={submitting !== null} className="inline-flex items-center gap-2 rounded-full border-2 border-red-600/60 px-6 py-3 text-sm font-bold text-red-700 hover:bg-red-50">
                <X className="size-4" strokeWidth={3} /> Tolak
              </button>
            </div>
            </div>
          )}
        </section>
      ) : (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            Pengajuan ini telah <strong className={req.status === 'approved' ? 'text-emerald-700' : 'text-red-700'}>{req.status === 'approved' ? 'disetujui' : 'ditolak'}</strong>
            {req.decided_at ? ` pada ${fmt(req.decided_at)}` : ''}.
          </p>
          {req.verification_code && (
            <a href={`${API_BASE_PATH}/api/special-area-requests/${req.id}/pdf?code=${req.verification_code}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              <FileSignature className="size-4" /> Lihat Form PDF ber-QR
            </a>
          )}
        </section>
      )}
    </div>
  )
}

export default function PersetujuanAreaSpecialPage() {
  return <Suspense fallback={null}><Content /></Suspense>
}
