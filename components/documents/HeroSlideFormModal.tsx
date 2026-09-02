'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

export type EditableHeroSlide = {
  id: number
  mediaType: 'video' | 'image'
  title: string
  description: string | null
  ctaLabel: string | null
  ctaHref: string | null
  isActive: boolean
}

const inputClass = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const labelClass = 'mb-1.5 block text-xs font-semibold text-muted-foreground'

export function HeroSlideFormModal({
  open,
  onClose,
  onSaved,
  slide,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  slide?: EditableHeroSlide
}) {
  const isEdit = Boolean(slide)
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaHref, setCtaHref] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setMediaType(slide?.mediaType ?? 'video')
      setTitle(slide?.title ?? '')
      setDescription(slide?.description ?? '')
      setCtaLabel(slide?.ctaLabel ?? '')
      setCtaHref(slide?.ctaHref ?? '')
      setIsActive(slide?.isActive ?? true)
      setFile(null)
      setError(null)
    }
  }, [open, slide])

  if (!open) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!isEdit && !file) { setError('File video/gambar wajib diunggah.'); return }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.set('mediaType', mediaType)
      formData.set('title', title)
      formData.set('description', description)
      formData.set('ctaLabel', ctaLabel)
      formData.set('ctaHref', ctaHref)
      formData.set('isActive', String(isActive))
      if (file) formData.set('file', file)

      const res = await fetch(`${API_BASE_PATH}/api/hero-slides${isEdit ? `/${slide!.id}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.message ?? 'Gagal menyimpan slide.')
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
    <div className="fixed inset-0 z-80 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-primary px-6 py-5 text-primary-foreground">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground/65">Hero Slide</p>
            <h2 className="text-lg font-bold">{isEdit ? 'Edit Slide' : 'Tambah Slide'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-8 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground">
            <X className="size-[18px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={labelClass}>Tipe Media</span>
              <select value={mediaType} onChange={(e) => setMediaType(e.target.value as 'video' | 'image')} className={inputClass}>
                <option value="video">Video</option>
                <option value="image">Gambar</option>
              </select>
            </label>
            <label className="flex items-center gap-2 self-end pb-2.5">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4 rounded border-input" />
              <span className="text-sm text-foreground">Aktif ditampilkan</span>
            </label>
          </div>

          <label>
            <span className={labelClass}>Judul</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
          </label>

          <label>
            <span className={labelClass}>Deskripsi (opsional)</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${inputClass} h-auto py-2`} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={labelClass}>Label Tombol (opsional)</span>
              <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Lihat Detail" className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Link Tombol (opsional)</span>
              <input value={ctaHref} onChange={(e) => setCtaHref(e.target.value)} placeholder="/audits" className={inputClass} />
            </label>
          </div>

          <label>
            <span className={labelClass}>
              {isEdit ? `Ganti File ${mediaType === 'video' ? 'Video' : 'Gambar'} (opsional)` : `File ${mediaType === 'video' ? 'Video (MP4/WebM, maks 100MB)' : 'Gambar (JPG/PNG/WebP, maks 15MB)'}`}
            </span>
            <input
              type="file"
              accept={mediaType === 'video' ? 'video/mp4,video/webm' : 'image/jpeg,image/png,image/webp'}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required={!isEdit}
              className="w-full rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
            />
            {isEdit && <span className="mt-1 block text-xs text-muted-foreground">Kosongkan jika hanya mengubah teks.</span>}
          </label>

          {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary">
              Batal
            </button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
