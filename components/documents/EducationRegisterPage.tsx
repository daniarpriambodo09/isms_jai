'use client'

// components/documents/EducationRegisterPage.tsx

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Eye, FileText, GraduationCap, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { DocumentViewModal } from '@/components/documents/DocumentViewModal'
import { EducationFormModal, type EditableEducation } from '@/components/documents/EducationFormModal'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/components/pagination'

type EducationDocument = {
  id: number
  title: string
  category: string
  language: string
  file_path: string
  uploaded_at: string
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword.trim()) return <>{text}</>
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return (
    <>
      {text.split(regex).map((part, index) =>
        regex.test(part) ? (
          <mark key={index} className="rounded-sm bg-accent/35 px-0.5 text-accent-foreground">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  )
}

const LANGUAGE_BADGE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  Indonesia: {
    label: '🇮🇩 Indonesia',
    bg: '#edf6ff',
    color: '#1a5fa0',
    border: 'rgba(26,95,160,0.2)',
  },
  English: {
    label: '🇬🇧 English',
    bg: '#f0faf0',
    color: '#276e4a',
    border: 'rgba(39,110,74,0.2)',
  },
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  'PDF':      { bg: '#fff0f0', color: '#a03030' },
  'Video':    { bg: '#f0f4ff', color: '#3a52a0' },
  'PPT':      { bg: '#fff8ed', color: '#8a5a00' },
  'Dokumen':  { bg: '#edf8f7', color: '#1a6e6a' },
  'Lainnya':  { bg: '#f5f5f5', color: '#666666' },
}

function CategoryBadge({ category }: { category: string }) {
  const style = CATEGORY_COLORS[category] ?? { bg: '#f3f4f6', color: '#555' }
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold"
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.color}25` }}
    >
      {category}
    </span>
  )
}

function LanguageBadge({ language }: { language: string }) {
  const style = LANGUAGE_BADGE[language] ?? { label: language, bg: '#f3f4f6', color: '#555', border: 'transparent' }
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
    >
      {style.label}
    </span>
  )
}

export function EducationRegisterPage() {
  const { isLoggedIn } = useAuth()
  const [documents, setDocuments] = useState<EducationDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('Semua')
  const [viewing, setViewing] = useState<EducationDocument | null>(null)
  const [editing, setEditing] = useState<EducationDocument | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<EducationDocument | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/education`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setDocuments(data.documents ?? [])
      setErrorMsg(null)
    } catch (e) {
      setDocuments([])
      setErrorMsg(e instanceof Error ? e.message : 'Gagal memuat dokumen education.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDocuments() }, [loadDocuments])

  const allCategories = useMemo(() => {
    const cats = Array.from(new Set(documents.map((d) => d.category)))
    return ['Semua', ...cats]
  }, [documents])

  const filtered = useMemo(() => {
    const kw = searchQuery.trim().toLowerCase()
    return documents.filter((d) => {
      const matchKw = !kw || `${d.title} ${d.category}`.toLowerCase().includes(kw)
      const matchCat = categoryFilter === 'Semua' || d.category === categoryFilter
      return matchKw && matchCat
    })
  }, [documents, searchQuery, categoryFilter])

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (doc: EducationDocument) => { setEditing(doc); setFormOpen(true) }
  const { page, setPage, totalPages, pageItems, pageSize } = usePagination(filtered, 20)
  useEffect(() => { setPage(1) }, [searchQuery, categoryFilter, setPage])

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/education?id=${pendingDelete.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setErrorMsg(data?.message ?? 'Gagal menghapus dokumen.')
        setDeleting(false)
        setPendingDelete(null)
        return
      }
      await loadDocuments()
    } catch {
      setErrorMsg('Tidak dapat menghubungi server.')
    }
    setDeleting(false)
    setPendingDelete(null)
  }

  const editableDoc: EditableEducation | undefined = editing
    ? { id: editing.id, title: editing.title, category: editing.category, language: editing.language }
    : undefined

  const downloadUrl = (filePath: string, title: string) =>
    `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(filePath)}&download=1&name=${encodeURIComponent(title)}.pdf`

  return (
    <div className="flex flex-col gap-6">
      {/* Hero banner */}
      <section
        className="relative overflow-hidden rounded-[1.25rem] border border-border p-6 text-primary-foreground shadow-xl sm:p-8"
        style={{
          background: 'linear-gradient(135deg, #1a3a52 0%, #1a5f7a 45%, #278e84 100%)',
        }}
      >
        {/* Decorative circles */}
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-10 right-32 h-36 w-36 rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }}
        />

        <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2 text-xs text-primary-foreground/65">
              <GraduationCap className="size-4" />
              Education &amp; Training materials
            </div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Materi Education
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/72">
              Kumpulan materi edukasi keamanan informasi untuk seluruh karyawan — tersedia dalam Bahasa Indonesia dan Bahasa Inggris.
            </p>
          </div>
          {isLoggedIn && (
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              style={{
                background: 'linear-gradient(135deg, oklch(0.7 0.15 55) 0%, oklch(0.75 0.18 50) 100%)',
                color: '#1a2f1a',
              }}
            >
              <Plus className="size-4" />
              Tambah Dokumen
            </button>
          )}
        </div>
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="portal-eyebrow">Education library</p>
          <p className="mt-1 text-sm text-muted-foreground">{documents.length} dokumen tersedia</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {allCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className="rounded-full border px-3 py-1 text-[11px] font-semibold transition-all"
                style={
                  categoryFilter === cat
                    ? {
                        background: 'linear-gradient(135deg, #1a5f7a, #278e84)',
                        color: 'white',
                        borderColor: 'transparent',
                      }
                    : {
                        background: 'transparent',
                        color: 'var(--muted-foreground)',
                        borderColor: 'var(--border)',
                      }
                }
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul atau kategori..."
              aria-label="Cari dokumen education"
              className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Bersihkan pencarian"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {errorMsg && (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMsg}
        </p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead
              style={{ background: 'linear-gradient(135deg, var(--secondary) 0%, color-mix(in oklch, var(--secondary) 60%, var(--card)) 100%)' }}
            >
              <tr>
                {['Tanggal', 'Judul Materi', 'Kategori', 'Bahasa', 'Aksi'].map((head, i) => (
                  <th
                    key={head}
                    className={`whitespace-nowrap px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground ${i === 0 ? 'max-[680px]:hidden' : ''}`}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" />
                    <p className="text-sm text-muted-foreground">Memuat dokumen...</p>
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <GraduationCap className="mx-auto mb-3 size-10 text-muted-foreground/30" />
                    <p className="font-medium text-muted-foreground">
                      {searchQuery || categoryFilter !== 'Semua'
                        ? 'Tidak ada dokumen yang cocok'
                        : 'Belum ada dokumen education'}
                    </p>
                    {isLoggedIn && !searchQuery && categoryFilter === 'Semua' && (
                      <button
                        type="button"
                        onClick={openAdd}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                        style={{ background: 'linear-gradient(135deg, #1a5f7a, #278e84)' }}
                      >
                        <Plus className="size-4" /> Tambah Dokumen Pertama
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {pageItems.map((doc, index) => (
                <tr
                  key={doc.id}
                  className="transition-colors hover:bg-secondary/30"
                  style={{ background: index % 2 === 1 ? 'color-mix(in oklch, var(--secondary) 30%, transparent)' : undefined }}
                >
                  {/* Tanggal */}
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground max-[680px]:hidden">
                    {formatDate(doc.uploaded_at)}
                  </td>

                  {/* Judul */}
                  <td className="min-w-[280px] px-5 py-4">
                    <div className="flex items-center gap-3 font-medium text-foreground">
                      <span
                        className="grid size-9 flex-shrink-0 place-items-center rounded-lg"
                        style={{
                          background: 'linear-gradient(135deg, rgba(26,95,122,0.12), rgba(39,142,132,0.15))',
                          color: '#278e84',
                        }}
                      >
                        <FileText className="size-4" />
                      </span>
                      <Highlight text={doc.title} keyword={searchQuery} />
                    </div>
                  </td>

                  {/* Kategori */}
                  <td className="whitespace-nowrap px-5 py-4">
                    <CategoryBadge category={doc.category} />
                  </td>

                  {/* Bahasa */}
                  <td className="whitespace-nowrap px-5 py-4">
                    <LanguageBadge language={doc.language} />
                  </td>

                  {/* Aksi */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      {/* Lihat PDF */}
                      <button
                        type="button"
                        onClick={() => setViewing(doc)}
                        aria-label={`Lihat ${doc.title}`}
                        title="Lihat PDF"
                        className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                      >
                        <Eye className="size-4" />
                      </button>

                      {/* Download */}
                      <a
                        href={downloadUrl(doc.file_path, doc.title)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download PDF"
                        aria-label={`Download ${doc.title}`}
                        className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                      >
                        <Download className="size-4" />
                      </a>

                      {/* Admin: Edit & Delete */}
                      {isLoggedIn && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(doc)}
                            aria-label={`Edit ${doc.title}`}
                            title="Edit dokumen"
                            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-accent-foreground"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(doc)}
                            aria-label={`Hapus ${doc.title}`}
                            title="Hapus dokumen"
                            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={pageSize} />
        )}
      </div>

      {/* Modals */}
      {viewing && (
        <DocumentViewModal
          open={Boolean(viewing)}
          onClose={() => setViewing(null)}
          filePath={viewing.file_path}
          fileName={viewing.title}
        />
      )}
      <EducationFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={loadDocuments}
        document={editableDoc}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        title="Hapus dokumen?"
        message={`Dokumen "${pendingDelete?.title}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
