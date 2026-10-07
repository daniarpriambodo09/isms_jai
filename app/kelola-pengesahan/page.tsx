// app/kelola-pengesahan/page.tsx
//
// ISM Admin: who signs controlled documents. Prosedur ISMS and Working
// Standard each have their own list of positions (the tabs; ?kind=... opens
// one directly) — positions can be added, edited and deleted in both. One row
// per position (Unit Kerja / Jabatan) with the person currently holding it and
// their email. When someone changes jobs, edit the name + email here — requests
// still waiting on that position are re-sent to the new person automatically,
// while past signatures keep the name of whoever actually signed.

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Loader2, Mail, Pencil, Plus, Send, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { DOC_KINDS, DOC_KIND_INFO, isDocKind, type DocKind } from '@/lib/document-kinds'
import { AdminGate } from '@/components/admin-gate'
import { ConfirmDialog } from '@/components/confirm-dialog'

type Role = { code: string; title: string; person_name: string; initials: string | null; email: string | null; sort_order: number; is_default: boolean; updated_at: string; updated_by: string | null }
type PendingStep = { id: number; document_id: number; control_no: string; title: string; role_title: string; approver_name: string | null; approver_email: string | null; notified_at: string | null; email_error: string | null; reminded_at?: string | null; reminder_count?: number }
type Draft = { code: string; title: string; personName: string; initials: string; email: string; sortOrder: string; isDefault: boolean }
type KindCounts = Record<DocKind, { roles: number; pending: number }>

// Example values shown in the empty inputs, per register.
const PLACEHOLDERS: Record<DocKind, { code: string; title: string }> = {
  procedure: { code: 'WPJU', title: 'Information Assets Administrator' },
  working_standard: { code: 'WS-APP3', title: 'Approved 3' },
  tmmin_standard: { code: 'TM-APP2', title: 'Approved 2' },
  review_form: { code: 'FR-APP2', title: 'Approval 2' },
}

const inputClass = 'h-10 w-full min-w-0 rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const labelClass = 'text-xs font-semibold text-foreground'

function SectionCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-start gap-3 border-b border-border bg-secondary/30 px-5 py-4">
        <span className="grid size-9 flex-shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <div>
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

const emptyDraft = (order: number): Draft => ({ code: '', title: '', personName: '', initials: '', email: '', sortOrder: String(order), isDefault: true })

function RoleForm({ draft, setDraft, withCode, kind }: { draft: Draft; setDraft: (d: Draft) => void; withCode: boolean; kind: DocKind }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[90px_1.3fr_1fr_84px_1.2fr_70px]">
      {withCode && (
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Kode</span>
          <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder={PLACEHOLDERS[kind].code} maxLength={20} className={`${inputClass} font-mono`} />
        </label>
      )}
      <label className={`flex flex-col gap-1.5 ${withCode ? '' : 'lg:col-span-2'}`}>
        <span className={labelClass}>Unit Kerja (Jabatan)</span>
        <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={PLACEHOLDERS[kind].title} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Nama</span>
        <input value={draft.personName} onChange={(e) => setDraft({ ...draft, personName: e.target.value })} placeholder="Nama pejabat" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass} title="Huruf yang tercetak di bawah kotak tanda tangan (mis. TWC). Kosongkan untuk memakai 3 huruf pertama nama.">Inisial</span>
        <input value={draft.initials} onChange={(e) => setDraft({ ...draft, initials: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder={draft.personName.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'TWC'} maxLength={5} className={`${inputClass} font-mono uppercase`} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Email</span>
        <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="nama@jai.co.id" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Urutan</span>
        <input type="number" min={1} max={99} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} className={inputClass} />
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground sm:col-span-2 lg:col-span-6">
        <input type="checkbox" checked={draft.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })} className="size-4 accent-[color:var(--p-700)]" />
        Otomatis dicentang saat menambah dokumen baru
      </label>
    </div>
  )
}

export default function KelolaPengesahanPage() {
  const { isLoggedIn, isLoading, adminUser } = useAuth()
  const [kind, setKind] = useState<DocKind>('procedure')
  const [kindReady, setKindReady] = useState(false)
  const [counts, setCounts] = useState<KindCounts | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [pending, setPending] = useState<PendingStep[]>([])
  const [smtpReady, setSmtpReady] = useState(true)
  const [appUrlWarning, setAppUrlWarning] = useState<{ configured: string; suggestions: string[] } | null>(null)
  const [fixingUrl, setFixingUrl] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft(1))
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Role | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [resendingDoc, setResendingDoc] = useState<number | null>(null)

  const isAdmin = adminUser?.role === 'ism_admin'
  const kindInfo = DOC_KIND_INFO[kind]

  // ?kind=working_standard opens that register's list (linked from its form).
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('kind')
    if (isDocKind(requested)) setKind(requested)
    setKindReady(true)
  }, [])

  const switchKind = (next: DocKind) => {
    if (next === kind) return
    setKind(next)
    setEditingCode(null)
    setAdding(false)
    setMessage(null)
    const url = new URL(window.location.href)
    url.searchParams.set('kind', next)
    window.history.replaceState(null, '', url)
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-approver-roles?kind=${kind}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setRoles(data.roles ?? [])
      setPending(data.pending ?? [])
      setCounts(data.counts ?? null)
      setSmtpReady(Boolean(data.smtpReady))
      setAppUrlWarning(data.appUrlWarning ?? null)
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Gagal memuat data.' })
    } finally {
      setLoading(false)
    }
  }, [kind])

  useEffect(() => { if (isAdmin && kindReady) load() }, [isAdmin, kindReady, load])

  const startEdit = (role: Role) => {
    setAdding(false)
    setEditingCode(role.code)
    setDraft({ code: role.code, title: role.title, personName: role.person_name, initials: role.initials ?? '', email: role.email ?? '', sortOrder: String(role.sort_order), isDefault: role.is_default })
    setMessage(null)
  }

  const startAdd = () => {
    setEditingCode(null)
    setAdding(true)
    setDraft(emptyDraft((roles.at(-1)?.sort_order ?? 0) + 1))
    setMessage(null)
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-approver-roles`, {
        method: adding ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, code: draft.code, title: draft.title, personName: draft.personName, initials: draft.initials, email: draft.email, sortOrder: Number(draft.sortOrder), isDefault: draft.isDefault }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message ?? 'Gagal menyimpan.')
      setMessage({ ok: true, text: data.message ?? 'Jabatan ditambahkan.' })
      setEditingCode(null)
      setAdding(false)
      await load()
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Gagal menyimpan.' })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-approver-roles?code=${encodeURIComponent(pendingDelete.code)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setMessage({ ok: false, text: data.message ?? 'Gagal menghapus.' })
      else { setMessage({ ok: true, text: 'Jabatan dihapus.' }); await load() }
    } finally {
      setDeleting(false)
      setPendingDelete(null)
    }
  }

  const applyAppUrl = async (appUrl: string) => {
    setFixingUrl(true)
    setMessage(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/smtp-settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appUrl }) })
      const data = await res.json().catch(() => ({}))
      setMessage({ ok: res.ok, text: res.ok ? `${data.message} Tekan "Kirim ulang" pada dokumen yang menunggu agar approver menerima link yang benar.` : (data.message ?? 'Gagal mengubah App URL.') })
      await load()
    } finally {
      setFixingUrl(false)
    }
  }

  const resend = async (documentId: number) => {
    setResendingDoc(documentId)
    setMessage(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-isms/approval/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, mode: 'resend' }),
      })
      const data = await res.json().catch(() => ({}))
      setMessage({ ok: res.ok, text: data.message ?? (res.ok ? 'Email dikirim ulang.' : 'Gagal mengirim.') })
      await load()
    } finally {
      setResendingDoc(null)
    }
  }

  if (!isLoading && !isLoggedIn) return <AdminGate />
  if (!isLoading && adminUser && !isAdmin) return <AdminGate title="Akses terbatas" message="Halaman ini hanya untuk akun ISM Admin." />
  if (loading) return <div className="rounded-3xl border border-border bg-card p-12 text-center text-sm text-muted-foreground shadow-sm">Memuat data pengesahan...</div>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Approver Pengesahan Dokumen</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Atur jabatan pengesahan dan siapa yang menjabatnya. Prosedur ISMS, Working Standard, Standard Requirement TMMIN, dan Form Review Dokumen masing-masing punya daftar jabatan sendiri — jabatan bisa ditambah, diubah, dan dihapus. Saat ada pergantian jabatan, cukup ganti <strong>nama</strong> dan <strong>email</strong> di sini — permintaan yang sedang menunggu otomatis dikirim ulang ke orang baru, sedangkan riwayat tanda tangan sebelumnya tetap tercatat atas nama penyetuju lama.
          </p>
        </div>
        <Link href={kindInfo.path} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-secondary">
          Register {kindInfo.short} <ArrowRight className="size-4" />
        </Link>
      </div>

      <div role="tablist" aria-label="Jenis dokumen" className="flex w-full flex-wrap gap-1 rounded-2xl border border-border bg-card p-1 shadow-sm sm:w-fit">
        {DOC_KINDS.map((k) => {
          const active = k === kind
          const waiting = counts?.[k]?.pending ?? 0
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchKind(k)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-4 sm:text-sm ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
            >
              {DOC_KIND_INFO[k].label}
              {counts && <span className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold leading-none ${active ? 'bg-primary-foreground/20' : 'bg-secondary text-secondary-foreground'}`}>{counts[k].roles}</span>}
              {waiting > 0 && <span title={`${waiting} dokumen menunggu pengesahan`} className="size-2 rounded-full bg-amber-500" />}
            </button>
          )
        })}
      </div>

      {!smtpReady && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-5 flex-none" />
          <p>SMTP belum dikonfigurasi, jadi email pengesahan belum bisa terkirim. Atur dulu di <Link href="/kelola-smtp" className="font-semibold underline">SMTP Settings</Link>.</p>
        </div>
      )}

      {appUrlWarning && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-500/40 bg-red-50 px-5 py-4 text-sm text-red-900">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-5 flex-none" />
            <span>
              <strong>Link di email pengesahan tidak bisa dibuka.</strong> App URL masih <span className="font-mono">{appUrlWarning.configured}</span>, padahal alamat server ini sekarang <span className="font-mono">{appUrlWarning.suggestions.join(' / ')}</span> (IP laptop/server berubah). Approver akan melihat &ldquo;This site can&rsquo;t be reached&rdquo;.
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2 pl-7">
            {appUrlWarning.suggestions.slice(0, 2).map((url) => (
              <button key={url} type="button" onClick={() => applyAppUrl(url)} disabled={fixingUrl} className="inline-flex items-center gap-1.5 rounded-full bg-red-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50">
                {fixingUrl && <Loader2 className="size-3.5 animate-spin" />} Pakai {url}
              </button>
            ))}
            <Link href="/kelola-smtp" className="text-xs font-semibold underline">Atur di SMTP Settings</Link>
          </div>
          <p className="pl-7 text-xs text-red-800/80">Agar tidak terulang, beri laptop/server ini IP tetap (DHCP reservation di router atau IP statis).</p>
        </div>
      )}

      {message && (
        <p className={`rounded-xl border px-4 py-3 text-sm ${message.ok ? 'border-emerald-600/20 bg-emerald-600/10 text-emerald-800' : 'border-destructive/20 bg-destructive/10 text-destructive'}`}>{message.text}</p>
      )}

      <SectionCard icon={<Users className="size-4" />} title={`Jabatan pengesahan ${kindInfo.label}`} description="Email dikirim berurutan sesuai kolom Urutan (1 dulu, lalu 2, dst.)">
        <div className="flex flex-col gap-3">
          {roles.length === 0 && !adding && (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Belum ada jabatan pengesahan untuk {kindInfo.label}. Tambahkan jabatan pertama di bawah.
            </p>
          )}
          {roles.map((role) => (
            <div key={role.code} className={`rounded-xl border p-4 transition ${editingCode === role.code ? 'border-primary bg-primary/[0.03]' : 'border-border'}`}>
              {editingCode === role.code ? (
                <div className="flex flex-col gap-4">
                  <RoleForm draft={draft} setDraft={setDraft} withCode={false} kind={kind} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                      {saving && <Loader2 className="size-4 animate-spin" />} Simpan
                    </button>
                    <button type="button" onClick={() => setEditingCode(null)} className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary">Batal</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  <span className="grid size-10 flex-none place-items-center rounded-full bg-[color:var(--p-850)] font-mono text-sm font-bold text-primary-foreground">{role.sort_order}</span>
                  <div className="min-w-[180px] flex-1">
                    <p className="text-xs text-muted-foreground">
                      <span className="mr-1.5 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-semibold text-secondary-foreground">{role.code}</span>
                      {role.title}
                      {role.is_default && <span className="ml-1.5 text-[10.5px] text-[color:var(--p-600)]">· default</span>}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-base font-semibold text-foreground">
                      {role.person_name}
                      {(role.initials || role.person_name.replace(/[^A-Za-z]/g, '').slice(0, 3)) && !/^belum\s*diisi$/i.test(role.person_name.trim()) && (
                        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-muted-foreground" title={role.initials ? 'Inisial yang tercetak di bawah kotak tanda tangan' : 'Inisial otomatis dari nama — bisa diubah lewat Ganti / Edit'}>
                          {role.initials || role.person_name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()}
                        </span>
                      )}
                    </p>
                    <p className={`flex items-center gap-1.5 text-xs ${role.email ? 'text-muted-foreground' : 'text-destructive'}`}>
                      <Mail className="size-3.5" /> {role.email ?? 'Email belum diisi — email pengesahan tidak bisa dikirim'}
                    </p>
                  </div>
                  <p className="hidden text-[11px] text-muted-foreground md:block">Diubah {formatDateTime(role.updated_at)}{role.updated_by ? ` · ${role.updated_by}` : ''}</p>
                  <div className="ml-auto flex gap-1">
                    <button type="button" onClick={() => startEdit(role)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"><Pencil className="size-3.5" /> Ganti / Edit</button>
                    <button type="button" onClick={() => setPendingDelete(role)} aria-label={`Hapus ${role.title}`} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {adding ? (
            <div className="rounded-xl border border-primary bg-primary/[0.03] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Jabatan baru · {kindInfo.label}</p>
                <button type="button" onClick={() => setAdding(false)} aria-label="Batal" className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary"><X className="size-4" /></button>
              </div>
              <RoleForm draft={draft} setDraft={setDraft} withCode kind={kind} />
              <button type="button" onClick={save} disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {saving && <Loader2 className="size-4 animate-spin" />} Tambah jabatan
              </button>
            </div>
          ) : (
            <button type="button" onClick={startAdd} className="inline-flex w-fit items-center gap-2 rounded-full border border-dashed border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:border-primary hover:text-primary">
              <Plus className="size-4" /> Tambah jabatan
            </button>
          )}
        </div>
      </SectionCard>

      <SectionCard icon={<ShieldCheck className="size-4" />} title="Sedang menunggu pengesahan" description={`${kindInfo.label} yang saat ini menunggu keputusan seorang approver — pengingat otomatis tiap 3 hari, dikirim pada hari kerja (maks. 5×)`}>
        {pending.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada {kindInfo.noun} yang menunggu pengesahan.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {pending.map((step) => (
              <div key={step.id} className="flex flex-wrap items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground"><span className="mr-2 font-mono text-xs text-[color:var(--p-600)]">{step.control_no}</span>{step.title}</p>
                  <p className="text-xs text-muted-foreground">Menunggu <strong className="text-foreground">{step.approver_name}</strong> · {step.role_title}{step.approver_email ? ` · ${step.approver_email}` : ''}</p>
                  {step.email_error
                    ? <p className="mt-0.5 text-xs text-destructive">{step.email_error}</p>
                    : step.notified_at && <p className="mt-0.5 text-[11px] text-muted-foreground">Email terkirim {formatDateTime(step.notified_at)}{step.reminder_count && step.reminded_at ? ` · pengingat ${step.reminder_count}× (terakhir ${formatDateTime(step.reminded_at)})` : ''}</p>}
                </div>
                <button type="button" onClick={() => resend(step.document_id)} disabled={resendingDoc === step.document_id} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50">
                  {resendingDoc === step.document_id ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Kirim ulang
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Hapus jabatan?"
        message={`Jabatan "${pendingDelete?.title}" akan dihapus. Jabatan yang masih dipakai di dokumen tidak bisa dihapus — untuk pergantian orang cukup gunakan "Ganti / Edit".`}
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
