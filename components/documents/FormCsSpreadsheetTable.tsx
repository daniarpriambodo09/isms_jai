'use client'

import { Eye, FileSpreadsheet, Pencil, Trash2 } from 'lucide-react'

export type FormCsDocument = {
  id: number
  control_no: string
  title: string
  language: string
  uploaded_at: string
  file_path: string
  keterangan_type: 'none' | 'plain-note' | 'web-base-approval' | 'list-all-daftar'
  keterangan_note: string | null
  file_variant: string | null
  file_kind: 'pdf' | 'xls'
  title_emphasis_from: number | null
}

export type FormCsGroupHeader = { id: number; category: string; sort_order: number; label: string; control_no_prefix: string | null }

function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword.trim()) return <>{text}</>
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return <>{text.split(regex).map((part, index) => (regex.test(part) ? <mark key={index} className="rounded-sm bg-accent/35 px-1 text-accent-foreground">{part}</mark> : <span key={index}>{part}</span>))}</>
}

function TitleCell({ title, emphasisFrom, keyword }: { title: string; emphasisFrom: number | null; keyword: string }) {
  if (emphasisFrom == null || emphasisFrom < 0 || emphasisFrom >= title.length) return <Highlight text={title} keyword={keyword} />
  const plain = title.slice(0, emphasisFrom)
  const emphasized = title.slice(emphasisFrom)
  return (
    <>
      <Highlight text={plain} keyword={keyword} />
      <i className="italic"><Highlight text={emphasized} keyword={keyword} /></i>
    </>
  )
}

function FileChip({ kind, variant }: { kind: 'pdf' | 'xls'; variant: string | null }) {
  const isXls = kind === 'xls'
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold"
      style={isXls ? { background: '#dff5e6', color: '#1a6e3a' } : { background: '#fde2e2', color: '#a13030' }}
    >
      {isXls ? 'XLS' : variant ? `PDF (${variant})` : 'PDF'}
    </span>
  )
}

function generateMonthBadges() {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const badges: { label: string; year: 2024 | 2025 }[] = []
  for (let m = 0; m < 12; m++) badges.push({ label: `${months[m]} '24`, year: 2024 })
  for (let m = 0; m < 6; m++) badges.push({ label: `${months[m]} '25`, year: 2025 })
  return badges
}
const MONTH_BADGES = generateMonthBadges()

function GroupHeaderRow({ header, colSpanOffset = 0 }: { header: FormCsGroupHeader; colSpanOffset?: number }) {
  return (
    <tr>
      <td colSpan={2 + colSpanOffset} className="bg-secondary/50 p-3 align-top">
        <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-wide text-primary">{header.label}</div>
        <div className="grid grid-cols-6 gap-1">
          {MONTH_BADGES.map((badge) => (
            <span
              key={badge.label}
              className="rounded-full px-1 py-1 text-center text-[9.5px] font-bold"
              style={badge.year === 2024 ? { background: '#d6f5f5', color: '#1a7a7a' } : { background: '#d4f5c8', color: '#2f7a1f' }}
            >
              {badge.label}
            </span>
          ))}
        </div>
      </td>
      <td className="bg-secondary/50" colSpan={3} />
    </tr>
  )
}

export type FormCsRow = { key: string; controlNo: string; title: string; emphasisFrom: number | null; language: string; keteranganType: FormCsDocument['keterangan_type']; keteranganNote: string | null; files: FormCsDocument[] }
type Row = FormCsRow

function groupRows(documents: FormCsDocument[]): Row[] {
  const map = new Map<string, Row>()
  const order: string[] = []
  for (const doc of documents) {
    const key = doc.control_no
    let row = map.get(key)
    if (!row) {
      row = { key, controlNo: doc.control_no, title: doc.title, emphasisFrom: doc.title_emphasis_from, language: doc.language, keteranganType: doc.keterangan_type, keteranganNote: doc.keterangan_note, files: [] }
      map.set(key, row)
      order.push(key)
    }
    row.files.push(doc)
  }
  return order.map((key) => map.get(key)!)
}

export function FormCsSpreadsheetTable({
  documents,
  groupHeaders,
  query,
  isLoggedIn,
  onView,
  onEdit,
  onDelete,
  selectedIds,
  onToggleRow,
  onToggleAll,
}: {
  documents: FormCsDocument[]
  groupHeaders: FormCsGroupHeader[]
  query: string
  isLoggedIn: boolean
  onView: (doc: FormCsDocument) => void
  onEdit: (doc: FormCsDocument) => void
  onDelete: (doc: FormCsDocument) => void
  selectedIds?: Set<number>
  onToggleRow?: (row: Row) => void
  onToggleAll?: () => void
}) {
  const rows = groupRows(documents)
  const showSelection = isLoggedIn && !!selectedIds && !!onToggleRow && !!onToggleAll
  const allSelected = showSelection && rows.length > 0 && rows.every((row) => row.files.every((f) => selectedIds!.has(f.id)))

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="table-head-gradient">
            <tr>
              {showSelection && (
                <th className="w-9 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="Pilih semua" className="size-4 rounded border-border" />
                </th>
              )}
              {['CTRL No.', 'Nama Dokumen', 'Lang', 'File', 'Keterangan'].map((head) => (
                <th key={head} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groupHeaders.map((header) => <GroupHeaderRow key={header.id} header={header} colSpanOffset={showSelection ? 1 : 0} />)}

            {rows.length === 0 && groupHeaders.length === 0 && (
              <tr>
                <td colSpan={showSelection ? 6 : 5} className="px-5 py-14 text-center">
                  <FileSpreadsheet className="mx-auto mb-3 size-9 text-muted-foreground/40" />
                  <p className="font-medium text-muted-foreground">{query ? 'Tidak ada dokumen yang cocok' : 'Belum ada dokumen'}</p>
                </td>
              </tr>
            )}

            {rows.map((row, index) => (
              <tr key={row.key} className={`table-row-glow ${index % 2 ? 'bg-secondary/20' : ''}`}>
                {showSelection && (
                  <td className="px-4 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={row.files.every((f) => selectedIds!.has(f.id))}
                      onChange={() => onToggleRow!(row)}
                      aria-label={`Pilih ${row.controlNo}`}
                      className="size-4 rounded border-border"
                    />
                  </td>
                )}
                <td className="px-4 py-3 align-top font-semibold text-accent-foreground"><Highlight text={row.controlNo} keyword={query} /></td>
                {/* Nama Dokumen / Lang / File / Aksi are rendered one line per file (rather
                    than collapsed to the first file's data) so that when two files share a
                    Ctrl No — e.g. an Indonesian and a Japanese version — both file names,
                    languages, and their own edit/delete controls are visible and clearly
                    paired, instead of only the first file's title/language showing. */}
                <td className="min-w-[260px] px-4 py-3 align-top font-medium text-foreground">
                  <div className="flex flex-col gap-1.5">
                    {row.files.map((file) => (
                      <div key={file.id}><TitleCell title={file.title} emphasisFrom={file.title_emphasis_from} keyword={query} /></div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 align-top text-muted-foreground">
                  <div className="flex flex-col gap-1.5">
                    {row.files.map((file) => <div key={file.id}>{file.language}</div>)}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-col items-start gap-1.5">
                    {row.files.map((file) => (
                      <button key={file.id} type="button" onClick={() => onView(file)} className="cursor-pointer" title="Lihat dokumen">
                        <FileChip kind={file.file_kind} variant={file.file_variant} />
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-col gap-1.5">
                    {row.files.map((file) => (
                      <div key={file.id} className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 text-[11px] italic text-destructive">{file.keterangan_note}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          {isLoggedIn && <button type="button" onClick={() => onEdit(file)} aria-label={`Edit ${file.title} (${file.language})`} title={`Edit ${file.language}`} className="grid size-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-accent-foreground"><Pencil className="size-3.5" /></button>}
                          {isLoggedIn && <button type="button" onClick={() => onDelete(file)} aria-label={`Hapus ${file.title} (${file.language})`} title={`Hapus ${file.language}`} className="grid size-7 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3.5" /></button>}
                          <button type="button" onClick={() => onView(file)} aria-label={`Lihat ${file.title} (${file.language})`} title={`Lihat ${file.language}`} className="grid size-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-primary"><Eye className="size-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
