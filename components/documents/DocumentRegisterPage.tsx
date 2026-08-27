'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, FileText, FolderOpen, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { DocumentViewModal } from '@/components/documents/DocumentViewModal'
import { DocumentFormModal, type EditableDocument } from '@/components/documents/DocumentFormModal'

type ApiDocument = { id: number; title: string; revision: number; file_path: string; uploaded_at: string }
type DepartmentInfo = { id: number; name: string; slug: string }
type SectionInfo = { id: number; name: string; slug: string }

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword.trim()) return <>{text}</>
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return <>{text.split(regex).map((part, i) => regex.test(part) ? <mark key={i} className="rounded-sm bg-accent/35 px-1 text-accent-foreground">{part}</mark> : <span key={i}>{part}</span>)}</>
}

export function DocumentRegisterPage({ department, section }: { department: DepartmentInfo; section: SectionInfo | null }) {
  const { isLoggedIn } = useAuth()
  const [docs, setDocs] = useState<ApiDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState<ApiDocument | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ApiDocument | null>(null)

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

  const handleDelete = async (doc: ApiDocument) => {
    if (!confirm(`Hapus dokumen "${doc.title}"?`)) return
    try { if ((await fetch(`${API_BASE_PATH}/api/documents/${doc.id}`, { method: 'DELETE' })).ok) loadDocuments() } catch { /* no-op */ }
  }
  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (doc: ApiDocument) => { setEditing(doc); setFormOpen(true) }

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-[1.25rem] border border-border bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/10 sm:p-8">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2 text-xs text-primary-foreground/65"><FolderOpen className="size-4" /> Document register <span className="text-primary-foreground/35">/</span> {department.name}</div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{section ? section.name : department.name}</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/72">Kumpulan dokumen terkendali untuk {section ? `section ${section.name}` : `departemen ${department.name}`}.</p>
          </div>
          {isLoggedIn && <button type="button" onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5"><Plus /> Tambah Dokumen</button>}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div><p className="portal-eyebrow">Controlled library</p><p className="mt-1 text-sm text-muted-foreground">{docs.length} dokumen terdaftar</p></div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama dokumen..." aria-label="Cari nama dokumen" className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Bersihkan pencarian" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
          <thead className="bg-secondary/55"><tr>{['Tanggal Upload', 'Nama Dokumen', 'Revisi', 'Aksi'].map((head) => <th key={head} className="whitespace-nowrap px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{head}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {loading && <tr><td colSpan={4} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat dokumen...</p></td></tr>}
            {!loading && filteredDocs.length === 0 && <tr><td colSpan={4} className="px-5 py-16 text-center"><FileText className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">{hasFilter ? 'Tidak ada dokumen yang cocok' : 'Belum ada dokumen'}</p>{hasFilter && <button onClick={() => setQuery('')} className="mt-2 text-xs font-semibold text-primary hover:underline">Hapus pencarian</button>}</td></tr>}
            {filteredDocs.map((doc, index) => <tr key={doc.id} className={index % 2 ? 'bg-secondary/20' : ''}><td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{formatDate(doc.uploaded_at)}</td><td className="min-w-[260px] px-5 py-4"><div className="flex items-center gap-3 font-medium text-foreground"><span className="grid size-9 place-items-center rounded-lg bg-accent/20 text-accent-foreground"><FileText className="size-4" /></span><Highlight text={doc.title} keyword={query} /></div></td><td className="px-5 py-4"><span className="inline-flex rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">Rev. {doc.revision}</span></td><td className="px-5 py-4"><div className="flex items-center gap-1"><button type="button" onClick={() => setViewing(doc)} aria-label={`Lihat ${doc.title}`} title="Lihat dokumen" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary"><Eye className="size-4" /></button>{isLoggedIn && <><button type="button" onClick={() => openEdit(doc)} aria-label={`Edit ${doc.title}`} title="Edit dokumen" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-accent-foreground"><Pencil className="size-4" /></button><button type="button" onClick={() => handleDelete(doc)} aria-label={`Hapus ${doc.title}`} title="Hapus dokumen" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" /></button></>}</div></td></tr>)}
          </tbody>
        </table></div>
        {!loading && filteredDocs.length > 0 && <div className="border-t border-border bg-secondary/20 px-5 py-3 text-xs text-muted-foreground">Menampilkan <span className="font-semibold text-foreground">{filteredDocs.length}</span>{hasFilter ? ` dari ${docs.length}` : ''} dokumen</div>}
      </div>

      {viewing && <DocumentViewModal open={Boolean(viewing)} onClose={() => setViewing(null)} filePath={viewing.file_path} fileName={viewing.title} />}
      <DocumentFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={loadDocuments} departmentId={department.id} sectionId={section?.id ?? null} document={editableDocument} />
    </div>
  )
}
