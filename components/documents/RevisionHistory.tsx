'use client'

// "Riwayat revisi" of a document under e-sign approval: every file it has
// had (newest first) with the revision requests made on each. Any earlier
// file can be compared side by side with the current one — the marks (strikes
// and markers) on the left, on the very file they were made on — so the
// approver and the ISM Admin see exactly what changed.

import { useState } from 'react'
import { ArrowLeftRight, ExternalLink, FileText, MapPin } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { RevisionNotesDialog, type RevisionPin } from '@/components/documents/RevisionNotes'

export type HistoryRequest = {
  approvalId: number
  approverName: string | null
  roleTitle: string
  revision: number
  decidedAt: string
  general: string | null
  pins: RevisionPin[]
  filePath: string | null
  fileKept: boolean
}

export type RevisionHistoryData = {
  current: { revision: number; filePath: string; uploadedAt: string }
  versions: { revision: number; filePath: string; uploadedAt: string | null; replacedAt: string; replacedBy: string | null }[]
  requests: HistoryRequest[]
}

type Open = { filePath: string; label: string; request: HistoryRequest | null; compare: boolean }

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'
}

export function fileUrl(filePath: string, token?: string) {
  return `${API_BASE_PATH}/api/files/serve?path=${encodeURIComponent(filePath)}${token ? `&token=${encodeURIComponent(token)}` : ''}`
}

// Something to show: an earlier file, or more than the one request already on screen.
export function hasHistory(history: RevisionHistoryData | null | undefined) {
  return !!history && (history.versions.length > 0 || history.requests.length > 1)
}

/**
 * Opens the notes of a revision request on the file they were made on; when
 * that file has since been replaced, side by side with the current one.
 */
export function RevisionCompareDialog({
  history,
  open,
  token,
  heading,
  onClose,
}: {
  history: RevisionHistoryData
  open: Open
  token?: string
  heading: string
  onClose: () => void
}) {
  const currentLabel = `Sesudah · Rev. ${history.current.revision} — file terbaru (${formatDate(history.current.uploadedAt)})`
  const request = open.request
  return (
    <RevisionNotesDialog
      mode="view"
      filePath={open.filePath}
      token={token}
      heading={heading}
      subheading={request
        ? `Catatan dari ${request.approverName ?? '-'} (${request.roleTitle}) · Rev. ${request.revision} · ${formatDate(request.decidedAt)}`
        : open.label}
      hint={open.compare
        ? 'Kiri: file saat revisi diminta, lengkap dengan coretan & penanda. Kanan: file terbaru. Keduanya bergulir bersamaan — klik catatan untuk melompat ke letaknya.'
        : request && !open.compare && request.filePath !== open.filePath
          ? 'File saat revisi diminta tidak tersimpan — coretan & penanda ditampilkan di file terbaru, posisinya bisa sedikit bergeser.'
          : undefined}
      initialGeneral={request?.general ?? null}
      initialPins={request?.pins ?? []}
      baseLabel={open.label}
      compare={open.compare ? { filePath: history.current.filePath, label: currentLabel } : undefined}
      onClose={onClose}
    />
  )
}

/** The way to show one request: on its own file, compared with the current one when it changed since. */
export function openForRequest(history: RevisionHistoryData, request: HistoryRequest): Open {
  const own = request.fileKept && request.filePath ? request.filePath : null
  if (own && own !== history.current.filePath) {
    return { filePath: own, label: `Sebelum · Rev. ${request.revision} — file saat revisi diminta`, request, compare: true }
  }
  return { filePath: history.current.filePath, label: `Rev. ${history.current.revision}`, request, compare: false }
}

export function RevisionHistoryList({ history, token, heading }: { history: RevisionHistoryData; token?: string; heading: string }) {
  const [open, setOpen] = useState<Open | null>(null)

  const onFile = (filePath: string) => history.requests.filter((r) => r.fileKept && r.filePath === filePath)
  const lost = history.requests.filter((r) => !r.fileKept || !r.filePath)
  const files = [
    { key: 'current', revision: history.current.revision, filePath: history.current.filePath, when: `Diunggah ${formatDate(history.current.uploadedAt)}`, current: true },
    ...history.versions.map((v, i) => ({
      key: `v${i}`, revision: v.revision, filePath: v.filePath,
      when: `Diunggah ${formatDate(v.uploadedAt)} · diganti ${formatDate(v.replacedAt)}${v.replacedBy ? ` oleh ${v.replacedBy}` : ''}`,
      current: false,
    })),
  ]

  return (
    <>
      <ol className="flex flex-col gap-2">
        {files.map((f) => {
          const requests = onFile(f.filePath)
          return (
            <li key={f.key} className={`rounded-xl border p-3 ${f.current ? 'border-emerald-600/30 bg-emerald-50/50' : 'border-border bg-card'}`}>
              <div className="flex flex-wrap items-start gap-2">
                <FileText className={`mt-0.5 size-4 flex-none ${f.current ? 'text-emerald-700' : 'text-muted-foreground'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    Rev. {f.revision}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${f.current ? 'bg-emerald-600 text-white' : 'bg-secondary text-secondary-foreground'}`}>{f.current ? 'File terbaru' : 'Versi sebelumnya'}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{f.when}</p>
                </div>
                <a href={fileUrl(f.filePath, token)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline">
                  Buka PDF <ExternalLink className="size-3" />
                </a>
              </div>

              {requests.map((r) => (
                <div key={r.approvalId} className="mt-2 rounded-lg border-l-2 border-[#c2412c] bg-[#fdf6f3] px-2.5 py-2">
                  <p className="text-[11.5px] text-[#8a2d1d]">
                    <strong>Minta revisi</strong> dari {r.approverName ?? '-'} ({r.roleTitle}) · {formatDate(r.decidedAt)} · {r.pins.length} catatan di dokumen
                  </p>
                  {r.general && <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-[11.5px] text-foreground">{r.general}</p>}
                  <button type="button" onClick={() => setOpen(openForRequest(history, r))} className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-[#c2412c]/40 bg-card px-2.5 py-1 text-[11px] font-semibold text-[#a83522] hover:bg-[#fdf0ec]">
                    {f.current ? <><MapPin className="size-3" /> Lihat coretan & penanda</> : <><ArrowLeftRight className="size-3" /> Bandingkan dengan file terbaru</>}
                  </button>
                </div>
              ))}

              {!f.current && requests.length === 0 && (
                <button type="button" onClick={() => setOpen({ filePath: f.filePath, label: `Sebelum · Rev. ${f.revision}`, request: null, compare: true })} className="mt-2 inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary">
                  <ArrowLeftRight className="size-3" /> Bandingkan dengan file terbaru
                </button>
              )}
            </li>
          )
        })}

        {lost.length > 0 && (
          <li className="rounded-xl border border-dashed border-border p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">Catatan revisi lama — file saat itu tidak tersimpan</p>
            {lost.map((r) => (
              <div key={r.approvalId} className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-foreground">
                <span className="min-w-0 flex-1">Rev. {r.revision} · {r.approverName ?? '-'} · {formatDate(r.decidedAt)} · {r.pins.length} catatan</span>
                <button type="button" onClick={() => setOpen(openForRequest(history, r))} className="inline-flex items-center gap-1 font-semibold text-[#a83522] hover:underline">
                  <MapPin className="size-3" /> Lihat di file terbaru
                </button>
              </div>
            ))}
          </li>
        )}
      </ol>

      {open && <RevisionCompareDialog history={history} open={open} token={token} heading={heading} onClose={() => setOpen(null)} />}
    </>
  )
}
