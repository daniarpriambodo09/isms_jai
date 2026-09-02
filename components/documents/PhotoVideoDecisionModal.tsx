'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

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
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(14,34,53,0.5)] p-4">
      <div className="w-full max-w-[520px] rounded-2xl bg-white p-6 shadow-[0_20px_50px_rgba(14,34,53,0.25)]">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[#7290a5]">
              {request.request_type === 'internal' ? 'PENGAJUAN INTERNAL' : 'VISITOR REGISTRATION'}
            </div>
            <h2 className="text-[18px] font-bold text-[#20354a]">{request.requester_name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid h-8 w-8 place-items-center rounded-full text-[#8798a8] hover:bg-[#f0f4f7]">
            <X className="w-[18px]" />
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
          {request.nik && (<><dt className="text-[#7290a5]">NIK</dt><dd className="text-[#20354a]">{request.nik}</dd></>)}
          <dt className="text-[#7290a5]">{request.request_type === 'internal' ? 'Dept/Seksi' : 'Company/Organization'}</dt>
          <dd className="text-[#20354a]">{request.dept_or_company}</dd>
          {request.dept && (<><dt className="text-[#7290a5]">Department</dt><dd className="text-[#20354a]">{request.dept}</dd></>)}
          {request.dept_pic_kamera && (<><dt className="text-[#7290a5]">Dept. PIC Kamera</dt><dd className="text-[#20354a]">{request.dept_pic_kamera}</dd></>)}
          <dt className="text-[#7290a5]">Dari</dt><dd className="text-[#20354a]">{formatDateTime(request.from_at)}</dd>
          <dt className="text-[#7290a5]">Sampai</dt><dd className="text-[#20354a]">{formatDateTime(request.to_at)}</dd>
          <dt className="text-[#7290a5]">Lokasi</dt><dd className="text-[#20354a]">{request.location}</dd>
          <dt className="text-[#7290a5]">Tujuan</dt><dd className="text-[#20354a]">{request.objective}</dd>
          <dt className="text-[#7290a5]">Diajukan</dt><dd className="text-[#20354a]">{formatDateTime(request.submitted_at)}</dd>
        </dl>

        {request.status !== 'pending' && (
          <p className="mt-4 rounded-[6px] bg-[#f5fafb] px-3 py-2 text-[12px] text-[#7c91a1]">
            Sudah diputuskan: <strong>{request.status === 'approved' ? 'Disetujui' : 'Ditolak'}</strong> oleh {request.decided_by} pada {request.decided_at ? formatDateTime(request.decided_at) : '-'}.
            {request.decision_note && <> Catatan: {request.decision_note}</>}
          </p>
        )}

        <label className="mt-4 flex flex-col gap-[6px]">
          <span className="text-[12px] font-medium text-[#3c5369]">Catatan keputusan (opsional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="rounded-[7px] border border-[#dce6ed] bg-[#fbfcfd] px-3 py-2 text-[13px] text-[#20354a] outline-none focus:border-[#278e84]" />
        </label>

        {error && <p className="mt-3 rounded-[6px] bg-[#fdecec] px-3 py-2 text-[12px] text-[#b3413a]">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button type="button" disabled={submitting} onClick={() => decide('rejected')} className="flex-1 rounded-[7px] border border-[#e5b6b6] bg-[#fdecec] py-2.5 text-[13px] font-semibold text-[#b3413a] hover:bg-[#fbdada] disabled:cursor-not-allowed disabled:opacity-60">
            Tolak
          </button>
          <button type="button" disabled={submitting} onClick={() => decide('approved')} className="flex-1 rounded-[7px] bg-[#278e84] py-2.5 text-[13px] font-semibold text-white hover:bg-[#20776e] disabled:cursor-not-allowed disabled:opacity-60">
            Setujui
          </button>
        </div>
      </div>
    </div>
  )
}
