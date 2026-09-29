// app/kelola-pengesahan/page.tsx
//
// ISM Admin: who signs Prosedur ISMS documents. One row per position
// (Unit Kerja / Jabatan) with the person currently holding it and their
// email. When someone changes jobs, edit the name + email here — requests
// still waiting on that position are re-sent to the new person automatically,
// while past signatures keep the name of whoever actually signed.

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Loader2, Mail, Pencil, Plus, Send, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { AdminGate } from '@/components/admin-gate'
import { ConfirmDialog } from '@/components/confirm-dialog'

type Role = { code: string; title: string; person_name: string; email: string | null; sort_order: number; is_default: boolean; updated_at: string; updated_by: string | null }
type PendingStep = { id: number; document_id: number; control_no: string; title: string; role_title: string; approver_name: string | null; approver_email: string | null; notified_at: string | null; email_error: string | null }
type Draft = { code: string; title: string; personName: string; email: string; sortOrder: string; isDefault: boolean }

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

const emptyDraft = (order: number): Draft => ({ code: '', title: '', personName: '', email: '', sortOrder: String(order), isDefault: true })

function RoleForm({ draft, setDraft, withCode }: { draft: Draft; setDraft: (d: Draft) => void; withCode: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[90px_1.3fr_1fr_1.2fr_70px]">
      {withCode && (
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Kode</span>
          <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="WPJU" maxLength={20} className={`${inputClass} font-mono`} />
        </label>
      )}
      <label className={`flex flex-col gap-1.5 ${withCode ? '' : 'lg:col-span-2'}`}>
        <span className={labelClass}>Unit Kerja (Jabatan)</span>
        <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Information Assets Administrator" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Nama</span>
        <input value={draft.personName} onChange={(e) => setDraft({ ...draft, personName: e.target.value })} placeholder="Nama pejabat" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Email</span>
        <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="nama@jai.co.id" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Urutan</span>
        <input type="number" min={1} max={99} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} className={inputClass} />
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground sm:col-span-2 lg:col-span-5">
        <input type="checkbox" checked={draft.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })} className="size-4 accent-[color:var(--p-700)]" />
        Otomatis dicentang saat menambah dokumen baru
      </label>
    </div>
  )
}

export default function KelolaPengesahanPage() {
  const { isLoggedIn, isLoading, adminUser } = useAuth()
  const [roles, setRoles] = useState<Role[]>([])
  const [pending, setPending] = useState<PendingStep[]>([])
  const [smtpReady, setSmtpReady] = useState(true)
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

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-approver-roles`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setRoles(data.roles ?? [])
      setPending(data.pending ?? [])
      setSmtpReady(Boolean(data.smtpReady))
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Gagal memuat data.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  const startEdit = (role: Role) => {
    setAdding(false)
    setEditingCode(role.code)
    setDraft({ code: role.code, title: role.title, personName: role.person_name, email: role.email ?? '', sortOrder: String(role.sort_order), isDefault: role.is_default })
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
        body: JSON.stringify({ code: draft.code, title: draft.title, personName: draft.personName, email: draft.email, sortOrder: Number(draft.sortOrder), isDefault: draft.isDefault }),
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Pengesahan Prosedur ISMS</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Atur siapa yang menjabat setiap posisi pengesahan. Saat ada pergantian jabatan, cukup ganti <strong>nama</strong> dan <strong>email</strong> di sini — permintaan yang sedang menunggu otomatis dikirim ulang ke orang baru, sedangkan riwayat tanda tangan sebelumnya tetap tercatat atas nama penyetuju lama.
          </p>
        </div>
        <Link href="/prosedur-isms" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-secondary">
          Register Prosedur <ArrowRight className="size-4" />
        </Link>
      </div>

      {!smtpReady && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-5 flex-none" />
          <p>SMTP belum dikonfigurasi, jadi email pengesahan belum bisa terkirim. Atur dulu di <Link href="/kelola-smtp" className="font-semibold underline">SMTP Settings</Link>.</p>
        </div>
      )}

      {message && (
        <p className={`rounded-xl border px-4 py-3 text-sm ${message.ok ? 'border-emerald-600/20 bg-emerald-600/10 text-emerald-800' : 'border-destructive/20 bg-destructive/10 text-destructive'}`}>{message.text}</p>
      )}

      <SectionCard icon={<Users className="size-4" />} title="Jabatan pengesahan" description="Email dikirim berurutan sesuai kolom Urutan (1 dulu, lalu 2, dst.)">
        <div className="flex flex-col gap-3">
          {roles.map((role) => (
            <div key={role.code} className={`rounded-xl border p-4 transition ${editingCode === role.code ? 'border-primary bg-primary/[0.03]' : 'border-border'}`}>
              {editingCode === role.code ? (
                <div className="flex flex-col gap-4">
                  <RoleForm draft={draft} setDraft={setDraft} withCode={false} />
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
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      <span className="mr-1.5 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-semibold text-secondary-foreground">{role.code}</span>
                      {role.title}
                      {role.is_default && <span className="ml-1.5 text-[10.5px] text-[color:var(--p-600)]">· default</span>}
                    </p>
                    <p className="mt-1 text-base font-semibold text-foreground">{role.person_name}</p>
                    <p className={`flex items-center gap-1.5 text-xs ${role.email ? 'text-muted-foreground' : 'text-destructive'}`}>
                      <Mail className="size-3.5" /> {role.email ?? 'Email belum diisi — email pengesahan tidak bisa dikirim'}
                    </p>
                  </div>
                  <p className="hidden text-[11px] text-muted-foreground md:block">Diubah {formatDateTime(role.updated_at)}{role.updated_by ? ` · ${role.updated_by}` : ''}</p>
                  <div className="flex gap-1">
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
                <p className="text-sm font-semibold text-foreground">Jabatan baru</p>
                <button type="button" onClick={() => setAdding(false)} aria-label="Batal" className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary"><X className="size-4" /></button>
              </div>
              <RoleForm draft={draft} setDraft={setDraft} withCode />
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

      <SectionCard icon={<ShieldCheck className="size-4" />} title="Sedang menunggu pengesahan" description="Dokumen yang saat ini menunggu keputusan seorang approver">
        {pending.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada dokumen yang menunggu pengesahan.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {pending.map((step) => (
              <div key={step.id} className="flex flex-wrap items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground"><span className="mr-2 font-mono text-xs text-[color:var(--p-600)]">{step.control_no}</span>{step.title}</p>
                  <p className="text-xs text-muted-foreground">Menunggu <strong className="text-foreground">{step.approver_name}</strong> · {step.role_title}{step.approver_email ? ` · ${step.approver_email}` : ''}</p>
                  {step.email_error
                    ? <p className="mt-0.5 text-xs text-destructive">{step.email_error}</p>
                    : step.notified_at && <p className="mt-0.5 text-[11px] text-muted-foreground">Email terkirim {formatDateTime(step.notified_at)}</p>}
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
