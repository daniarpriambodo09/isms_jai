// components/documents/FormReviewOverview.tsx
'use client'

// "Cek Form Review" (ISM Admin): every document of Prosedur ISMS and Standard
// Requirement TMMIN in one list — whether its Form Review is uploaded beside
// it, and where its signing stands. Read from the two registers' own lists.
// From here the admin also uploads a Form Review — choosing the document it
// belongs to — and sets who approves (document and Form Review together).

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck, Download, ExternalLink, Loader2, Search, Upload, UserCheck, X } from 'lucide-react'
import { toast } from '@/components/toast'
import { API_BASE_PATH } from '@/lib/config'
import { DOC_KIND_INFO } from '@/lib/document-kinds'
import { downloadExcel } from '@/lib/excel-export'
import { useEscapeClose } from '@/hooks/useEscapeClose'

type Step = { role_code: string; role_title: string; status: string; approver_name: string | null; decided_at: string | null }
type Doc = { id: number; control_no: string; title: string; revision: number; elf_date: string; note: string | null; approval_roles: string[]; approver_overrides?: Record<string, Person>; review_roles?: string[]; approval_status: 'none' | 'pending' | 'approved' | 'rejected'; review_form_path?: string | null; approvals: Step[] }
type Role = { code: string; title: string; person_name: string | null; email: string | null; is_default?: boolean }
type Person = { name: string; email: string }
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const peopleKey = (value: Record<string, Person>) => JSON.stringify(Object.keys(value).sort().map((code) => [code, value[code].name.trim(), value[code].email.trim().toLowerCase()]))
type Kind = 'procedure' | 'tmmin_standard'
type Row = Doc & { kind: Kind }
const keyOf = (row: Row) => `${row.kind}-${row.id}`

/**
 * One group of positions to tick, each with its person for this document
 * (the position's usual holder unless another name and e-mail are given).
 */
function RolePicker({ legend, hint, roles, selected, onToggle, people, setPeople, editingPerson, setEditingPerson }: {
  legend: string
  hint: string
  roles: Role[] | null
  selected: string[]
  onToggle: (code: string, on: boolean) => void
  people: Record<string, Person>
  setPeople: (update: (current: Record<string, Person>) => Record<string, Person>) => void
  editingPerson: string | null
  setEditingPerson: (code: string | null) => void
}) {
  const ordered = (roles ?? []).filter((role) => selected.includes(role.code)).map((role) => role.code)
  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-3">
      <legend className="px-1 text-xs font-semibold text-foreground">{legend}</legend>
      {!roles ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Memuat jabatan…</p>
        : !roles.length ? <p className="text-xs text-muted-foreground">Belum ada jabatan pengesahan.</p>
          : roles.map((role) => {
            const checked = selected.includes(role.code)
            const person = people[role.code]
            const own = !!person && !!(person.name.trim() || person.email.trim())
            const open = editingPerson === role.code || (checked && !role.email && !own)
            return (
              <div key={role.code} className={`rounded-lg px-2 py-1.5 ${checked ? 'bg-secondary/40' : ''}`}>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    aria-label={`${role.title} (${role.code})`}
                    onChange={() => {
                      onToggle(role.code, !checked)
                      // a position without an e-mail needs its person here: keep the fields open while they're typed
                      if (!checked && !role.email && !own) setEditingPerson(role.code)
                    }}
                    className="mt-0.5 size-4 accent-[color:var(--primary)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{role.title} <span className="font-mono text-[10px] text-muted-foreground">{role.code}</span></span>
                    <span className="block text-[11px] text-muted-foreground">
                      {own
                        ? <><strong className="text-foreground">{person!.name || '—'}</strong> · {person!.email || 'email belum diisi'} <span className="text-primary">(khusus dokumen ini)</span></>
                        : <>{role.person_name || 'Belum diisi'}{role.email ? '' : ' · email belum diisi'}</>}
                    </span>
                  </span>
                </label>
                {checked && !open && (
                  <div className="ml-6 mt-1 flex flex-wrap gap-3 text-[11px] font-semibold">
                    <button type="button" onClick={() => { setEditingPerson(role.code); setPeople((current) => ({ ...current, [role.code]: current[role.code] ?? { name: '', email: '' } })) }} className="text-primary hover:underline">{own ? 'Ubah orang' : 'Ganti orang untuk dokumen ini'}</button>
                    {own && <button type="button" onClick={() => setPeople((current) => { const next = { ...current }; delete next[role.code]; return next })} className="text-muted-foreground hover:underline">Kembali ke {role.person_name || 'default'}</button>}
                  </div>
                )}
                {checked && open && (
                  <div className="ml-6 mt-2 grid gap-2 sm:grid-cols-2" data-testid={`person-${role.code}`}>
                    <input value={person?.name ?? ''} onChange={(event) => setPeople((current) => ({ ...current, [role.code]: { name: event.target.value, email: current[role.code]?.email ?? '' } }))} placeholder="Nama approver" aria-label={`Nama approver ${role.code}`} className="h-9 rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary" />
                    <input value={person?.email ?? ''} onChange={(event) => setPeople((current) => ({ ...current, [role.code]: { name: current[role.code]?.name ?? '', email: event.target.value } }))} placeholder="nama@jai.co.id" type="email" aria-label={`Email approver ${role.code}`} className="h-9 rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary" />
                    <p className="text-[11px] text-muted-foreground sm:col-span-2">Hanya untuk dokumen ini — jabatan {role.code} di dokumen lain tetap {(role.person_name || 'orang default-nya').replace(/\.$/, '')}.{' '}
                      <button type="button" onClick={() => { setEditingPerson(null); if (!role.email) return; setPeople((current) => { const next = { ...current }; if (!next[role.code]?.name.trim() && !next[role.code]?.email.trim()) delete next[role.code]; return next }) }} className="font-semibold text-primary hover:underline">Selesai</button>
                    </p>
                  </div>
                )}
              </div>
            )
          })}
      <p className="px-1 text-[11px] text-muted-foreground">{ordered.length ? `Email dikirim berurutan: ${ordered.join(' → ')}.` : hint}</p>
    </fieldset>
  )
}

/**
 * Upload a Form Review to the document it belongs to (chosen from the list),
 * and/or set who approves. The Form Review has its own approvers (the Form
 * Review positions: Prepared / Checked / Approval), who sign first; then the
 * document's approvers. A new file or other approvers start the signing again.
 */
function FormReviewEditor({ rows, initialKey, focus, onClose, onSaved }: { rows: Row[]; initialKey: string; focus: 'file' | 'approvers'; onClose: () => void; onSaved: () => void }) {
  const [docKey, setDocKey] = useState(initialKey)
  const doc = rows.find((row) => keyOf(row) === docKey) ?? null
  const [file, setFile] = useState<File | null>(null)
  const [roles, setRoles] = useState<Record<string, Role[]>>({})
  const [selected, setSelected] = useState<string[]>(doc?.approval_roles ?? [])
  const [reviewSelected, setReviewSelected] = useState<string[] | null>(null)
  // Someone else than the position's usual holder, for this document only.
  const [people, setPeople] = useState<Record<string, Person>>(doc?.approver_overrides ?? {})
  const [editingPerson, setEditingPerson] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // the chosen document's approvers to start from; the positions to choose from
  useEffect(() => { setSelected(doc?.approval_roles ?? []); setReviewSelected(null); setPeople(doc?.approver_overrides ?? {}); setEditingPerson(null); setError(null) }, [docKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!doc) return
    for (const kind of [doc.kind, 'review_form'] as const) {
      if (roles[kind]) continue
      fetch(`${API_BASE_PATH}/api/prosedur-approver-roles?kind=${kind}`, { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : { roles: [] }))
        .then((data: { roles?: Role[] }) => setRoles((current) => ({ ...current, [kind]: data.roles ?? [] })))
        .catch(() => {})
    }
  }, [doc, roles])

  const kindRoles = doc ? roles[doc.kind] ?? null : null
  const reviewRoles = roles.review_form ?? null
  const hasReview = !!doc && (!!doc.review_form_path || !!file)
  // the form's approvers: as set on the document, else (a form new here, or attached before it had its own) the default ones
  const reviewDefault = useMemo(() => {
    if (!doc) return []
    if ((doc.review_roles ?? []).length) return doc.review_roles!
    return (reviewRoles ?? []).filter((role) => role.is_default && (role.email || doc.approver_overrides?.[role.code])).map((role) => role.code)
  }, [doc, reviewRoles])
  const reviewChosen = hasReview ? reviewSelected ?? reviewDefault : []
  const ordered = (kindRoles ?? []).filter((role) => selected.includes(role.code)).map((role) => role.code)
  const reviewOrdered = (reviewRoles ?? []).filter((role) => reviewChosen.includes(role.code)).map((role) => role.code)
  const allChosen = [...reviewOrdered, ...ordered]
  // only the chosen positions keep a person of their own; an empty entry = the usual holder
  const chosenPeople = Object.fromEntries(Object.entries(people).filter(([code, person]) => allChosen.includes(code) && (person.name.trim() || person.email.trim()))) as Record<string, Person>
  const approversChanged = !!doc && (ordered.join(',') !== (doc.approval_roles ?? []).join(',')
    || reviewOrdered.join(',') !== (doc.review_roles ?? []).join(',')
    || peopleKey(chosenPeople) !== peopleKey(doc.approver_overrides ?? {}))
  const changed = !!doc && (!!file || approversChanged)
  // a chosen position must end up with a name and a working e-mail
  const problem = [...(reviewRoles ?? []).filter((role) => reviewOrdered.includes(role.code)), ...(kindRoles ?? []).filter((role) => ordered.includes(role.code))].map((role) => {
    const person = chosenPeople[role.code]
    if (person) return !person.name.trim() ? `Nama approver ${role.code} belum diisi.` : !EMAIL.test(person.email.trim()) ? `Email approver ${role.code} belum benar.` : null
    return role.email ? null : `${role.title} (${role.code}) belum punya email — isi orang untuk dokumen ini, atau lepas centangnya.`
  }).find(Boolean) ?? null

  const save = async () => {
    if (!doc || !changed || problem) return
    setSaving(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('id', String(doc.id))
      form.set('controlNo', doc.control_no)
      form.set('title', doc.title)
      form.set('elfDate', doc.elf_date.slice(0, 10))
      form.set('revision', String(doc.revision))
      form.set('approvalRoles', JSON.stringify(ordered))
      if (hasReview) form.set('reviewRoles', JSON.stringify(reviewOrdered))
      form.set('approverOverrides', JSON.stringify(chosenPeople))
      form.set('note', doc.note ?? '')
      if (file) form.set('reviewFile', file)
      const response = await fetch(`${API_BASE_PATH}${DOC_KIND_INFO[doc.kind].api}`, { method: 'PUT', body: form })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) { setError(body.message ?? 'Gagal menyimpan.'); return }
      toast(body.approvalRestarted
        ? `Tersimpan — pengesahan ${doc.control_no} dimulai ulang; email dikirim ke approver pertama.`
        : allChosen.length ? `Tersimpan untuk ${doc.control_no}.` : `Tersimpan — ${doc.control_no} tidak memerlukan pengesahan.`)
      onSaved()
    } catch { setError('Tidak dapat menghubungi server.') } finally { setSaving(false) }
  }

  const groups = (['procedure', 'tmmin_standard'] as const).map((kind) => ({ kind, rows: rows.filter((row) => row.kind === kind) }))
  const pickerProps = { people, setPeople, editingPerson, setEditingPerson }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-5">
        <div>
          <h3 className="text-base font-semibold text-foreground">{focus === 'approvers' ? 'Atur approver' : 'Unggah Form Review'}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Pilih dokumen yang sesuai — Form Review tersimpan di sebelah dokumen itu. Form Review disahkan oleh approver Form Review-nya (Prepared, Checked, Approval), lalu dokumen oleh approver dokumen.</p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">Dokumen</span>
          <select value={docKey} onChange={(event) => { setDocKey(event.target.value); setFile(null) }} aria-label="Dokumen" className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary">
            <option value="">— Pilih dokumen —</option>
            {groups.map((group) => (
              <optgroup key={group.kind} label={DOC_KIND_INFO[group.kind].label}>
                {group.rows.map((row) => <option key={keyOf(row)} value={keyOf(row)}>{row.control_no} — {row.title} (Rev. {row.revision}){row.review_form_path ? ' · sudah ada Form Review' : ''}</option>)}
              </optgroup>
            ))}
          </select>
        </label>

        {doc && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">{doc.review_form_path ? 'Ganti Form Review (PDF, opsional)' : 'File Form Review (PDF)'}</span>
              <input type="file" accept="application/pdf" aria-label="File Form Review" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="rounded-lg border border-border bg-background px-3 py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-primary-foreground" />
              {doc.review_form_path && <a href={`${API_BASE_PATH}/api/prosedur-isms/${doc.id}/pdf?part=review`} target="_blank" rel="noopener noreferrer" className="w-fit text-[11px] font-semibold text-primary hover:underline">Lihat Form Review yang sekarang</a>}
            </label>

            {hasReview && (
              <RolePicker
                legend="Approver Form Review (Prepared · Checked · Approval)"
                hint="Tidak ada yang dicentang = Form Review tidak ditandatangani."
                roles={reviewRoles}
                selected={reviewChosen}
                onToggle={(code, on) => setReviewSelected((reviewSelected ?? reviewDefault).filter((c) => c !== code).concat(on ? [code] : []))}
                {...pickerProps}
              />
            )}
            <RolePicker
              legend={`Approver dokumen (${DOC_KIND_INFO[doc.kind].label})`}
              hint="Tidak ada yang dicentang = dokumen tidak memerlukan pengesahan."
              roles={kindRoles}
              selected={selected}
              onToggle={(code, on) => setSelected((current) => current.filter((c) => c !== code).concat(on ? [code] : []))}
              {...pickerProps}
            />
            {allChosen.length > 0 && <p className="px-1 text-[11px] text-muted-foreground">Urutan pengesahan: {allChosen.join(' → ')}.</p>}

            {changed && ((doc.approval_roles ?? []).length > 0 || (doc.review_roles ?? []).length > 0 || allChosen.length > 0) && (
              <p className="rounded-xl border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                {file && approversChanged ? 'Form Review baru dan approver yang berbeda' : file ? 'Form Review baru' : 'Approver yang berbeda'} memulai ulang pengesahan {doc.control_no}: approver menerima email lagi untuk menyetujui Form Review dan dokumennya.
              </p>
            )}
          </>
        )}

        {changed && problem && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{problem}</p>}
        {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary">Batal</button>
          <button type="button" onClick={save} disabled={!changed || !!problem || saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">{saving && <Loader2 className="size-4 animate-spin" />} Simpan</button>
        </div>
      </div>
    </div>
  )
}

type Filter = 'all' | 'with' | 'without' | 'waiting' | 'approved' | 'rejected'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'with', label: 'Ada Form Review' },
  { key: 'without', label: 'Belum ada' },
  { key: 'waiting', label: 'Menunggu' },
  { key: 'approved', label: 'Disahkan' },
  { key: 'rejected', label: 'Perlu revisi' },
]

const fmt = (value: string | null) => (value ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '')

/** Where the signing of a document (and so of its Form Review) stands, in words. */
function statusOf(doc: Doc): { label: string; tone: string; detail: string } {
  const steps = doc.approvals ?? []
  const done = steps.filter((s) => s.status === 'approved')
  if (doc.approval_status === 'none') return { label: 'Tanpa pengesahan', tone: 'bg-secondary text-muted-foreground', detail: '' }
  if (doc.approval_status === 'approved') {
    const last = done.map((s) => s.decided_at).filter((at): at is string => !!at).sort().pop() ?? null
    return { label: 'Disahkan', tone: 'bg-emerald-600/10 text-emerald-700', detail: `${done.length}/${steps.length} approver · ${fmt(last)}` }
  }
  if (doc.approval_status === 'rejected') {
    const by = steps.find((s) => s.status === 'rejected')
    return { label: 'Perlu revisi', tone: 'bg-[#fbe6e0] text-[#b3361f]', detail: by ? `diminta ${by.approver_name ?? by.role_title}` : '' }
  }
  if (steps.length && steps.every((s) => s.status === 'waiting')) return { label: 'Belum dikirim', tone: 'bg-amber-100 text-amber-800', detail: 'email belum dikirim ke approver' }
  const now = steps.find((s) => s.status === 'pending')
  return { label: 'Menunggu', tone: 'bg-amber-100 text-amber-800', detail: `${done.length}/${steps.length} · menunggu ${now ? `${now.approver_name ?? '-'} (${now.role_title})` : '-'}` }
}

/**
 * startWith: open straight on the upload panel of this document ("kind-id") —
 * the register's own "Unggah Form Review" / "Ganti" buttons land here.
 * onChanged: something was saved (the register reloads its list).
 */
export function FormReviewOverview({ open, onClose, startWith = null, onChanged }: { open: boolean; onClose: () => void; startWith?: string | null; onChanged?: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  // the upload / approver panel: which document it starts on ('' = to be chosen)
  const [editing, setEditing] = useState<{ key: string; focus: 'file' | 'approvers' } | null>(null)
  const [reload, setReload] = useState(0)
  // Opened for one document: its panel first; Batal then shows the whole list.
  useEffect(() => { if (open) setEditing(startWith ? { key: startWith, focus: 'file' } : null) }, [open, startWith])
  useEscapeClose(open && !editing, onClose)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setRows(null)
    setError(null)
    Promise.all((['procedure', 'tmmin_standard'] as const).map(async (kind) => {
      const response = await fetch(`${API_BASE_PATH}${DOC_KIND_INFO[kind].api}`, { cache: 'no-store' })
      if (!response.ok) throw new Error()
      const data = await response.json() as { documents?: Doc[] }
      return (data.documents ?? []).map((doc) => ({ ...doc, kind }))
    }))
      .then((lists) => { if (!cancelled) setRows(lists.flat()) })
      .catch(() => { if (!cancelled) setError('Gagal memuat daftar dokumen.') })
    return () => { cancelled = true }
  }, [open, reload])

  const counts = useMemo(() => {
    const list = rows ?? []
    return {
      all: list.length,
      with: list.filter((r) => r.review_form_path).length,
      without: list.filter((r) => !r.review_form_path).length,
      waiting: list.filter((r) => r.approval_status === 'pending').length,
      approved: list.filter((r) => r.approval_status === 'approved').length,
      rejected: list.filter((r) => r.approval_status === 'rejected').length,
    }
  }, [rows])

  const shown = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return (rows ?? []).filter((r) => {
      if (keyword && !`${r.control_no} ${r.title}`.toLowerCase().includes(keyword)) return false
      if (filter === 'with') return !!r.review_form_path
      if (filter === 'without') return !r.review_form_path
      if (filter === 'waiting') return r.approval_status === 'pending'
      if (filter === 'approved') return r.approval_status === 'approved'
      if (filter === 'rejected') return r.approval_status === 'rejected'
      return true
    })
  }, [rows, filter, query])

  const exportExcel = () => downloadExcel(
    `cek-form-review-${new Date().toISOString().slice(0, 10)}.xlsx`,
    ['Menu', 'No. Kontrol', 'Nama Dokumen', 'Revisi', 'Form Review', 'Status Pengesahan', 'Keterangan'],
    shown.map((r) => { const s = statusOf(r); return [DOC_KIND_INFO[r.kind].label, r.control_no, r.title, r.revision, r.review_form_path ? 'Ada' : 'Belum ada', s.label, s.detail] }),
    'Form Review'
  )

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[55] flex bg-[color-mix(in_oklch,_var(--p-950)_55%,_transparent)] p-0 sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Cek Form Review" onClick={(e) => e.stopPropagation()} className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-mono-label text-[10px] text-muted-foreground"><ClipboardCheck className="size-3.5" /> Khusus Admin ISM</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Cek Form Review</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Prosedur ISMS dan Standard Requirement TMMIN — Form Review tiap dokumen, status pengesahannya, unggah Form Review dan atur approver.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-9 flex-none place-items-center rounded-full text-muted-foreground hover:bg-secondary"><X className="size-5" /></button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${filter === f.key ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground hover:bg-secondary'}`}>
              {f.label} <span className="rounded-full bg-black/10 px-1.5 text-[10px]">{counts[f.key]}</span>
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari no. kontrol / dokumen" aria-label="Cari dokumen" className="h-8 w-52 rounded-full border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary" />
            </label>
            <button type="button" onClick={exportExcel} disabled={!shown.length} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"><Download className="size-3.5" /> Excel</button>
            <button type="button" onClick={() => setEditing({ key: '', focus: 'file' })} disabled={!rows} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"><Upload className="size-3.5" /> Unggah Form Review</button>
          </div>
        </div>

        {editing && rows ? (
          <FormReviewEditor
            key={editing.key || 'new'}
            rows={rows}
            initialKey={editing.key}
            focus={editing.focus}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); setReload((n) => n + 1); onChanged?.() }}
          />
        ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          {error ? <p className="m-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
            : !rows ? <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Memuat…</p>
              : !shown.length ? <p className="p-10 text-center text-sm text-muted-foreground">Tidak ada dokumen untuk filter ini.</p>
                : (
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="sticky top-0 bg-card text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-5 py-2.5">Dokumen</th>
                        <th className="px-3 py-2.5">Menu</th>
                        <th className="px-3 py-2.5">Form Review</th>
                        <th className="px-3 py-2.5">Status pengesahan</th>
                        <th className="px-5 py-2.5 text-right">Buka</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {shown.map((r) => {
                        const s = statusOf(r)
                        const info = DOC_KIND_INFO[r.kind]
                        return (
                          <tr key={keyOf(r)} data-testid="fr-row">
                            <td className="px-5 py-3 align-top">
                              <p className="font-semibold text-foreground">{r.control_no} <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Rev. {r.revision}</span></p>
                              <p className="mt-0.5 max-w-[320px] truncate text-xs text-muted-foreground">{r.title}</p>
                            </td>
                            <td className="px-3 py-3 align-top text-xs text-muted-foreground">{info.short}</td>
                            <td className="px-3 py-3 align-top">
                              {r.review_form_path
                                ? <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"><ClipboardCheck className="size-3" /> Ada</span>
                                : <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Belum ada</span>}
                            </td>
                            <td className="px-3 py-3 align-top">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.tone}`}>{s.label}</span>
                              {s.detail && <p className="mt-1 text-[11px] text-muted-foreground">{s.detail}</p>}
                            </td>
                            <td className="px-5 py-3 text-right align-top">
                              <div className="flex flex-col items-end gap-1">
                                {r.review_form_path && (
                                  <a href={`${API_BASE_PATH}/api/prosedur-isms/${r.id}/pdf?part=review`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Form Review <ExternalLink className="size-3" /></a>
                                )}
                                <button type="button" onClick={() => setEditing({ key: keyOf(r), focus: 'file' })} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Upload className="size-3" /> {r.review_form_path ? 'Ganti Form Review' : 'Unggah Form Review'}</button>
                                <button type="button" onClick={() => setEditing({ key: keyOf(r), focus: 'approvers' })} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><UserCheck className="size-3" /> Atur approver</button>
                                <Link href={`${info.path}?q=${encodeURIComponent(r.control_no)}`} onClick={onClose} className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline">Lihat di {info.short}</Link>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
        </div>
        )}
      </div>
    </div>
  )
}
