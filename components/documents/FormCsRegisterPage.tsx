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
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/70 px-3.5 py-2 text-xs font-semibold text-foreground shadow-2xs transition-all hover:bg-secondary hover:text-foreground cursor-pointer"
                >
                  <Settings2 className="size-3.5" />
                  Kelola Baris Grup
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(null); setFormOpen(true) }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:-translate-y-0.5 cursor-pointer"
                >
                  <Plus className="size-3.5" />
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
              <button type="button" onClick={() => setGroupHeaderModalOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-white/10 cursor-pointer">
                <Settings2 className="size-4" />Kelola Baris Grup
              </button>
              <button type="button" onClick={() => { setEditing(null); setFormOpen(true) }} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5 cursor-pointer">
                <Plus className="size-4" />Tambah Dokumen
              </button>
            </>
          )}
        />
      )}

      {category === 'form-aplikasi' && (
        <section aria-label="Layanan Formulir Online Resmi" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/70 pb-3">
            <div>
              <p className="portal-eyebrow">Online services</p>
              <h3 className="font-display text-lg font-extrabold text-foreground tracking-tight">
                Layanan Formulir &amp; Pengajuan Izin Online
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pilih formulir resmi untuk pengajuan perizinan dan layanan digital dengan alur persetujuan terverifikasi.
              </p>
            </div>
            <span className="self-start sm:self-auto rounded-full border border-primary/20 bg-primary/5 px-3 py-1 font-mono-label text-[11px] font-bold text-primary">
              5 Layanan Formulir Aktif
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {/* Card 1: Form Layanan IT (E-Sign) */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-b from-card via-card to-emerald-500/[0.06] p-5 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/15">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400" />
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="grid size-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs transition-transform duration-300 group-hover:scale-110">
                    <FileSignature className="size-5" />
                  </div>
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 shadow-2xs">
                    5 Form IT
                  </span>
                </div>
                <h4 className="mt-3.5 font-display text-sm font-extrabold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Form Layanan IT (E-Sign)
                </h4>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                  Pengadaan PC/Laptop, Lisensi Software, Email &amp; User ID, dan Koneksi Jaringan.
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  <Link href="/form-it-esign?form=ISMS-F-010-001" className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white transition-colors">PC/Laptop</Link>
                  <Link href="/form-it-esign?form=ISMS-F-010-003" className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white transition-colors">Software</Link>
                  <Link href="/form-it-esign?form=ISMS-F-010-006" className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white transition-colors">Email &amp; ID</Link>
                  <Link href="/form-it-esign?form=ISMS-F-03-00-003" className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white transition-colors">Jaringan</Link>
                </div>
              </div>
              <div className="mt-4 border-t border-emerald-500/20 pt-3">
                <Link
                  href="/form-it-esign"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 active:to-teal-700 active:scale-95 text-white px-3.5 py-2.5 text-xs font-bold shadow-md shadow-emerald-600/25 transition-all duration-200 group-hover:shadow-lg group-hover:shadow-emerald-600/35"
                >
                  <span>Buka Form IT</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Card 2: Registrasi Fingerprint Special Security Area */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-indigo-500/30 bg-gradient-to-b from-card via-card to-indigo-500/[0.06] p-5 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/15">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-400 to-indigo-400" />
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="grid size-11 place-items-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shadow-xs transition-transform duration-300 group-hover:scale-110">
                    <Fingerprint className="size-5" />
                  </div>
                  <span className="rounded-full bg-indigo-500/15 border border-indigo-500/40 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 shadow-2xs">
                    F-02-00-002
                  </span>
                </div>
                <h4 className="mt-3.5 font-display text-sm font-extrabold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  Registrasi Fingerprint
                </h4>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                  Pendaftaran sidik jari akses Special Security Area (Server Room, Arsip) E-Sign resmi IAA.
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-indigo-700 dark:text-indigo-300">Server Room</span>
                  <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-indigo-700 dark:text-indigo-300">Arsip</span>
                  <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-indigo-700 dark:text-indigo-300">Akses 24/7</span>
                </div>
              </div>
              <div className="mt-4 border-t border-indigo-500/20 pt-3">
                <Link
                  href="/registrasi-fingerprint"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:from-indigo-700 active:to-purple-700 active:scale-95 text-white px-3.5 py-2.5 text-xs font-bold shadow-md shadow-indigo-600/25 transition-all duration-200 group-hover:shadow-lg group-hover:shadow-indigo-600/35"
                >
                  <span>Buka Form Fingerprint</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Card 3: Izin Bawa Alat IT */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-sky-500/30 bg-gradient-to-b from-card via-card to-sky-500/[0.06] p-5 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-sky-500 hover:shadow-xl hover:shadow-sky-500/15">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-500 via-blue-400 to-cyan-400" />
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="grid size-11 place-items-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 shadow-xs transition-transform duration-300 group-hover:scale-110">
                    <Laptop className="size-5" />
                  </div>
                  <span className="rounded-full bg-sky-500/15 border border-sky-500/40 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 shadow-2xs">
                    F-03-00-001/002
                  </span>
                </div>
                <h4 className="mt-3.5 font-display text-sm font-extrabold text-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                  Izin Bawa Alat IT
                </h4>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                  Izin membawa masuk / keluar laptop, USB, kamera &amp; perangkat IT ke area PT. JAI.
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-sky-700 dark:text-sky-300">Laptop &amp; PC</span>
                  <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-sky-700 dark:text-sky-300">USB Flashdisk</span>
                  <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-sky-700 dark:text-sky-300">Kamera</span>
                </div>
              </div>
              <div className="mt-4 border-t border-sky-500/20 pt-3">
                <Link
                  href="/ijin-masuk-alat-it"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 active:from-sky-700 active:to-blue-700 active:scale-95 text-white px-3.5 py-2.5 text-xs font-bold shadow-md shadow-sky-600/25 transition-all duration-200 group-hover:shadow-lg group-hover:shadow-sky-600/35"
                >
                  <span>Buka Form Alat IT</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Card 4: Izin Foto & Video */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-amber-500/30 bg-gradient-to-b from-card via-card to-amber-500/[0.06] p-5 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/15">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-400" />
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="grid size-11 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs transition-transform duration-300 group-hover:scale-110">
                    <Camera className="size-5" />
                  </div>
                  <span className="rounded-full bg-amber-500/15 border border-amber-500/40 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 shadow-2xs">
                    F-04-00-001
                  </span>
                </div>
                <h4 className="mt-3.5 font-display text-sm font-extrabold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  Izin Foto &amp; Video
                </h4>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                  Permohonan izin pengambilan dokumentasi foto / video di lingkungan PT. JAI.
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-700 dark:text-amber-300">Dokumentasi</span>
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-700 dark:text-amber-300">Audit Visual</span>
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-700 dark:text-amber-300">Pemberian Pita</span>
                </div>
              </div>
              <div className="mt-4 border-t border-amber-500/20 pt-3">
                <Link
                  href="/ijin-foto-video"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 active:from-amber-700 active:to-orange-700 active:scale-95 text-white px-3.5 py-2.5 text-xs font-bold shadow-md shadow-amber-600/25 transition-all duration-200 group-hover:shadow-lg group-hover:shadow-amber-600/35"
                >
                  <span>Buka Form Foto/Video</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Card 5: Special Security Area */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-rose-500/30 bg-gradient-to-b from-card via-card to-rose-500/[0.06] p-5 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-rose-500 hover:shadow-xl hover:shadow-rose-500/15">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-red-400 to-rose-400" />
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="grid size-11 place-items-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-xs transition-transform duration-300 group-hover:scale-110">
                    <ShieldAlert className="size-5" />
                  </div>
                  <span className="rounded-full bg-rose-500/15 border border-rose-500/40 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 shadow-2xs">
                    Zona Khusus
                  </span>
                </div>
                <h4 className="mt-3.5 font-display text-sm font-extrabold text-foreground group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                  Special Security Area
                </h4>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                  Izin akses ke Server Room, Ruang Arsip, dan Area Berpengawasan Khusus.
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-rose-700 dark:text-rose-300">Server Room</span>
                  <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-rose-700 dark:text-rose-300">Ruang Arsip</span>
                  <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-rose-700 dark:text-rose-300">Area Terbatas</span>
                </div>
              </div>
              <div className="mt-4 border-t border-rose-500/20 pt-3">
                <button
                  type="button"
                  onClick={() => setSpecialAreaModalOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:from-rose-700 active:to-red-700 active:scale-95 text-white px-3.5 py-2.5 text-xs font-bold shadow-md shadow-rose-600/25 transition-all duration-200 group-hover:shadow-lg group-hover:shadow-rose-600/35 cursor-pointer"
                >
                  <span>Buka Form Zona Khusus</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {category === 'kontrol-cs' && <VendorRegistrationsPanel isLoggedIn={isLoggedIn} />}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 pt-2">
        <div>
          <p className="portal-eyebrow">Controlled library</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{documents.length} dokumen master terdaftar</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-[680px]:w-full">
          {isLoggedIn && selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5 shadow-xs">
              <span className="text-xs font-bold text-foreground">{selectedIds.size} terpilih</span>
              <button type="button" onClick={() => setBulkDeleteOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground shadow-xs transition hover:opacity-90 cursor-pointer">
                <Trash2 className="size-3.5" />Hapus
              </button>
              <button type="button" onClick={() => setSelectedIds(new Set())} aria-label="Batal pilih" className="grid size-6 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground cursor-pointer">
                <X className="size-3.5" />
              </button>
            </div>
          )}
          {isLoggedIn && (
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredDocuments.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-xs transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <Download className="size-3.5" />
              <span>Export Excel</span>
            </button>
          )}
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari No. Kontrol atau nama dokumen..."
              aria-label={`Cari ${title}`}
              className="h-9 w-full rounded-xl border border-input bg-card py-2 pl-9 pr-8 text-xs font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 shadow-xs"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Bersihkan pencarian" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="size-3.5" />
              </button>
            )}
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
