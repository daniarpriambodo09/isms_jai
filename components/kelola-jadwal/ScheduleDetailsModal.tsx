'use client'

import { useState, type FormEvent } from 'react'
import { Check, X } from 'lucide-react'
import { useEscapeClose } from '@/hooks/useEscapeClose'

const inputClass = 'h-10 rounded-[7px] border border-[#dce6ed] bg-[#fbfcfd] px-3 text-[13px] text-[#20354a] outline-none focus:border-[#278e84]'
const labelText = 'text-[12px] font-medium text-[#3c5369]'

export function ScheduleDetailsModal({
  open,
  fileName,
  submitting,
  onCancel,
  onConfirm,
}: {
  open: boolean
  fileName: string
  submitting: boolean
  onCancel: () => void
  onConfirm: (title: string, description: string) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEscapeClose(open, onCancel)

  if (!open) return null

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onConfirm(title, description)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(14,34,53,0.5)] p-4">
      <div role="dialog" aria-modal="true" aria-label="Detail File" className="w-full max-w-[440px] rounded-2xl bg-white p-6 shadow-[0_20px_50px_rgba(14,34,53,0.25)]">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[#7290a5]">DETAIL FILE</div>
            <h2 className="truncate text-[15px] font-bold text-[#20354a]" title={fileName}>{fileName}</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label="Batal" className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-[#8798a8] hover:bg-[#f0f4f7]"><X className="w-[18px]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-[6px]">
            <span className={labelText}>Judul (opsional)</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus placeholder="Contoh: Jadwal Audit Internal Q3 2026" className={inputClass} />
          </label>
          <label className="flex flex-col gap-[6px]">
            <span className={labelText}>Keterangan (opsional)</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Contoh: Mencakup area produksi dan gudang."
              rows={3}
              className="rounded-[7px] border border-[#dce6ed] bg-[#fbfcfd] px-3 py-2 text-[13px] text-[#20354a] outline-none focus:border-[#278e84]"
            />
          </label>
          <button type="submit" disabled={submitting} className="mt-1 inline-flex h-10 items-center justify-center gap-1.5 rounded-[7px] bg-[#20354a] text-[13px] font-medium text-white hover:bg-[#284360] disabled:cursor-not-allowed disabled:opacity-60">
            <Check className="size-4" />{submitting ? 'Mengunggah...' : 'Unggah File'}
          </button>
        </form>
      </div>
    </div>
  )
}
