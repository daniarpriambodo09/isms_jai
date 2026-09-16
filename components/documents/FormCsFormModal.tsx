'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'

type FileKind = 'pdf' | 'xls'

export type EditableFormCsDocument = {
  id: number
  controlNo: string
  title: string
  language: string
  keteranganNote: string | null
  fileKind: FileKind
  titleEmphasisFrom: number | null
}

const inputClass = 'h-10 rounded-[7px] border border-[#dce6ed] bg-[#fbfcfd] px-3 text-[13px] text-[#20354a] outline-none focus:border-[#278e84]'
const labelText = 'text-[12px] font-medium text-[#3c5369]'

export function FormCsFormModal({ open, onClose, onSaved, category, title, document }: { open: boolean; onClose: () => void; onSaved: () => void; category: 'form-aplikasi' | 'kontrol-cs'; title: string; document?: EditableFormCsDocument }) {
  const isEdit = Boolean(document)
  const [controlNo, setControlNo] = useState('')
  const [name, setName] = useState('')
  const [language, setLanguage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [keteranganNote, setKeteranganNote] = useState('')
  const [fileKind, setFileKind] = useState<FileKind>('pdf')
  const [italicEnabled, setItalicEnabled] = useState(false)
  const [italicSubstring, setItalicSubstring] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEscapeClose(open, onClose)

  useEffect(() => {
    if (open) {
      setControlNo(document?.controlNo ?? '')
      setName(document?.title ?? '')
      setLanguage(document?.language ?? '')
      setFile(null)
      setKeteranganNote(document?.keteranganNote ?? '')
      setFileKind(document?.fileKind ?? 'pdf')
      const emphasisFrom = document?.titleEmphasisFrom
      const docTitle = document?.title ?? ''
      if (emphasisFrom != null && emphasisFrom >= 0 && emphasisFrom < docTitle.length) {
        setItalicEnabled(true)
        setItalicSubstring(docTitle.slice(emphasisFrom))
      } else {
        setItalicEnabled(false)
        setItalicSubstring('')
      }
      setError(null)
    }
  }, [open, document])

  if (!open) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!isEdit && !file) { setError(`File ${fileKind === 'xls' ? 'Excel' : 'PDF'} wajib diunggah.`); return }
    setSubmitting(true)
    try {
      const titleEmphasisFrom = italicEnabled && italicSubstring.trim() ? name.lastIndexOf(italicSubstring.trim()) : -1

      const formData = new FormData()
      formData.set('controlNo', controlNo)
      formData.set('title', name)
      formData.set('language', language)
      if (file) formData.set('file', file)
      if (document) formData.set('id', String(document.id))
      formData.set('keteranganType', keteranganNote.trim() ? 'plain-note' : 'none')
      formData.set('keteranganNote', keteranganNote)
      formData.set('fileKind', fileKind)
      if (titleEmphasisFrom >= 0) formData.set('titleEmphasisFrom', String(titleEmphasisFrom))

      const response = await fetch(`${API_BASE_PATH}/api/form-cs/${category}`, { method: isEdit ? 'PUT' : 'POST', body: formData })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message ?? 'Gagal menyimpan dokumen.')
        return
      }
      onSaved()
      onClose()
    } catch { setError('Tidak dapat menghubungi server.') } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(14,34,53,0.5)] p-4">
      <div role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit Dokumen' : 'Tambah Dokumen'} className="max-h-[90vh] w-full max-w-[460px] overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_20px_50px_rgba(14,34,53,0.25)]">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[#7290a5]">{title.toUpperCase()}</div>
            <h2 className="text-[18px] font-bold text-[#20354a]">{isEdit ? 'Edit Dokumen' : 'Tambah Dokumen'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid h-8 w-8 place-items-center rounded-full text-[#8798a8] hover:bg-[#f0f4f7]"><X className="w-[18px]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-[6px]">
            <span className={labelText}>No. Kontrol</span>
            <input value={controlNo} onChange={(event) => setControlNo(event.target.value)} required autoFocus placeholder="Contoh: FA-001" className={inputClass} />
          </label>

          <label className="flex flex-col gap-[6px]">
            <span className={labelText}>Nama Dokumen</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Nama dokumen" className={inputClass} />
          </label>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={italicEnabled} onChange={(event) => setItalicEnabled(event.target.checked)} />
            <span className={labelText}>Bagian akhir judul dicetak miring</span>
          </label>
          {italicEnabled && (
            <label className="flex flex-col gap-[6px]">
              <span className={labelText}>Teks yang dicetak miring (harus persis sama dengan bagian akhir judul)</span>
              <input value={italicSubstring} onChange={(event) => setItalicSubstring(event.target.value)} placeholder="Contoh: Special Security Area" className={inputClass} />
            </label>
          )}

          <label className="flex flex-col gap-[6px]">
            <span className={labelText}>Bahasa</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)} required className={inputClass}>
              <option value="" disabled>Pilih bahasa</option>
              <option value="IDN">IDN</option>
              <option value="ENG">ENG</option>
              <option value="JPN">JPN</option>
              <option value="IDN-JPN">IDN-JPN</option>
              <option value="IDN-ENG">IDN-ENG</option>
              <option value="ENG-JPN">ENG-JPN</option>
              <option value="ENG-IDN">ENG-IDN</option>
            </select>
          </label>

          <label className="flex flex-col gap-[6px]">
            <span className={labelText}>Jenis File</span>
            <select value={fileKind} onChange={(event) => setFileKind(event.target.value as FileKind)} className={inputClass}>
              <option value="pdf">PDF</option>
              <option value="xls">XLS</option>
            </select>
          </label>

          <label className="flex flex-col gap-[6px]">
            <span className={labelText}>Keterangan</span>
            <input value={keteranganNote} onChange={(event) => setKeteranganNote(event.target.value)} placeholder="Contoh: * Added by 25/08/2017 (SSA)" className={inputClass} />
          </label>

          <label className="flex flex-col gap-[6px]">
            <span className={labelText}>{isEdit ? `Upload Ulang ${fileKind === 'xls' ? 'Excel' : 'PDF'} (opsional)` : `File ${fileKind === 'xls' ? 'Excel' : 'PDF'}`}</span>
            <input type="file" accept={fileKind === 'xls' ? '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf'} onChange={(event) => setFile(event.target.files?.[0] ?? null)} required={!isEdit} className="rounded-[7px] border border-[#dce6ed] bg-[#fbfcfd] px-3 py-2 text-[12px] text-[#40566a] file:mr-3 file:rounded-[5px] file:border-0 file:bg-[#20354a] file:px-3 file:py-[6px] file:text-[11px] file:font-medium file:text-white" />
            {isEdit && <span className="text-[11px] text-[#8798a8]">Kosongkan jika hanya mengubah data dokumen.</span>}
          </label>

          {isEdit && <p className="rounded-[6px] bg-[#f5fafb] px-3 py-2 text-[11px] text-[#7c91a1]">Upload ulang file akan memperbarui tanggal upload.</p>}
          {error && <p className="rounded-[6px] bg-[#fdecec] px-3 py-2 text-[12px] text-[#b3413a]">{error}</p>}

          <button type="submit" disabled={submitting} className="mt-1 inline-flex h-10 items-center justify-center rounded-[7px] bg-[#20354a] text-[13px] font-medium text-white hover:bg-[#284360] disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>
      </div>
    </div>
  )
}
