'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ClipboardCheck, Download, Eye, EyeOff, FileText, Globe, Loader2, Pencil, Plus, QrCode, Search, Trash2, Upload, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { BlueprintHero, HazardHero, IndexHero, latestUpload } from '@/components/page-hero'
import { DOC_KIND_INFO, type DocKind } from '@/lib/document-kinds'
import { API_BASE_PATH } from '@/lib/config'
import { TableSkeletonRows } from '@/components/documents/TableSkeleton'
import { EmptyState } from '@/components/documents/EmptyState'
import { onRowClick } from '@/lib/row-click'
import { toast } from '@/components/toast'
import { DocumentViewModal } from '@/components/documents/DocumentViewModal'
import { ProcedureFormModal, type EditableProcedure } from '@/components/documents/ProcedureFormModal'
import { ResubmitDialog } from '@/components/documents/ResubmitDialog'
import { ReviewFormModal } from '@/components/documents/ReviewFormModal'
import { NO_HEAD_CLASS, OrderCell, ReorderHint, moveItem, useDragReorder } from '@/components/documents/RowReorder'
import { ProcedureApprovalCell, type ApprovalStep } from '@/components/documents/ProcedureApprovalCell'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormReviewOverview } from '@/components/documents/FormReviewOverview'
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
  /** Admin's choice: show this document to visitors once it is final. */
  public_visible: boolean
  approvals: ApprovalStep[]
  slots_count: number
  // Earlier files kept + revision requests ("Riwayat revisi").
  history_count?: number
  /** Prosedur ISMS / TMMIN: its Form Review, signed by the same approval. */
  review_form_path?: string | null
}

type StatusFilter = 'all' | 'published' | 'hidden' | 'pending' | 'approved' | 'rejected' | 'none'

// Admin only — visitors get just the published documents from the API.
// "published" = what visitors see: final (fully approved, or needs no
// approval) and not hidden by the admin. "hidden" = final but switched off.
const STATUS_FILTERS: { id: StatusFilter; label: string; hint?: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'published', label: 'Tampil ke pengunjung', hint: 'Sudah final dan dipilih admin untuk ditampilkan' },
  { id: 'hidden', label: 'Disembunyikan', hint: 'Sudah final, tetapi disembunyikan admin dari pengunjung' },
  { id: 'approved', label: 'Disahkan semua' },
  { id: 'pending', label: 'Menunggu' },
  { id: 'rejected', label: 'Perlu Revisi' },
  { id: 'none', label: 'Tanpa pengesahan' },
]

// Final = every approver approved it, or it needs no approval.
const isFinal = (document: { approval_status: string }) => document.approval_status === 'approved' || document.approval_status === 'none'
const isPublished = (document: { approval_status: string; public_visible: boolean }) => isFinal(document) && document.public_visible
const isHidden = (document: { approval_status: string; public_visible: boolean }) => isFinal(document) && !document.public_visible

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

// One register for every kind of document that goes through e-sign approval
// (Prosedur ISMS, Working Standard): same table, same approval column, same
// admin tools — only the hero, the wording and the list API differ.
// A document still being signed has no Eff Date yet: it becomes the day the
// last of its ticked approvers approves (one ticked → that approval; several →
// the last of them). Until then the register says so instead of a date.
const effDateWaiting = (document: { approval_status: string }) => document.approval_status === 'pending' || document.approval_status === 'rejected'

export function ProcedureRegisterPage({ kind = 'procedure' }: { kind?: DocKind }) {
  const kindInfo = DOC_KIND_INFO[kind]
  const listApi = `${API_BASE_PATH}${kindInfo.api}`
  const { isLoggedIn, adminUser } = useAuth()
  const isIsmsAdmin = adminUser?.role === 'ism_admin'
  const [documents, setDocuments] = useState<ProcedureDocument[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [verifyBase, setVerifyBase] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  // ?q= prefills the search (links in the admin emails and the bell open the
  // register already filtered to their document) — also when already here.
  const searchParams = useSearchParams()
  const qParam = searchParams.get('q')
  useEffect(() => {
    if (qParam) setQuery(qParam)
  }, [qParam])
  // Form Review is uploaded like the other registers. A form that was filled
  // in on the portal (before that) is still edited in its form (ReviewFormModal).
  const isReviewForm = kind === 'review_form'
  const [reviewForm, setReviewForm] = useState<{ editId?: number; notice?: string | null } | null>(null)
  const reviewBack = DOC_KIND_INFO[searchParams.get('from') === 'tmmin_standard' ? 'tmmin_standard' : 'procedure']
  const [viewing, setViewing] = useState<ProcedureDocument | null>(null)
  // The viewer shows the document's Form Review instead of the document itself.
  const [viewingReview, setViewingReview] = useState(false)
  // Prosedur ISMS / TMMIN: a "Form Review" column beside the document — each
  // document's Form Review & Revisi Dokumen, uploaded right there.
  const hasReviewColumn = kind === 'procedure' || kind === 'tmmin_standard'
  const [reviewUpload, setReviewUpload] = useState<{ document: ProcedureDocument; file: File } | null>(null)
  // "Cek Form Review" (ISM Admin): every document's Form Review and its signing status.
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [reviewUploading, setReviewUploading] = useState(false)
  const uploadReviewForm = async () => {
    if (!reviewUpload) return
    const { document, file } = reviewUpload
    setReviewUploading(true)
    try {
      const form = new FormData()
      form.set('id', String(document.id))
      form.set('controlNo', document.control_no)
      form.set('title', document.title)
      form.set('elfDate', document.elf_date.slice(0, 10))
      form.set('revision', String(document.revision))
      form.set('approvalRoles', JSON.stringify(document.approval_roles))
      form.set('note', document.note ?? '')
      form.set('reviewFile', file)
      const response = await fetch(listApi, { method: 'PUT', body: form })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) { toast(body.message ?? 'Gagal mengunggah Form Review.', 'error'); return }
      toast(body.approvalRestarted ? 'Form Review diunggah — pengesahan dimulai ulang untuk dokumen dan Form Review-nya.' : 'Form Review diunggah.')
      setReviewUpload(null)
      loadDocuments()
    } catch { toast('Gagal mengunggah Form Review.', 'error') } finally { setReviewUploading(false) }
  }
  // true = show the generated signed PDF (QRs stamped), false = the uploaded original
  const [viewingSigned, setViewingSigned] = useState(false)
  const hasSignature = (document: ProcedureDocument) => document.approvals.some((step) => step.status === 'approved' && step.verification_code)
  // Clicking a row: the signed version when there is one, else the uploaded file.
  const openDocument = (document: ProcedureDocument) => { setViewingSigned(hasSignature(document)); setViewing(document) }
  const [editing, setEditing] = useState<ProcedureDocument | null>(null)
  // "Ajukan ulang" after a revision request: upload the fixed file.
  const [resubmitting, setResubmitting] = useState<ProcedureDocument | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ProcedureDocument | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [visibilityBusy, setVisibilityBusy] = useState<Set<number>>(new Set())

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(listApi, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setDocuments(data.documents ?? [])
      setVerifyBase(data.verifyBase ?? `${window.location.origin}${API_BASE_PATH}/verifikasi-pengesahan?code=`)
      setError(null)
    } catch (loadError) {
      setDocuments([])
      setError(loadError instanceof Error ? loadError.message : `Gagal memuat daftar ${kindInfo.label}.`)
    } finally {
      setLoading(false)
    }
  }, [listApi, kindInfo.label])

  // Reload on login/logout: admins also get the documents that aren't published yet.
  useEffect(() => { loadDocuments() }, [loadDocuments, isLoggedIn])

  const filteredDocuments = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return documents.filter((document) =>
      (statusFilter === 'all'
        || (statusFilter === 'published' ? isPublished(document) : statusFilter === 'hidden' ? isHidden(document) : document.approval_status === statusFilter)) &&
      (!keyword || `${document.control_no} ${document.title} ${document.note ?? ''}`.toLowerCase().includes(keyword))
    )
  }, [documents, query, statusFilter])

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: documents.length, published: 0, hidden: 0, pending: 0, approved: 0, rejected: 0, none: 0 }
    for (const document of documents) {
      counts[document.approval_status] = (counts[document.approval_status] ?? 0) + 1
      if (isPublished(document)) counts.published++
      if (isHidden(document)) counts.hidden++
    }
    return counts
  }, [documents])

  const approvalAction = async (document: ProcedureDocument, mode: 'resend' | 'restart') => {
    setBusyId(document.id)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/prosedur-isms/approval/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id, mode }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok) toast(data.message ?? 'Email pengesahan dikirim.')
      else toast(data.message ?? 'Gagal mengirim email pengesahan.', 'error')
      await loadDocuments()
    } catch {
      toast('Tidak dapat menghubungi server.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  // Show / hide documents on the visitors' page (one row's switch, or the selection).
  const setVisibility = async (ids: number[], publicVisible: boolean) => {
    if (ids.length === 0) return
    setVisibilityBusy(new Set(ids))
    try {
      const response = await fetch(listApi, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, publicVisible }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message ?? 'Gagal mengubah tampilan dokumen.')
      setDocuments((current) => current.map((document) => ids.includes(document.id) ? { ...document, public_visible: publicVisible } : document))
      const what = ids.length > 1 ? `${ids.length} dokumen` : (documents.find((document) => document.id === ids[0])?.control_no ?? 'Dokumen')
      toast(`${what} ${publicVisible ? 'ditampilkan ke' : 'disembunyikan dari'} pengunjung.`, publicVisible ? 'success' : 'info')
    } catch (visibilityError) {
      toast(visibilityError instanceof Error ? visibilityError.message : 'Gagal mengubah tampilan dokumen.', 'error')
    } finally {
      setVisibilityBusy(new Set())
    }
  }

  // Working Standard: every QR is placed automatically (the admin may still
  // move them any time). The other registers: placed after each approval.
  const placeBeforeSending = kind === 'working_standard'
  const openAdd = () => { setEditing(null); setFormOpen(true) }
  // A Form Review filled in on the portal is edited in its form; one uploaded as a PDF, like any uploaded document.
  const filledInPortal = async (document: ProcedureDocument) =>
    isReviewForm && await fetch(`${listApi}?form=${document.id}`, { cache: 'no-store' }).then((response) => response.ok).catch(() => false)
  const openEdit = async (document: ProcedureDocument) => {
    if (await filledInPortal(document)) { setReviewForm({ editId: document.id }); return }
    setEditing(document); setFormOpen(true)
  }
  // After "Minta Revisi": an uploaded document gets its fixed file; a review form is corrected in its form.
  const openResubmit = async (document: ProcedureDocument) => {
    if (await filledInPortal(document)) setReviewForm({ editId: document.id, notice: document.approvals.find((step) => step.status === 'rejected')?.decision_note ?? null })
    else setResubmitting(document)
  }
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
    const results = await Promise.all(ids.map((id) => fetch(`${listApi}?id=${id}`, { method: 'DELETE' })))
    const failed = results.filter((r) => !r.ok).length
    if (failed > 0) setError(`${failed} dari ${ids.length} dokumen gagal dihapus.`)
    setSelectedIds(new Set())
    await loadDocuments()
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
  }
  const handleExportCsv = () => {
    downloadExcel(
      `${kindInfo.path.slice(1)}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      ['No.', 'No. Kontrol', 'Nama Dokumen', 'Revisi', 'Eff Date', 'Tanggal Upload', 'Catatan Pengesahan', 'Tampil ke Pengunjung', 'Note Dokumen'],
      filteredDocuments.map((d) => [rowNumbers.get(d.title) ?? '', d.control_no, d.title, d.revision, effDateWaiting(d) ? 'Menunggu pengesahan' : formatDate(d.elf_date), formatDate(d.uploaded_at), approvalSummary(d), isPublished(d) ? 'Ya' : isHidden(d) ? 'Tidak (disembunyikan)' : 'Tidak (belum final)', d.note ?? ''])
    )
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const response = await fetch(`${listApi}?id=${pendingDelete.id}`, { method: 'DELETE' })
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

  // "No." of each row (documents sharing a title are one row), across pages.
  const rowNumbers = useMemo(() => new Map(groupByTitle(filteredDocuments).map((group, i) => [group.key, i + 1])), [filteredDocuments])

  // The order is the admin's to set (drag a row, or up / down) while the
  // whole register is shown — no search, no status filter.
  const allGroups = useMemo(() => groupByTitle(documents), [documents])
  const canReorder = isIsmsAdmin && !query.trim() && statusFilter === 'all' && allGroups.length > 1
  const moveGroup = async (fromKey: string, to: number) => {
    const from = allGroups.findIndex((g) => g.key === fromKey)
    if (from < 0 || to < 0 || to >= allGroups.length || from === to) return
    const next = moveItem(allGroups, from, to).flatMap((g) => g.docs)
    setDocuments(next) // shown at once; saved in the background
    try {
      const res = await fetch(listApi, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: next.map((d) => d.id) }) })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Gagal menyimpan urutan dokumen.')
    } catch (orderError) {
      toast(orderError instanceof Error ? orderError.message : 'Gagal menyimpan urutan dokumen.', 'error')
      loadDocuments()
    }
  }
  const dragReorder = useDragReorder((fromKey, toKey) => moveGroup(fromKey, allGroups.findIndex((g) => g.key === toKey)))

  const editableDocument: EditableProcedure | undefined = editing ? {
    id: editing.id,
    controlNo: editing.control_no,
    title: editing.title,
    revision: editing.revision,
    elfDate: editing.elf_date.slice(0, 10),
    approvalRoles: editing.approval_roles,
    note: editing.note,
    hasReviewForm: !!editing.review_form_path,
  } : undefined

  return (
    <div className="flex flex-col gap-6">
      {kind === 'tmmin_standard' ? (
        <BlueprintHero
          count={documents.length}
          updatedAt={latestUpload(documents)}
          action={isLoggedIn && <button type="button" onClick={openAdd} className="inline-flex items-center gap-2 rounded-none border border-[color:var(--p-400)] bg-[color:var(--p-400)] px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--p-950)] transition hover:opacity-90"><Plus className="size-4" />Tambah Dokumen</button>}
        />
      ) : kind === 'working_standard' ? (
        <HazardHero
          count={documents.length}
          action={isLoggedIn && <button type="button" onClick={openAdd} className="inline-flex items-center gap-2 rounded-md bg-[color:var(--p-900)] px-4 py-2.5 text-sm font-semibold text-accent shadow-sm transition-transform hover:-translate-y-0.5"><Plus className="size-4" />Tambah Dokumen</button>}
        />
      ) : isReviewForm ? (
        <IndexHero
          eyebrow="(F) — ISMS-F-001-001"
          title="Form Review & Revisi Dokumen"
          description="Form review dan revisi dokumen ISMS (ISMS-F-001-001) — daftar tersendiri, terpisah dari Prosedur ISMS dan standar lainnya."
          count={documents.length}
          countLabel="form review tercatat"
          updatedAt={latestUpload(documents)}
          action={(
            <div className="flex flex-wrap items-center gap-2">
              <Link href={reviewBack.path} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-secondary"><ArrowLeft className="size-4" />{reviewBack.label}</Link>
              {isIsmsAdmin && <button type="button" onClick={openAdd} title="Unggah Form Review (PDF) — tetap disahkan dengan e-sign, QR ditempatkan otomatis" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"><Upload className="size-4" />Upload Form Review</button>}
            </div>
          )}
        />
      ) : (
      <IndexHero
        eyebrow="(P) — Procedure register"
        title="Prosedur ISMS"
        description="Daftar dokumen prosedur ISMS beserta revisi dan tanggal pengendaliannya."
        count={documents.length}
        countLabel="dokumen prosedur terkendali"
        updatedAt={latestUpload(documents)}
        action={isLoggedIn && <button type="button" onClick={openAdd} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"><Plus className="size-4" />Tambah Dokumen</button>}
      />
      )}

      {/* Approval status filter — admins only; visitors see published documents only. */}
      {isLoggedIn && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono-label text-[10px] text-muted-foreground">Pengesahan</span>
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                title={filter.hint}
                onClick={() => setStatusFilter(filter.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${statusFilter === filter.id ? 'border-primary bg-primary text-primary-foreground' : filter.id === 'published' ? 'border-emerald-600/40 text-emerald-700 hover:bg-emerald-600/10' : 'border-border text-muted-foreground hover:text-foreground'}`}
              >
                {filter.label}
                <span className={`rounded-full px-1.5 font-mono text-[10px] ${statusFilter === filter.id ? 'bg-white/20' : 'bg-secondary'}`}>{statusCounts[filter.id]}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Pengunjung hanya melihat dokumen yang <strong className="text-foreground">sudah final</strong> (disahkan semua approver, atau tanpa pengesahan)
            {' '}<strong className="text-foreground">dan Anda pilih untuk ditampilkan</strong> — atur dengan tombol <Globe className="inline size-3.5 text-emerald-700" /> di kolom Aksi, atau centang beberapa dokumen sekaligus.
            Dokumen yang masih menunggu atau perlu revisi tidak pernah tampil ke pengunjung.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div><p className="portal-eyebrow">Controlled library</p><p className="mt-1 text-sm text-muted-foreground">{documents.length} dokumen terdaftar</p></div>
        <div className="flex flex-wrap items-center gap-2 max-[680px]:w-full">
          {isLoggedIn && selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
              <span className="text-xs font-semibold text-foreground">{selectedIds.size} terpilih</span>
              {isIsmsAdmin && <>
                <button type="button" onClick={() => setVisibility(Array.from(selectedIds), true)} disabled={visibilityBusy.size > 0} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"><Globe className="size-3.5" />Tampilkan ke pengunjung</button>
                <button type="button" onClick={() => setVisibility(Array.from(selectedIds), false)} disabled={visibilityBusy.size > 0} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"><EyeOff className="size-3.5" />Sembunyikan</button>
              </>}
              <button type="button" onClick={() => setBulkDeleteOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition hover:opacity-90"><Trash2 className="size-3.5" />Hapus Terpilih</button>
              <button type="button" onClick={() => setSelectedIds(new Set())} aria-label="Batal pilih" className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary"><X className="size-4" /></button>
            </div>
          )}
          {hasReviewColumn && isIsmsAdmin && (
            <button type="button" onClick={() => setOverviewOpen(true)} title="Form Review tiap dokumen Prosedur ISMS & TMMIN dan status pengesahannya" className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10">
              <ClipboardCheck className="size-3.5" />Cek Form Review
            </button>
          )}
          {isLoggedIn && <button type="button" onClick={handleExportCsv} disabled={filteredDocuments.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"><Download className="size-3.5" />Export Excel</button>}
          <div className="relative w-full sm:w-80"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari No. Kontrol atau dokumen..." aria-label={`Cari ${kindInfo.label}`} className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Bersihkan pencarian" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>}</div>
        </div>
      </div>

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {isIsmsAdmin && <div className="-mt-2"><ReorderHint active={!query.trim() && statusFilter === 'all'} /></div>}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="doc-table w-full min-w-[560px] text-sm"><thead className="table-head-gradient"><tr>{isLoggedIn && <th className="w-10 px-5 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="Pilih semua" className="size-4 rounded border-border" /></th>}<th className={NO_HEAD_CLASS}>No.</th>{['No. Kontrol', 'Nama Dokumen', ...(hasReviewColumn ? ['Form Review'] : []), 'Revisi', 'Eff Date', 'Tanggal Upload', 'Catatan Pengesahan', 'Aksi'].map((head) => <th key={head} className={`whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground ${head === 'Eff Date' || head === 'Tanggal Upload' ? 'max-[760px]:hidden' : ''}`}>{head}</th>)}</tr></thead><tbody className="divide-y divide-border">
        {loading && <TableSkeletonRows columns={(isLoggedIn ? 9 : 8) + (hasReviewColumn ? 1 : 0)} />}
        {!loading && filteredDocuments.length === 0 && <tr><td colSpan={hasReviewColumn ? 10 : 9} className="px-5 py-16 text-center"><EmptyState filtered={!!query || statusFilter !== 'all'} onClear={() => { setQuery(''); setStatusFilter('all') }} onAdd={isLoggedIn ? openAdd : undefined} /></td></tr>}
        {groupByTitle(pageItems).map((group, index) => (
          <tr key={group.key} {...(canReorder ? dragReorder.row(group.key) : {})} onClick={(event) => onRowClick(event, () => openDocument(group.docs[0]))} className={`doc-row table-row-glow ${index % 2 ? 'bg-secondary/20' : ''} ${dragReorder.rowClass(group.key)}`}>
            {isLoggedIn && (
              <td data-cell="select" className="px-4 py-4 align-top">
                <div className="flex flex-col gap-1.5">
                  {group.docs.map((document) => <div key={document.id} className="py-0.5"><input type="checkbox" checked={selectedIds.has(document.id)} onChange={() => toggleSelect(document.id)} aria-label={`Pilih ${document.title}`} className="size-4 rounded border-border" /></div>)}
                </div>
              </td>
            )}
            <td data-cell="no" className="px-4 py-4 align-top"><OrderCell
              number={rowNumbers.get(group.key) ?? index + 1}
              label={group.title}
              reorder={canReorder ? (() => {
                const position = allGroups.findIndex((g) => g.key === group.key)
                return { handleProps: dragReorder.handle(group.key), canUp: position > 0, canDown: position < allGroups.length - 1, onUp: () => moveGroup(group.key, position - 1), onDown: () => moveGroup(group.key, position + 1) }
              })() : undefined}
            /></td>
            <td data-cell="code" className="px-4 py-4 align-top font-semibold text-accent-foreground">
              <div className="flex flex-col gap-1.5">
                {group.docs.map((document) => (
                  <div key={document.id} className="whitespace-nowrap py-0.5">
                    <Highlight text={document.control_no} keyword={query} />
                    {isLoggedIn && !isFinal(document) && (
                      <span title="Belum disahkan semua approver — tidak tampil ke pengunjung" className="ml-2 inline-block rounded-full bg-amber-100 align-middle px-2 py-0.5 text-[10px] font-semibold text-amber-800">Belum tampil publik</span>
                    )}
                    {isLoggedIn && isHidden(document) && (
                      <span title="Sudah final, tetapi disembunyikan admin dari pengunjung" className="ml-2 inline-block rounded-full bg-secondary align-middle px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Disembunyikan</span>
                    )}
                  </div>
                ))}
              </div>
            </td>
            <td data-cell="title" className="min-w-[240px] px-4 py-4 align-top">
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
            {hasReviewColumn && (
              <td data-label="Form Review" className="px-4 py-4 align-top">
                <div className="flex flex-col gap-1.5">
                  {group.docs.map((document) => (
                    <div key={document.id} className="flex flex-wrap items-center gap-1.5 py-0.5">
                      {document.review_form_path ? (
                        <button
                          type="button"
                          onClick={() => { setViewingReview(true); setViewingSigned(hasSignature(document)); setViewing(document) }}
                          title={`Form Review & Revisi Dokumen untuk ${document.control_no}`}
                          className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11.5px] font-semibold text-primary transition hover:bg-primary/10"
                        >
                          <ClipboardCheck className="size-3.5" /> Form Review{group.docs.length > 1 ? ` · Rev. ${document.revision}` : ''}
                        </button>
                      ) : !isIsmsAdmin && <span className="text-muted-foreground">–</span>}
                      {isIsmsAdmin && (
                        <label title={document.review_form_path ? 'Ganti Form Review dokumen ini' : 'Unggah Form Review untuk dokumen ini'} className="inline-flex w-fit cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary">
                          <Upload className="size-3" /> {document.review_form_path ? 'Ganti' : 'Unggah Form Review'}
                          <input
                            type="file"
                            accept="application/pdf"
                            aria-label={`Unggah Form Review untuk ${document.control_no}`}
                            className="sr-only"
                            onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) setReviewUpload({ document, file }) }}
                          />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              </td>
            )}
            <td className="px-4 py-4 align-top">
              <div className="flex flex-col gap-1.5">
                {group.docs.map((document) => <div key={document.id} className="whitespace-nowrap py-0.5"><span className="inline-flex rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">Rev. {document.revision}</span></div>)}
              </div>
            </td>
            <td className="px-4 py-4 align-top text-muted-foreground max-[760px]:hidden">
              <div className="flex flex-col gap-1.5">
                {group.docs.map((document) => <div key={document.id} className="whitespace-nowrap py-0.5">{effDateWaiting(document) ? <span className="text-xs italic" title="Eff Date terisi otomatis dengan tanggal persetujuan approver terakhir">Menunggu pengesahan</span> : formatDate(document.elf_date)}</div>)}
              </div>
            </td>
            <td className="px-4 py-4 align-top text-muted-foreground max-[760px]:hidden">
              <div className="flex flex-col gap-1.5">
                {group.docs.map((document) => <div key={document.id} className="whitespace-nowrap py-0.5">{formatDate(document.uploaded_at)}</div>)}
              </div>
            </td>
            <td data-cell="approval" className="px-4 py-4 align-top">
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
                    onRestart={() => openResubmit(document)}
                    slotsCount={document.slots_count}
                    historyCount={document.history_count ?? 0}
                    onSlotsChanged={() => loadDocuments()}
                    placeBeforeSending={placeBeforeSending}
                    hasReviewForm={!!document.review_form_path}
                  />
                ))}
              </div>
            </td>
            <td data-cell="actions" className="px-4 py-4 align-top">
              <div className="flex flex-col gap-1.5">
                {group.docs.map((document) => (
                  <div key={document.id} className="flex items-center gap-1 py-0.5">
                    {hasSignature(document) && !isLoggedIn ? (
                      // Visitors: the final document, QR signatures in place.
                      <button type="button" onClick={() => { setViewingSigned(true); setViewing(document) }} aria-label={`Lihat ${document.title}`} title="Lihat dokumen (bertanda tangan QR)" data-label="Lihat" className="relative grid size-8 place-items-center rounded-md text-emerald-700 hover:bg-emerald-600/10"><Eye className="size-4" /><QrCode className="absolute -right-0.5 -top-0.5 size-3 rounded-sm bg-card" /></button>
                    ) : hasSignature(document) ? (
                      <>
                        <button type="button" onClick={() => { setViewingSigned(true); setViewing(document) }} aria-label={`Lihat ${document.title} bertanda tangan`} title="Lihat dokumen bertanda tangan (QR)" data-label="Ber-QR" className="relative grid size-8 place-items-center rounded-md text-emerald-700 hover:bg-emerald-600/10"><Eye className="size-4" /><QrCode className="absolute -right-0.5 -top-0.5 size-3 rounded-sm bg-card" /></button>
                        <button type="button" onClick={() => { setViewingSigned(false); setViewing(document) }} aria-label={`Lihat file asli ${document.title}`} title="Lihat file asli (tanpa QR)" data-label="Asli" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary"><FileText className="size-4" /></button>
                      </>
                    ) : (
                      <button type="button" onClick={() => { setViewingSigned(false); setViewing(document) }} aria-label={`Lihat ${document.title}`} title="Lihat dokumen" data-label="Lihat" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary"><Eye className="size-4" /></button>
                    )}
                    {isIsmsAdmin && (
                      // Show / hide on the visitors' page. Not final yet → it can't be
                      // public, but the choice is kept for when it is approved.
                      <button
                        type="button"
                        role="switch"
                        data-label={document.public_visible ? 'Tampil' : 'Sembunyi'}
                        aria-checked={document.public_visible}
                        onClick={() => setVisibility([document.id], !document.public_visible)}
                        disabled={visibilityBusy.has(document.id)}
                        aria-label={`Tampilkan ${document.title} ke pengunjung`}
                        title={
                          !document.public_visible ? 'Disembunyikan dari pengunjung — klik untuk menampilkan'
                            : isFinal(document) ? 'Tampil ke pengunjung — klik untuk menyembunyikan'
                              : 'Akan tampil ke pengunjung setelah disahkan semua approver — klik untuk tetap menyembunyikan'
                        }
                        className={`grid size-8 place-items-center rounded-md transition disabled:opacity-50 ${
                          !document.public_visible ? 'text-muted-foreground/60 hover:bg-secondary hover:text-foreground'
                            : isFinal(document) ? 'bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20'
                              : 'text-amber-700 hover:bg-amber-100'
                        }`}
                      >
                        {visibilityBusy.has(document.id) ? <Loader2 className="size-4 animate-spin" /> : document.public_visible ? <Globe className="size-4" /> : <EyeOff className="size-4" />}
                      </button>
                    )}
                    {isLoggedIn && <>
                      <button type="button" onClick={() => openEdit(document)} aria-label={`Edit ${document.title}`} title="Edit dokumen" data-label="Edit" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-accent-foreground"><Pencil className="size-4" /></button>
                      <button type="button" onClick={() => setPendingDelete(document)} aria-label={`Hapus ${document.title}`} title="Hapus dokumen" data-label="Hapus" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" /></button>
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
          onClose={() => { setViewing(null); setViewingReview(false) }}
          filePath={viewingReview && viewing.review_form_path ? viewing.review_form_path : viewing.file_path}
          fileName={viewingReview ? `Form Review — ${viewing.title}` : viewing.title}
          sourceUrl={viewingSigned ? `${API_BASE_PATH}/api/prosedur-isms/${viewing.id}/pdf${viewingReview ? '?part=review' : ''}` : undefined}
          badge={viewingSigned
            ? <span className="flex-none rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">Bertanda tangan (QR)</span>
            : hasSignature(viewing) ? <span className="flex-none rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">File asli</span> : null}
        />
      )}
      {isIsmsAdmin && <FormReviewOverview open={overviewOpen} onClose={() => setOverviewOpen(false)} />}
      <ConfirmDialog
        open={!!reviewUpload}
        title={reviewUpload?.document.review_form_path ? 'Ganti Form Review?' : 'Unggah Form Review?'}
        message={reviewUpload
          ? `${reviewUpload.file.name} untuk ${reviewUpload.document.control_no} — ${reviewUpload.document.title}.${reviewUpload.document.approval_roles.length ? ' Dokumen dan Form Review-nya disahkan bersama, jadi pengesahan dimulai ulang: approver menerima email lagi untuk menyetujui keduanya.' : ''}`
          : ''}
        confirmLabel="Unggah"
        danger={false}
        pending={reviewUploading}
        onConfirm={uploadReviewForm}
        onCancel={() => setReviewUpload(null)}
      />
      <ProcedureFormModal kind={kind} open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => loadDocuments()} document={editableDocument} />
      <ReviewFormModal
        open={!!reviewForm}
        editId={reviewForm?.editId}
        notice={reviewForm?.notice}
        onClose={() => setReviewForm(null)}
        onSaved={(message) => { toast(message); loadDocuments() }}
      />
      {resubmitting && (
        <ResubmitDialog
          kind={kind}
          document={resubmitting}
          revisionNote={resubmitting.approvals.find((step) => step.status === 'rejected')?.decision_note ?? null}
          onClose={() => setResubmitting(null)}
          onDone={(message) => { setResubmitting(null); toast(message); loadDocuments() }}
          onWithoutFile={() => { const target = resubmitting; setResubmitting(null); approvalAction(target, 'restart') }}
        />
      )}
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
