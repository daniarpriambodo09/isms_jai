'use client'

// "Ajukan ulang" after an approver asked for a revision: upload the fixed
// PDF and the approval starts again from the first approver, on the new file.
// The replaced file is kept in the revision history, so approvers can compare
// before / after. Re-submitting the same file is still possible, but only as
// a deliberate second choice (e.g. when the requested change turned out not
// to be needed).

import { useState, type FormEvent } from 'react'
import { Loader2, RotateCcw, Upload, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { DOC_KIND_INFO, type DocKind } from '@/lib/document-kinds'
import { useEscapeClose } from '@/hooks/useEscapeClose'

export type ResubmitDocument = {
  id: number
  control_no: string
  title: string
  revision: number
  elf_date: string
  approval_roles: string[]
  note: string | null
}

export function ResubmitDialog({
  kind,
  document,
  revisionNote,
  onClose,
  onDone,
  onWithoutFile,
}: {
  kind: DocKind
  document: ResubmitDocument
  /** The approver's revision notes (summary), as a reminder of what to fix. */
  revisionNote: string | null
  onClose: () => void
  /** After a successful upload; the message goes to a toast. */
  onDone: (message: string) => void
  /** Restart the approval with the current file, unchanged. */
  onWithoutFile: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [revision, setRevision] = useState(String(document.revision))
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [confirmSame, setConfirmSame] = useState(false)

  useEscapeClose(!sending, onClose)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file) { setError('Pilih file PDF hasil perbaikan.'); return }
    if (file.type !== 'application/pdf') { setError('File harus berupa PDF.'); return }
    setSending(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('id', String(document.id))
      form.set('controlNo', document.control_no)
      form.set('title', document.title)
      form.set('elfDate', document.elf_date.slice(0, 10))
      form.set('revision', revision)
      form.set('approvalRoles', JSON.stringify(document.approval_roles))
      form.set('note', document.note ?? '')
      form.set('file', file)
      const res = await fetch(`${API_BASE_PATH}${DOC_KIND_INFO[kind].api}`, { method: 'PUT', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.message ?? 'Gagal mengunggah file perbaikan.'); return }
      onDone('File perbaikan diunggah — pengesahan dimulai ulang dan email dikirim ke approver pertama.')
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_oklch,_var(--p-950)_50%,_transparent)] p-4" onClick={() => !sending && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Ajukan ulang" onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_20px_50px_color-mix(in_oklch,_var(--p-950)_25%,_transparent)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[color:var(--p-muted)]">Ajukan ulang · {DOC_KIND_INFO[kind].label}</div>
            <h2 className="truncate text-[18px] font-bold text-[color:var(--p-800)]">{document.control_no} — {document.title}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={sending} aria-label="Tutup" className="grid h-8 w-8 flex-none place-items-center rounded-full text-[color:var(--p-muted2)] hover:bg-[color:var(--p-surface2)]"><X className="w-[18px]" /></button>
        </div>

        {revisionNote && (
          <div className="mb-4 rounded-[10px] border-l-[3px] border-[#c2412c] bg-[#fdf6f3] px-3 py-2.5">
            <p className="text-[11px] font-bold text-[#a83522]">Yang diminta approver</p>
            <p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-line text-[12.5px] leading-5 text-[#5c2016]">{revisionNote}</p>
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-[6px]">
            <span className="text-[12px] font-medium text-[color:var(--p-ink2)]">File PDF hasil perbaikan</span>
            <input type="file" accept="application/pdf" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 py-2 text-[12px] text-[color:var(--p-ink2)] file:mr-3 file:rounded-[5px] file:border-0 file:bg-[color:var(--p-800)] file:px-3 file:py-[6px] file:text-[11px] file:font-medium file:text-white" />
          </label>
          <label className="flex flex-col gap-[6px]">
            <span className="text-[12px] font-medium text-[color:var(--p-ink2)]">Revisi</span>
            <input type="number" min={1} step={1} value={revision} onChange={(e) => setRevision(e.target.value)} required className="h-10 w-32 rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 text-[13px] text-[color:var(--p-800)] outline-none focus:border-[color:var(--p-600)]" />
            <span className="text-[11px] text-[color:var(--p-muted2)]">Ubah bila nomor revisi di dokumen ikut naik; jika tidak, biarkan.</span>
          </label>
          <p className="text-[11.5px] leading-5 text-[color:var(--p-muted)]">
            Pengesahan dimulai ulang dari approver pertama dengan file baru. File lama tetap tersimpan di <strong>Riwayat revisi</strong>, sehingga approver bisa membandingkan sebelum &amp; sesudah.
          </p>

          {error && <p className="rounded-[6px] bg-[#fdecec] px-3 py-2 text-[12px] text-[#b3413a]">{error}</p>}

          <button type="submit" disabled={sending} className="inline-flex h-10 items-center justify-center gap-2 rounded-[7px] bg-[color:var(--p-800)] text-[13px] font-medium text-white hover:bg-[color:var(--p-750)] disabled:cursor-not-allowed disabled:opacity-60">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Unggah perbaikan &amp; ajukan ulang
          </button>
        </form>

        <div className="mt-4 border-t border-[color:var(--p-border)] pt-3">
          {confirmSame ? (
            <div className="flex flex-col gap-2 rounded-[8px] bg-[color:var(--p-surface2)] p-3 text-[11.5px] text-[color:var(--p-ink2)]">
              <p>Approver akan menerima <strong>file yang sama</strong> seperti sebelumnya. Lanjutkan hanya bila memang tidak ada yang perlu diubah.</p>
              <div className="flex gap-2">
                <button type="button" onClick={onWithoutFile} disabled={sending} className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--p-800)] px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50"><RotateCcw className="size-3.5" /> Ya, ajukan file yang sama</button>
                <button type="button" onClick={() => setConfirmSame(false)} className="rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-[color:var(--p-muted)] hover:bg-white">Batal</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmSame(true)} disabled={sending} className="text-[11.5px] font-semibold text-[color:var(--p-muted)] underline-offset-2 hover:text-[color:var(--p-800)] hover:underline">
              Ajukan ulang tanpa mengganti file…
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
