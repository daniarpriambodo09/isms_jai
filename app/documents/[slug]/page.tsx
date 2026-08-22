// app/documents/[slug]/page.tsx
'use client'

import { notFound } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Download, FileSpreadsheet, FileText, Search, SlidersHorizontal } from 'lucide-react'
import { documents, titleFor } from '@/lib/portal-data'

export default function DocumentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const [query, setQuery] = useState('')
  const [asc, setAsc] = useState(true)
  const [slug, setSlug] = useState<string | null>(null)

  params.then(({ slug: nextSlug }) => setSlug(nextSlug))

  const allowed = ['standards', 'forms', 'working-standard']

  if (slug && !allowed.includes(slug)) notFound()
  if (!slug) return null

  const title =
    slug === 'standards'
      ? 'Prosedur ISMS'
      : slug === 'forms'
        ? 'ISMS Form Aplikasi & Kontrol CS'
        : slug === 'working-standard'
          ? 'Working Standard & Standard Requirements TMMIN'
          : titleFor(slug)

  const rows = useMemo(
    () =>
      documents
        .filter((row) => row.join(' ').toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => (asc ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0]))),
    [query, asc]
  )

  return (
    <section className="rounded-[9px] border border-[#e4edf2] bg-white p-[27px] shadow-[0_2px_8px_rgba(34,58,79,0.025)] max-[680px]:p-[18px_15px]">
      <div className="flex items-start justify-between gap-5 mb-6 max-[680px]:flex-col">
        <div>
          <div className="mb-[9px] text-[10px] font-bold uppercase tracking-[0.13em] text-[#7290a5]">
            DOCUMENT REGISTER
          </div>
          <h2 className="text-[20px] text-[#20354a] tracking-[-0.025em]">{title}</h2>
          <p className="mt-[7px] text-[13px] leading-[1.5] text-[#75889c]">
            Controlled documents and current revision status.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 self-center rounded-[7px] border border-[#dbe6ec] bg-white px-4 py-[10px] text-[13px] font-medium text-[#3c5369] hover:bg-[#f7fafc] [&>svg]:w-4"
        >
          <SlidersHorizontal /> Filter
        </button>
      </div>

      <div className="mb-[13px] flex items-center justify-between max-[680px]:flex-col max-[680px]:items-start max-[680px]:gap-[10px]">
        <div className="flex h-9 w-full max-w-[330px] items-center gap-[9px] rounded-[6px] border border-[#dce6ed] bg-[#fbfcfd] px-[11px] max-[680px]:max-w-none">
          <Search className="w-[15px] text-[#8ba0b0]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents..."
            aria-label="Search documents"
            className="w-full border-0 bg-transparent text-[12px] text-[#40566a] outline-none placeholder:text-[#a2b1bd]"
          />
        </div>
        <span className="text-[11px] text-[#8599a8]">{rows.length} documents</span>
      </div>

      <div className="overflow-x-auto rounded-[7px] border border-[#e6edf1]">
        <table className="w-full min-w-[760px] border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="whitespace-nowrap bg-[#f7fafc] px-[15px] py-[13px] text-left text-[9px] font-bold uppercase tracking-[0.07em] text-[#72889c]">
                <button onClick={() => setAsc(!asc)} className="flex items-center gap-[5px] [&>svg]:w-3">
                  Control no. {asc ? <ArrowDown /> : <ArrowUp />}
                </button>
              </th>
              {['Document name', 'Rev.', 'Revision date', 'Status', 'Action'].map((head) => (
                <th
                  key={head}
                  className="whitespace-nowrap bg-[#f7fafc] px-[15px] py-[13px] text-left text-[9px] font-bold uppercase tracking-[0.07em] text-[#72889c]"
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]}>
                <td className="whitespace-nowrap border-t border-[#edf1f4] px-[15px] py-[14px] font-semibold text-[#347a86]">
                  {row[0]}
                </td>
                <td className="min-w-[290px] whitespace-nowrap border-t border-[#edf1f4] px-[15px] py-[14px]">
                  <div className="flex items-center gap-[10px] font-medium text-[#3c5369]">
                    <div className="grid h-[23px] w-[23px] place-items-center rounded-[4px] bg-[#edf5f7] text-[#76a2b5] [&>svg]:w-[13px]">
                      {row[5] === 'xls' ? <FileSpreadsheet /> : <FileText />}
                    </div>
                    <span>{row[1]}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap border-t border-[#edf1f4] px-[15px] py-[14px] text-[#62768a]">
                  {row[2]}
                </td>
                <td className="whitespace-nowrap border-t border-[#edf1f4] px-[15px] py-[14px] text-[#62768a]">
                  {row[3]}
                </td>
                <td className="whitespace-nowrap border-t border-[#edf1f4] px-[15px] py-[14px]">
                  <span
                    className={
                      row[4] === 'Active'
                        ? 'inline-flex items-center gap-[5px] rounded-[30px] bg-[#e5f4f1] px-2 py-[5px] text-[10px] font-semibold text-[#278378] before:h-[5px] before:w-[5px] before:rounded-full before:bg-[#35a896] before:content-[""]'
                        : 'inline-flex items-center gap-[5px] rounded-[30px] bg-[#eff2f4] px-2 py-[5px] text-[10px] font-semibold text-[#7e8a95] before:h-[5px] before:w-[5px] before:rounded-full before:bg-[#9ba5ad] before:content-[""]'
                    }
                  >
                    {row[4]}
                  </span>
                </td>
                <td className="whitespace-nowrap border-t border-[#edf1f4] px-[15px] py-[14px]">
                  <button
                    className="inline-flex items-center gap-[5px] text-[10px] font-bold text-[#39798b] [&>svg]:w-[14px]"
                    aria-label={`Download ${row[1]}`}
                  >
                    <Download /> {row[5].toUpperCase()}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}