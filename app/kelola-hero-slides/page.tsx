// app/kelola-hero-slides/page.tsx

'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Film, ImageIcon, Pencil, Plus, Settings, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { HeroSlideFormModal, type EditableHeroSlide } from '@/components/documents/HeroSlideFormModal'

type Slide = {
  id: number
  media_type: 'video' | 'image'
  file_path: string
  title: string
  description: string | null
  cta_label: string | null
  cta_href: string | null
  sort_order: number
  is_active: boolean
}

export default function KelolaHeroSlidesPage() {
  const { isLoggedIn, isLoading } = useAuth()
  const [slides, setSlides] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Slide | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/hero-slides?all=1`, { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setSlides(data.slides ?? [])
      setError(null)
    } catch (e) {
      setSlides([])
      setError(e instanceof Error ? e.message : 'Gagal memuat hero slides.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (isLoggedIn) load() }, [isLoggedIn, load])

  if (!isLoading && !isLoggedIn) {
    return <section className="rounded-3xl border border-border bg-card p-10 text-center shadow-sm"><p className="text-sm text-muted-foreground">Halaman ini khusus untuk admin yang sudah login.</p></section>
  }

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (slide: Slide) => { setEditing(slide); setFormOpen(true) }

  const handleDelete = async (slide: Slide) => {
    if (!confirm(`Hapus slide "${slide.title}"?`)) return
    const res = await fetch(`${API_BASE_PATH}/api/hero-slides/${slide.id}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) { const data = await res.json().catch(() => null); setError(data?.message ?? 'Gagal menghapus slide.'); return }
    load()
  }

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= slides.length) return
    const a = slides[index]
    const b = slides[target]
    await Promise.all([
      fetch(`${API_BASE_PATH}/api/hero-slides/${a.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ sortOrder: b.sort_order }) }),
      fetch(`${API_BASE_PATH}/api/hero-slides/${b.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ sortOrder: a.sort_order }) }),
    ])
    load()
  }

  const editableSlide: EditableHeroSlide | undefined = editing
    ? { id: editing.id, mediaType: editing.media_type, title: editing.title, description: editing.description, ctaLabel: editing.cta_label, ctaHref: editing.cta_href, isActive: editing.is_active }
    : undefined

  return (
    <div className="flex flex-col gap-7">
      <header className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
              <Settings className="size-3.5" /> Admin workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Kelola Hero Slides</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">Atur video/gambar yang tampil bergantian di hero halaman Home, beserta urutannya.</p>
          </div>
          <button type="button" onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5">
            <Plus className="size-4" /> Tambah Slide
          </button>
        </div>
      </header>

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-secondary/55">
              <tr>
                {['Urutan', 'Slide', 'Tipe', 'Status', 'Aksi'].map((head) => (
                  <th key={head} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr><td colSpan={5} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat...</p></td></tr>
              )}
              {!loading && slides.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-16 text-center"><Film className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">Belum ada slide.</p></td></tr>
              )}
              {slides.map((slide, index) => (
                <tr key={slide.id} className={index % 2 ? 'bg-secondary/20' : ''}>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Naikkan urutan" className="grid size-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-30">
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => move(index, 1)} disabled={index === slides.length - 1} aria-label="Turunkan urutan" className="grid size-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-30">
                        <ArrowDown className="size-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="min-w-[220px] px-4 py-3">
                    <div className="flex items-center gap-3 font-medium text-foreground">
                      <span className="grid size-9 flex-shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        {slide.media_type === 'video' ? <Film className="size-4" /> : <ImageIcon className="size-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate">{slide.title}</p>
                        {slide.description && <p className="truncate text-xs text-muted-foreground">{slide.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{slide.media_type === 'video' ? 'Video' : 'Gambar'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${slide.is_active ? 'bg-[#dff5e6] text-[#1a6e3a]' : 'bg-secondary text-muted-foreground'}`}>
                      {slide.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => openEdit(slide)} aria-label={`Edit ${slide.title}`} className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-accent-foreground">
                        <Pencil className="size-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(slide)} aria-label={`Hapus ${slide.title}`} className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <HeroSlideFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} slide={editableSlide} />
    </div>
  )
}
