'use client'

// components/documents/EducationFormModal.tsx

import { useEffect, useState, type FormEvent } from 'react'
import { X, GraduationCap } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

export type EditableEducation = {
  id: number
  title: string
  category: string
  language: string
}

const CATEGORIES = [
  'PDF',
  'Video',
  'PPT',
  'Dokumen',
  'Lainnya',
]

const LANGUAGES = ['Indonesia', 'English']

export function EducationFormModal({
  open,
  onClose,
  onSaved,
  document,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  document?: EditableEducation
}) {
  const isEdit = Boolean(document)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [language, setLanguage] = useState(LANGUAGES[0])
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(document?.title ?? '')
      setCategory(document?.category ?? CATEGORIES[0])
      setLanguage(document?.language ?? LANGUAGES[0])
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
      formData.set('title', title)
      formData.set('category', category)
      formData.set('language', language)
      if (file) formData.set('file', file)
      if (document) formData.set('id', String(document.id))

      const res = await fetch(`${API_BASE_PATH}/api/education`, {
        method: isEdit ? 'PUT' : 'POST',
        body: formData,
      })
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

  const inputClass =
    'h-10 rounded-[7px] border border-[#dce6ed] bg-[#fbfcfd] px-3 text-[13px] text-[#20354a] outline-none focus:border-[#278e84] focus:ring-2 focus:ring-[#278e84]/20 transition-colors'
  const labelClass = 'flex flex-col gap-[6px]'
  const labelTextClass = 'text-[12px] font-semibold text-[#3c5369]'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(14,34,53,0.55)] p-4 backdrop-blur-[2px]">
      <div
        className="w-full max-w-[480px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(14,34,53,0.28)]"
        style={{ animation: 'dropdown-in 200ms cubic-bezier(0.22,1,0.36,1) both' }}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{
            background: 'linear-gradient(135deg, #1a5f7a 0%, #278e84 100%)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <GraduationCap className="size-5 text-white" />
            </div>
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/65">Education</p>
              <h2 className="text-[16px] font-bold text-white">
                {isEdit ? 'Edit Dokumen' : 'Tambah Dokumen'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <label className={labelClass}>
            <span className={labelTextClass}>Judul Materi</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              placeholder="Contoh: Pengenalan ISO/IEC 27001:2022"
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              <span className={labelTextClass}>Kategori</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className={inputClass}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              <span className={labelTextClass}>Bahasa</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                required
                className={inputClass}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </label>
          </div>

          <label className={labelClass}>
            <span className={labelTextClass}>
              {isEdit ? 'Upload Ulang PDF (opsional)' : 'File PDF'}
            </span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required={!isEdit}
              className="rounded-[7px] border border-[#dce6ed] bg-[#fbfcfd] px-3 py-2 text-[12px] text-[#40566a] file:mr-3 file:rounded-[5px] file:border-0 file:bg-[#1a5f7a] file:px-3 file:py-[6px] file:text-[11px] file:font-medium file:text-white hover:file:bg-[#278e84]"
            />
            {isEdit && (
              <span className="text-[11px] text-[#8798a8]">Kosongkan jika hanya mengubah data dokumen.</span>
            )}
          </label>

          {error && (
            <p className="rounded-[7px] border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-[7px] border border-[#dce6ed] bg-white py-2.5 text-[13px] font-medium text-[#3c5369] transition-colors hover:bg-[#f5f8fa]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-[7px] py-2.5 text-[13px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #1a5f7a 0%, #278e84 100%)',
              }}
            >
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
