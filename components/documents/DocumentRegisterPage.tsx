// components/documents/DocumentRegisterPage.tsx

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Eye, FileText, GripVertical, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { FolderHero } from '@/components/page-hero'
import { API_BASE_PATH } from '@/lib/config'
import { TableSkeletonRows } from '@/components/documents/TableSkeleton'
import { EmptyState } from '@/components/documents/EmptyState'
import { onRowClick } from '@/lib/row-click'
import { DocumentViewModal } from '@/components/documents/DocumentViewModal'
import { DocumentFormModal, type EditableDocument } from '@/components/documents/DocumentFormModal'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/components/pagination'
import { downloadExcel } from '@/lib/excel-export'
import { useSearchQueryParam } from '@/hooks/useSearchQueryParam'
import { NO_HEAD_CLASS, OrderCell, moveItem, useDragReorder } from '@/components/documents/RowReorder'
import { toast } from '@/components/toast'

type ApiDocument = { id: number; title: string; revision: string; file_path: string; uploaded_at: string }
type SectionInfo = { id: number; name: string; slug: string }
type DepartmentInfo = { id: number; name: string; slug: string; sections: SectionInfo[] }

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword.trim()) return <>{text}</>
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return <>{text.split(regex).map((part, i) => regex.test(part) ? <mark key={i} className="rounded-sm bg-accent/35 px-1 text-accent-foreground">{part}</mark> : <span key={i}>{part}</span>)}</>
}

type TitleGroup = { key: string; title: string; docs: ApiDocument[] }

// Two documents occasionally share the exact same title — grouping by title
// collapses the repeated title into a single line with every matching
// revision/date/action listed together.
function groupByTitle(docs: ApiDocument[]): TitleGroup[] {
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

export function DocumentRegisterPage({ department, section }: { department: DepartmentInfo; section: SectionInfo | null }) {
  const { isLoggedIn } = useAuth()
  const [docs, setDocs] = useState<ApiDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  useSearchQueryParam(setQuery)
  const [viewing, setViewing] = useState<ApiDocument | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ApiDocument | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ApiDocument | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ department: department.slug })
    if (section) params.set('section', section.slug)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/documents?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      setDocs(data.documents ?? [])
    } catch { setDocs([]) } finally { setLoading(false) }
  }, [department.slug, section])

  useEffect(() => { loadDocuments() }, [loadDocuments])
  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? docs.filter((doc) => doc.title.toLowerCase().includes(q)) : docs
  }, [docs, query])
  const hasFilter = query.trim() !== ''
  const editableDocument: EditableDocument | undefined = editing ? { id: editing.id, title: editing.title, revision: editing.revision, uploadedAt: editing.uploaded_at.slice(0, 10) } : undefined
  const { page, setPage, totalPages, pageItems, pageSize } = usePagination(filteredDocs, 20)
  useEffect(() => { setPage(1) }, [query, setPage])

  // The list in rows (documents sharing a title are one row) — numbered, and
  // arranged by hand by the admin while no search narrows it.
  const allGroups = useMemo(() => groupByTitle(docs), [docs])
  const shownGroups = useMemo(() => groupByTitle(filteredDocs), [filteredDocs])
  const canReorder = isLoggedIn && !hasFilter && allGroups.length > 1
  const moveGroup = async (fromKey: string, to: number) => {
    const from = allGroups.findIndex((g) => g.key === fromKey)
    if (from < 0 || to < 0 || to >= allGroups.length || from === to) return
    const next = moveItem(allGroups, from, to).flatMap((g) => g.docs)
    setDocs(next) // shown at once; saved in the background
    try {
      const res = await fetch(`${API_BASE_PATH}/api/documents`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: next.map((d) => d.id) }) })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Gagal menyimpan urutan dokumen.')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Gagal menyimpan urutan dokumen.', 'error')
      loadDocuments()
    }
  }
  const dragReorder = useDragReorder((fromKey, toKey) => moveGroup(fromKey, allGroups.findIndex((g) => g.key === toKey)))

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try { if ((await fetch(`${API_BASE_PATH}/api/documents/${pendingDelete.id}`, { method: 'DELETE' })).ok) loadDocuments() } catch { /* no-op */ }
    setDeleting(false)
    setPendingDelete(null)
  }
  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (doc: ApiDocument) => { setEditing(doc); setFormOpen(true) }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  const allVisibleSelected = filteredDocs.length > 0 && filteredDocs.every((d) => selectedIds.has(d.id))
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) filteredDocs.forEach((d) => next.delete(d.id))
      else filteredDocs.forEach((d) => next.add(d.id))
      return next
    })
  }
  const confirmBulkDelete = async () => {
    setBulkDeleting(true)
    const ids = Array.from(selectedIds)
    const results = await Promise.all(ids.map((id) => fetch(`${API_BASE_PATH}/api/documents/${id}`, { method: 'DELETE' })))
    const failed = results.filter((r) => !r.ok).length
    if (failed > 0) console.error(`${failed} dari ${ids.length} dokumen gagal dihapus.`)
    setSelectedIds(new Set())
    await loadDocuments()
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
  }
  const handleExportCsv = () => {
    downloadExcel(
      `dokumen-${department.slug}${section ? `-${section.slug}` : ''}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      ['No.', 'Nama Dokumen', 'Revisi', 'Tanggal Upload'],
      filteredDocs.map((d) => [shownGroups.findIndex((g) => g.key === d.title) + 1, d.title, d.revision, formatDate(d.uploaded_at)])
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <FolderHero
        department={department}
        section={section}
        count={docs.length}
        action={isLoggedIn && <button type="button" onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5"><Plus className="size-4" /> Tambah Dokumen</button>}
      />

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div><p className="portal-eyebrow">Controlled library</p><p className="mt-1 text-sm text-muted-foreground">{docs.length} dokumen terdaftar</p></div>
        <div className="flex flex-wrap items-center gap-2 max-[680px]:w-full">
          {isLoggedIn && selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
              <span className="text-xs font-semibold text-foreground">{selectedIds.size} terpilih</span>
              <button type="button" onClick={() => setBulkDeleteOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition hover:opacity-90"><Trash2 className="size-3.5" />Hapus Terpilih</button>
              <button type="button" onClick={() => setSelectedIds(new Set())} aria-label="Batal pilih" className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary"><X className="size-4" /></button>
            </div>
          )}
          {isLoggedIn && <button type="button" onClick={handleExportCsv} disabled={filteredDocs.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"><Download className="size-3.5" />Export Excel</button>}
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama dokumen..." aria-label="Cari nama dokumen" className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Bersihkan pencarian" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>}
          </div>
        </div>
      </div>

      {isLoggedIn && (
        <p className="-mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <GripVertical className="mt-0.5 size-3.5 flex-none" />
          {!hasFilter
            ? <span>Urutan bisa diatur: tarik baris lewat ikon <strong className="text-foreground">⋮⋮</strong> di kolom No., atau pakai panah naik/turun. Dokumen baru masuk di paling bawah.</span>
            : <span>Kosongkan pencarian/filter untuk mengatur urutan dokumen.</span>}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto"><table className="doc-table w-full min-w-[560px] text-sm">
          <thead className="table-head-gradient"><tr>{isLoggedIn && <th className="w-10 px-5 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="Pilih semua" className="size-4 rounded border-border" /></th>}<th className={NO_HEAD_CLASS}>No.</th>{['Tanggal Upload', 'Nama Dokumen', 'Revisi', 'Aksi'].map((head, i) => <th key={head} className={`whitespace-nowrap px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground ${i === 0 ? 'max-[560px]:hidden' : ''}`}>{head}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {loading && <TableSkeletonRows columns={isLoggedIn ? 6 : 5} />}
            {!loading && filteredDocs.length === 0 && <tr><td colSpan={6} className="px-5 py-16 text-center"><EmptyState filtered={hasFilter} onClear={() => setQuery('')} onAdd={isLoggedIn ? openAdd : undefined} /></td></tr>}
            {groupByTitle(pageItems).map((group, index) => {
              const position = shownGroups.findIndex((g) => g.key === group.key)
              return (
              <tr key={group.key} {...(canReorder ? dragReorder.row(group.key) : {})} onClick={(event) => onRowClick(event, () => setViewing(group.docs[0]))} className={`doc-row table-row-glow ${index % 2 ? 'bg-secondary/20' : ''} ${dragReorder.rowClass(group.key)}`}>
                {isLoggedIn && (
                  <td data-cell="select" className="px-5 py-4 align-top">
                    <div className="flex flex-col gap-1.5">
                      {group.docs.map((doc) => <div key={doc.id} className="py-0.5"><input type="checkbox" checked={selectedIds.has(doc.id)} onChange={() => toggleSelect(doc.id)} aria-label={`Pilih ${doc.title}`} className="size-4 rounded border-border" /></div>)}
                    </div>
                  </td>
                )}
                <td data-cell="no" className="px-4 py-4 align-top">
                  <OrderCell
                    number={position + 1}
                    label={group.title}
                    reorder={canReorder ? { handleProps: dragReorder.handle(group.key), canUp: position > 0, canDown: position < allGroups.length - 1, onUp: () => moveGroup(group.key, position - 1), onDown: () => moveGroup(group.key, position + 1) } : undefined}
                  />
                </td>
                <td className="px-5 py-4 align-top text-muted-foreground max-[560px]:hidden">
                  <div className="flex flex-col gap-1.5">
                    {group.docs.map((doc) => <div key={doc.id} className="whitespace-nowrap py-0.5">{formatDate(doc.uploaded_at)}</div>)}
                  </div>
                </td>
                <td data-cell="title" className="min-w-[260px] px-5 py-4 align-top">
                  <div className="flex items-center gap-3 font-medium text-foreground">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/20 text-accent-foreground"><FileText className="size-4" /></span>
                    <Highlight text={group.title} keyword={query} />
                  </div>
                </td>
                <td className="px-5 py-4 align-top">
                  <div className="flex flex-col gap-1.5">
                    {group.docs.map((doc) => <div key={doc.id} className="py-0.5"><span className="inline-flex rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">{doc.revision?.trim() ? doc.revision : '—'}</span></div>)}
                  </div>
                </td>
                <td data-cell="actions" className="px-5 py-4 align-top">
                  <div className="flex flex-col gap-1.5">
                    {group.docs.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-1 py-0.5">
                        <button type="button" onClick={() => setViewing(doc)} aria-label={`Lihat ${doc.title}`} title="Lihat dokumen" data-label="Lihat" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary"><Eye className="size-4" /></button>
                        {isLoggedIn && <>
                          <button type="button" onClick={() => openEdit(doc)} aria-label={`Edit ${doc.title}`} title="Edit dokumen" data-label="Edit" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-accent-foreground"><Pencil className="size-4" /></button>
                          <button type="button" onClick={() => setPendingDelete(doc)} aria-label={`Hapus ${doc.title}`} title="Hapus dokumen" data-label="Hapus" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" /></button>
                        </>}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table></div>
        {!loading && filteredDocs.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredDocs.length} pageSize={pageSize} />
        )}
      </div>

      {viewing && <DocumentViewModal open={Boolean(viewing)} onClose={() => setViewing(null)} filePath={viewing.file_path} fileName={viewing.title} />}
      <DocumentFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={loadDocuments} departmentId={department.id} sectionId={section?.id ?? null} document={editableDocument} />
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
