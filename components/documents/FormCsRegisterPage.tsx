'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Download,
  FileSignature,
  FileText,
  Fingerprint,
  Laptop,
  Mail,
  Network,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
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
          {/* Header with Anti-Slop Refined Typography */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <p className="portal-eyebrow !mb-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Enterprise Services · ISO/IEC 27001
                </p>
              </div>
              <h3 className="font-display text-xl sm:text-2xl font-black text-foreground tracking-tight mt-1">
                Layanan Formulir &amp; Pengajuan Izin Online
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 max-w-2xl leading-relaxed">
                Pusat perizinan terpadu PT. JAI dengan alur persetujuan digital, integrasi E-Sign QR Code resmi, dan kepatuhan standar keamanan informasi.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 font-mono text-xs font-semibold text-foreground shadow-2xs">
                <ShieldCheck className="size-3.5 text-primary" />
                <span>5 Layanan Terverifikasi</span>
              </span>
            </div>
          </div>

          {/* Bento Grid Layout (Anti-Slop Architecture) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* HERO BENTO (Left 7 Cols): Form Layanan IT (E-Sign) */}
            <div className="group lg:col-span-7 flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs hover:border-foreground/30 hover:shadow-lg transition-all duration-200 relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-11 place-items-center rounded-xl bg-secondary border border-border text-foreground transition-transform duration-200 group-hover:scale-105 shadow-2xs">
                      <FileSignature className="size-5.5 text-primary" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                          ISMS-F-010 / F-03
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          <span>E-Sign Terintegrasi</span>
                        </span>
                      </div>
                      <h4 className="font-display text-base sm:text-lg font-black text-foreground tracking-tight mt-1">
                        Form Layanan IT (E-Sign)
                      </h4>
                    </div>
                  </div>
                </div>

                <p className="text-xs sm:text-[13px] leading-relaxed text-muted-foreground">
                  Pengadaan dan peremajaan komputer, lisensi software terverifikasi, pembuatan &amp; mutasi akun domain, serta izin sambungan jaringan tamu dan rekanan.
                </p>

                {/* Sub-Category Interactive Tiles (2x2 Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <Link
                    href="/form-it-esign?form=ISMS-F-010-001"
                    className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-border/80 bg-secondary/40 hover:bg-secondary hover:border-foreground/20 transition-all text-xs group/item"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-7 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 text-foreground">
                        <Laptop className="size-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-foreground truncate">PC &amp; Laptop</div>
                        <div className="text-[10px] text-muted-foreground font-mono">F-010-001 · Baru/Refresh</div>
                      </div>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground group-hover/item:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link
                    href="/form-it-esign?form=ISMS-F-010-003"
                    className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-border/80 bg-secondary/40 hover:bg-secondary hover:border-foreground/20 transition-all text-xs group/item"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-7 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 text-foreground">
                        <Cpu className="size-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-foreground truncate">Lisensi Software</div>
                        <div className="text-[10px] text-muted-foreground font-mono">F-010-003 · CAD, Office, SAP</div>
                      </div>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground group-hover/item:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link
                    href="/form-it-esign?form=ISMS-F-010-006"
                    className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-border/80 bg-secondary/40 hover:bg-secondary hover:border-foreground/20 transition-all text-xs group/item"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-7 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 text-foreground">
                        <Mail className="size-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-foreground truncate">Email &amp; User ID</div>
                        <div className="text-[10px] text-muted-foreground font-mono">F-010-006/007 · Akun JAI</div>
                      </div>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground group-hover/item:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link
                    href="/form-it-esign?form=ISMS-F-03-00-003"
                    className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-border/80 bg-secondary/40 hover:bg-secondary hover:border-foreground/20 transition-all text-xs group/item"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-7 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 text-foreground">
                        <Network className="size-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-foreground truncate">Koneksi Jaringan</div>
                        <div className="text-[10px] text-muted-foreground font-mono">F-03-00-003 · Tamu &amp; Rekanan</div>
                      </div>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground group-hover/item:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-[11px] text-muted-foreground">
                  *Dokumen sah otomatis dibubuhi QR Code tanda tangan elektronik terverifikasi.
                </span>
                <Link
                  href="/form-it-esign"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 text-xs font-bold shadow-xs transition-all duration-200 group/btn shrink-0"
                >
                  <span>Buka Portal Form IT</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover/btn:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* BENTO COMPANION (Right 5 Cols): Izin Bawa Masuk / Keluar Alat IT */}
            <div className="group lg:col-span-5 flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs hover:border-foreground/30 hover:shadow-lg transition-all duration-200">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-11 place-items-center rounded-xl bg-secondary border border-border text-foreground transition-transform duration-200 group-hover:scale-105 shadow-2xs">
                      <Laptop className="size-5.5 text-foreground" />
                    </div>
                    <div>
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded-md">
                        ISMS-F-03-00-001/002
                      </span>
                      <h4 className="font-display text-base sm:text-lg font-black text-foreground tracking-tight mt-1">
                        Izin Bawa Alat IT
                      </h4>
                    </div>
                  </div>
                </div>

                <p className="text-xs sm:text-[13px] leading-relaxed text-muted-foreground">
                  Izin resmi membawa masuk dan keluar perangkat elektronik (Laptop, PC, USB Drive, Kamera) melewati gerbang pos keamanan pabrik PT. JAI.
                </p>

                {/* Key feature checklist */}
                <div className="space-y-2 pt-1 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                    <span>Verifikasi nomor seri &amp; barcode otomatis di Pos Satpam</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                    <span>Opsi izin sementara (kunjungan) atau izin jangka panjang</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                    <span>Integrasi cetak label barcode &amp; kartu izin resmi</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-border">
                <Link
                  href="/ijin-masuk-alat-it"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border px-4 py-2.5 text-xs font-bold transition-all duration-200 group/btn"
                >
                  <span>Buka Form Alat IT</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover/btn:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* ROW 2: 3 BALANCED TILES */}
            {/* Tile 1: Registrasi Fingerprint */}
            <div className="group lg:col-span-4 flex flex-col justify-between rounded-2xl border border-border bg-card p-5.5 shadow-xs hover:border-foreground/30 hover:shadow-lg transition-all duration-200">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="grid size-10 place-items-center rounded-xl bg-secondary border border-border text-foreground transition-transform duration-200 group-hover:scale-105 shadow-2xs">
                    <Fingerprint className="size-5 text-foreground" />
                  </div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded-md">
                    F-02-00-002
                  </span>
                </div>

                <div>
                  <h4 className="font-display text-sm sm:text-base font-black text-foreground tracking-tight">
                    Registrasi Fingerprint
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Pendaftaran sidik jari biometrik untuk otorisasi akses pintu Special Security Area (Server Room &amp; Ruang Arsip).
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-secondary/60 border border-border/80 px-2 py-0.5 rounded">
                    Server Room
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-secondary/60 border border-border/80 px-2 py-0.5 rounded">
                    Ruang Arsip
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-secondary/60 border border-border/80 px-2 py-0.5 rounded">
                    Otorisasi IAA
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3.5 border-t border-border">
                <Link
                  href="/registrasi-fingerprint"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border px-3.5 py-2 text-xs font-bold transition-all duration-200 group/btn"
                >
                  <span>Buka Form Fingerprint</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover/btn:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Tile 2: Izin Foto & Video */}
            <div className="group lg:col-span-4 flex flex-col justify-between rounded-2xl border border-border bg-card p-5.5 shadow-xs hover:border-foreground/30 hover:shadow-lg transition-all duration-200">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="grid size-10 place-items-center rounded-xl bg-secondary border border-border text-foreground transition-transform duration-200 group-hover:scale-105 shadow-2xs">
                    <Camera className="size-5 text-foreground" />
                  </div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded-md">
                    F-04-00-001
                  </span>
                </div>

                <div>
                  <h4 className="font-display text-sm sm:text-base font-black text-foreground tracking-tight">
                    Izin Foto &amp; Video
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Permohonan izin pengambilan dokumentasi visual di area pabrik &amp; fasilitas PT. JAI sesuai audit kerahasiaan ISMS.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-secondary/60 border border-border/80 px-2 py-0.5 rounded">
                    Audit Visual
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-secondary/60 border border-border/80 px-2 py-0.5 rounded">
                    Pemberian Pita Kamera
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-secondary/60 border border-border/80 px-2 py-0.5 rounded">
                    Pencegahan Kebocoran
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3.5 border-t border-border">
                <Link
                  href="/ijin-foto-video"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border px-3.5 py-2 text-xs font-bold transition-all duration-200 group/btn"
                >
                  <span>Buka Form Foto/Video</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover/btn:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Tile 3: Special Security Area */}
            <div className="group lg:col-span-4 flex flex-col justify-between rounded-2xl border border-border bg-card p-5.5 shadow-xs hover:border-foreground/30 hover:shadow-lg transition-all duration-200">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="grid size-10 place-items-center rounded-xl bg-secondary border border-border text-foreground transition-transform duration-200 group-hover:scale-105 shadow-2xs">
                    <ShieldAlert className="size-5 text-foreground" />
                  </div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary border border-border px-2 py-0.5 rounded-md">
                    F-006-001
                  </span>
                </div>

                <div>
                  <h4 className="font-display text-sm sm:text-base font-black text-foreground tracking-tight">
                    Special Security Area
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Izin akses fisik, inspeksi, dan kegiatan teknis di zona terbatas dengan pengawasan ketat (Server Room &amp; Ruang Arsip).
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-secondary/60 border border-border/80 px-2 py-0.5 rounded">
                    Zona Terbatas
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-secondary/60 border border-border/80 px-2 py-0.5 rounded">
                    Wajib Pendamping
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-secondary/60 border border-border/80 px-2 py-0.5 rounded">
                    Log Akses Terverifikasi
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3.5 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSpecialAreaModalOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border px-3.5 py-2 text-xs font-bold transition-all duration-200 group/btn cursor-pointer"
                >
                  <span>Buka Form Zona Khusus</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover/btn:translate-x-1" />
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
