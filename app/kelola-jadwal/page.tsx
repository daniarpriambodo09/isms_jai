// app/kelola-jadwal/page.tsx

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, Eye, FileText, GraduationCap, ImageIcon, Plus, Settings, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { AdminGate } from '@/components/admin-gate'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DocumentViewModal } from '@/components/documents/DocumentViewModal'
import { ImageCropModal } from '@/components/kelola-jadwal/ImageCropModal'
import { ScheduleDetailsModal } from '@/components/kelola-jadwal/ScheduleDetailsModal'

type Kind = 'audit' | 'training'
type ScheduleDocument = {
  id: number
  kind: Kind
  file_path: string
  mime_type: string
  title: string | null
  description: string | null
  uploaded_at: string
  uploaded_by: string | null
}

const KIND_META: Record<Kind, { label: string; icon: typeof CalendarDays; description: string }> = {
  audit: { label: 'Jadwal Audit', icon: CalendarDays, description: 'Ditampilkan di halaman Home dan Jadwal Audit.' },
  training: { label: 'Jadwal Training', icon: GraduationCap, description: 'Ditampilkan di halaman Home.' },
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fileUrl(doc: ScheduleDocument) {
  return `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(doc.file_path)}`
}

function DocumentRow({ doc, meta, onDeleted }: { doc: ScheduleDocument; meta: { label: string }; onDeleted: () => void }) {
  const [viewing, setViewing] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isImage = doc.mime_type.startsWith('image/')
  const isPdf = doc.mime_type === 'application/pdf'

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/schedule-documents?id=${doc.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) { const data = await res.json().catch(() => null); setError(data?.message ?? 'Gagal menghapus dokumen.'); setDeleting(false); setPendingDelete(false); return }
      onDeleted()
    } catch {
      setError('Tidak dapat menghubungi server.')
    }
    setDeleting(false)
    setPendingDelete(false)
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/20 px-4 py-3">
      <button type="button" onClick={() => setViewing(true)} className="grid size-11 flex-shrink-0 place-items-center overflow-hidden rounded-lg bg-card text-primary">
        {isImage ? <img src={fileUrl(doc)} alt={doc.title ?? meta.label} className="h-full w-full object-cover" /> : <FileText className="size-5" />}
      </button>
      <button type="button" onClick={() => setViewing(true)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-foreground">{doc.title ?? meta.label}</p>
        {doc.description && <p className="truncate text-xs text-muted-foreground">{doc.description}</p>}
        <p className="text-xs text-muted-foreground">Diunggah {formatDateTime(doc.uploaded_at)} {doc.uploaded_by && <>oleh <span className="font-medium">{doc.uploaded_by}</span></>}</p>
      </button>
      <button type="button" onClick={() => setViewing(true)} aria-label="Lihat" title="Lihat" className="grid size-8 flex-shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-primary"><Eye className="size-4" /></button>
      <button type="button" onClick={() => setPendingDelete(true)} aria-label="Hapus" title="Hapus" className="grid size-8 flex-shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" /></button>

      {error && <p className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}

      {viewing && (
        isPdf
          ? <DocumentViewModal open={viewing} onClose={() => setViewing(false)} filePath={doc.file_path} fileName={doc.title ?? meta.label} />
          : (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/90" onClick={() => setViewing(false)}>
              <img src={fileUrl(doc)} alt={doc.title ?? meta.label} className="h-screen w-screen object-contain" onClick={(e) => e.stopPropagation()} />
            </div>
          )
      )}

      <ConfirmDialog
        open={pendingDelete}
        title={`Hapus "${doc.title ?? meta.label}"?`}
        message="File ini akan dihapus permanen dan tidak akan tampil lagi di Home. Tindakan ini tidak dapat dibatalkan."
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(false)}
      />
    </div>
  )
}

function UploadSlot({ kind, docs, onChanged }: { kind: Kind; docs: ScheduleDocument[]; onChanged: () => void }) {
  const meta = KIND_META[kind]
  const Icon = meta.icon
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File, title: string, description: string) => {
    setError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.set('kind', kind)
      form.set('file', file)
      if (title.trim()) form.set('title', title.trim())
      if (description.trim()) form.set('description', description.trim())
      const res = await fetch(`${API_BASE_PATH}/api/schedule-documents`, { method: 'POST', body: form, credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.message ?? 'Gagal mengunggah file.'); return }
      setPendingFile(null)
      onChanged()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="grid size-9 flex-shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
        <div>
          <p className="text-sm font-semibold text-foreground">{meta.label}</p>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-5">
        {docs.length === 0 ? (
          <div className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/20 px-4 py-10 text-muted-foreground">
            <ImageIcon className="size-8" />
            <span className="text-sm font-semibold">Belum ada file diunggah</span>
          </div>
        ) : (
          docs.map((doc) => <DocumentRow key={doc.id} doc={doc} meta={meta} onDeleted={onChanged} />)
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-secondary/20 px-3 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:bg-secondary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="size-4" />{uploading ? 'Mengunggah...' : 'Tambah File'}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            if (file.type.startsWith('image/')) {
              setCropFile(file)
              setCropSrc(URL.createObjectURL(file))
            } else {
              setPendingFile(file)
            }
            e.target.value = ''
          }}
        />

        {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}
      </div>

      {cropSrc && cropFile && (
        <ImageCropModal
          open={Boolean(cropSrc)}
          imageSrc={cropSrc}
          fileName={cropFile.name}
          mimeType={cropFile.type}
          onCancel={() => {
            URL.revokeObjectURL(cropSrc)
            setCropSrc(null)
            setCropFile(null)
          }}
          onConfirm={(file) => {
            URL.revokeObjectURL(cropSrc)
            setCropSrc(null)
            setCropFile(null)
            setPendingFile(file)
          }}
        />
      )}

      {pendingFile && (
        <ScheduleDetailsModal
          open={Boolean(pendingFile)}
          fileName={pendingFile.name}
          submitting={uploading}
          onCancel={() => setPendingFile(null)}
          onConfirm={(title, description) => handleFile(pendingFile, title, description)}
        />
      )}
    </div>
  )
}

export default function KelolaJadwalPage() {
  const { isLoggedIn, isLoading } = useAuth()
  const [documents, setDocuments] = useState<Record<Kind, ScheduleDocument[]>>({ audit: [], training: [] })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/schedule-documents`, { cache: 'no-store' })
      const data = await res.json()
      setDocuments(data.documents ?? { audit: [], training: [] })
    } catch {
      setDocuments({ audit: [], training: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (!isLoading && !isLoggedIn) {
    return <AdminGate />
  }

  return (
    <div className="flex flex-col gap-7">
      <header className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
              <Settings className="size-3.5" /> Admin workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Kelola Jadwal</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">Unggah jadwal audit dan training sebagai PDF atau gambar — bisa lebih dari satu file per jenis, dan semuanya tampil di halaman Home dan Jadwal Audit.</p>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center shadow-sm">
          <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" />
          <p className="text-sm text-muted-foreground">Memuat...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <UploadSlot kind="audit" docs={documents.audit} onChanged={load} />
          <UploadSlot kind="training" docs={documents.training} onChanged={load} />
        </div>
      )}
    </div>
  )
}
