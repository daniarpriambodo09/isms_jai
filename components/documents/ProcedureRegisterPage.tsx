'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, Eye, FileText, Pencil, Plus, QrCode, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { IndexHero, latestUpload } from '@/components/page-hero'
import { API_BASE_PATH } from '@/lib/config'
import { DocumentViewModal } from '@/components/documents/DocumentViewModal'
import { ProcedureFormModal, type EditableProcedure } from '@/components/documents/ProcedureFormModal'
import { ProcedureApprovalCell, type ApprovalStep } from '@/components/documents/ProcedureApprovalCell'
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
  approval_roles: string[]
  note: string | null
  approval_status: 'none' | 'pending' | 'approved' | 'rejected'
  approvals: ApprovalStep[]
  slots_count: number
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'none'

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'pending', label: 'Menunggu' },
  { id: 'approved', label: 'Disahkan' },
  { id: 'rejected', label: 'Perlu Revisi' },
  { id: 'none', label: 'Tanpa pengesahan' },
]

function approvalSummary(document: ProcedureDocument) {
  if (document.approval_roles.length === 0) return '-'
  return document.approvals.map((step) => `${step.role_code}: ${step.approver_name ?? '-'} (${step.status === 'approved' ? `Disetujui ${step.decided_at ? formatDate(step.decided_at) : ''}` : step.status === 'rejected' ? 'Minta revisi' : step.status === 'pending' ? 'Menunggu' : 'Antri'})`).join('; ')
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
  const { isLoggedIn, adminUser } = useAuth()
  const isIsmsAdmin = adminUser?.role === 'ism_admin'
  const [documents, setDocuments] = useState<ProcedureDocument[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [verifyBase, setVerifyBase] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  // ?q= prefills the search (links in the admin emails and the bell open the
  // register already filtered to their document) — also when already here.
  const qParam = useSearchParams().get('q')
  useEffect(() => {
    if (qParam) setQuery(qParam)
  }, [qParam])
  const [viewing, setViewing] = useState<ProcedureDocument | null>(null)
  // true = show the generated signed PDF (QRs stamped), false = the uploaded original
  const [viewingSigned, setViewingSigned] = useState(false)
  const hasSignature = (document: ProcedureDocument) => document.approvals.some((step) => step.status === 'approved' && step.verification_code)
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
      setVerifyBase(data.verifyBase ?? `${window.location.origin}${API_BASE_PATH}/verifikasi-pengesahan?code=`)
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
    return documents.filter((document) =>
      (statusFilter === 'all' || document.approval_status === statusFilter) &&
      (!keyword || `${document.control_no} ${document.title} ${document.note ?? ''}`.toLowerCase().includes(keyword))
    )
  }, [documents, query, statusFilter])

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: documents.length, pending: 0, approved: 0, rejected: 0, none: 0 }
    for (const document of documents) counts[document.approval_status] = (counts[document.approval_status] ?? 0) + 1
    return counts
  }, [documents])

  const approvalAction = async (document: ProcedureDocument, mode: 'resend' | 'restart') => {
    setBusyId(document.id)
    setNotice(null)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/prosedur-isms/approval/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id, mode }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok) setNotice(data.message ?? 'Email pengesahan dikirim.')
      else setError(data.message ?? 'Gagal mengirim email pengesahan.')
      await loadDocuments()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setBusyId(null)
    }
  }

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (document: ProcedureDocument) => { setEditing(document); setFormOpen(true) }
  const { page, setPage, totalPages, pageItems, pageSize } = usePagination(filteredDocuments, 20)
  useEffect(() => { setPage(1) }, [query, statusFilter, setPage])

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
      ['No. Kontrol', 'Nama Dokumen', 'Revisi', 'Eff Date', 'Tanggal Upload', 'Catatan Pengesahan', 'Note Dokumen'],
      filteredDocuments.map((d) => [d.control_no, d.title, d.revision, formatDate(d.elf_date), formatDate(d.uploaded_at), approvalSummary(d), d.note ?? ''])
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
    approvalRoles: editing.approval_roles,
    note: editing.note,
  } : undefined

  return (
    <div className="flex flex-col gap-6">
      <IndexHero
        eyebrow="(P) — Procedure register"
        title="Prosedur ISMS"
        description="Daftar dokumen prosedur ISMS beserta revisi dan tanggal pengendaliannya."
        count={documents.length}
        countLabel="dokumen prosedur terkendali"
        updatedAt={latestUpload(documents)}
        action={isLoggedIn && <button type="button" onClick={openAdd} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"><Plus className="size-4" />Tambah Dokumen</button>}
      />

      {/* Approval status filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono-label text-[10px] text-muted-foreground">Pengesahan</span>
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setStatusFilter(filter.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${statusFilter === filter.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
          >
            {filter.label}
            <span className={`rounded-full px-1.5 font-mono text-[10px] ${statusFilter === filter.id ? 'bg-white/20' : 'bg-secondary'}`}>{statusCounts[filter.id]}</span>
          </button>
        ))}
      </div>

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
      {notice && <p className="rounded-lg border border-emerald-600/20 bg-emerald-600/10 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="table-head-gradient"><tr>{isLoggedIn && <th className="w-10 px-5 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="Pilih semua" className="size-4 rounded border-border" /></th>}{['No. Kontrol', 'Nama Dokumen', 'Revisi', 'Eff Date', 'Tanggal Upload', 'Catatan Pengesahan', 'Aksi'].map((head, i) => <th key={head} className={`whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground ${i === 3 || i === 4 ? 'max-[760px]:hidden' : ''}`}>{head}</th>)}</tr></thead><tbody className="divide-y divide-border">
        {loading && <tr><td colSpan={8}className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat dokumen...</p></td></tr>}
        {!loading && filteredDocuments.length === 0 && <tr><td colSpan={8}className="px-5 py-16 text-center"><FileText className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">{query || statusFilter !== 'all' ? 'Tidak ada dokumen yang cocok' : 'Belum ada dokumen'}</p></td></tr>}
        {groupByTitle(pageItems).map((group, index) => (
          <tr key={group.key} className={`table-row-glow ${index % 2 ? 'bg-secondary/20' : ''}`}>
            {isLoggedIn && (
              <td className="px-4 py-4 align-top">
                <div className="flex flex-col gap-1.5">
                  {group.docs.map((document) => <div key={document.id} className="py-0.5"><input type="checkbox" checked={selectedIds.has(document.id)} onChange={() => toggleSelect(document.id)} aria-label={`Pilih ${document.title}`} className="size-4 rounded border-border" /></div>)}
                </div>
              </td>
            )}
            <td className="px-4 py-4 align-top font-semibold text-accent-foreground">
              <div className="flex flex-col gap-1.5">
                {group.docs.map((document) => <div key={document.id} className="whitespace-nowrap py-0.5"><Highlight text={document.control_no} keyword={query} /></div>)}
              </div>
            </td>
            <td className="min-w-[240px] px-4 py-4 align-top">
              <div className="flex items-start gap-3 font-medium text-foreground">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/20 text-accent-foreground"><FileText className="size-4" /></span>
                <div className="min-w-0 pt-1.5">
                  <Highlight text={group.title} keyword={query} />
                  {group.docs.filter((document) => document.note).map((document) => (
                    <p key={document.id} className="mt-1.5 text-xs font-normal leading-5 text-muted-foreground">
                      <span className="font-semibold text-foreground/70">Note:</span> <Highlight text={document.note ?? ''} keyword={query} />
                    </p>
                  ))}
                </div>
              </div>
            </td>
            <td className="px-4 py-4 align-top">
              <div className="flex flex-col gap-1.5">
                {group.docs.map((document) => <div key={document.id} className="whitespace-nowrap py-0.5"><span className="inline-flex rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">Rev. {document.revision}</span></div>)}
              </div>
            </td>
            <td className="px-4 py-4 align-top text-muted-foreground max-[760px]:hidden">
              <div className="flex flex-col gap-1.5">
                {group.docs.map((document) => <div key={document.id} className="whitespace-nowrap py-0.5">{formatDate(document.elf_date)}</div>)}
              </div>
            </td>
            <td className="px-4 py-4 align-top text-muted-foreground max-[760px]:hidden">
              <div className="flex flex-col gap-1.5">
                {group.docs.map((document) => <div key={document.id} className="whitespace-nowrap py-0.5">{formatDate(document.uploaded_at)}</div>)}
              </div>
            </td>
            <td className="px-4 py-4 align-top">
              <div className="flex flex-col gap-3">
                {group.docs.map((document) => (
                  <ProcedureApprovalCell
                    key={document.id}
                    documentId={document.id}
                    documentLabel={`${document.control_no} — ${document.title} (Rev. ${document.revision})`}
                    verifyBase={verifyBase}
                    roles={document.approval_roles}
                    steps={document.approvals}
                    status={document.approval_status}
                    isAdmin={isIsmsAdmin}
                    busy={busyId === document.id}
                    onResend={() => approvalAction(document, 'resend')}
                    onRestart={() => approvalAction(document, 'restart')}
                    slotsCount={document.slots_count}
                    onSlotsChanged={() => loadDocuments()}
                  />
                ))}
              </div>
            </td>
            <td className="px-4 py-4 align-top">
              <div className="flex flex-col gap-1.5">
                {group.docs.map((document) => (
                  <div key={document.id} className="flex items-center gap-1 py-0.5">
                    {hasSignature(document) ? (
                      <>
                        <button type="button" onClick={() => { setViewingSigned(true); setViewing(document) }} aria-label={`Lihat ${document.title} bertanda tangan`} title="Lihat dokumen bertanda tangan (QR)" className="relative grid size-8 place-items-center rounded-md text-emerald-700 hover:bg-emerald-600/10"><Eye className="size-4" /><QrCode className="absolute -right-0.5 -top-0.5 size-3 rounded-sm bg-card" /></button>
                        <button type="button" onClick={() => { setViewingSigned(false); setViewing(document) }} aria-label={`Lihat file asli ${document.title}`} title="Lihat file asli (tanpa QR)" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary"><FileText className="size-4" /></button>
                      </>
                    ) : (
                      <button type="button" onClick={() => { setViewingSigned(false); setViewing(document) }} aria-label={`Lihat ${document.title}`} title="Lihat dokumen" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary"><Eye className="size-4" /></button>
                    )}
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

      {viewing && (
        <DocumentViewModal
          open={Boolean(viewing)}
          onClose={() => setViewing(null)}
          filePath={viewing.file_path}
          fileName={viewing.title}
          sourceUrl={viewingSigned ? `${API_BASE_PATH}/api/prosedur-isms/${viewing.id}/pdf` : undefined}
          badge={viewingSigned
            ? <span className="flex-none rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">Bertanda tangan (QR)</span>
            : hasSignature(viewing) ? <span className="flex-none rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">File asli</span> : null}
        />
      )}
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
