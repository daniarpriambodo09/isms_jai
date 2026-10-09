'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { DOC_KIND_INFO, type DocKind } from '@/lib/document-kinds'
import { useEscapeClose } from '@/hooks/useEscapeClose'

export type EditableProcedure = {
  id: number
  controlNo: string
  title: string
  revision: number
  elfDate: string
  approvalRoles: string[]
  note: string | null
  /** Prosedur ISMS / TMMIN: a Form Review PDF is attached beside the document. */
  hasReviewForm?: boolean
}

type ApproverRole = { code: string; title: string; person_name: string; email: string | null; sort_order: number; is_default: boolean }

const PLACEHOLDERS: Record<DocKind, { controlNo: string; title: string }> = {
  procedure: { controlNo: 'Contoh: P14-001', title: 'Contoh: Prosedur Pengendalian Dokumen' },
  working_standard: { controlNo: 'Contoh: ISMS-OS-010-001', title: 'Contoh: Standard Mengganti Password pada Windows 11' },
  review_form: { controlNo: 'Contoh: 002/ISMS/10/2026', title: 'Contoh: Form Review — ISMS Division Profile' },
  tmmin_standard: { controlNo: 'Contoh: TMMIN-SR-001', title: 'Contoh: Standard Requirement Keamanan Informasi TMMIN' },
}

function todayAsInputValue() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

export function ProcedureFormModal({
  kind = 'procedure',
  open,
  onClose,
  onSaved,
  document,
}: {
  /** Which register the document goes to (Prosedur ISMS / Working Standard). */
  kind?: DocKind
  open: boolean
  onClose: () => void
  onSaved: (saved?: { id: number }) => void
  document?: EditableProcedure
}) {
  const isEdit = Boolean(document)
  const [controlNo, setControlNo] = useState('')
  const [title, setTitle] = useState('')
  const [elfDate, setElfDate] = useState('')
  const [revision, setRevision] = useState('1')
  // Adding a document: it is revision 1 unless "Dokumen revisi" is ticked, which asks for its number.
  const [isRevision, setIsRevision] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  // Prosedur ISMS / TMMIN: the document's Form Review & Revisi Dokumen, signed by the same approval.
  const takesReviewForm = kind === 'procedure' || kind === 'tmmin_standard'
  const [reviewFile, setReviewFile] = useState<File | null>(null)
  const [removeReview, setRemoveReview] = useState(false)
  const [note, setNote] = useState('')
  const [roles, setRoles] = useState<ApproverRole[]>([])
  const [rolesLoaded, setRolesLoaded] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEscapeClose(open, onClose)

  useEffect(() => {
    if (open) {
      setControlNo(document?.controlNo ?? '')
      setTitle(document?.title ?? '')
      setElfDate(document?.elfDate ?? todayAsInputValue())
      setRevision(String(document?.revision ?? 1))
      setIsRevision(false)
      setNote(document?.note ?? '')
      setSelectedRoles(document?.approvalRoles ?? [])
      setFile(null)
      setReviewFile(null)
      setRemoveReview(false)
      setError(null)
    }
  }, [open, document])

  // Approver positions of this register (Kelola Pengesahan). New documents
  // start with the roles marked "default"; existing ones keep what they had.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setRolesLoaded(false)
    fetch(`${API_BASE_PATH}/api/prosedur-approver-roles?kind=${kind}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { roles: [] }))
      .then((data: { roles?: ApproverRole[] }) => {
        if (cancelled) return
        const list = data.roles ?? []
        setRoles(list)
        // Positions without an e-mail can't be asked, so they never start ticked.
        if (!isEdit) setSelectedRoles(list.filter((role) => role.is_default && role.email).map((role) => role.code))
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setRolesLoaded(true) })
    return () => { cancelled = true }
  }, [open, isEdit, kind])

  const toggleRole = (code: string) =>
    setSelectedRoles((current) => (current.includes(code) ? current.filter((c) => c !== code) : [...current, code]))
  const orderedSelection = roles.filter((role) => selectedRoles.includes(role.code))

  if (!open) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!isEdit && !file) {
      setError('File PDF wajib diunggah.')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.set('controlNo', controlNo)
      formData.set('title', title)
      formData.set('elfDate', elfDate)
      formData.set('approvalRoles', JSON.stringify(orderedSelection.map((role) => role.code)))
      formData.set('note', note)
      if (file) formData.set('file', file)
      if (takesReviewForm && reviewFile) formData.set('reviewFile', reviewFile)
      if (takesReviewForm && removeReview && !reviewFile) formData.set('removeReviewForm', '1')
      formData.set('revision', isEdit || isRevision ? revision : '1')
      if (document) formData.set('id', String(document.id))

      const res = await fetch(`${API_BASE_PATH}${DOC_KIND_INFO[kind].api}`, {
        method: isEdit ? 'PUT' : 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.message ?? 'Gagal menyimpan dokumen.')
        return
      }

      const saved = await res.json().catch(() => null)
      onSaved(saved?.document)
      onClose()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_oklch,_var(--p-950)_50%,_transparent)] p-4">
      <div role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit Dokumen' : 'Tambah Dokumen'} className="max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_20px_50px_color-mix(in_oklch,_var(--p-950)_25%,_transparent)]">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[color:var(--p-muted)]">{DOC_KIND_INFO[kind].label}</div>
            <h2 className="text-[18px] font-bold text-[color:var(--p-800)]">{isEdit ? 'Edit Dokumen' : 'Tambah Dokumen'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid h-8 w-8 place-items-center rounded-full text-[color:var(--p-muted2)] hover:bg-[color:var(--p-surface2)]"><X className="w-[18px]" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-[6px]"><span className="text-[12px] font-medium text-[color:var(--p-ink2)]">No. Kontrol</span><input value={controlNo} onChange={(event) => setControlNo(event.target.value)} required placeholder={PLACEHOLDERS[kind].controlNo} className="h-10 rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 text-[13px] text-[color:var(--p-800)] outline-none focus:border-[color:var(--p-600)]" /></label>
          <label className="flex flex-col gap-[6px]"><span className="text-[12px] font-medium text-[color:var(--p-ink2)]">Nama Dokumen</span><input value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus placeholder={PLACEHOLDERS[kind].title} className="h-10 rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 text-[13px] text-[color:var(--p-800)] outline-none focus:border-[color:var(--p-600)]" /></label>
          <label className="flex flex-col gap-[6px]"><span className="text-[12px] font-medium text-[color:var(--p-ink2)]">Eff Date</span><input type="date" value={elfDate} onChange={(event) => setElfDate(event.target.value)} required aria-label="Pilih Eff Date" className="h-10 rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 text-[13px] text-[color:var(--p-800)] outline-none [color-scheme:light] focus:border-[color:var(--p-600)] [&::-webkit-calendar-picker-indicator]:ml-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:rounded-[5px] [&::-webkit-calendar-picker-indicator]:bg-[color:var(--p-800)] [&::-webkit-calendar-picker-indicator]:p-[3px] [&::-webkit-calendar-picker-indicator]:[filter:invert(1)]" /></label>
          {isEdit ? (
            <label className="flex flex-col gap-[6px]"><span className="text-[12px] font-medium text-[color:var(--p-ink2)]">Revisi</span><input type="number" min={1} step={1} value={revision} onChange={(event) => setRevision(event.target.value)} required className="h-10 rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 text-[13px] text-[color:var(--p-800)] outline-none focus:border-[color:var(--p-600)]" /></label>
          ) : (
            <div className="flex flex-col gap-[6px]">
              <label className="flex w-fit cursor-pointer items-center gap-2 text-[12px] font-medium text-[color:var(--p-ink2)]">
                <input
                  type="checkbox"
                  checked={isRevision}
                  onChange={(event) => { setIsRevision(event.target.checked); setRevision(event.target.checked ? '' : '1') }}
                  className="size-4 accent-[color:var(--p-700)]"
                />
                Dokumen revisi
              </label>
              {isRevision
                ? <label className="flex flex-col gap-[6px]"><span className="text-[11.5px] text-[color:var(--p-muted2)]">Nomor revisi dokumen ini</span><input type="number" min={1} step={1} value={revision} onChange={(event) => setRevision(event.target.value)} required autoFocus placeholder="Contoh: 3" aria-label="Nomor revisi" className="h-10 rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 text-[13px] text-[color:var(--p-800)] outline-none focus:border-[color:var(--p-600)]" /></label>
                : <p className="text-[11.5px] text-[color:var(--p-muted2)]">Tidak dicentang = dokumen baru, tercatat sebagai Revisi 1.</p>}
            </div>
          )}
          <label className="flex flex-col gap-[6px]"><span className="text-[12px] font-medium text-[color:var(--p-ink2)]">{isEdit ? 'Upload Ulang PDF (opsional)' : 'File PDF'}</span><input type="file" accept="application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required={!isEdit} className="rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 py-2 text-[12px] text-[color:var(--p-ink2)] file:mr-3 file:rounded-[5px] file:border-0 file:bg-[color:var(--p-800)] file:px-3 file:py-[6px] file:text-[11px] file:font-medium file:text-white" />{isEdit && <span className="text-[11px] text-[color:var(--p-muted2)]">Kosongkan jika hanya mengubah data dokumen.</span>}</label>
          {takesReviewForm && (
            <label className="flex flex-col gap-[6px]">
              <span className="text-[12px] font-medium text-[color:var(--p-ink2)]">{isEdit && document?.hasReviewForm ? 'Ganti Form Review (opsional)' : 'Form Review (PDF, opsional)'}</span>
              <input type="file" accept="application/pdf" aria-label="Form Review" onChange={(event) => { setReviewFile(event.target.files?.[0] ?? null); setRemoveReview(false) }} className="rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 py-2 text-[12px] text-[color:var(--p-ink2)] file:mr-3 file:rounded-[5px] file:border-0 file:bg-[color:var(--p-800)] file:px-3 file:py-[6px] file:text-[11px] file:font-medium file:text-white" />
              <span className="text-[11px] leading-4 text-[color:var(--p-muted2)]">Form Review &amp; Revisi Dokumen untuk dokumen ini — tampil di sebelah dokumennya. Disahkan oleh approver Form Review (Prepared, Checked, Approval dari Approver Pengesahan → Form Review) sebelum approver dokumen; bisa diatur per dokumen di Cek Form Review.</span>
              {isEdit && document?.hasReviewForm && !reviewFile && (
                <span className="flex items-center gap-2 text-[11.5px] text-[color:var(--p-ink2)]">
                  <input type="checkbox" checked={removeReview} onChange={(event) => setRemoveReview(event.target.checked)} className="size-3.5 accent-[color:var(--p-700)]" />
                  Hapus Form Review dari dokumen ini
                </span>
              )}
            </label>
          )}

          <fieldset className="flex flex-col gap-2 rounded-[10px] border border-[color:var(--p-border)] p-3">
            <legend className="px-1 text-[12px] font-medium text-[color:var(--p-ink2)]">Catatan Pengesahan</legend>
            {roles.length === 0 && <p className="text-[11.5px] text-[color:var(--p-muted2)]">{rolesLoaded ? `Belum ada jabatan pengesahan untuk ${DOC_KIND_INFO[kind].label}.` : 'Memuat daftar jabatan…'}</p>}
            {roles.map((role) => (
              <label key={role.code} title={role.email ? undefined : 'Isi email jabatan ini dulu di Approver Pengesahan'} className={`flex items-start gap-2.5 rounded-[7px] px-1.5 py-1 ${role.email || selectedRoles.includes(role.code) ? 'cursor-pointer hover:bg-[color:var(--p-surface2)]' : 'cursor-not-allowed opacity-60'}`}>
                {/* no e-mail → can't be chosen (an already-chosen one can still be unticked) */}
                <input type="checkbox" checked={selectedRoles.includes(role.code)} disabled={!role.email && !selectedRoles.includes(role.code)} onChange={() => toggleRole(role.code)} className="mt-0.5 size-4 accent-[color:var(--p-700)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium text-[color:var(--p-800)]">{role.title}</span>
                  <span className="block text-[11.5px] text-[color:var(--p-muted)]">{role.person_name}{!role.email && <span className="ml-1 text-[#b3413a]">· email belum diisi — tidak bisa dipilih</span>}</span>
                </span>
                <span className="rounded-full bg-[color:var(--p-surface2)] px-2 py-0.5 font-mono text-[10px] text-[color:var(--p-muted)]">{role.code}</span>
              </label>
            ))}
            <p className="px-1 text-[11px] leading-4 text-[color:var(--p-muted2)]">
              {orderedSelection.length === 0
                ? 'Tidak dicentang = dokumen tidak memerlukan pengesahan (tampil "–").'
                : `Email dikirim berurutan: ${orderedSelection.map((role) => role.code).join(' → ')}. Approver cukup menekan Setujui; ${kind === 'working_standard' ? 'QR otomatis tercetak di kotak tanda tangan setelah disetujui' : 'posisi QR diatur admin setelah disetujui'}.${isEdit ? ' Mengganti file, revisi, atau jabatan akan memulai ulang pengesahan.' : ''}`}
            </p>
            <Link href={`/kelola-pengesahan?kind=${kind}`} className="w-fit px-1 text-[11.5px] font-semibold text-[color:var(--p-700)] underline-offset-2 hover:underline">
              Tambah / hapus / ubah jabatan →
            </Link>
          </fieldset>

          <label className="flex flex-col gap-[6px]"><span className="text-[12px] font-medium text-[color:var(--p-ink2)]">Note Dokumen (opsional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={1000} placeholder="Catatan untuk dokumen ini" className="rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 py-2 text-[13px] text-[color:var(--p-800)] outline-none focus:border-[color:var(--p-600)]" /></label>

          {error &&<p className="rounded-[6px] bg-[#fdecec] px-3 py-2 text-[12px] text-[#b3413a]">{error}</p>}
          <button type="submit" disabled={submitting} className="mt-1 inline-flex h-10 items-center justify-center rounded-[7px] bg-[color:var(--p-800)] text-[13px] font-medium text-white hover:bg-[color:var(--p-750)] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Menyimpan...' : 'Simpan'}</button>
        </form>
      </div>
    </div>
  )
}
