'use client'

import { Eye, FileSpreadsheet, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'

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
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold"
      style={isXls ? { background: '#e3f5e3', color: '#1f7a3f' } : { background: '#fde4e4', color: '#a13030' }}
    >
      {isXls ? 'XLS' : variant ? `PDF(${variant})` : 'PDF'}
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

function GroupHeaderRow({ header }: { header: FormCsGroupHeader }) {
  return (
    <tr>
      <td colSpan={2} className="border border-[#a8c9c9] bg-[#b8dede] p-2 align-top">
        <div className="mb-1.5 text-center text-[12px] font-bold uppercase leading-snug text-[#20354a]">{header.label}</div>
        <div className="grid grid-cols-6 gap-1">
          {MONTH_BADGES.map((badge) => (
            <span
              key={badge.label}
              className="rounded px-1 py-1 text-center text-[9.5px] font-bold"
              style={badge.year === 2024 ? { background: '#d6f5f5', color: '#1a7a7a', border: '1px solid #a8e0e0' } : { background: '#d4f5c8', color: '#2f7a1f', border: '1px solid #a8e0a0' }}
            >
              {badge.label}
            </span>
          ))}
        </div>
      </td>
      <td className="border border-[#a8c9c9] bg-[#f5faf9]" />
      <td className="border border-[#a8c9c9] bg-[#f5faf9]" />
      <td className="border border-[#a8c9c9] bg-[#f5faf9]" />
    </tr>
  )
}

function WebBaseApprovalCell() {
  return (
    <div className="inline-flex flex-col gap-1 rounded border border-[#c9d6de] bg-[#f5f8fa] p-1.5 text-center text-[10px]">
      <span className="font-bold text-[#3c5369]">WEB BASE :</span>
      <div className="grid grid-cols-2 gap-1">
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-[#3c5369]">NON-YAZAKI</span>
          <span className="rounded bg-[#f6d3d3] px-1.5 py-0.5 font-bold text-[#a13030]">APPROVAL</span>
          <span className="rounded bg-[#dbeef0] px-1.5 py-0.5 font-bold text-[#20776e]">LIST ALL</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-[#3c5369]">YAZAKI</span>
          <span className="rounded bg-[#f6d3d3] px-1.5 py-0.5 font-bold text-[#a13030]">APPROVAL</span>
          <span className="rounded bg-[#f6e3d3] px-1.5 py-0.5 font-bold text-[#8a5a00]">APPROVAL PLAN</span>
          <span className="rounded bg-[#dbeef0] px-1.5 py-0.5 font-bold text-[#20776e]">LIST ALL</span>
        </div>
      </div>
    </div>
  )
}

function ListAllDaftarCell() {
  const daftarHref = '/foto-video-internal'
  return (
    <div className="flex flex-wrap gap-1.5">
      <Link href="/kelola-permintaan-foto-video" className="rounded bg-[#278e84] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#20776e]">LIST ALL</Link>
      <Link href={daftarHref} className="rounded bg-[#20354a] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#284360]">DAFTAR</Link>
    </div>
  )
}

type Row = { key: string; controlNo: string; title: string; emphasisFrom: number | null; language: string; keteranganType: FormCsDocument['keterangan_type']; keteranganNote: string | null; files: FormCsDocument[] }

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
}: {
  documents: FormCsDocument[]
  groupHeaders: FormCsGroupHeader[]
  query: string
  isLoggedIn: boolean
  onView: (doc: FormCsDocument) => void
  onEdit: (doc: FormCsDocument) => void
  onDelete: (doc: FormCsDocument) => void
}) {
  const rows = groupRows(documents)

  return (
    <div className="overflow-x-auto rounded-xl border border-[#a8c9c9]">
      <table className="w-full min-w-[960px] border-collapse text-[12px]">
        <thead>
          <tr>
            {['CTRL No.', 'NAMA DOKUMEN', 'LANG', 'FILE', 'KETERANGAN'].map((head) => (
              <th key={head} className="border border-[#a8c9c9] bg-[#b8dede] px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-[#20354a]">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupHeaders.map((header) => <GroupHeaderRow key={header.id} header={header} />)}

          {rows.length === 0 && groupHeaders.length === 0 && (
            <tr>
              <td colSpan={5} className="border border-[#a8c9c9] px-5 py-14 text-center">
                <FileSpreadsheet className="mx-auto mb-3 size-9 text-[#a8c0c0]" />
                <p className="font-medium text-[#7290a5]">{query ? 'Tidak ada dokumen yang cocok' : 'Belum ada dokumen'}</p>
              </td>
            </tr>
          )}

          {rows.map((row, index) => (
            <tr key={row.key} className={index % 2 ? 'bg-[#f5faf9]' : 'bg-white'}>
              <td className="border border-[#d8e8e8] px-3 py-2.5 align-top font-semibold text-[#278e84]"><Highlight text={row.controlNo} keyword={query} /></td>
              <td className="min-w-[260px] border border-[#d8e8e8] px-3 py-2.5 align-top font-medium text-[#20354a]">
                <TitleCell title={row.title} emphasisFrom={row.emphasisFrom} keyword={query} />
              </td>
              <td className="border border-[#d8e8e8] px-3 py-2.5 align-top text-[#3c5369]">{row.language}</td>
              <td className="border border-[#d8e8e8] px-3 py-2.5 align-top">
                <div className="flex flex-col items-start gap-1">
                  {row.files.map((file) => (
                    <button key={file.id} type="button" onClick={() => onView(file)} className="cursor-pointer" title="Lihat dokumen">
                      <FileChip kind={file.file_kind} variant={file.file_variant} />
                    </button>
                  ))}
                </div>
              </td>
              <td className="border border-[#d8e8e8] px-3 py-2.5 align-top">
                <div className="flex flex-col gap-2">
                  {row.keteranganType === 'plain-note' && row.keteranganNote && (
                    <span className="text-[11px] italic text-[#c0392b]">{row.keteranganNote}</span>
                  )}
                  {row.keteranganType === 'web-base-approval' && <WebBaseApprovalCell />}
                  {row.keteranganType === 'list-all-daftar' && <ListAllDaftarCell />}

                  {isLoggedIn && (
                    <div className="flex items-center gap-1 pt-1">
                      <button type="button" onClick={() => onEdit(row.files[0])} aria-label={`Edit ${row.controlNo}`} title="Edit" className="grid size-6 place-items-center rounded text-[#7290a5] hover:bg-[#e4edf2] hover:text-[#20354a]"><Pencil className="size-3.5" /></button>
                      {row.files.map((file) => (
                        <button key={file.id} type="button" onClick={() => onDelete(file)} aria-label={`Hapus ${file.control_no}${file.file_variant ? ` (${file.file_variant})` : ''}`} title={`Hapus${file.file_variant ? ` varian ${file.file_variant}` : ''}`} className="grid size-6 place-items-center rounded text-[#7290a5] hover:bg-[#fdecec] hover:text-[#b3413a]"><Trash2 className="size-3.5" /></button>
                      ))}
                      <button type="button" onClick={() => onView(row.files[0])} aria-label={`Lihat ${row.controlNo}`} title="Lihat" className="grid size-6 place-items-center rounded text-[#7290a5] hover:bg-[#e4edf2] hover:text-[#20354a]"><Eye className="size-3.5" /></button>
                    </div>
                  )}
                  {!isLoggedIn && (
                    <button type="button" onClick={() => onView(row.files[0])} aria-label={`Lihat ${row.controlNo}`} title="Lihat" className="grid size-6 w-fit place-items-center rounded text-[#7290a5] hover:bg-[#e4edf2] hover:text-[#20354a]"><Eye className="size-3.5" /></button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
