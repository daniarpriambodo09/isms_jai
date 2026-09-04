'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, FileText, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { DocumentViewModal } from '@/components/documents/DocumentViewModal'
import { ProcedureFormModal, type EditableProcedure } from '@/components/documents/ProcedureFormModal'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/components/pagination'

type ProcedureDocument = {
  id: number
  control_no: string
  title: string
  revision: number
  elf_date: string
  uploaded_at: string
  file_path: string
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword.trim()) return <>{text}</>
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return <>{text.split(regex).map((part, index) => regex.test(part) ? <mark key={index} className="rounded-sm bg-accent/35 px-1 text-accent-foreground">{part}</mark> : <span key={index}>{part}</span>)}</>
}

export function ProcedureRegisterPage() {
  const { isLoggedIn } = useAuth()
  const [documents, setDocuments] = useState<ProcedureDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState<ProcedureDocument | null>(null)
  const [editing, setEditing] = useState<ProcedureDocument | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ProcedureDocument | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/prosedur-isms`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setDocuments(data.documents ?? [])
      setError(null)
    } catch (loadError) {
      setDocuments([])
      setError(loadError instanceof Error ? loadError.message : 'Gagal memuat daftar prosedur ISMS.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDocuments() }, [loadDocuments])

  const filteredDocuments = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return documents
    return documents.filter((document) => `${document.control_no} ${document.title}`.toLowerCase().includes(keyword))
  }, [documents, query])

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (document: ProcedureDocument) => { setEditing(document); setFormOpen(true) }
  const { page, setPage, totalPages, pageItems, pageSize } = usePagination(filteredDocuments, 20)
  useEffect(() => { setPage(1) }, [query, setPage])

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/prosedur-isms?id=${pendingDelete.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message ?? 'Gagal menghapus dokumen.')
        setDeleting(false)
        setPendingDelete(null)
        return
      }
      await loadDocuments()
    } catch {
      setError('Tidak dapat menghubungi server.')
    }
    setDeleting(false)
    setPendingDelete(null)
  }

  const editableDocument: EditableProcedure | undefined = editing ? {
    id: editing.id,
    controlNo: editing.control_no,
    title: editing.title,
    elfDate: editing.elf_date.slice(0, 10),
  } : undefined

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-[1.25rem] border border-border bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/10 sm:p-8">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2 text-xs text-primary-foreground/65"><FileText className="size-4" /> Document register</div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Prosedur ISMS</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/72">Daftar dokumen prosedur ISMS beserta revisi dan tanggal pengendaliannya.</p>
          </div>
          {isLoggedIn && <button type="button" onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5"><Plus className="size-4" />Tambah Dokumen</button>}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div><p className="portal-eyebrow">Controlled library</p><p className="mt-1 text-sm text-muted-foreground">{documents.length} dokumen terdaftar</p></div>
        <div className="relative w-full sm:w-80"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari No. Kontrol atau dokumen..." aria-label="Cari prosedur ISMS" className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Bersihkan pencarian" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>}</div>
      </div>

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="table-head-gradient"><tr>{['No. Kontrol', 'Nama Dokumen', 'Revisi', 'Elf Date', 'Tanggal Upload', 'Aksi'].map((head, i) => <th key={head} className={`whitespace-nowrap px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground ${i === 3 || i === 4 ? 'max-[760px]:hidden' : ''}`}>{head}</th>)}</tr></thead><tbody className="divide-y divide-border">
        {loading && <tr><td colSpan={6} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat dokumen...</p></td></tr>}
        {!loading && filteredDocuments.length === 0 && <tr><td colSpan={6} className="px-5 py-16 text-center"><FileText className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">{query ? 'Tidak ada dokumen yang cocok' : 'Belum ada dokumen'}</p></td></tr>}
        {pageItems.map((document, index) => <tr key={document.id} className={`table-row-glow ${index % 2 ? 'bg-secondary/20' : ''}`}><td className="whitespace-nowrap px-5 py-4 font-semibold text-accent-foreground"><Highlight text={document.control_no} keyword={query} /></td><td className="min-w-[280px] px-5 py-4"><div className="flex items-center gap-3 font-medium text-foreground"><span className="grid size-9 place-items-center rounded-lg bg-accent/20 text-accent-foreground"><FileText className="size-4" /></span><Highlight text={document.title} keyword={query} /></div></td><td className="whitespace-nowrap px-5 py-4"><span className="inline-flex rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">Rev. {document.revision}</span></td><td className="whitespace-nowrap px-5 py-4 text-muted-foreground max-[760px]:hidden">{formatDate(document.elf_date)}</td><td className="whitespace-nowrap px-5 py-4 text-muted-foreground max-[760px]:hidden">{formatDate(document.uploaded_at)}</td><td className="px-5 py-4"><div className="flex items-center gap-1"><button type="button" onClick={() => setViewing(document)} aria-label={`Lihat ${document.title}`} title="Lihat dokumen" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary"><Eye className="size-4" /></button>{isLoggedIn && <><button type="button" onClick={() => openEdit(document)} aria-label={`Edit ${document.title}`} title="Edit dokumen" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-accent-foreground"><Pencil className="size-4" /></button><button type="button" onClick={() => setPendingDelete(document)} aria-label={`Hapus ${document.title}`} title="Hapus dokumen" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" /></button></>}</div></td></tr>)}
      </tbody></table></div>
        {!loading && filteredDocuments.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredDocuments.length} pageSize={pageSize} />
        )}
      </div>

      {viewing && <DocumentViewModal open={Boolean(viewing)} onClose={() => setViewing(null)} filePath={viewing.file_path} fileName={viewing.title} />}
      <ProcedureFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={loadDocuments} document={editableDocument} />
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
