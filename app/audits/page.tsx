// app/audits/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, FileText, Maximize2, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { DocumentViewModal } from '@/components/documents/DocumentViewModal'
import { useEscapeClose } from '@/hooks/useEscapeClose'

type ScheduleDocument = {
  id: number
  kind: 'audit' | 'training'
  file_path: string
  mime_type: string
  title: string | null
  description: string | null
  uploaded_at: string
  uploaded_by: string | null
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fileUrl(doc: ScheduleDocument) {
  return `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(doc.file_path)}`
}

export default function AuditsPage() {
  const [docs, setDocs] = useState<ScheduleDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [openDoc, setOpenDoc] = useState<ScheduleDocument | null>(null)

  useEscapeClose(Boolean(openDoc), () => setOpenDoc(null))

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/schedule-documents`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { documents: {} }))
      .then((data: { documents?: { audit: ScheduleDocument[] } }) => setDocs(data.documents?.audit ?? []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [])

  const isImageOpen = openDoc?.mime_type.startsWith('image/')
  const isPdfOpen = openDoc?.mime_type === 'application/pdf'

  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: '#e0eaf1',
        background: 'linear-gradient(145deg, #ffffff 0%, #f7fafc 100%)',
        boxShadow: '0 4px 20px rgba(34,58,79,0.06), 0 1px 4px rgba(34,58,79,0.04)',
      }}
    >
      <div
        className="border-b px-7 py-6"
        style={{ borderColor: '#e8f0f5', background: 'linear-gradient(135deg, #f8fbfd 0%, #f0f6fa 100%)' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, #1a5f7a 0%, #278e84 100%)', boxShadow: '0 4px 12px rgba(39,142,132,0.3)', color: 'white' }}
          >
            <CalendarDays className="size-5" />
          </div>
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: '#278e84' }}>Monitoring</div>
            <h2 className="text-[20px] font-bold tracking-tight" style={{ color: '#1a2f3e' }}>Internal Audit Schedule</h2>
            <p className="mt-1 text-[12.5px] leading-snug" style={{ color: '#6a8499' }}>Jadwal audit terbaru yang diunggah admin ISM.</p>
          </div>
        </div>
      </div>

      <div className="p-7 max-[680px]:p-4">
        {loading ? (
          <div className="h-64 animate-pulse rounded-xl bg-secondary/50" />
        ) : docs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 px-6 py-14 text-center text-sm text-muted-foreground">
            <CalendarDays className="mx-auto mb-3 size-9 text-muted-foreground/40" />
            Belum ada jadwal audit diunggah.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {docs.map((doc) => {
              const isImage = doc.mime_type.startsWith('image/')
              return isImage ? (
                <div key={doc.id}>
                  <button
                    type="button"
                    onClick={() => setOpenDoc(doc)}
                    className="group relative block w-full overflow-hidden rounded-2xl shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    <div className="aspect-video w-full">
                      <img src={fileUrl(doc)} alt={doc.title ?? 'Jadwal Audit'} className="h-full w-full object-cover" />
                    </div>
                    <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                      <Maximize2 className="size-4" />
                    </span>
                  </button>
                  {(doc.title || doc.description) && (
                    <div className="mt-2 px-1">
                      {doc.title && <p className="text-sm font-semibold" style={{ color: '#1a2f3e' }}>{doc.title}</p>}
                      {doc.description && <p className="mt-0.5 text-xs" style={{ color: '#7a9bb0' }}>{doc.description}</p>}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setOpenDoc(doc)}
                  className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <span className="grid size-12 flex-shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-primary">
                    <FileText className="size-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{doc.title ?? 'Jadwal Audit'}</p>
                    {doc.description && <p className="truncate text-xs" style={{ color: '#7a9bb0' }}>{doc.description}</p>}
                    <p className="text-xs" style={{ color: '#7a9bb0' }}>Diperbarui {formatDate(doc.uploaded_at)}{doc.uploaded_by && ` oleh ${doc.uploaded_by}`} · Klik untuk membuka</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {openDoc && (
        isPdfOpen ? (
          <DocumentViewModal open={Boolean(openDoc)} onClose={() => setOpenDoc(null)} filePath={openDoc.file_path} fileName={openDoc.title ?? 'Jadwal Audit'} />
        ) : isImageOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/90" onClick={() => setOpenDoc(null)}>
            <img src={fileUrl(openDoc)} alt={openDoc.title ?? 'Jadwal Audit'} className="h-screen w-screen object-contain" onClick={(e) => e.stopPropagation()} />
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
