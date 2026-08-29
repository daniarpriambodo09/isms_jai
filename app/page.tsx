// app/page.tsx

'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, FileText, ImagePlus, Loader2, Move, Plus, Save, Trash2, Type } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import PDFViewer from '@/components/documents/PDFViewer'

type BlockType = 'text' | 'image' | 'pdf'
type Block = { id: string; type: BlockType; x: number; y: number; width: number; height: number; content?: string; src?: string; name?: string }
const CANVAS_WIDTH = 1200
const CANVAS_HEIGHT = 700
const MIN_BLOCK_WIDTH = 80
const MIN_BLOCK_HEIGHT = 60

function createBlockId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function CanvasBlock({
  block,
  edit,
  selected,
  canvasRef,
  onSelect,
  onChange,
  onRemove,
}: {
  block: Block
  edit: boolean
  selected: boolean
  canvasRef: React.RefObject<HTMLDivElement | null>
  onSelect: () => void
  onChange: (patch: Partial<Block>) => void
  onRemove: () => void
}) {
  // Menyimpan posisi awal drag/resize beserta faktor skala kanvas (px layar -> unit kanvas)
  const dragStart = useRef<{ x: number; y: number; blockX: number; blockY: number; scaleX: number; scaleY: number } | null>(null)
  const resizeStart = useRef<{ x: number; y: number; width: number; height: number; scaleX: number; scaleY: number } | null>(null)

  // Kanvas dirender dengan lebar yang bisa menyusut (min-w-[720px] / max-w-[1200px]),
  // sedangkan koordinat blok disimpan dalam unit tetap 1200x700. Tanpa konversi skala ini,
  // pergerakan pointer di layar tidak sebanding dengan pergerakan blok di kanvas -> terasa lemot/macet.
  const getScale = () => {
    const rect = canvasRef.current?.getBoundingClientRect()
    const scaleX = rect && rect.width > 0 ? CANVAS_WIDTH / rect.width : 1
    const scaleY = rect && rect.height > 0 ? CANVAS_HEIGHT / rect.height : 1
    return { scaleX, scaleY }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!edit) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const { scaleX, scaleY } = getScale()
    dragStart.current = { x: event.clientX, y: event.clientY, blockX: block.x, blockY: block.y, scaleX, scaleY }
    onSelect()
  }
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return
    const { x, y, blockX, blockY, scaleX, scaleY } = dragStart.current
    const nextX = blockX + (event.clientX - x) * scaleX
    const nextY = blockY + (event.clientY - y) * scaleY
    onChange({
      x: Math.max(0, Math.min(CANVAS_WIDTH - block.width, nextX)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT - block.height, nextY)),
    })
  }
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStart.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const onResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!edit) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const { scaleX, scaleY } = getScale()
    resizeStart.current = { x: event.clientX, y: event.clientY, width: block.width, height: block.height, scaleX, scaleY }
  }
  const onResizePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeStart.current) return
    event.stopPropagation()
    const { x, y, width, height, scaleX, scaleY } = resizeStart.current
    const nextWidth = width + (event.clientX - x) * scaleX
    const nextHeight = height + (event.clientY - y) * scaleY
    onChange({
      width: Math.max(MIN_BLOCK_WIDTH, Math.min(CANVAS_WIDTH - block.x, nextWidth)),
      height: Math.max(MIN_BLOCK_HEIGHT, Math.min(CANVAS_HEIGHT - block.y, nextHeight)),
    })
  }
  const onResizePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    resizeStart.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const style = {
    left: `${(block.x / CANVAS_WIDTH) * 100}%`,
    top: `${(block.y / CANVAS_HEIGHT) * 100}%`,
    width: `${(block.width / CANVAS_WIDTH) * 100}%`,
    height: `${(block.height / CANVAS_HEIGHT) * 100}%`,
  }
  const pdfPath = block.src?.split('path=')[1] ? decodeURIComponent(block.src.split('path=')[1]) : block.src

  return (
    <div
      className={`group absolute overflow-hidden rounded-lg border select-none ${selected ? 'border-accent ring-2 ring-accent/30' : 'border-transparent'} ${edit ? 'cursor-move' : ''}`}
      style={{ ...style, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(event) => { event.stopPropagation(); onSelect() }}
    >
      {block.type === 'text' && (edit ? (
        <textarea value={block.content ?? ''} onChange={(event) => onChange({ content: event.target.value })} onPointerDown={(event) => event.stopPropagation()} className="h-full w-full resize-none bg-transparent p-4 text-lg font-medium text-foreground outline-none" />
      ) : (
        <p className="h-full whitespace-pre-wrap p-4 text-lg font-medium text-foreground">{block.content}</p>
      ))}
      {block.type === 'image' && block.src && (
        <img src={block.src} alt={block.name ?? 'Canvas image'} draggable={false} className="h-full w-full object-cover" />
      )}
      {block.type === 'pdf' && pdfPath && (
        <div className="relative h-full w-full bg-card">
          {/* Saat mode edit, overlay ini menangkap pointer duluan supaya blok PDF tetap bisa
              digeser/di-resize walau kontrol internal PDFViewer (scroll, tombol, dsb) ada di atasnya. */}
          {edit && <div className="absolute inset-0 z-10" />}
          <PDFViewer filePath={pdfPath} fileName={block.name ?? 'Dokumen PDF'} />
        </div>
      )}
      {edit && selected && (
        <>
          <button
            type="button"
            title="Hapus elemen"
            aria-label="Hapus elemen"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onRemove() }}
            className="absolute right-2 top-2 z-20 grid size-8 place-items-center rounded-md bg-destructive text-white shadow"
          >
            <Trash2 className="size-4" />
          </button>
          <div
            role="presentation"
            title="Ubah ukuran"
            aria-label="Ubah ukuran elemen"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
            onClick={(event) => event.stopPropagation()}
            className="absolute bottom-1 right-1 z-20 size-4 cursor-se-resize rounded-sm border-2 border-white bg-accent shadow"
            style={{ touchAction: 'none' }}
          />
        </>
      )}
    </div>
  )
}

function EmptyCanvasState({
  isLoggedIn,
  onAddText,
  onUpload,
}: {
  isLoggedIn: boolean
  onAddText: () => void
  onUpload: (type: 'image' | 'pdf', file: File) => void
}) {
  if (!isLoggedIn) {
    return (
      <div className="absolute inset-0 grid place-items-center text-center text-muted-foreground">
        <div>
          <FileText className="mx-auto mb-3 size-8 opacity-60" />
          <p className="font-medium">Konten home akan segera hadir di sini.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="absolute inset-0 grid place-items-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border bg-card/60 px-8 py-10 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-secondary">
          <Plus className="size-6 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-primary">Kanvas home masih kosong</p>
          <p className="mt-1 text-sm text-muted-foreground">Tambahkan teks, foto, atau dokumen PDF untuk mulai menyusun tampilan halaman awal.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={onAddText} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary">
            <Type className="size-4" />Teks
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary">
            <ImagePlus className="size-4" />Foto
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload('image', file); event.currentTarget.value = '' }} />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary">
            <FileText className="size-4" />PDF
            <input type="file" accept="application/pdf" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload('pdf', file); event.currentTarget.value = '' }} />
          </label>
        </div>
      </div>
    </div>
  )
}

type Asset = { src: string; name: string }
type HomeLayout = { image: Asset | null; pdf: Asset | null }
const emptyLayout: HomeLayout = { image: null, pdf: null }

function pdfPath(src: string) {
  try { return new URL(src, window.location.origin).searchParams.get('path') ?? src } catch { return src }
}

function UploadBox({ kind, asset, editable, onUpload, onRemove }: { kind: 'image' | 'pdf'; asset: Asset | null; editable: boolean; onUpload: (file: File) => void; onRemove: () => void }) {
  const isImage = kind === 'image'
  return <div className="relative min-h-[520px] bg-white">
    {asset ? (isImage ? <img src={asset.src} alt={asset.name} className="h-full min-h-[520px] w-full object-contain" /> : <PDFViewer filePath={pdfPath(asset.src)} fileName={asset.name} />) : editable ? (
      <label className="flex min-h-[520px] cursor-pointer flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground transition-colors hover:bg-secondary/40">
        {isImage ? <ImagePlus className="size-10 opacity-60" /> : <FileText className="size-10 opacity-60" />}<span className="font-semibold text-primary">Upload {isImage ? 'gambar' : 'PDF'}</span><span className="text-sm">{isImage ? 'JPG, PNG, atau WebP' : 'Dokumen PDF untuk detail gambar'}</span>
        <input type="file" accept={isImage ? 'image/jpeg,image/png,image/webp' : 'application/pdf'} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.currentTarget.value = '' }} />
      </label>
    ) : <div className="grid min-h-[520px] place-items-center px-6 text-center text-muted-foreground"><span>Belum ada {isImage ? 'gambar' : 'detail PDF'}.</span></div>}
    {asset && editable && <div className="absolute right-3 top-3 flex items-center gap-2"><label className="inline-flex cursor-pointer items-center gap-2 bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">{isImage ? <ImagePlus className="size-4" /> : <FileText className="size-4" />} Ganti<input type="file" accept={isImage ? 'image/jpeg,image/png,image/webp' : 'application/pdf'} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.currentTarget.value = '' }} /></label><button type="button" title={`Hapus ${isImage ? 'gambar' : 'PDF'}`} aria-label={`Hapus ${isImage ? 'gambar' : 'PDF'}`} onClick={onRemove} className="grid size-8 place-items-center bg-destructive text-white shadow-sm hover:bg-destructive/90"><Trash2 className="size-4" /></button></div>}
  </div>
}

export default function Page() {
  const { isLoggedIn, isLoading: authLoading } = useAuth()
  const [layout, setLayout] = useState<HomeLayout>(emptyLayout)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { fetch(`${API_BASE_PATH}/api/home-canvas`, { cache: 'no-store' }).then((res) => res.json()).then((data) => setLayout(data.layout ?? emptyLayout)).catch(() => setMessage('Konten home belum dapat dimuat.')).finally(() => setLoading(false)) }, [])
  const upload = async (kind: 'image' | 'pdf', file: File) => {
    setMessage('Mengunggah aset...')
    try { const form = new FormData(); form.append('file', file); const res = await fetch(`${API_BASE_PATH}/api/home-canvas`, { method: 'POST', body: form }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.message ?? `Upload gagal (HTTP ${res.status}).`); setLayout((current) => ({ ...current, [kind]: { src: data.url, name: data.name } })); setMessage('Aset siap ditampilkan. Klik Simpan untuk menerbitkan perubahan.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Upload gagal. Periksa koneksi server dan sesi admin.') }
  }
  const save = async () => {
    setSaving(true); setMessage('Menyimpan konten home...')
    try { const res = await fetch(`${API_BASE_PATH}/api/home-canvas`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout }) }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.message ?? `Gagal menyimpan (HTTP ${res.status}).`); setLayout(data.layout ?? layout); setMessage('Konten home tersimpan.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal menyimpan konten home.') } finally { setSaving(false) }
  }
  return <div className="space-y-5">
    {!authLoading && isLoggedIn && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><div><p className="portal-eyebrow">Home content</p><h2 className="text-xl font-bold text-primary">Kelola gambar dan detail PDF</h2></div><button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan</button></div>}
    {message && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Check className="size-4 text-accent-foreground" />{message}</p>}
    {loading ? <div className="grid min-h-[520px] place-items-center bg-white"><Loader2 className="size-7 animate-spin text-muted-foreground" /></div> : <section className="grid grid-cols-1 gap-6 lg:grid-cols-2"><div><p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-primary">Gambar</p><UploadBox kind="image" asset={layout.image} editable={isLoggedIn} onUpload={(file) => upload('image', file)} onRemove={() => setLayout((current) => ({ ...current, image: null }))} /></div><div><p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-primary">Detail PDF</p><UploadBox kind="pdf" asset={layout.pdf} editable={isLoggedIn} onUpload={(file) => upload('pdf', file)} onRemove={() => setLayout((current) => ({ ...current, pdf: null }))} /></div></section>}
    {isLoggedIn && <p className="text-xs text-muted-foreground">Gunakan tombol upload pada masing-masing kolom, lalu klik Simpan untuk menerbitkan perubahan.</p>}
  </div>
}