'use client'

import { useState } from 'react'
import { Camera, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'

export type PhotoVideoRequest = {
  id: number
  request_type: 'internal' | 'visitor'
  nik: string | null
  requester_name: string
  dept_or_company: string
  dept: string | null
  dept_pic_kamera: string | null
  from_at: string
  to_at: string
  location: string
  objective: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  decided_at: string | null
  decided_by: string | null
  decision_note: string | null
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

export function PhotoVideoDecisionModal({ request, onClose, onDecided }: { request: PhotoVideoRequest; onClose: () => void; onDecided: () => void }) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEscapeClose(true, onClose)

  const decide = async (status: 'approved' | 'rejected') => {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/photo-video-requests/${request.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, decisionNote: note }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message ?? 'Gagal menyimpan keputusan.')
        return
      }
      onDecided()
      onClose()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-label={`Keputusan pengajuan ${request.requester_name}`} className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-primary px-6 py-5 text-primary-foreground">
          <div className="flex items-center gap-3">
            <span className="grid size-9 flex-shrink-0 place-items-center rounded-lg bg-primary-foreground/15"><Camera className="size-4" /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground/65">
                {request.request_type === 'internal' ? 'Pengajuan Internal' : 'Visitor Registration'}
              </p>
              <h2 className="text-lg font-bold">{request.requester_name}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-8 flex-shrink-0 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground">
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="p-6">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
            {request.nik && (<><dt className="text-muted-foreground">NIK</dt><dd className="text-foreground">{request.nik}</dd></>)}
            <dt className="text-muted-foreground">{request.request_type === 'internal' ? 'Dept/Seksi' : 'Company/Organization'}</dt>
            <dd className="text-foreground">{request.dept_or_company}</dd>
            {request.dept && (<><dt className="text-muted-foreground">Department</dt><dd className="text-foreground">{request.dept}</dd></>)}
            {request.dept_pic_kamera && (<><dt className="text-muted-foreground">Dept. PIC Kamera</dt><dd className="text-foreground">{request.dept_pic_kamera}</dd></>)}
            <dt className="text-muted-foreground">Dari</dt><dd className="text-foreground">{formatDateTime(request.from_at)}</dd>
            <dt className="text-muted-foreground">Sampai</dt><dd className="text-foreground">{formatDateTime(request.to_at)}</dd>
            <dt className="text-muted-foreground">Lokasi</dt><dd className="text-foreground">{request.location}</dd>
            <dt className="text-muted-foreground">Tujuan</dt><dd className="text-foreground">{request.objective}</dd>
            <dt className="text-muted-foreground">Diajukan</dt><dd className="text-foreground">{formatDateTime(request.submitted_at)}</dd>
          </dl>

          {request.status !== 'pending' && (
            <p className="mt-4 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              Sudah diputuskan: <strong className="text-foreground">{request.status === 'approved' ? 'Disetujui' : 'Ditolak'}</strong> oleh {request.decided_by} pada {request.decided_at ? formatDateTime(request.decided_at) : '-'}.
              {request.decision_note && <> Catatan: {request.decision_note}</>}
            </p>
          )}

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Catatan keputusan (opsional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15"
            />
          </label>

          {error && <p className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => decide('rejected')}
              className="flex-1 rounded-lg border border-destructive/30 bg-destructive/10 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Tolak
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => decide('approved')}
              className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              style={{ background: 'linear-gradient(135deg, oklch(0.48 0.12 180) 0%, oklch(0.58 0.14 165) 100%)' }}
            >
              Setujui
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
