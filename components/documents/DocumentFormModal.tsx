// components/documents/DocumentFormModal.tsx
'use client'

import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

export type EditableDocument = {
  id: number
  title: string
  revision: number
  uploadedAt: string // yyyy-mm-dd, for <input type="date">
}

export function DocumentFormModal({
  open,
  onClose,
  onSaved,
  departmentId,
  sectionId,
  document,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  departmentId: number
  sectionId: number | null
  /** Pass a document to edit it; omit to add a new one. */
  document?: EditableDocument
}) {
  const isEdit = Boolean(document)

  const [title, setTitle] = useState(document?.title ?? '')
  const [uploadedAt, setUploadedAt] = useState(document?.uploadedAt ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
      let res: Response

      if (isEdit && document) {
        res = await fetch(`${API_BASE_PATH}/api/documents/${document.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, uploadedAt: uploadedAt || null }),
        })
      } else {
        const formData = new FormData()
        formData.set('title', title)
        formData.set('departmentId', String(departmentId))
        if (sectionId) formData.set('sectionId', String(sectionId))
        if (file) formData.set('file', file)

        res = await fetch(`${API_BASE_PATH}/api/documents`, {
          method: 'POST',
          body: formData,
        })
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null)
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
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-[0_20px_50px_rgba(14,34,53,0.25)]">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[#7290a5]">
              DOKUMEN
            </div>
            <h2 className="text-[18px] font-bold text-[#20354a]">
              {isEdit ? 'Edit Dokumen' : 'Tambah Dokumen'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 place-items-center rounded-full text-[#8798a8] hover:bg-[#f0f4f7]"
          >
            <X className="w-[18px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-[6px]">
            <span className="text-[12px] font-medium text-[#3c5369]">Nama Dokumen</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              autoFocus
              placeholder="Contoh: Prosedur Pengendalian Akses"
              className="h-10 rounded-[7px] border border-[#dce6ed] bg-[#fbfcfd] px-3 text-[13px] text-[#20354a] outline-none focus:border-[#278e84]"
            />
          </label>

          {isEdit && (
            <label className="flex flex-col gap-[6px]">
              <span className="text-[12px] font-medium text-[#3c5369]">Tanggal Upload</span>
              <input
                type="date"
                value={uploadedAt}
                onChange={(event) => setUploadedAt(event.target.value)}
                className="h-10 rounded-[7px] border border-[#dce6ed] bg-[#fbfcfd] px-3 text-[13px] text-[#20354a] outline-none focus:border-[#278e84]"
              />
            </label>
          )}

          {isEdit && (
            <p className="rounded-[6px] bg-[#f5fafb] px-3 py-2 text-[11px] text-[#7c91a1]">
              Revisi saat ini: <strong className="text-[#40566a]">{document?.revision}</strong> — akan
              otomatis bertambah menjadi {(document?.revision ?? 1) + 1} setelah disimpan.
            </p>
          )}

          {!isEdit && (
            <label className="flex flex-col gap-[6px]">
              <span className="text-[12px] font-medium text-[#3c5369]">File PDF</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
                className="rounded-[7px] border border-[#dce6ed] bg-[#fbfcfd] px-3 py-2 text-[12px] text-[#40566a] file:mr-3 file:rounded-[5px] file:border-0 file:bg-[#20354a] file:px-3 file:py-[6px] file:text-[11px] file:font-medium file:text-white"
              />
            </label>
          )}

          {error && (
            <p className="rounded-[6px] bg-[#fdecec] px-3 py-2 text-[12px] text-[#b3413a]">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 inline-flex h-10 items-center justify-center rounded-[7px] bg-[#20354a] text-[13px] font-medium text-white hover:bg-[#284360] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>
      </div>
    </div>
  )
}