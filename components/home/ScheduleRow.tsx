'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, FileText, GraduationCap, Maximize2, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { DocumentViewModal } from '@/components/documents/DocumentViewModal'
import { useEscapeClose } from '@/hooks/useEscapeClose'

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

const KIND_META: Record<Kind, { title: string; icon: typeof CalendarDays }> = {
  audit: { title: 'Upcoming Audit Schedule', icon: CalendarDays },
  training: { title: 'Upcoming Training Schedule', icon: GraduationCap },
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fileUrl(doc: ScheduleDocument) {
  return `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(doc.file_path)}`
}

export function ScheduleRow({ kind }: { kind: Kind }) {
  const [docs, setDocs] = useState<ScheduleDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [openDoc, setOpenDoc] = useState<ScheduleDocument | null>(null)
  const meta = KIND_META[kind]
  const Icon = meta.icon

  useEscapeClose(Boolean(openDoc), () => setOpenDoc(null))

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/schedule-documents`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { documents: {} }))
      .then((data: { documents?: Record<Kind, ScheduleDocument[]> }) => setDocs(data.documents?.[kind] ?? []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [kind])

  const isImageOpen = openDoc?.mime_type.startsWith('image/')
  const isPdfOpen = openDoc?.mime_type === 'application/pdf'

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span
          className="grid size-8 place-items-center rounded-full text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, oklch(0.39 0.09 205) 0%, oklch(0.48 0.12 180) 100%)' }}
        >
          <Icon className="size-4" />
        </span>
        <p className="portal-eyebrow">{meta.title}</p>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-secondary/50" />
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-6 py-10 text-center text-sm text-muted-foreground">Belum ada jadwal diunggah.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {docs.map((doc) => {
            const isImage = doc.mime_type.startsWith('image/')
            return isImage ? (
              <div key={doc.id}>
                <button
                  type="button"
                  onClick={() => setOpenDoc(doc)}
                  className="group relative block w-full overflow-hidden rounded-[28px] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <div className="aspect-video w-full">
                    <img src={fileUrl(doc)} alt={doc.title ?? meta.title} className="h-full w-full object-cover" />
                  </div>
                  <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <Maximize2 className="size-4" />
                  </span>
                </button>
                {(doc.title || doc.description) && (
                  <div className="mt-2 px-1">
                    {doc.title && <p className="text-sm font-semibold text-foreground">{doc.title}</p>}
                    {doc.description && <p className="mt-0.5 text-xs text-muted-foreground">{doc.description}</p>}
                  </div>
                )}
              </div>
            ) : (
              <button
                key={doc.id}
                type="button"
                onClick={() => setOpenDoc(doc)}
                className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <span className="grid size-12 flex-shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-primary">
                  <FileText className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{doc.title ?? meta.title}</p>
                  {doc.description && <p className="truncate text-xs text-muted-foreground">{doc.description}</p>}
                  <p className="text-xs text-muted-foreground">Diperbarui {formatDate(doc.uploaded_at)} · Klik untuk membuka</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {openDoc && (
        isPdfOpen ? (
          <DocumentViewModal open={Boolean(openDoc)} onClose={() => setOpenDoc(null)} filePath={openDoc.file_path} fileName={openDoc.title ?? meta.title} />
        ) : isImageOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/90" onClick={() => setOpenDoc(null)}>
            <img src={fileUrl(openDoc)} alt={openDoc.title ?? meta.title} className="h-screen w-screen object-contain" onClick={(e) => e.stopPropagation()} />
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
