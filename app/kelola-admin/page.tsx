// app/kelola-admin/page.tsx

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, History, Loader2, Plus, Shield, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { AdminGate } from '@/components/admin-gate'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/components/pagination'

type AdminRole = 'ism_admin' | 'lobby' | 'security'
type AdminRow = { id: number; username: string; email: string | null; role: AdminRole; created_at: string }
type ActivityEntry = {
  id: number
  actor_username: string
  actor_role: string
  action: string
  entity_type: string
  entity_id: string | null
  description: string
  created_at: string
}

const ROLE_LABEL: Record<AdminRole, string> = {
  ism_admin: 'ISM Admin',
  lobby: 'Lobby',
  security: 'Security',
}
const ROLE_TONE: Record<AdminRole, string> = {
  ism_admin: 'bg-primary/10 text-primary',
  lobby: 'bg-accent/20 text-accent-foreground',
  security: 'bg-secondary text-secondary-foreground',
}
const ACTION_LABEL: Record<string, string> = { create: 'Membuat', update: 'Mengubah', delete: 'Menghapus' }
const ACTION_TONE: Record<string, string> = {
  create: 'bg-emerald-500/10 text-emerald-600',
  update: 'bg-amber-500/10 text-amber-600',
  delete: 'bg-red-500/10 text-red-600',
}

const inputClass = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'

function formatDate(value: string) {
  return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function KelolaAdminPage() {
  const { isLoggedIn, isLoading, adminUser } = useAuth()

  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [adminsLoading, setAdminsLoading] = useState(true)
  const [log, setLog] = useState<ActivityEntry[]>([])
  const [logLoading, setLogLoading] = useState(true)
  const [tab, setTab] = useState<'accounts' | 'log'>('accounts')

  const [showCreate, setShowCreate] = useState(false)
  const [createUsername, setCreateUsername] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<AdminRole>('lobby')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editRole, setEditRole] = useState<AdminRole>('lobby')
  const [editPassword, setEditPassword] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/admins`, { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      setAdmins(data.admins ?? [])
    } catch { setAdmins([]) } finally { setAdminsLoading(false) }
  }, [])

  const loadLog = useCallback(async () => {
    setLogLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/activity-log`, { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      setLog(data.entries ?? [])
    } catch { setLog([]) } finally { setLogLoading(false) }
  }, [])

  useEffect(() => {
    if (isLoggedIn && adminUser?.role === 'ism_admin') { loadAdmins(); loadLog() }
  }, [isLoggedIn, adminUser, loadAdmins, loadLog])

  const { page, setPage, totalPages, pageItems: logPageItems, pageSize } = usePagination(log, 20)

  const submitCreate = async () => {
    setCreateError('')
    setCreating(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: createUsername.trim(), email: createEmail.trim() || undefined, password: createPassword, role: createRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Gagal membuat akun admin.')
      setShowCreate(false)
      setCreateUsername(''); setCreateEmail(''); setCreatePassword(''); setCreateRole('lobby')
      loadAdmins(); loadLog()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (admin: AdminRow) => {
    setEditingId(admin.id)
    setEditRole(admin.role)
    setEditPassword('')
    setEditError('')
  }

  const submitEdit = async (id: number) => {
    setEditError('')
    setEditSaving(true)
    try {
      const body: { role?: AdminRole; newPassword?: string } = { role: editRole }
      if (editPassword) body.newPassword = editPassword
      const res = await fetch(`${API_BASE_PATH}/api/admins/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Gagal memperbarui akun admin.')
      setEditingId(null)
      loadAdmins(); loadLog()
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setEditSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/admins/${deleteTarget.id}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Gagal menghapus akun admin.')
      setDeleteTarget(null)
      loadAdmins(); loadLog()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Terjadi kesalahan.')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const ismAdminCount = useMemo(() => admins.filter((a) => a.role === 'ism_admin').length, [admins])

  if (!isLoading && !isLoggedIn) return <AdminGate />
  if (!isLoading && adminUser && adminUser.role !== 'ism_admin') {
    return <AdminGate title="Akses terbatas" message="Halaman ini hanya untuk akun ISM Admin." />
  }

  return (
    <div className="flex flex-col gap-7">
      <header className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8">
        <div className="absolute right-8 top-0 hidden h-full w-1/3 border-l border-primary-foreground/10 bg-[linear-gradient(135deg,transparent_25%,rgba(255,255,255,0.08)_25%,transparent_60%)] sm:block" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
              <Shield className="size-3.5" /> Admin workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Kelola akun admin</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">
              Tambah, ubah role, reset password, atau hapus akun admin — serta lihat riwayat aktivitas seluruh admin di sistem.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Users className="size-5" /></div>
          <div><div className="text-2xl font-semibold tracking-tight text-foreground">{admins.length}</div><div className="text-xs font-medium text-muted-foreground">Total akun admin</div></div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="grid size-11 place-items-center rounded-2xl bg-accent/20 text-accent-foreground"><ShieldCheck className="size-5" /></div>
          <div><div className="text-2xl font-semibold tracking-tight text-foreground">{ismAdminCount}</div><div className="text-xs font-medium text-muted-foreground">Akun ISM Admin</div></div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="grid size-11 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><History className="size-5" /></div>
          <div><div className="text-2xl font-semibold tracking-tight text-foreground">{log.length}</div><div className="text-xs font-medium text-muted-foreground">Aktivitas tercatat</div></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab('accounts')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === 'accounts' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Users className="size-4" /> Akun Admin
        </button>
        <button
          type="button"
          onClick={() => setTab('log')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === 'log' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <History className="size-4" /> Log Aktivitas
        </button>
      </div>

      {tab === 'accounts' && (
        <div className="rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="portal-eyebrow">Direktori akun</p>
              <p className="mt-1 text-sm text-muted-foreground">Akun lobby/security untuk kiosk, dan akun ism_admin untuk konten portal.</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowCreate((v) => !v); setCreateError('') }}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, oklch(0.39 0.09 205) 0%, oklch(0.48 0.12 180) 100%)', boxShadow: '0 3px 12px oklch(0.39 0.09 205 / 35%)' }}
            >
              {showCreate ? <X className="size-4" /> : <Plus className="size-4" />}
              {showCreate ? 'Batal' : 'Tambah Admin'}
            </button>
          </div>

          {showCreate && (
            <div className="border-b border-border bg-secondary/30 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Username</label>
                  <input value={createUsername} onChange={(e) => setCreateUsername(e.target.value)} className={inputClass} placeholder="username" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Email (opsional)</label>
                  <input value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} className={inputClass} placeholder="email@jai.co.id" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Password</label>
                  <input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} className={inputClass} placeholder="minimal 6 karakter" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Role</label>
                  <select value={createRole} onChange={(e) => setCreateRole(e.target.value as AdminRole)} className={inputClass}>
                    <option value="lobby">Lobby</option>
                    <option value="security">Security</option>
                    <option value="ism_admin">ISM Admin</option>
                  </select>
                </div>
              </div>
              {createError && <p className="mt-3 text-sm text-destructive">{createError}</p>}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={submitCreate}
                  disabled={creating || !createUsername.trim() || createPassword.length < 6}
                  className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, oklch(0.39 0.09 205) 0%, oklch(0.48 0.12 180) 100%)' }}
                >
                  {creating && <Loader2 className="size-4 animate-spin" />}
                  Buat Akun
                </button>
              </div>
            </div>
          )}

          {adminsLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : admins.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Belum ada akun admin.</div>
          ) : (
            <div className="divide-y divide-border">
              {admins.map((admin) => {
                const isSelf = adminUser?.id === admin.id
                const isEditing = editingId === admin.id
                return (
                  <div key={admin.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`grid size-9 place-items-center rounded-xl text-xs font-bold ${ROLE_TONE[admin.role]}`}>
                          {admin.username.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{admin.username}</span>
                            {isSelf && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Anda</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">{admin.email ?? '—'} · Dibuat {formatDate(admin.created_at)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ROLE_TONE[admin.role]}`}>{ROLE_LABEL[admin.role]}</span>
                        {!isSelf && !isEditing && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(admin)}
                              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(admin)}
                              aria-label={`Hapus ${admin.username}`}
                              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </>
                        )}
                        {isSelf && <span className="text-xs text-muted-foreground">Gunakan Pengaturan untuk ubah password sendiri</span>}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Role</label>
                            <select value={editRole} onChange={(e) => setEditRole(e.target.value as AdminRole)} className={inputClass}>
                              <option value="lobby">Lobby</option>
                              <option value="security">Security</option>
                              <option value="ism_admin">ISM Admin</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Reset password (opsional)</label>
                            <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className={inputClass} placeholder="kosongkan jika tidak diubah" />
                          </div>
                        </div>
                        {editError && <p className="mt-3 text-sm text-destructive">{editError}</p>}
                        <div className="mt-4 flex justify-end gap-2">
                          <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary">Batal</button>
                          <button
                            type="button"
                            onClick={() => submitEdit(admin.id)}
                            disabled={editSaving || (editPassword.length > 0 && editPassword.length < 6)}
                            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, oklch(0.39 0.09 205) 0%, oklch(0.48 0.12 180) 100%)' }}
                          >
                            {editSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                            Simpan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'log' && (
        <div className="rounded-3xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <p className="portal-eyebrow">Riwayat aktivitas</p>
            <p className="mt-1 text-sm text-muted-foreground">200 aktivitas terbaru — pembuatan, perubahan, dan penghapusan data oleh admin.</p>
          </div>
          {logLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : log.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Belum ada aktivitas tercatat.</div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {logPageItems.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 px-5 py-3.5">
                    <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ACTION_TONE[entry.action] ?? 'bg-secondary text-secondary-foreground'}`}>
                      {ACTION_LABEL[entry.action] ?? entry.action}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{entry.description}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {entry.actor_username} ({entry.actor_role}) · {formatDate(entry.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={log.length} pageSize={pageSize} />
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus akun admin?"
        message={deleteTarget ? `Akun "${deleteTarget.username}" (${ROLE_LABEL[deleteTarget.role]}) akan dihapus permanen dan tidak bisa login lagi.` : ''}
        confirmLabel="Hapus"
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
