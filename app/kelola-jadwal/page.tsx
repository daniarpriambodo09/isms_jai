// app/kelola-jadwal/page.tsx

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Eye, FileText, ImageIcon, Pencil, Plus, Settings, Trash2, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { AdminGate } from '@/components/admin-gate'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DocumentViewModal } from '@/components/documents/DocumentViewModal'
import { ScheduleDetailsModal } from '@/components/kelola-jadwal/ScheduleDetailsModal'

type Category = { id: number; slug: string; label: string; sort_order: number }
type ScheduleDocument = {
  id: number
  kind: string
  file_path: string
  mime_type: string
  title: string | null
  description: string | null
  uploaded_at: string
  uploaded_by: string | null
}

const inputClass = 'h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const iconButtonClass = 'grid size-8 place-items-center rounded-lg text-muted-foreground/80 transition hover:bg-white/15 hover:text-white'

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fileUrl(doc: ScheduleDocument) {
  return `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(doc.file_path)}`
}

function DocumentRow({ doc, label, onDeleted }: { doc: ScheduleDocument; label: string; onDeleted: () => void }) {
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
        {isImage ? <img src={fileUrl(doc)} alt={doc.title ?? label} className="h-full w-full object-cover" /> : <FileText className="size-5" />}
      </button>
      <button type="button" onClick={() => setViewing(true)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-foreground">{doc.title ?? label}</p>
        {doc.description && <p className="truncate text-xs text-muted-foreground">{doc.description}</p>}
        <p className="text-xs text-muted-foreground">Diunggah {formatDateTime(doc.uploaded_at)} {doc.uploaded_by && <>oleh <span className="font-medium">{doc.uploaded_by}</span></>}</p>
      </button>
      <button type="button" onClick={() => setViewing(true)} aria-label="Lihat" title="Lihat" className="grid size-8 flex-shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-primary"><Eye className="size-4" /></button>
      <button type="button" onClick={() => setPendingDelete(true)} aria-label="Hapus" title="Hapus" className="grid size-8 flex-shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" /></button>

      {error && <p className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}

      {viewing && (
        isPdf
          ? <DocumentViewModal open={viewing} onClose={() => setViewing(false)} filePath={doc.file_path} fileName={doc.title ?? label} />
          : (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/90" onClick={() => setViewing(false)}>
              <img src={fileUrl(doc)} alt={doc.title ?? label} className="h-screen w-screen object-contain" onClick={(e) => e.stopPropagation()} />
            </div>
          )
      )}

      <ConfirmDialog
        open={pendingDelete}
        title={`Hapus "${doc.title ?? label}"?`}
        message="File ini akan dihapus permanen dan tidak akan tampil lagi di Home. Tindakan ini tidak dapat dibatalkan."
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(false)}
      />
    </div>
  )
}

function UploadSlot({
  category,
  docs,
  onChanged,
  onRename,
  onDelete,
}: {
  category: Category
  docs: ScheduleDocument[]
  onChanged: () => void
  onRename: (category: Category) => void
  onDelete: (category: Category) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File, title: string, description: string) => {
    setError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.set('kind', category.slug)
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
      <div className="flex items-center justify-between gap-3 border-b border-border bg-primary px-5 py-4 text-primary-foreground">
        <p className="truncate text-sm font-semibold">{category.label}</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onRename(category)} aria-label={`Ubah nama ${category.label}`} title="Ubah nama kategori" className={iconButtonClass}><Pencil className="size-3.5" /></button>
          <button type="button" onClick={() => onDelete(category)} aria-label={`Hapus kategori ${category.label}`} title="Hapus kategori" className={`${iconButtonClass} hover:bg-destructive/20 hover:text-destructive-foreground`}><Trash2 className="size-3.5" /></button>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-5">
        {docs.length === 0 ? (
          <div className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/20 px-4 py-10 text-muted-foreground">
            <ImageIcon className="size-8" />
            <span className="text-sm font-semibold">Belum ada file diunggah</span>
          </div>
        ) : (
          docs.map((doc) => <DocumentRow key={doc.id} doc={doc} label={category.label} onDeleted={onChanged} />)
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
            e.target.value = ''
            if (!file) return
            setPendingFile(file)
          }}
        />

        {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}
      </div>

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
  const [categories, setCategories] = useState<Category[]>([])
  const [documents, setDocuments] = useState<ScheduleDocument[]>([])
  const [loading, setLoading] = useState(true)

  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  const [renaming, setRenaming] = useState<Category | null>(null)
  const [renameLabel, setRenameLabel] = useState('')
  const [renameError, setRenameError] = useState('')
  const [renaming2, setRenaming2] = useState(false)

  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<Category | null>(null)
  const [deletingCategory, setDeletingCategory] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [catRes, docRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api/schedule-categories`, { cache: 'no-store' }),
        fetch(`${API_BASE_PATH}/api/schedule-documents`, { cache: 'no-store' }),
      ])
      const catData = await catRes.json()
      const docData = await docRes.json()
      setCategories(catData.categories ?? [])
      setDocuments(docData.documents ?? [])
    } catch {
      setCategories([])
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const docsByCategory = useMemo(() => {
    const map = new Map<string, ScheduleDocument[]>()
    for (const doc of documents) {
      if (!map.has(doc.kind)) map.set(doc.kind, [])
      map.get(doc.kind)!.push(doc)
    }
    return map
  }, [documents])

  const submitAddCategory = async () => {
    if (!newCategoryLabel.trim()) return
    setSavingCategory(true)
    setCategoryError('')
    try {
      const res = await fetch(`${API_BASE_PATH}/api/schedule-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label: newCategoryLabel.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Gagal menambahkan kategori.')
      setNewCategoryLabel('')
      setAddingCategory(false)
      await load()
    } catch (e) {
      setCategoryError(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setSavingCategory(false)
    }
  }

  const startRename = (category: Category) => {
    setRenaming(category)
    setRenameLabel(category.label)
    setRenameError('')
  }

  const submitRename = async () => {
    if (!renaming || !renameLabel.trim()) return
    setRenaming2(true)
    setRenameError('')
    try {
      const res = await fetch(`${API_BASE_PATH}/api/schedule-categories/${renaming.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label: renameLabel.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Gagal mengubah nama kategori.')
      setRenaming(null)
      await load()
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setRenaming2(false)
    }
  }

  const confirmDeleteCategory = async () => {
    if (!pendingDeleteCategory) return
    setDeletingCategory(true)
    try {
      await fetch(`${API_BASE_PATH}/api/schedule-categories/${pendingDeleteCategory.id}`, { method: 'DELETE', credentials: 'include' })
      await load()
    } finally {
      setDeletingCategory(false)
      setPendingDeleteCategory(null)
    }
  }

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
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">Unggah PDF atau gambar apa pun per kategori — bisa lebih dari satu file, dan tambahkan kategori baru sendiri (misal Diagram Security Area) kapan saja. Semuanya tampil di Home.</p>
          </div>
          <button
            type="button"
            onClick={() => { setAddingCategory(true); setNewCategoryLabel(''); setCategoryError('') }}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5"
          >
            <Plus className="size-4" /> Tambah Kategori
          </button>
        </div>
      </header>

      {addingCategory && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kategori jadwal baru</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input value={newCategoryLabel} onChange={(e) => setNewCategoryLabel(e.target.value)} placeholder="Contoh: Diagram Security Area" autoFocus className={inputClass} onKeyDown={(e) => e.key === 'Enter' && submitAddCategory()} />
            <div className="flex items-center gap-1.5">
              <button onClick={submitAddCategory} disabled={savingCategory || !newCategoryLabel.trim()} className="grid size-9 place-items-center rounded-xl text-primary transition hover:bg-secondary disabled:opacity-50" aria-label="Simpan"><Check className="size-4" /></button>
              <button onClick={() => setAddingCategory(false)} className="grid size-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-secondary" aria-label="Batal"><X className="size-4" /></button>
            </div>
          </div>
          {categoryError && <p className="mt-2 text-xs text-destructive">{categoryError}</p>}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center shadow-sm">
          <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" />
          <p className="text-sm text-muted-foreground">Memuat...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-secondary/40 p-12 text-center text-sm text-muted-foreground">Belum ada kategori jadwal. Klik &quot;Tambah Kategori&quot; untuk membuat yang pertama.</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {categories.map((category) => (
            <UploadSlot
              key={category.id}
              category={category}
              docs={docsByCategory.get(category.slug) ?? []}
              onChanged={load}
              onRename={startRename}
              onDelete={setPendingDeleteCategory}
            />
          ))}
        </div>
      )}

      {renaming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(14,34,53,0.5)] p-4">
          <div role="dialog" aria-modal="true" aria-label="Ubah nama kategori" className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-[0_20px_50px_rgba(14,34,53,0.25)]">
            <div className="mb-5 flex items-start justify-between">
              <h2 className="text-[15px] font-bold text-[#20354a]">Ubah nama kategori</h2>
              <button type="button" onClick={() => setRenaming(null)} aria-label="Tutup" className="grid h-8 w-8 place-items-center rounded-full text-[#8798a8] hover:bg-[#f0f4f7]"><X className="w-[18px]" /></button>
            </div>
            <input value={renameLabel} onChange={(e) => setRenameLabel(e.target.value)} autoFocus className={inputClass} onKeyDown={(e) => e.key === 'Enter' && submitRename()} />
            {renameError && <p className="mt-2 text-xs text-destructive">{renameError}</p>}
            <button
              type="button"
              onClick={submitRename}
              disabled={renaming2 || !renameLabel.trim()}
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[7px] bg-[#20354a] text-[13px] font-medium text-white hover:bg-[#284360] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check className="size-4" />{renaming2 ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDeleteCategory}
        title="Hapus kategori?"
        message={`Kategori "${pendingDeleteCategory?.label}" beserta ${docsByCategory.get(pendingDeleteCategory?.slug ?? '')?.length ?? 0} file di dalamnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
        pending={deletingCategory}
        onConfirm={confirmDeleteCategory}
        onCancel={() => setPendingDeleteCategory(null)}
      />
    </div>
  )
}
