'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'

export type EditableWorkingStandard = {
  id: number
  controlNo: string
  title: string
  revision: number
  effectiveDate: string | null
}

export function WorkingStandardFormModal({ open, onClose, onSaved, document }: { open: boolean; onClose: () => void; onSaved: () => void; document?: EditableWorkingStandard }) {
  const isEdit = Boolean(document)
  const [controlNo, setControlNo] = useState('')
  const [title, setTitle] = useState('')
  const [revision, setRevision] = useState('1')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEscapeClose(open, onClose)

  useEffect(() => {
    if (open) {
      setControlNo(document?.controlNo ?? '')
      setTitle(document?.title ?? '')
      setRevision(String(document?.revision ?? 1))
      setEffectiveDate(document?.effectiveDate?.slice(0, 10) ?? '')
      setFile(null)
      setError(null)
    }
  }, [open, document])

  if (!open) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!isEdit && !file) {
      setError('File PDF wajib diunggah.')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.set('controlNo', controlNo)
      formData.set('title', title)
      formData.set('effectiveDate', effectiveDate)
      if (file) formData.set('file', file)
      if (document) {
        formData.set('id', String(document.id))
        formData.set('revision', revision)
      }

      const response = await fetch(`${API_BASE_PATH}/api/working-standard`, { method: isEdit ? 'PUT' : 'POST', body: formData })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message ?? 'Gagal menyimpan dokumen.')
        return
      }
      onSaved()
      onClose()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_oklch,_var(--p-950)_50%,_transparent)] p-4">
      <div role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit Dokumen' : 'Tambah Dokumen'} className="w-full max-w-[460px] rounded-2xl bg-white p-6 shadow-[0_20px_50px_color-mix(in_oklch,_var(--p-950)_25%,_transparent)]">
        <div className="mb-5 flex items-start justify-between"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[color:var(--p-muted)]">WORKING STANDARD</div><h2 className="text-[18px] font-bold text-[color:var(--p-800)]">{isEdit ? 'Edit Dokumen' : 'Tambah Dokumen'}</h2></div><button type="button" onClick={onClose} aria-label="Tutup" className="grid h-8 w-8 place-items-center rounded-full text-[color:var(--p-muted2)] hover:bg-[color:var(--p-surface2)]"><X className="w-[18px]" /></button></div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-[6px]"><span className="text-[12px] font-medium text-[color:var(--p-ink2)]">No. Kontrol</span><input value={controlNo} onChange={(event) => setControlNo(event.target.value)} required autoFocus placeholder="Contoh: WS-001" className="h-10 rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 text-[13px] text-[color:var(--p-800)] outline-none focus:border-[color:var(--p-600)]" /></label>
          <label className="flex flex-col gap-[6px]"><span className="text-[12px] font-medium text-[color:var(--p-ink2)]">Nama Dokumen</span><input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Contoh: Standard Requirements TMMIN" className="h-10 rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 text-[13px] text-[color:var(--p-800)] outline-none focus:border-[color:var(--p-600)]" /></label>
          <label className="flex flex-col gap-[6px]"><span className="text-[12px] font-medium text-[color:var(--p-ink2)]">Effective Date</span><input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} className="h-10 rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 text-[13px] text-[color:var(--p-800)] outline-none focus:border-[color:var(--p-600)]" /></label>
          {isEdit && <label className="flex flex-col gap-[6px]"><span className="text-[12px] font-medium text-[color:var(--p-ink2)]">Revisi</span><input type="number" min={1} step={1} value={revision} onChange={(event) => setRevision(event.target.value)} required className="h-10 rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 text-[13px] text-[color:var(--p-800)] outline-none focus:border-[color:var(--p-600)]" /></label>}
          <label className="flex flex-col gap-[6px]"><span className="text-[12px] font-medium text-[color:var(--p-ink2)]">{isEdit ? 'Upload Ulang PDF (opsional)' : 'File PDF'}</span><input type="file" accept="application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required={!isEdit} className="rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 py-2 text-[12px] text-[color:var(--p-ink2)] file:mr-3 file:rounded-[5px] file:border-0 file:bg-[color:var(--p-800)] file:px-3 file:py-[6px] file:text-[11px] file:font-medium file:text-white" />{isEdit && <span className="text-[11px] text-[color:var(--p-muted2)]">Kosongkan jika hanya mengubah data dokumen.</span>}</label>
          {error && <p className="rounded-[6px] bg-[#fdecec] px-3 py-2 text-[12px] text-[#b3413a]">{error}</p>}
          <button type="submit" disabled={submitting} className="mt-1 inline-flex h-10 items-center justify-center rounded-[7px] bg-[color:var(--p-800)] text-[13px] font-medium text-white hover:bg-[color:var(--p-750)] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Menyimpan...' : 'Simpan'}</button>
        </form>
      </div>
    </div>
  )
}
