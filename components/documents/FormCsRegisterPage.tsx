'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Camera, Download, FileSignature, FileText, Fingerprint, Laptop, Plus, Search, Settings2, ShieldAlert, Trash2, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ControlPanelHero, PaperHero } from '@/components/page-hero'
import { API_BASE_PATH } from '@/lib/config'
import { BlockSkeleton } from '@/components/documents/TableSkeleton'
import { DocumentViewModal } from '@/components/documents/DocumentViewModal'
import { FormCsFormModal, type EditableFormCsDocument } from '@/components/documents/FormCsFormModal'
import { FormCsSpreadsheetTable, type FormCsDocument, type FormCsGroupHeader, type FormCsRow } from '@/components/documents/FormCsSpreadsheetTable'
import { FormCsGroupHeaderModal } from '@/components/documents/FormCsGroupHeaderModal'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { VendorRegistrationsPanel } from '@/components/documents/VendorRegistrationsPanel'
import { SpecialAreaFormModal } from '@/components/special-area/SpecialAreaForm'
import { downloadExcel } from '@/lib/excel-export'
import { useSearchQueryParam } from '@/hooks/useSearchQueryParam'
import { moveItem } from '@/lib/ordered-ids'
import { toast } from '@/components/toast'
import { ReorderHint } from '@/components/documents/RowReorder'

type Category = 'form-aplikasi' | 'kontrol-cs'

export function FormCsRegisterPage({ category, title }: { category: Category; title: string }) {
  const { isLoggedIn } = useAuth()
  const [documents, setDocuments] = useState<FormCsDocument[]>([])
  const [groupHeaders, setGroupHeaders] = useState<FormCsGroupHeader[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  useSearchQueryParam(setQuery)
  const [viewing, setViewing] = useState<FormCsDocument | null>(null)
  const [editing, setEditing] = useState<FormCsDocument | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [groupHeaderModalOpen, setGroupHeaderModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<FormCsDocument | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [specialAreaModalOpen, setSpecialAreaModalOpen] = useState(false)

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

  // The admin arranges the rows (one per control no.) by hand while the
  // whole list is shown; the files of a control no. travel together.
  const canReorder = isLoggedIn && !query.trim()
  const moveRow = async (key: string, to: number) => {
    const keys = Array.from(new Set(documents.map((d) => d.control_no)))
    const from = keys.indexOf(key)
    if (from < 0 || to < 0 || to >= keys.length || from === to) return
    const next = moveItem(keys, from, to).flatMap((k) => documents.filter((d) => d.control_no === k))
    setDocuments(next) // shown at once; saved in the background
    try {
      const res = await fetch(`${API_BASE_PATH}/api/form-cs/${category}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: next.map((d) => d.id) }) })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Gagal menyimpan urutan dokumen.')
    } catch (orderError) {
      toast(orderError instanceof Error ? orderError.message : 'Gagal menyimpan urutan dokumen.', 'error')
      loadDocuments()
    }
  }

  const editableDocument: EditableFormCsDocument | undefined = editing
    ? {
        id: editing.id,
        controlNo: editing.control_no,
        title: editing.title,
        language: editing.language,
        keteranganNote: editing.keterangan_note,
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

  // Selection is per row (grouped by No. Kontrol) since that's how a human
  // reasons about "delete this document" — a row can hold several file
  // variants, so toggling a row toggles every file id underneath it.
  const toggleRow = (row: FormCsRow) => {
    const rowIds = row.files.map((f) => f.id)
    const allSelected = rowIds.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      rowIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)))
      return next
    })
  }
  const toggleAll = () => {
    const allIds = filteredDocuments.map((d) => d.id)
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      allIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)))
      return next
    })
  }
  const confirmBulkDelete = async () => {
    setBulkDeleting(true)
    const ids = Array.from(selectedIds)
    const results = await Promise.all(ids.map((id) => fetch(`${API_BASE_PATH}/api/form-cs/${category}?id=${id}`, { method: 'DELETE' })))
    const failed = results.filter((r) => !r.ok).length
    if (failed > 0) setError(`${failed} dari ${ids.length} file gagal dihapus.`)
    setSelectedIds(new Set())
    await loadDocuments()
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
  }

  const handleExportCsv = () => {
    downloadExcel(
      `${category}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      ['No. Kontrol', 'Nama Dokumen', 'Bahasa', 'Variant', 'Tanggal Upload'],
      filteredDocuments.map((d) => [
        d.control_no,
        d.title,
        d.language,
        d.file_variant ?? '',
        new Date(d.uploaded_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      ])
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {category === 'form-aplikasi' ? (
        <PaperHero
          title={title}
          count={documents.length}
          action={
            isLoggedIn ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGroupHeaderModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary"
                >
                  <Settings2 className="size-4" />
                  Kelola Baris Grup
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(null); setFormOpen(true) }}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 hover:opacity-90"
                >
                  <Plus className="size-4" />
                  Tambah Dokumen
                </button>
              </div>
            ) : null
          }
        />
      ) : (
        <ControlPanelHero
          title={title}
          count={documents.length}
          pdf={documents.filter((d) => d.file_kind !== 'xls').length}
          xls={documents.filter((d) => d.file_kind === 'xls').length}
          updatedAt={documents.reduce<string | null>((latest, d) => (!latest || d.uploaded_at > latest ? d.uploaded_at : latest), null)}
          action={isLoggedIn && (
            <>
              <button type="button" onClick={() => setGroupHeaderModalOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-white/10">
                <Settings2 className="size-4" />Kelola Baris Grup
              </button>
              <button type="button" onClick={() => { setEditing(null); setFormOpen(true) }} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5">
                <Plus className="size-4" />Tambah Dokumen
              </button>
            </>
          )}
        />
      )}

      {category === 'form-aplikasi' && (
        <section aria-label="Layanan Formulir Online Resmi" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="portal-eyebrow">Online services</p>
              <h3 className="font-display text-lg font-bold text-foreground">
                Layanan Formulir &amp; Pengajuan Izin Online
              </h3>
            </div>
            <span className="hidden rounded-full border border-border bg-secondary/50 px-3 py-1 font-mono-label text-[10px] text-muted-foreground sm:inline-block">
              5 Layanan Formulir &amp; E-Sign Aktif
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {/* Card 1: Izin Bawa Alat IT */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-blue-200/90 bg-gradient-to-b from-blue-50/80 via-card to-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-md dark:border-blue-900/50 dark:from-blue-950/30 dark:via-card dark:to-card">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/25">
                    <Laptop className="size-5" />
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                    F-03-00-001/002
                  </span>
                </div>
                <h4 className="mt-3.5 font-display text-base font-bold text-foreground">
                  Izin Bawa Alat IT
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Izin membawa masuk / keluar laptop, USB, kamera &amp; perangkat IT ke area PT. JAI.
                </p>
              </div>
              <div className="mt-4 border-t border-border/60 pt-3">
                <Link
                  href="/ijin-masuk-alat-it"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 group-hover:shadow"
                >
                  <span>Buka Formulir</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            {/* Card 2: Form E-Sign IT */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-emerald-200/90 bg-gradient-to-b from-emerald-50/80 via-card to-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-300 hover:shadow-md dark:border-emerald-900/50 dark:from-emerald-950/30 dark:via-card dark:to-card">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/25">
                    <FileSignature className="size-5" />
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                    6 Template E-Sign
                  </span>
                </div>
                <h4 className="mt-3.5 font-display text-base font-bold text-foreground">
                  Form E-Sign IT
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Pengadaan PC &amp; Software, Akun Email/User ID, dan Jaringan ber-E-Sign resmi.
                </p>
              </div>
              <div className="mt-4 border-t border-border/60 pt-3">
                <Link
                  href="/form-it-esign"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 group-hover:shadow"
                >
                  <span>Buka Form E-Sign</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            {/* Card 3: Registrasi Fingerprint Special Security Area */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-indigo-200/90 bg-gradient-to-b from-indigo-50/80 via-card to-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-indigo-300 hover:shadow-md dark:border-indigo-900/50 dark:from-indigo-950/30 dark:via-card dark:to-card">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-500/25">
                    <Fingerprint className="size-5" />
                  </div>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                    F-02-00-002
                  </span>
                </div>
                <h4 className="mt-3.5 font-display text-base font-bold text-foreground">
                  Registrasi Fingerprint
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Pendaftaran sidik jari akses Special Security Area (Server Room, Arsip) E-Sign IAA Teguh Sunjoyo.
                </p>
              </div>
              <div className="mt-4 border-t border-border/60 pt-3">
                <Link
                  href="/form-it-esign?form=ISMS-F-02-00-002"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 group-hover:shadow"
                >
                  <span>Buka Form Fingerprint</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            {/* Card 3: Izin Foto & Video */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/80 via-card to-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-amber-300 hover:shadow-md dark:border-amber-900/50 dark:from-amber-950/30 dark:via-card dark:to-card">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="grid size-10 place-items-center rounded-xl bg-amber-600 text-white shadow-sm shadow-amber-500/25">
                    <Camera className="size-5" />
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                    F-04-00-001
                  </span>
                </div>
                <h4 className="mt-3.5 font-display text-base font-bold text-foreground">
                  Izin Foto &amp; Video
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Permohonan izin pengambilan dokumentasi foto / video di area PT. JAI.
                </p>
              </div>
              <div className="mt-4 border-t border-border/60 pt-3">
                <Link
                  href="/ijin-foto-video"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-amber-700 group-hover:shadow"
                >
                  <span>Buka Formulir</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            {/* Card 4: Special Security */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-rose-200/90 bg-gradient-to-b from-rose-50/80 via-card to-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-rose-300 hover:shadow-md dark:border-rose-900/50 dark:from-rose-950/30 dark:via-card dark:to-card">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="grid size-10 place-items-center rounded-xl bg-[#c7161e] text-white shadow-sm shadow-red-500/25">
                    <ShieldAlert className="size-5" />
                  </div>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-rose-800 dark:bg-rose-900/60 dark:text-rose-300">
                    Zona Khusus
                  </span>
                </div>
                <h4 className="mt-3.5 font-display text-base font-bold text-foreground">
                  Special Security Area
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Izin akses ke Server Room, Ruang Arsip, dan Area Berpengawasan Khusus.
                </p>
              </div>
              <div className="mt-4 border-t border-border/60 pt-3">
                <button
                  type="button"
                  onClick={() => setSpecialAreaModalOpen(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#c7161e] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#b0131a] group-hover:shadow"
                >
                  <span>Buka Pengajuan</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {category === 'kontrol-cs' && <VendorRegistrationsPanel isLoggedIn={isLoggedIn} />}

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div><p className="portal-eyebrow">Controlled library</p><p className="mt-1 text-sm text-muted-foreground">{documents.length} dokumen terdaftar</p></div>
        <div className="flex flex-wrap items-center gap-2 max-[680px]:w-full">
          {isLoggedIn && selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
              <span className="text-xs font-semibold text-foreground">{selectedIds.size} terpilih</span>
              <button type="button" onClick={() => setBulkDeleteOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition hover:opacity-90"><Trash2 className="size-3.5" />Hapus Terpilih</button>
              <button type="button" onClick={() => setSelectedIds(new Set())} aria-label="Batal pilih" className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary"><X className="size-4" /></button>
            </div>
          )}
          {isLoggedIn && <button type="button" onClick={handleExportCsv} disabled={filteredDocuments.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"><Download className="size-3.5" />Export Excel</button>}
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
      </div>

      {isLoggedIn && <div className="-mt-2"><ReorderHint active={!query.trim()} /></div>}

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {loading ? (
        <BlockSkeleton lines={6} />
      ) : (
        <FormCsSpreadsheetTable
          documents={filteredDocuments}
          groupHeaders={groupHeaders}
          query={query}
          isLoggedIn={isLoggedIn}
          onView={setViewing}
          onEdit={(document) => { setEditing(document); setFormOpen(true) }}
          onDelete={setPendingDelete}
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          onMoveRow={canReorder ? moveRow : undefined}
        />
      )}

      {!loading && filteredDocuments.length > 0 && (
        <div className="rounded-lg border border-border bg-secondary/20 px-5 py-3 text-xs text-muted-foreground">
          Menampilkan <span className="font-semibold text-foreground">{filteredDocuments.length}</span>{query ? ` dari ${documents.length}` : ''} baris file
        </div>
      )}

      {viewing && (
        <DocumentViewModal
          open={Boolean(viewing)}
          onClose={() => setViewing(null)}
          filePath={viewing.file_path}
          fileName={viewing.title}
          mimeType={viewing.file_kind === 'xls' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf'}
        />
      )}
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
      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Hapus dokumen terpilih?"
        message={`${selectedIds.size} file akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
        pending={bulkDeleting}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />
      {specialAreaModalOpen && (
        <SpecialAreaFormModal
          onClose={() => setSpecialAreaModalOpen(false)}
          onSaved={() => {
            setSpecialAreaModalOpen(false)
            toast('Pengajuan Ijin Masuk Area Special Security berhasil dikirim.')
          }}
        />
      )}
    </div>
  )
}
