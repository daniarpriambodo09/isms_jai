'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Plus, Search, Settings2, Sparkles, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { DocumentViewModal } from '@/components/documents/DocumentViewModal'
import { FormCsFormModal, type EditableFormCsDocument } from '@/components/documents/FormCsFormModal'
import { FormCsSpreadsheetTable, type FormCsDocument, type FormCsGroupHeader } from '@/components/documents/FormCsSpreadsheetTable'
import { FormCsGroupHeaderModal } from '@/components/documents/FormCsGroupHeaderModal'
import { ConfirmDialog } from '@/components/confirm-dialog'

type Category = 'form-aplikasi' | 'kontrol-cs'

export function FormCsRegisterPage({ category, title }: { category: Category; title: string }) {
  const { isLoggedIn } = useAuth()
  const [documents, setDocuments] = useState<FormCsDocument[]>([])
  const [groupHeaders, setGroupHeaders] = useState<FormCsGroupHeader[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState<FormCsDocument | null>(null)
  const [editing, setEditing] = useState<FormCsDocument | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [groupHeaderModalOpen, setGroupHeaderModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<FormCsDocument | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const [documentsRes, groupHeadersRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api/form-cs/${category}`, { cache: 'no-store' }),
        fetch(`${API_BASE_PATH}/api/form-cs/${category}/group-headers`, { cache: 'no-store' }),
      ])
      const documentsData = await documentsRes.json()
      if (!documentsRes.ok) throw new Error(documentsData.message)
      setDocuments(documentsData.documents ?? [])

      const groupHeadersData = await groupHeadersRes.json().catch(() => ({ groupHeaders: [] }))
      setGroupHeaders(groupHeadersRes.ok ? (groupHeadersData.groupHeaders ?? []) : [])

      setError(null)
    } catch (loadError) {
      setDocuments([])
      setGroupHeaders([])
      setError(loadError instanceof Error ? loadError.message : `Gagal memuat daftar ${title}.`)
    } finally {
      setLoading(false)
    }
  }, [category, title])

  useEffect(() => { loadDocuments() }, [loadDocuments])

  const filteredDocuments = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return keyword
      ? documents.filter((document) => `${document.control_no} ${document.title} ${document.language}`.toLowerCase().includes(keyword))
      : documents
  }, [documents, query])

  const editableDocument: EditableFormCsDocument | undefined = editing
    ? {
        id: editing.id,
        controlNo: editing.control_no,
        title: editing.title,
        language: editing.language,
        keteranganType: editing.keterangan_type,
        keteranganNote: editing.keterangan_note,
        fileVariant: editing.file_variant,
        fileKind: editing.file_kind,
        titleEmphasisFrom: editing.title_emphasis_from,
      }
    : undefined

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/form-cs/${category}?id=${pendingDelete.id}`, { method: 'DELETE' })
      if (!response.ok) { const data = await response.json().catch(() => null); setError(data?.message ?? 'Gagal menghapus dokumen.'); setDeleting(false); setPendingDelete(null); return }
      await loadDocuments()
    } catch { setError('Tidak dapat menghubungi server.') }
    setDeleting(false)
    setPendingDelete(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <section
        className="relative overflow-hidden rounded-[1.25rem] p-6 text-primary-foreground shadow-xl sm:p-8"
        style={{ background: 'linear-gradient(135deg, #1a3a52 0%, #1a5f7a 45%, #278e84 100%)' }}
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
        <div className="pointer-events-none absolute -bottom-14 -left-10 h-52 w-52 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
              <Sparkles className="size-3.5" /> Document register
            </div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/72">Daftar dokumen {title} beserta bahasa dan tanggal upload.</p>
          </div>
          {isLoggedIn && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setGroupHeaderModalOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-primary-foreground/25 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10">
                <Settings2 className="size-4" />Kelola Baris Grup
              </button>
              <button type="button" onClick={() => { setEditing(null); setFormOpen(true) }} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5">
                <Plus className="size-4" />Tambah Dokumen
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div><p className="portal-eyebrow">Controlled library</p><p className="mt-1 text-sm text-muted-foreground">{documents.length} dokumen terdaftar</p></div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari No. Kontrol atau dokumen..."
            aria-label={`Cari ${title}`}
            className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25"
          />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Bersihkan pencarian" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>}
        </div>
      </div>

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center shadow-sm">
          <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" />
          <p className="text-sm text-muted-foreground">Memuat dokumen...</p>
        </div>
      ) : (
        <FormCsSpreadsheetTable
          documents={filteredDocuments}
          groupHeaders={groupHeaders}
          query={query}
          isLoggedIn={isLoggedIn}
          onView={setViewing}
          onEdit={(document) => { setEditing(document); setFormOpen(true) }}
          onDelete={setPendingDelete}
        />
      )}

      {!loading && filteredDocuments.length > 0 && (
        <div className="rounded-lg border border-border bg-secondary/20 px-5 py-3 text-xs text-muted-foreground">
          Menampilkan <span className="font-semibold text-foreground">{filteredDocuments.length}</span>{query ? ` dari ${documents.length}` : ''} baris file
        </div>
      )}

      {viewing && <DocumentViewModal open={Boolean(viewing)} onClose={() => setViewing(null)} filePath={viewing.file_path} fileName={viewing.title} />}
      <FormCsFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={loadDocuments} category={category} title={title} document={editableDocument} />
      <FormCsGroupHeaderModal open={groupHeaderModalOpen} onClose={() => setGroupHeaderModalOpen(false)} onSaved={loadDocuments} category={category} groupHeaders={groupHeaders} />
      <ConfirmDialog
        open={!!pendingDelete}
        title="Hapus dokumen?"
        message={`Dokumen "${pendingDelete?.title}"${pendingDelete?.file_variant ? ` (${pendingDelete.file_variant})` : ''} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
