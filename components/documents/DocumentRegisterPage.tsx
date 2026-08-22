// components/documents/DocumentRegisterPage.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, FileText, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { DocumentViewModal } from '@/components/documents/DocumentViewModal'
import { DocumentFormModal, type EditableDocument } from '@/components/documents/DocumentFormModal'

type ApiDocument = {
  id: number
  title: string
  revision: number
  file_path: string
  uploaded_at: string
}

type DepartmentInfo = { id: number; name: string; slug: string }
type SectionInfo = { id: number; name: string; slug: string }

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword.trim()) return <>{text}</>
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="rounded-sm bg-[#fdf0c9] px-[1px] font-medium text-[#5c4a12]">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

export function DocumentRegisterPage({
  department,
  section,
}: {
  department: DepartmentInfo
  section: SectionInfo | null
}) {
  const { isLoggedIn } = useAuth()
  const [docs, setDocs] = useState<ApiDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState<ApiDocument | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ApiDocument | null>(null)

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ department: department.slug })
    if (section) params.set('section', section.slug)

    try {
      const res = await fetch(`${API_BASE_PATH}/api/documents?${params.toString()}`, {
        cache: 'no-store',
      })
      const data = await res.json()
      setDocs(data.documents ?? [])
    } catch {
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, [department.slug, section])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return docs
    return docs.filter((doc) => doc.title.toLowerCase().includes(q))
  }, [docs, query])

  const handleDelete = async (doc: ApiDocument) => {
    if (!confirm(`Hapus dokumen "${doc.title}"?`)) return
    try {
      const res = await fetch(`${API_BASE_PATH}/api/documents/${doc.id}`, { method: 'DELETE' })
      if (res.ok) loadDocuments()
    } catch {
      // no-op — table just won't refresh
    }
  }

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (doc: ApiDocument) => {
    setEditing(doc)
    setFormOpen(true)
  }

  const editableDocument: EditableDocument | undefined = editing
    ? {
        id: editing.id,
        title: editing.title,
        revision: editing.revision,
        uploadedAt: editing.uploaded_at.slice(0, 10),
      }
    : undefined

  const hasFilter = query.trim() !== ''

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-[9px] text-[10px] font-bold uppercase tracking-[0.13em] text-[#7290a5]">
            DOCUMENT REGISTER
          </div>
          <h2 className="text-[20px] text-[#20354a] tracking-[-0.025em]">
            {section ? `${department.name} — ${section.name}` : department.name}
          </h2>
          <p className="mt-[7px] text-[13px] leading-[1.5] text-[#75889c]">
            Dokumen terkendali untuk {section ? `section ${section.name}` : `departemen ${department.name}`}.
          </p>
        </div>

        {isLoggedIn && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1c2e46] px-4 py-[10px] text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(28,46,70,0.25)] transition-all hover:bg-[#26395a] active:scale-[0.98] [&>svg]:w-4"
          >
            <Plus /> Tambah Dokumen
          </button>
        )}
      </div>

      {/* Toolbar: search */}
      <div className="rounded-2xl border border-[#e6ecf3] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-[14px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#9aacc0]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama dokumen..."
            className="w-full rounded-xl border border-[#e6ecf3] bg-[#f8fafc] py-[10px] pl-[38px] pr-9 text-[13px] text-[#20354a] outline-none transition-colors placeholder:text-[#a2b1bd] hover:bg-white focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#278e84]/[0.35]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Bersihkan pencarian"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a2b1bd] hover:text-[#62768a]"
            >
              <X className="h-[14px] w-[14px]" />
            </button>
          )}
        </div>
        {hasFilter && (
          <p className="mt-[10px] text-[11px] text-[#8599a8]">
            Menampilkan <span className="font-semibold text-[#3c5369]">{filteredDocs.length}</span> dari{' '}
            <span className="font-semibold text-[#3c5369]">{docs.length}</span> dokumen
          </p>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#e6ecf3] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead className="border-b border-[#e6ecf3] bg-[#f8fafc]">
              <tr>
                {['Tanggal Upload', 'Nama Dokumen', 'Revisi', 'Aksi'].map((head) => (
                  <th
                    key={head}
                    className="whitespace-nowrap px-4 py-[13px] text-left text-[10px] font-bold uppercase tracking-wider text-[#7290a5]"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef1f5]">
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center">
                    <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#dce6ed] border-b-[#278e84]" />
                    <p className="text-[12px] text-[#8599a8]">Memuat dokumen...</p>
                  </td>
                </tr>
              )}

              {!loading && filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center">
                    <FileText className="mx-auto mb-3 h-9 w-9 text-[#cdd8e1]" />
                    <p className="text-[13px] font-medium text-[#62768a]">
                      {hasFilter ? 'Tidak ada dokumen yang cocok' : 'Belum ada dokumen'}
                    </p>
                    {hasFilter && (
                      <button
                        onClick={() => setQuery('')}
                        className="mt-[6px] text-[11px] text-[#278e84] hover:underline"
                      >
                        Hapus pencarian
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {filteredDocs.map((doc, index) => (
                <tr
                  key={doc.id}
                  className={`transition-colors hover:bg-[#f4f8fb] ${index % 2 === 1 ? 'bg-[#fbfcfd]' : ''}`}
                >
                  <td className="whitespace-nowrap px-4 py-[13px] text-[#62768a]">
                    {formatDate(doc.uploaded_at)}
                  </td>
                  <td className="min-w-[240px] px-4 py-[13px]">
                    <div className="flex items-center gap-[10px] font-medium text-[#3c5369]">
                      <div className="grid h-[26px] w-[26px] flex-none place-items-center rounded-[7px] bg-[#e6f1f8] text-[#3178a4]">
                        <FileText className="h-[13px] w-[13px]" />
                      </div>
                      <span><Highlight text={doc.title} keyword={query} /></span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-[13px]">
                    <span className="inline-flex items-center rounded-full bg-[#eef2f6] px-[10px] py-[4px] text-[11px] font-semibold text-[#4c5c6e]">
                      Rev. {doc.revision}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-[13px]">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewing(doc)}
                        aria-label={`Lihat ${doc.title}`}
                        title="Lihat dokumen"
                        className="grid h-7 w-7 place-items-center rounded-lg text-[#94a3b8] transition-colors hover:bg-[#e6f1f8] hover:text-[#3178a4] [&>svg]:w-[14px]"
                      >
                        <Eye />
                      </button>

                      {isLoggedIn && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(doc)}
                            aria-label={`Edit ${doc.title}`}
                            title="Edit dokumen"
                            className="grid h-7 w-7 place-items-center rounded-lg text-[#94a3b8] transition-colors hover:bg-[#fbf1de] hover:text-[#a6752f] [&>svg]:w-[13px]"
                          >
                            <Pencil />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(doc)}
                            aria-label={`Hapus ${doc.title}`}
                            title="Hapus dokumen"
                            className="grid h-7 w-7 place-items-center rounded-lg text-[#94a3b8] transition-colors hover:bg-[#fdecec] hover:text-[#c0392b] [&>svg]:w-[13px]"
                          >
                            <Trash2 />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filteredDocs.length > 0 && (
          <div className="border-t border-[#eef1f5] bg-[#fafbfc] px-4 py-[10px] text-[11px] text-[#8599a8]">
            Total {filteredDocs.length} dokumen
          </div>
        )}
      </div>

      {viewing && (
        <DocumentViewModal
          open={Boolean(viewing)}
          onClose={() => setViewing(null)}
          filePath={viewing.file_path}
          fileName={viewing.title}
        />
      )}

      <DocumentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={loadDocuments}
        departmentId={department.id}
        sectionId={section?.id ?? null}
        document={editableDocument}
      />
    </div>
  )
}