'use client'

// Fill in "Form Review & Revisi Dokumen ISMS" (ISMS-F-001-001) on the portal.
// Saving turns it into the official form as a PDF and sends it for e-sign to
// the positions ticked under "Catatan Pengesahan" (Prepared → Checked →
// Approval) — each signs with a QR in the form's own box. Editing a form
// regenerates the PDF and starts the approval again.

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { Loader2, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { DETAIL_REVISI_MAX, EMPTY_REVIEW_FORM, REVIEW_DOC_TYPES, REVIEW_LEVELS, REVIEW_MONTHS, REVIEW_RESULTS, type ReviewFormData } from '@/lib/review-form'

type ApproverRole = { code: string; title: string; person_name: string; email: string | null; is_default: boolean }

const inputClass = 'h-10 w-full min-w-0 rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 text-[13px] text-[color:var(--p-800)] outline-none focus:border-[color:var(--p-600)] [color-scheme:light]'
const labelClass = 'text-[12px] font-medium text-[color:var(--p-ink2)]'

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`flex min-w-0 flex-col gap-[6px] ${className}`}><span className={labelClass}>{label}</span>{children}</label>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-[10px] border border-[color:var(--p-border)] p-3.5">
      <legend className="px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--p-muted)]">{title}</legend>
      {children}
    </fieldset>
  )
}

export function ReviewFormModal({
  open,
  editId,
  prefill,
  notice,
  onClose,
  onSaved,
}: {
  open: boolean
  /** The form document being edited; new form when absent. */
  editId?: number
  /** New form: the document it is about (from the Prosedur ISMS row). */
  prefill?: Partial<ReviewFormData>
  /** Shown on top (e.g. the approver's revision request). */
  notice?: string | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const isEdit = editId !== undefined
  const [form, setForm] = useState<ReviewFormData>(EMPTY_REVIEW_FORM)
  const [roles, setRoles] = useState<ApproverRole[]>([])
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEscapeClose(open && !submitting, onClose)
  const set = <K extends keyof ReviewFormData>(key: K, value: ReviewFormData[K]) => setForm((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    setLoading(true)
    ;(async () => {
      try {
        const rolesRes = await fetch(`${API_BASE_PATH}/api/prosedur-approver-roles?kind=review_form`, { cache: 'no-store' })
        const list: ApproverRole[] = rolesRes.ok ? ((await rolesRes.json()).roles ?? []) : []
        if (cancelled) return
        setRoles(list)
        if (isEdit) {
          const res = await fetch(`${API_BASE_PATH}/api/form-review?form=${editId}`, { cache: 'no-store' })
          const data = await res.json()
          if (!res.ok) throw new Error(data.message)
          if (cancelled) return
          setForm({ ...EMPTY_REVIEW_FORM, ...data.form })
          setSelectedRoles(data.approvalRoles ?? [])
          setNote(data.note ?? '')
        } else {
          const now = new Date()
          setForm({ ...EMPTY_REVIEW_FORM, reviewRequestedAt: today(), periodMonth: now.getMonth() + 1, periodYear: now.getFullYear(), ...prefill })
          // Positions without an e-mail can't be asked, so they never start ticked.
          setSelectedRoles(list.filter((role) => role.is_default && role.email).map((role) => role.code))
          setNote('')
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Gagal memuat form.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId])

  if (!open) return null

  const ordered = roles.filter((role) => selectedRoles.includes(role.code))
  const toggleRole = (code: string) => setSelectedRoles((current) => (current.includes(code) ? current.filter((c) => c !== code) : [...current, code]))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/form-review`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editId, form, approvalRoles: ordered.map((role) => role.code), note }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.message ?? 'Gagal menyimpan Form Review.'); return }
      onSaved(ordered.length
        ? `Form Review ${isEdit ? 'diperbarui' : 'dibuat'} — permintaan tanda tangan dikirim ke ${ordered[0].person_name}.`
        : `Form Review ${isEdit ? 'diperbarui' : 'dibuat'} (tanpa pengesahan).`)
      onClose()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSubmitting(false)
    }
  }

  const check = (checked: boolean, onChange: (value: boolean) => void, label: string) => (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[color:var(--p-800)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[color:var(--p-700)]" /> {label}
    </label>
  )

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_oklch,_var(--p-950)_50%,_transparent)] p-0 sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit Form Review' : 'Buat Form Review'} className="flex h-full max-h-full w-full max-w-[720px] flex-col overflow-hidden bg-white shadow-[0_20px_50px_color-mix(in_oklch,_var(--p-950)_25%,_transparent)] sm:h-auto sm:max-h-[94vh] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--p-border)] px-6 py-4">
          <div className="min-w-0">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[color:var(--p-muted)]">ISMS-F-001-001</div>
            <h2 className="text-[18px] font-bold text-[color:var(--p-800)]">{isEdit ? 'Edit' : 'Buat'} Form Review &amp; Revisi Dokumen</h2>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Tutup" className="grid h-8 w-8 flex-none place-items-center rounded-full text-[color:var(--p-muted2)] hover:bg-[color:var(--p-surface2)]"><X className="w-[18px]" /></button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-24 text-[color:var(--p-muted)]"><Loader2 className="size-6 animate-spin" /></div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
              {notice && (
                <div className="rounded-[10px] border-l-[3px] border-[#c2412c] bg-[#fdf6f3] px-3 py-2.5">
                  <p className="text-[11px] font-bold text-[#a83522]">Yang diminta approver</p>
                  <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-line text-[12.5px] leading-5 text-[#5c2016]">{notice}</p>
                </div>
              )}

              <Section title="Form">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Kontrol No. Form *"><input value={form.formNo} onChange={(e) => set('formNo', e.target.value)} required autoFocus placeholder="Contoh: 002/ISMS/10/2026" className={inputClass} /></Field>
                  <Field label="Tanggal pengajuan review *"><input type="date" value={form.reviewRequestedAt} onChange={(e) => set('reviewRequestedAt', e.target.value)} required className={inputClass} /></Field>
                  <Field label="Tanggal selesai revisi"><input type="date" value={form.revisionDoneAt ?? ''} onChange={(e) => set('revisionDoneAt', e.target.value || null)} className={inputClass} /></Field>
                  <Field label="Tanggal selesai approval"><input type="date" value={form.approvalDoneAt ?? ''} onChange={(e) => set('approvalDoneAt', e.target.value || null)} className={inputClass} /></Field>
                  <Field label="Tanggal efektif"><input type="date" value={form.effectiveAt ?? ''} onChange={(e) => set('effectiveAt', e.target.value || null)} className={inputClass} /></Field>
                </div>
              </Section>

              <Section title="Dokumen yang direview">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Kontrol No. Dokumen"><input value={form.docControlNo} onChange={(e) => set('docControlNo', e.target.value)} placeholder="Contoh: ISMS-B-005" className={inputClass} /></Field>
                  <Field label="No. revisi lama"><input value={form.oldRevision} onChange={(e) => set('oldRevision', e.target.value)} placeholder="Contoh: Revisi 6" className={inputClass} /></Field>
                  <Field label="Title dokumen / judul *" className="sm:col-span-2"><input value={form.docTitle} onChange={(e) => set('docTitle', e.target.value)} required placeholder="Contoh: ISMS Division Profile or Company Profile" className={inputClass} /></Field>
                  <Field label="Level dokumen">
                    <select value={form.level ?? ''} onChange={(e) => set('level', (Number(e.target.value) || null) as ReviewFormData['level'])} className={inputClass}>
                      <option value="">— tidak dicentang —</option>
                      {REVIEW_LEVELS.map((n) => <option key={n} value={n}>Level {n}</option>)}
                    </select>
                  </Field>
                  <Field label="Jenis dokumen">
                    <select value={form.docType ?? ''} onChange={(e) => set('docType', (e.target.value || null) as ReviewFormData['docType'])} className={inputClass}>
                      <option value="">— tidak dicentang —</option>
                      {REVIEW_DOC_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                  </Field>
                </div>
              </Section>

              <Section title="Detail review dokumen">
                <p className="-mt-1 text-[11.5px] text-[color:var(--p-muted)]">Alasan review — centang atau isi minimal satu.</p>
                {check(form.reasonNew, (v) => set('reasonNew', v), 'Pembuatan baru')}
                <div className="flex flex-wrap items-center gap-3">
                  {check(form.reasonPeriodic, (v) => set('reasonPeriodic', v), 'Review berkala')}
                  {form.reasonPeriodic && (
                    <>
                      <select aria-label="Bulan review" value={form.periodMonth ?? ''} onChange={(e) => set('periodMonth', Number(e.target.value) || null)} className={`${inputClass} !w-36`}>
                        <option value="">Bulan</option>
                        {REVIEW_MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                      </select>
                      <input aria-label="Tahun review" type="number" min={2000} max={2100} value={form.periodYear ?? ''} onChange={(e) => set('periodYear', Number(e.target.value) || null)} placeholder="Tahun" className={`${inputClass} !w-24`} />
                    </>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Perubahan standards"><input value={form.standardsChange} onChange={(e) => set('standardsChange', e.target.value)} placeholder="mis. ISO/IEC 27001:2022" className={inputClass} /></Field>
                  <Field label="Perubahan regulasi"><input value={form.regulationChange} onChange={(e) => set('regulationChange', e.target.value)} className={inputClass} /></Field>
                  <Field label="Permintaan dari"><input value={form.requestFrom} onChange={(e) => set('requestFrom', e.target.value)} className={inputClass} /></Field>
                </div>

                <div className="mt-1 flex flex-col gap-2 border-t border-[color:var(--p-border)] pt-3">
                  <span className={labelClass}>Hasil review *</span>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {REVIEW_RESULTS.map(([key, label]) => (
                      <label key={key} className="flex cursor-pointer items-center gap-2 text-[13px] text-[color:var(--p-800)]">
                        <input type="radio" name="review-result" checked={form.result === key} onChange={() => set('result', key)} className="size-4 accent-[color:var(--p-700)]" /> {label}
                      </label>
                    ))}
                  </div>
                  {form.result === 'ditarik' && (
                    <Field label="Ditarik mulai tanggal *" className="max-w-[220px]"><input type="date" value={form.withdrawnFrom ?? ''} onChange={(e) => set('withdrawnFrom', e.target.value || null)} required className={inputClass} /></Field>
                  )}
                </div>
              </Section>

              <Section title="Detail revisi">
                <textarea aria-label="Detail revisi" value={form.detailRevisi} onChange={(e) => set('detailRevisi', e.target.value)} rows={4} maxLength={DETAIL_REVISI_MAX} placeholder="Apa yang direvisi (maks. dua baris di formulir)" className="rounded-[7px] border border-[color:var(--p-border)] bg-[color:var(--p-surface)] px-3 py-2 text-[13px] text-[color:var(--p-800)] outline-none focus:border-[color:var(--p-600)]" />
                <span className="-mt-1 text-right text-[11px] text-[color:var(--p-muted2)]">{form.detailRevisi.length}/{DETAIL_REVISI_MAX}{form.detailRevisi.length > 450 ? ' · teks sepanjang ini dilanjutkan di halaman lampiran PDF' : form.detailRevisi.length > 150 ? ' · dilanjutkan di ruang kosong samping kotak tanda tangan' : ''}</span>
              </Section>

              <Section title="Catatan pengesahan (tanda tangan QR)">
                {roles.length === 0 && <p className="text-[11.5px] text-[color:var(--p-muted2)]">Belum ada jabatan pengesahan untuk Form Review.</p>}
                {roles.map((role) => (
                  <label key={role.code} title={role.email ? undefined : 'Isi email jabatan ini dulu di Approver Pengesahan'} className={`flex items-start gap-2.5 rounded-[7px] px-1.5 py-1 ${role.email || selectedRoles.includes(role.code) ? 'cursor-pointer hover:bg-[color:var(--p-surface2)]' : 'cursor-not-allowed opacity-60'}`}>
                    <input type="checkbox" checked={selectedRoles.includes(role.code)} disabled={!role.email && !selectedRoles.includes(role.code)} onChange={() => toggleRole(role.code)} className="mt-0.5 size-4 accent-[color:var(--p-700)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-medium text-[color:var(--p-800)]">{role.title}</span>
                      <span className="block text-[11.5px] text-[color:var(--p-muted)]">{role.person_name}{!role.email && <span className="ml-1 text-[#b3413a]">· email belum diisi — tidak bisa dipilih</span>}</span>
                    </span>
                    <span className="rounded-full bg-[color:var(--p-surface2)] px-2 py-0.5 font-mono text-[10px] text-[color:var(--p-muted)]">{role.code}</span>
                  </label>
                ))}
                <p className="px-1 text-[11px] leading-4 text-[color:var(--p-muted2)]">
                  {ordered.length === 0
                    ? 'Tidak dicentang = form disimpan tanpa tanda tangan.'
                    : `Email dikirim berurutan: ${ordered.map((role) => role.code).join(' → ')}. QR tiap orang otomatis masuk ke kotak Prepared / Checked / Approval.${isEdit ? ' Menyimpan perubahan memulai ulang pengesahan.' : ''}`}
                </p>
                <Link href="/kelola-pengesahan?kind=review_form" className="w-fit px-1 text-[11.5px] font-semibold text-[color:var(--p-700)] underline-offset-2 hover:underline">Tambah / hapus / ubah jabatan →</Link>
              </Section>
            </div>

            <div className="flex flex-col gap-2 border-t border-[color:var(--p-border)] px-6 py-4">
              {error && <p className="rounded-[6px] bg-[#fdecec] px-3 py-2 text-[12px] text-[#b3413a]">{error}</p>}
              <button type="submit" disabled={submitting} className="inline-flex h-10 items-center justify-center gap-2 rounded-[7px] bg-[color:var(--p-800)] text-[13px] font-medium text-white hover:bg-[color:var(--p-750)] disabled:cursor-not-allowed disabled:opacity-60">
                {submitting && <Loader2 className="size-4 animate-spin" />} {submitting ? 'Membuat PDF & mengirim…' : isEdit ? 'Simpan & ajukan ulang' : 'Buat form & ajukan tanda tangan'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
