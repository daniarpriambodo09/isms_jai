'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

export type EditableWorkingStandard = {
  id: number
  controlNo: string
  title: string
}

export function WorkingStandardFormModal({ open, onClose, onSaved, document }: { open: boolean; onClose: () => void; onSaved: () => void; document?: EditableWorkingStandard }) {
  const isEdit = Boolean(document)
  const [controlNo, setControlNo] = useState('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setControlNo(document?.controlNo ?? '')
      setTitle(document?.title ?? '')
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
      if (file) formData.set('file', file)
      if (document) formData.set('id', String(document.id))

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
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(14,34,53,0.5)] p-4">
      <div className="w-full max-w-[460px] rounded-2xl bg-white p-6 shadow-[0_20px_50px_rgba(14,34,53,0.25)]">
        <div className="mb-5 flex items-start justify-between"><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[#7290a5]">WORKING STANDARD</div><h2 className="text-[18px] font-bold text-[#20354a]">{isEdit ? 'Edit Dokumen' : 'Tambah Dokumen'}</h2></div><button type="button" onClick={onClose} aria-label="Tutup" className="grid h-8 w-8 place-items-center rounded-full text-[#8798a8] hover:bg-[#f0f4f7]"><X className="w-[18px]" /></button></div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-[6px]"><span className="text-[12px] font-medium text-[#3c5369]">No. Kontrol</span><input value={controlNo} onChange={(event) => setControlNo(event.target.value)} required autoFocus placeholder="Contoh: WS-001" className="h-10 rounded-[7px] border border-[#dce6ed] bg-[#fbfcfd] px-3 text-[13px] text-[#20354a] outline-none focus:border-[#278e84]" /></label>
          <label className="flex flex-col gap-[6px]"><span className="text-[12px] font-medium text-[#3c5369]">Nama Dokumen</span><input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Contoh: Standard Requirements TMMIN" className="h-10 rounded-[7px] border border-[#dce6ed] bg-[#fbfcfd] px-3 text-[13px] text-[#20354a] outline-none focus:border-[#278e84]" /></label>
          <label className="flex flex-col gap-[6px]"><span className="text-[12px] font-medium text-[#3c5369]">{isEdit ? 'Upload Ulang PDF (opsional)' : 'File PDF'}</span><input type="file" accept="application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required={!isEdit} className="rounded-[7px] border border-[#dce6ed] bg-[#fbfcfd] px-3 py-2 text-[12px] text-[#40566a] file:mr-3 file:rounded-[5px] file:border-0 file:bg-[#20354a] file:px-3 file:py-[6px] file:text-[11px] file:font-medium file:text-white" />{isEdit && <span className="text-[11px] text-[#8798a8]">Kosongkan jika hanya mengubah data dokumen.</span>}</label>
          {isEdit && <p className="rounded-[6px] bg-[#f5fafb] px-3 py-2 text-[11px] text-[#7c91a1]">Revisi akan otomatis bertambah satu saat disimpan.</p>}
          {error && <p className="rounded-[6px] bg-[#fdecec] px-3 py-2 text-[12px] text-[#b3413a]">{error}</p>}
          <button type="submit" disabled={submitting} className="mt-1 inline-flex h-10 items-center justify-center rounded-[7px] bg-[#20354a] text-[13px] font-medium text-white hover:bg-[#284360] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Menyimpan...' : 'Simpan'}</button>
        </form>
      </div>
    </div>
  )
}
