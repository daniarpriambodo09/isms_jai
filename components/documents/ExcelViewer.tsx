// components/documents/ExcelViewer.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { API_BASE_PATH } from '@/lib/config'

export default function ExcelViewer({ filePath, fileName }: { filePath: string; fileName: string }) {
  const [html, setHtml] = useState<string | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const workbookRef = useRef<XLSX.WorkBook | null>(null)
  const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath
  const serveUrl = `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(cleanPath)}`
  const extension = filePath.split('.').pop()?.toLowerCase()
  const downloadName = extension && !fileName.toLowerCase().endsWith(`.${extension}`) ? `${fileName}.${extension}` : fileName

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError(false)
        const res = await fetch(serveUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buffer = await res.arrayBuffer()
        if (cancelled) return

        const workbook = XLSX.read(buffer, { type: 'array' })
        workbookRef.current = workbook
        setSheetNames(workbook.SheetNames)
        setActiveSheet(0)
      } catch (err) {
        console.error('ExcelViewer: gagal memuat file', err)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [filePath])

  useEffect(() => {
    const workbook = workbookRef.current
    const sheetName = sheetNames[activeSheet]
    if (!workbook || !sheetName) return
    const sheet = workbook.Sheets[sheetName]
    setHtml(XLSX.utils.sheet_to_html(sheet, { editable: false }))
  }, [sheetNames, activeSheet])

  if (loading) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-3 bg-slate-50 py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
        <p className="text-sm text-slate-500">Memuat dokumen Excel...</p>
      </div>
    )
  }

  if (error || !html) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 bg-slate-50 py-16">
        <p className="font-medium text-slate-700">Gagal memuat file Excel</p>
        <p className="text-sm text-slate-500">File tidak dapat ditampilkan di browser</p>
        <a
          href={serveUrl}
          download={downloadName}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#20354a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#284360]"
        >
          <Download className="size-4" /> Download File
        </a>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#e4edf2] bg-slate-50 px-3 py-2">
        {sheetNames.length > 1 ? (
          <div className="flex gap-1 overflow-x-auto">
            {sheetNames.map((name, index) => (
              <button
                key={name}
                type="button"
                onClick={() => setActiveSheet(index)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${index === activeSheet ? 'bg-[#20354a] text-white' : 'text-[#3c5369] hover:bg-slate-200'}`}
              >
                {name}
              </button>
            ))}
          </div>
        ) : <span />}
        <a
          href={serveUrl}
          download={downloadName}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#20354a] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#284360]"
        >
          <Download className="size-3.5" /> Download
        </a>
      </div>
      <div
        className="excel-viewer-table flex-1 overflow-auto p-3"
        // sheet_to_html output comes from our own trusted /api/files/serve fetch
        // (an admin-uploaded xlsx we control), not user-supplied HTML — safe to inject.
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style jsx global>{`
        .excel-viewer-table table { border-collapse: collapse; font-size: 12px; }
        .excel-viewer-table td, .excel-viewer-table th { border: 1px solid #e4edf2; padding: 4px 8px; white-space: nowrap; }
      `}</style>
    </div>
  )
}
