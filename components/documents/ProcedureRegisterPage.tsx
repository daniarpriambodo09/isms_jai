'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Eye, FileText, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { DocumentViewModal } from '@/components/documents/DocumentViewModal'
import { ProcedureFormModal, type EditableProcedure } from '@/components/documents/ProcedureFormModal'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/components/pagination'
import { downloadExcel } from '@/lib/excel-export'

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

type TitleGroup = { key: string; title: string; docs: ProcedureDocument[] }

// Two documents occasionally share the exact same title (e.g. uploaded
// twice by mistake, or genuinely two revisions logged as separate rows) —
// grouping by title collapses the repeated title into a single line with
// every matching control no./revision/date/action listed together, instead
// of the title being repeated once per row.
function groupByTitle(docs: ProcedureDocument[]): TitleGroup[] {
  const map = new Map<string, TitleGroup>()
  const order: string[] = []
  for (const doc of docs) {
    const key = doc.title
    let group = map.get(key)
    if (!group) { group = { key, title: doc.title, docs: [] }; map.set(key, group); order.push(key) }
    group.docs.push(doc)
  }
  return order.map((key) => map.get(key)!)
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

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

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  const allVisibleSelected = filteredDocuments.length > 0 && filteredDocuments.every((d) => selectedIds.has(d.id))
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) filteredDocuments.forEach((d) => next.delete(d.id))
      else filteredDocuments.forEach((d) => next.add(d.id))
      return next
    })
  }
  const confirmBulkDelete = async () => {
    setBulkDeleting(true)
    const ids = Array.from(selectedIds)
    const results = await Promise.all(ids.map((id) => fetch(`${API_BASE_PATH}/api/prosedur-isms?id=${id}`, { method: 'DELETE' })))
    const failed = results.filter((r) => !r.ok).length
    if (failed > 0) setError(`${failed} dari ${ids.length} dokumen gagal dihapus.`)
    setSelectedIds(new Set())
    await loadDocuments()
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
  }
  const handleExportCsv = () => {
    downloadExcel(
      `prosedur-isms-${new Date().toISOString().slice(0, 10)}.xlsx`,
      ['No. Kontrol', 'Nama Dokumen', 'Revisi', 'Eff Date', 'Tanggal Upload'],
      filteredDocuments.map((d) => [d.control_no, d.title, d.revision, formatDate(d.elf_date), formatDate(d.uploaded_at)])
    )
  }

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
    revision: editing.revision,
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
        <div className="flex flex-wrap items-center gap-2">
          {isLoggedIn && selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
              <span className="text-xs font-semibold text-foreground">{selectedIds.size} terpilih</span>
              <button type="button" onClick={() => setBulkDeleteOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition hover:opacity-90"><Trash2 className="size-3.5" />Hapus Terpilih</button>
              <button type="button" onClick={() => setSelectedIds(new Set())} aria-label="Batal pilih" className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary"><X className="size-4" /></button>
            </div>
          )}
          {isLoggedIn && <button type="button" onClick={handleExportCsv} disabled={filteredDocuments.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"><Download className="size-3.5" />Export Excel</button>}
          <div className="relative w-full sm:w-80"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari No. Kontrol atau dokumen..." aria-label="Cari prosedur ISMS" className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Bersihkan pencarian" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>}</div>
        </div>
      </div>

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="table-head-gradient"><tr>{isLoggedIn && <th className="w-10 px-5 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="Pilih semua" className="size-4 rounded border-border" /></th>}{['No. Kontrol', 'Nama Dokumen', 'Revisi', 'Eff Date', 'Tanggal Upload', 'Aksi'].map((head, i) => <th key={head} className={`whitespace-nowrap px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground ${i === 3 || i === 4 ? 'max-[760px]:hidden' : ''}`}>{head}</th>)}</tr></thead><tbody className="divide-y divide-border">
        {loading && <tr><td colSpan={7} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat dokumen...</p></td></tr>}
        {!loading && filteredDocuments.length === 0 && <tr><td colSpan={7} className="px-5 py-16 text-center"><FileText className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">{query ? 'Tidak ada dokumen yang cocok' : 'Belum ada dokumen'}</p></td></tr>}
        {groupByTitle(pageItems).map((group, index) => (
          <tr key={group.key} className={`table-row-glow ${index % 2 ? 'bg-secondary/20' : ''}`}>
            {isLoggedIn && (
              <td className="px-5 py-4 align-top">
                <div className="flex flex-col gap-1.5">
                  {group.docs.map((document) => <div key={document.id} className="py-0.5"><input type="checkbox" checked={selectedIds.has(document.id)} onChange={() => toggleSelect(document.id)} aria-label={`Pilih ${document.title}`} className="size-4 rounded border-border" /></div>)}
                </div>
              </td>
            )}
            <td className="px-5 py-4 align-top font-semibold text-accent-foreground">
              <div className="flex flex-col gap-1.5">
                {group.docs.map((document) => <div key={document.id} className="whitespace-nowrap py-0.5"><Highlight text={document.control_no} keyword={query} /></div>)}
              </div>
            </td>
            <td className="min-w-[280px] px-5 py-4 align-top">
              <div className="flex items-center gap-3 font-medium text-foreground">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/20 text-accent-foreground"><FileText className="size-4" /></span>
                <Highlight text={group.title} keyword={query} />
              </div>
            </td>
            <td className="px-5 py-4 align-top">
              <div className="flex flex-col gap-1.5">
                {group.docs.map((document) => <div key={document.id} className="whitespace-nowrap py-0.5"><span className="inline-flex rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">Rev. {document.revision}</span></div>)}
              </div>
            </td>
            <td className="px-5 py-4 align-top text-muted-foreground max-[760px]:hidden">
              <div className="flex flex-col gap-1.5">
                {group.docs.map((document) => <div key={document.id} className="whitespace-nowrap py-0.5">{formatDate(document.elf_date)}</div>)}
              </div>
            </td>
            <td className="px-5 py-4 align-top text-muted-foreground max-[760px]:hidden">
              <div className="flex flex-col gap-1.5">
                {group.docs.map((document) => <div key={document.id} className="whitespace-nowrap py-0.5">{formatDate(document.uploaded_at)}</div>)}
              </div>
            </td>
            <td className="px-5 py-4 align-top">
              <div className="flex flex-col gap-1.5">
                {group.docs.map((document) => (
                  <div key={document.id} className="flex items-center gap-1 py-0.5">
                    <button type="button" onClick={() => setViewing(document)} aria-label={`Lihat ${document.title}`} title="Lihat dokumen" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary"><Eye className="size-4" /></button>
                    {isLoggedIn && <>
                      <button type="button" onClick={() => openEdit(document)} aria-label={`Edit ${document.title}`} title="Edit dokumen" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-accent-foreground"><Pencil className="size-4" /></button>
                      <button type="button" onClick={() => setPendingDelete(document)} aria-label={`Hapus ${document.title}`} title="Hapus dokumen" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" /></button>
                    </>}
                  </div>
                ))}
              </div>
            </td>
          </tr>
        ))}
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
      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Hapus dokumen terpilih?"
        message={`${selectedIds.size} dokumen akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
        pending={bulkDeleting}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </div>
  )
}
