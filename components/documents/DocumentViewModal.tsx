// components/documents/DocumentViewModal.tsx
'use client'

import { X } from 'lucide-react'
import PDFViewer from '@/components/documents/PDFViewer'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'

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
  /** Defaults to PDF — every other caller only ever holds PDFs. Pass the
      real mime type to let this same modal play a video instead. */
  mimeType?: string
}) {
  useEscapeClose(open, onClose)

  if (!open) return null

  const isVideo = mimeType.startsWith('video/')

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(14,34,53,0.5)] p-4">
      <div role="dialog" aria-modal="true" aria-label={fileName} className={`flex w-full flex-col rounded-2xl bg-white shadow-[0_20px_50px_rgba(14,34,53,0.25)] ${isVideo ? 'max-w-[960px]' : 'h-[85vh] max-w-[900px]'}`}>
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
        {isVideo ? (
          <video
            controls
            autoPlay
            src={`${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(filePath)}`}
            className="max-h-[80vh] w-full bg-black"
          />
        ) : (
          <div className="flex-1 overflow-auto">
            <PDFViewer filePath={filePath} fileName={fileName} />
          </div>
        )}
      </div>
    </div>
  )
}