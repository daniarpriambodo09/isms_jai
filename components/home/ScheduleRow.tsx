'use client'

import { useState } from 'react'
import { FileText, Maximize2, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { DocumentViewModal } from '@/components/documents/DocumentViewModal'
import { useEscapeClose } from '@/hooks/useEscapeClose'

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

export function ScheduleRow({ label, docs }: { label: string; docs: ScheduleDocument[] }) {
  const [openDoc, setOpenDoc] = useState<ScheduleDocument | null>(null)

  useEscapeClose(Boolean(openDoc), () => setOpenDoc(null))

  const isImageOpen = openDoc?.mime_type.startsWith('image/')
  const isPdfOpen = openDoc?.mime_type === 'application/pdf'

  if (docs.length === 0) return null

  return (
    <section>
      <div className="flex flex-col">
        {docs.map((doc) => {
          const isImage = doc.mime_type.startsWith('image/')
          return isImage ? (
            <button
              key={doc.id}
              type="button"
              onClick={() => setOpenDoc(doc)}
              className={`group relative block w-full overflow-hidden ${FULL_BLEED}`}
            >
              {/* Full width, natural height — no forced box, so no side letterbox
                  bars and nothing cropped, whatever the image's own proportions. */}
              <img src={fileUrl(doc)} alt={doc.title ?? label} className="block h-auto w-full" />
              <span className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                <Maximize2 className="size-4" />
              </span>
            </button>
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
