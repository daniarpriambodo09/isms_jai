// components/documents/DocumentViewModal.tsx
'use client'

import { Download, X } from 'lucide-react'
import PDFViewer from '@/components/documents/PDFViewer'
import ExcelViewer from '@/components/documents/ExcelViewer'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'

const EXCEL_MIME_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

function kindOf(mimeType: string, filePath: string) {
  const extension = filePath.split('.').pop()?.toLowerCase() ?? ''
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension)) return 'image'
  if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf'
  if (EXCEL_MIME_TYPES.includes(mimeType) || ['xls', 'xlsx'].includes(extension)) return 'excel'
  return 'other'
}

export function DocumentViewModal({
  open,
  onClose,
  filePath,
  fileName,
  mimeType = 'application/pdf',
}: {
  open: boolean
  onClose: () => void
  filePath: string
  fileName: string
  /** Defaults to PDF since most callers only ever hold PDFs. Pass the real
      mime type (or rely on the file extension) to route to the right
      preview — video, image, Excel, or a plain "open file" fallback for
      anything else (PPT, DOC, ...) that can't be rendered inline. */
  mimeType?: string
}) {
  useEscapeClose(open, onClose)

  if (!open) return null

  const kind = kindOf(mimeType, filePath)
  const serveUrl = `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(filePath)}`
  const isCompact = kind === 'video' || kind === 'other'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(14,34,53,0.5)] p-4">
      <div role="dialog" aria-modal="true" aria-label={fileName} className={`flex w-full flex-col rounded-2xl bg-white shadow-[0_20px_50px_rgba(14,34,53,0.25)] ${isCompact ? 'max-w-[960px]' : 'h-[85vh] max-w-[900px]'}`}>
        <div className="flex items-center justify-between border-b border-[#e4edf2] px-5 py-4">
          <h2 className="truncate text-[14px] font-semibold text-[#20354a]">{fileName}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 flex-none place-items-center rounded-full text-[#8798a8] hover:bg-[#f0f4f7]"
          >
            <X className="w-[18px]" />
          </button>
        </div>
        {kind === 'video' && (
          <video controls autoPlay src={serveUrl} className="max-h-[80vh] w-full bg-black" />
        )}
        {kind === 'image' && (
          <div className="flex-1 overflow-auto bg-slate-50 p-4"><img src={serveUrl} alt={fileName} className="mx-auto max-w-full" /></div>
        )}
        {kind === 'pdf' && (
          <div className="flex-1 overflow-auto"><PDFViewer filePath={filePath} fileName={fileName} /></div>
        )}
        {kind === 'excel' && (
          <div className="flex-1 overflow-auto"><ExcelViewer filePath={filePath} fileName={fileName} /></div>
        )}
        {kind === 'other' && (
          <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <p className="text-sm text-[#5a6b7d]">Tipe file ini tidak dapat ditampilkan langsung di browser — silakan download untuk membukanya.</p>
            <a
              href={serveUrl}
              download={fileName}
              className="inline-flex items-center gap-2 rounded-lg bg-[#20354a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#284360]"
            >
              <Download className="size-4" /> Download File
            </a>
          </div>
        )}
      </div>
    </div>
  )
}