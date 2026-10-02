'use client'

import { useState } from 'react'
import { FileText, Maximize2, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { DocumentViewModal } from '@/components/documents/DocumentViewModal'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ChapterHeader, type ChapterTone } from '@/components/home/ChapterHeader'
import { ScrollAperture } from '@/components/home/ScrollAperture'

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

// Breaks each schedule image out of <main>'s centered max-width/padding so it
// spans the full browser width edge-to-edge, flush against the gallery above
// and the next schedule row below — one continuous strip of images, no gaps.
const FULL_BLEED = 'w-screen ml-[calc(50%-50vw)]'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fileUrl(doc: ScheduleDocument) {
  return `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(doc.file_path)}`
}

// Natural height, nothing cropped — and never stretched far past the file's
// own pixels: a small upload shown edge-to-edge on a wide screen turns to
// mush. Wider screens get the image centred on a soft blurred copy of itself.
const MAX_UPSCALE = 1.15

function ScheduleImage({ src, alt }: { src: string; alt: string }) {
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null)
  return (
    <span className="relative block overflow-hidden bg-muted">
      <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl" />
      <img
        src={src}
        alt={alt}
        onLoad={(event) => setNaturalWidth(event.currentTarget.naturalWidth)}
        ref={(img) => { if (img?.complete && img.naturalWidth && naturalWidth === null) setNaturalWidth(img.naturalWidth) }}
        className="relative mx-auto block h-auto w-full"
        style={{ maxWidth: naturalWidth ? Math.round(naturalWidth * MAX_UPSCALE) : undefined }}
      />
    </span>
  )
}

export function ScheduleRow({ label, docs, tone = 'light' }: { label: string; docs: ScheduleDocument[]; tone?: ChapterTone }) {
  const [openDoc, setOpenDoc] = useState<ScheduleDocument | null>(null)

  useEscapeClose(Boolean(openDoc), () => setOpenDoc(null))

  const isImageOpen = openDoc?.mime_type.startsWith('image/')
  const isPdfOpen = openDoc?.mime_type === 'application/pdf'

  if (docs.length === 0) return null

  const latest = docs.reduce((max, doc) => (doc.uploaded_at > max ? doc.uploaded_at : max), docs[0].uploaded_at)

  return (
    <section>
      <ChapterHeader
        eyebrow="Jadwal"
        title={label}
        meta={`${docs.length} file · diperbarui ${formatDate(latest)}`}
        tone={tone}
      >
        {docs.some((doc) => doc.mime_type.startsWith('image/')) && (
          <p className="flex items-center gap-2 font-mono-label text-[10px] opacity-60">
            <Maximize2 className="size-3.5" /> Klik gambar untuk memperbesar
          </p>
        )}
      </ChapterHeader>
      <div className="flex flex-col">
        {docs.map((doc) => {
          const isImage = doc.mime_type.startsWith('image/')
          return isImage ? (
            <ScrollAperture key={doc.id} className={FULL_BLEED}>
              <button
                type="button"
                onClick={() => setOpenDoc(doc)}
                className="group relative block w-full overflow-hidden"
              >
                <ScheduleImage src={fileUrl(doc)} alt={doc.title ?? label} />
                <span className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                  <Maximize2 className="size-4" />
                </span>
              </button>
            </ScrollAperture>
          ) : (
            <button
              key={doc.id}
              type="button"
              onClick={() => setOpenDoc(doc)}
              className="my-1.5 flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="grid size-12 flex-shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-primary">
                <FileText className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{doc.title ?? label}</p>
                {doc.description && <p className="truncate text-xs text-muted-foreground">{doc.description}</p>}
                <p className="text-xs text-muted-foreground">Diperbarui {formatDate(doc.uploaded_at)} · Klik untuk membuka</p>
              </div>
            </button>
          )
        })}
      </div>

      {openDoc && (
        isPdfOpen ? (
          <DocumentViewModal open={Boolean(openDoc)} onClose={() => setOpenDoc(null)} filePath={openDoc.file_path} fileName={openDoc.title ?? label} />
        ) : isImageOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/90" onClick={() => setOpenDoc(null)}>
            <img src={fileUrl(openDoc)} alt={openDoc.title ?? label} className="h-screen w-screen object-contain" onClick={(e) => e.stopPropagation()} />
            <button
              type="button"
              onClick={() => setOpenDoc(null)}
              aria-label="Tutup"
              className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <X className="size-5" />
            </button>
          </div>
        ) : null
      )}
    </section>
  )
}
