// components/documents/DocumentViewModal.tsx
'use client'

import { X } from 'lucide-react'
import PDFViewer from '@/components/documents/PDFViewer'

export function DocumentViewModal({
  open,
  onClose,
  filePath,
  fileName,
}: {
  open: boolean
  onClose: () => void
  filePath: string
  fileName: string
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(14,34,53,0.5)] p-4">
      <div className="flex h-[85vh] w-full max-w-[900px] flex-col rounded-2xl bg-white shadow-[0_20px_50px_rgba(14,34,53,0.25)]">
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
        <div className="flex-1 overflow-auto">
          <PDFViewer filePath={filePath} fileName={fileName} />
        </div>
      </div>
    </div>
  )
}