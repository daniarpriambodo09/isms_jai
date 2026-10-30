// app/kelola-admin/page.tsx

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Copy,
  Download,
  AlertTriangle,
  Eye,
  EyeOff,
  History,
  Loader2,
  Mail,
  Plus,
  Send,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { EMAIL_HINT, isDeliverableEmail } from '@/lib/email-address'
import { AdminNotificationEmails } from '@/components/admin/AdminNotificationEmails'
import { AdminGate } from '@/components/admin-gate'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/components/pagination'
import { useEscapeClose } from '@/hooks/useEscapeClose'

type AdminRole = 'ism_admin' | 'lobby' | 'security' | 'approver' | 'it'
type AdminRow = { id: number; username: string; email: string | null; role: AdminRole; created_at: string; current_password?: string | null }
type CreatedAccountInfo = {
  id?: number
  username: string
  password: string
  role: AdminRole
  email: string | null
  created_at: string
  emailSent?: boolean
  emailError?: string | null
}
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
  ism_admin: 'Admin ISMS',
  lobby: 'Lobby',
  security: 'Security',
  approver: 'Approver',
  it: 'IT Admin',
}
const ROLE_TONE: Record<AdminRole, string> = {
  ism_admin: 'bg-primary/10 text-primary',
  lobby: 'bg-accent/20 text-accent-foreground',
  security: 'bg-secondary text-secondary-foreground',
  approver: 'bg-emerald-500/10 text-emerald-700',
  it: 'bg-blue-600/10 text-blue-700',
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
  const [showCreatePass, setShowCreatePass] = useState(false)
  const [createError, setCreateError] = useState('')
  const [revealedPasswords, setRevealedPasswords] = useState<Record<number, boolean>>({})

  const toggleRevealPassword = (id: number) => {
    setRevealedPasswords((prev) => ({ ...prev, [id]: !prev[id] }))
  }
  const [creating, setCreating] = useState(false)

  // Celebratory account created modal state
  const [createdAccount, setCreatedAccount] = useState<CreatedAccountInfo | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(true)
  useEscapeClose(createdAccount !== null, () => setCreatedAccount(null))

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editRole, setEditRole] = useState<AdminRole>('lobby')
  const [editPassword, setEditPassword] = useState('')
  const [showEditPass, setShowEditPass] = useState(false)
  const [editEmail, setEditEmail] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [resendingId, setResendingId] = useState<number | null>(null)
  const [resendingModal, setResendingModal] = useState(false)
  const [resendNotice, setResendNotice] = useState<string | null>(null)

  const resendCredentials = async (admin: AdminRow) => {
    if (!admin.email) return
    setResendingId(admin.id)
    setResendNotice(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/admins/${admin.id}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Gagal mengirim ulang email kredensial.')
      setResendNotice(data.message ?? `Email ucapan selamat & kredensial berhasil dikirim ke ${admin.email}`)
      loadLog()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengirim email')
    } finally {
      setResendingId(null)
    }
  }

  const resendWelcomeFromModal = async () => {
    if (!createdAccount?.email) return
    setResendingModal(true)
    try {
      const targetAdmin = admins.find((a) => a.username === createdAccount.username)
      if (!targetAdmin) throw new Error('Akun tidak ditemukan.')
      const res = await fetch(`${API_BASE_PATH}/api/admins/${targetAdmin.id}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: createdAccount.password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Gagal mengirim email')
      setCreatedAccount({ ...createdAccount, emailSent: true, emailError: null })
    } catch (err) {
      setCreatedAccount({ ...createdAccount, emailSent: false, emailError: err instanceof Error ? err.message : 'Gagal' })
    } finally {
      setResendingModal(false)
    }
  }

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

  const copyText = (text: string, fieldName: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2500)
    }
  }

  const copyFullWelcomeMessage = () => {
    if (!createdAccount) return
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const msg = [
      '==================================================',
      'PEMBERITAHUAN KREDENSIAL AKUN RESMI ISMS PORTAL',
      'PT. JATIM AUTOCOMP INDONESIA',
      '==================================================',
      '',
      'Yth. Rekan Kerja,',
      'Akun Anda telah didaftarkan secara resmi di Portal ISMS PT. JAI.',
      '',
      'Berikut detail kredensial akun Anda:',
      `• Username     : ${createdAccount.username}`,
      `• Password     : ${createdAccount.password}`,
      `• Hak Akses    : ${ROLE_LABEL[createdAccount.role]}`,
      createdAccount.email ? `• Email Dinas  : ${createdAccount.email}` : null,
      `• Tautan Login : ${origin}/login`,
      '',
      'Panduan Keamanan Informasi (ISO/IEC 27001):',
      '1. Harap jaga kerahasiaan username dan password ini.',
      '2. Jangan membagikan informasi login kepada pihak manapun.',
      '3. Disarankan untuk segera memperbarui password setelah berhasil login pertama kali.',
      '==================================================',
    ].filter(Boolean).join('\n')

    copyText(msg, 'all')
  }

  const downloadCredentialsTxt = () => {
    if (!createdAccount) return
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const content = [
      '==================================================',
      'KREDENSIAL RESMI AKUN ISMS PORTAL PT. JAI',
      '==================================================',
      `Tanggal Pembuatan: ${new Date(createdAccount.created_at).toLocaleString('id-ID')}`,
      `Username         : ${createdAccount.username}`,
      `Password         : ${createdAccount.password}`,
      `Hak Akses / Role : ${ROLE_LABEL[createdAccount.role]}`,
      createdAccount.email ? `Email            : ${createdAccount.email}` : null,
      `URL Login        : ${origin}/login`,
      '',
      'PENTING:',
      'Simpan dokumen ini dengan aman sesuai standar kepatuhan ISO/IEC 27001.',
      '==================================================',
    ].filter(Boolean).join('\n')

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `kredensial-isms-${createdAccount.username}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

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
      
      const newAccountInfo: CreatedAccountInfo = {
        id: data.admin?.id,
        username: createUsername.trim(),
        password: createPassword,
        role: createRole,
        email: createEmail.trim() || null,
        created_at: new Date().toISOString(),
        emailSent: Boolean(data.emailSent),
        emailError: data.emailError ?? null,
      }

      setShowCreate(false)
      setCreatedAccount(newAccountInfo)
      setShowPassword(true)
      setCopiedField(null)
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
    setEditEmail(admin.email ?? '')
    setEditError('')
  }

  // Your own account: only the email (role/password go through Pengaturan).
  const submitEdit = async (id: number, self = false) => {
    setEditError('')
    setEditSaving(true)
    try {
      const body: { role?: AdminRole; newPassword?: string; email: string | null } = { email: editEmail.trim() || null }
      if (!self) body.role = editRole
      if (!self && editPassword) body.newPassword = editPassword
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
    return <AdminGate title="Akses terbatas" message="Halaman ini hanya untuk akun Admin ISMS." />
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
          <div><div className="text-2xl font-semibold tracking-tight text-foreground">{ismAdminCount}</div><div className="text-xs font-medium text-muted-foreground">Akun Admin ISMS</div></div>
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

      {tab === 'accounts' && <AdminNotificationEmails accountsKey={admins.map((admin) => `${admin.id}:${admin.role}:${admin.email ?? ''}`).join('|')} />}

      {tab === 'accounts' && (
        <div className="rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="portal-eyebrow">Direktori akun</p>
              <p className="mt-1 text-sm text-muted-foreground">Akun lobby/security untuk kiosk, akun Admin ISMS untuk kontrol portal, dan akun approver untuk menyetujui seluruh dokumen & formulir lewat “Persetujuan Saya”.</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowCreate((v) => !v); setCreateError('') }}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--p-550) 100%)', boxShadow: '0 3px 12px color-mix(in oklch, var(--primary) 35%, transparent)' }}
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
                  <label className="mb-1 block text-xs text-muted-foreground">{createRole === 'approver' ? 'Email (wajib — email approver)' : 'Email (opsional)'}</label>
                  <input value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} className={inputClass} placeholder="email@jai.co.id" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-muted-foreground">Password</label>
                    <button
                      type="button"
                      onClick={() => setShowCreatePass(!showCreatePass)}
                      className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {showCreatePass ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                      <span>{showCreatePass ? 'Sembunyikan' : 'Lihat'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showCreatePass ? 'text' : 'password'}
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      className={`${inputClass} pr-9`}
                      placeholder="minimal 6 karakter"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePass(!showCreatePass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      title={showCreatePass ? 'Sembunyikan password' : 'Lihat password'}
                    >
                      {showCreatePass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Role</label>
                  <select value={createRole} onChange={(e) => setCreateRole(e.target.value as AdminRole)} className={inputClass}>
                    <option value="lobby">Lobby</option>
                    <option value="security">Security</option>
                    <option value="ism_admin">Admin ISMS</option>
                    <option value="it">IT Admin (ISMS-F-03)</option>
                    <option value="approver">Approver (Persetujuan Saya)</option>
                  </select>
                </div>
              </div>
              {createRole === 'approver' && (
                <p className="mt-3 rounded-xl bg-secondary/60 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                  Akun <strong className="text-foreground">Approver</strong> terhubung otomatis ke seluruh alur persetujuan: Dokumen Prosedur ISMS, Formulir Layanan IT (E-Sign), Izin Akses Area Special, dan Izin Foto / Video Visitor. <strong className="text-foreground">Email wajib diisi</strong> dan akan menyinkronkan seluruh permohonan yang ditujukan ke alamat email tersebut ke menu Persetujuan Saya & notifikasi.
                </p>
              )}
              {createError && <p className="mt-3 text-sm text-destructive">{createError}</p>}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={submitCreate}
                  disabled={creating || !createUsername.trim() || createPassword.length < 6 || (createRole === 'approver' && !createEmail.trim())}
                  className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--p-550) 100%)' }}
                >
                  {creating && <Loader2 className="size-4 animate-spin" />}
                  Buat Akun
                </button>
              </div>
            </div>
          )}

          {resendNotice && (
            <div className="mx-5 my-4 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-800">
              <div className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-emerald-600" />
                <span>{resendNotice}</span>
              </div>
              <button type="button" onClick={() => setResendNotice(null)} className="cursor-pointer text-emerald-700 hover:text-emerald-900">
                <X className="size-4" />
              </button>
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
                          <div className="text-xs text-muted-foreground">
                            {admin.email ? (
                              isDeliverableEmail(admin.email)
                                ? admin.email
                                : <span className="inline-flex items-center gap-1 font-semibold text-amber-700" title={EMAIL_HINT}><AlertTriangle className="size-3.5 shrink-0" />{admin.email} (tidak bisa menerima email)</span>
                            ) : '—'} · Dibuat {formatDate(admin.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Tombol & Tampilan Sandi / Password */}
                        <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/50 px-2.5 py-1 text-xs shadow-2xs">
                          <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Sandi:</span>
                          <span className="font-mono font-bold text-foreground min-w-[70px]">
                            {revealedPasswords[admin.id]
                              ? (admin.current_password || '(Terenkripsi)')
                              : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleRevealPassword(admin.id)}
                            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer transition rounded hover:bg-secondary"
                            title={revealedPasswords[admin.id] ? 'Sembunyikan sandi' : 'Lihat sandi akun ini'}
                          >
                            {revealedPasswords[admin.id] ? <EyeOff className="size-3.5 text-amber-600" /> : <Eye className="size-3.5 text-primary" />}
                          </button>
                          {admin.current_password && (
                            <button
                              type="button"
                              onClick={() => copyText(admin.current_password!, `pass-${admin.id}`)}
                              className="p-1 text-muted-foreground hover:text-foreground cursor-pointer transition rounded hover:bg-secondary"
                              title="Salin sandi akun ini"
                            >
                              {copiedField === `pass-${admin.id}` ? (
                                <Check className="size-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ROLE_TONE[admin.role]}`}>{ROLE_LABEL[admin.role]}</span>
                        {!isSelf && !isEditing && (
                          <>
                            {admin.email && isDeliverableEmail(admin.email) && (
                              <button
                                type="button"
                                onClick={() => resendCredentials(admin)}
                                disabled={resendingId === admin.id}
                                title="Kirim ulang email ucapan selamat & kredensial akun ke email pemilik"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground disabled:opacity-50 cursor-pointer"
                              >
                                {resendingId === admin.id ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
                                <span>Kirim Kredensial</span>
                              </button>
                            )}
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
                        {isSelf && !isEditing && (
                          <button
                            type="button"
                            onClick={() => startEdit(admin)}
                            title="Password akun sendiri diubah lewat Pengaturan"
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
                          >
                            Ubah email
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs text-muted-foreground">Email (tujuan notifikasi admin)</label>
                            <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className={inputClass} placeholder="nama@jai.co.id" />
                            {editEmail.trim() && !isDeliverableEmail(editEmail) && <p className="mt-1 text-[11px] text-amber-700">{EMAIL_HINT}</p>}
                          </div>
                          {!isSelf && (
                            <>
                              <div>
                                <label className="mb-1 block text-xs text-muted-foreground">Role</label>
                                <select value={editRole} onChange={(e) => setEditRole(e.target.value as AdminRole)} className={inputClass}>
                                  <option value="lobby">Lobby</option>
                                  <option value="security">Security</option>
                                  <option value="ism_admin">ISM Admin</option>
                                  <option value="it">IT Admin (ISMS-F-03)</option>
                                  <option value="approver">Approver</option>
                                </select>
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-xs text-muted-foreground">Reset password (opsional)</label>
                                  {editPassword && (
                                    <button
                                      type="button"
                                      onClick={() => setShowEditPass(!showEditPass)}
                                      className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                      {showEditPass ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                                      <span>{showEditPass ? 'Sembunyikan' : 'Lihat'}</span>
                                    </button>
                                  )}
                                </div>
                                <div className="relative">
                                  <input
                                    type={showEditPass ? 'text' : 'password'}
                                    value={editPassword}
                                    onChange={(e) => setEditPassword(e.target.value)}
                                    className={`${inputClass} pr-9`}
                                    placeholder="kosongkan jika tidak diubah"
                                  />
                                  {editPassword && (
                                    <button
                                      type="button"
                                      onClick={() => setShowEditPass(!showEditPass)}
                                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                      title={showEditPass ? 'Sembunyikan password' : 'Lihat password'}
                                    >
                                      {showEditPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        {isSelf && <p className="mt-2 text-[11px] text-muted-foreground">Password akun Anda sendiri diubah lewat halaman Pengaturan.</p>}
                        {editError && <p className="mt-3 text-sm text-destructive">{editError}</p>}
                        <div className="mt-4 flex justify-end gap-2">
                          <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary">Batal</button>
                          <button
                            type="button"
                            onClick={() => submitEdit(admin.id, isSelf)}
                            disabled={editSaving || (editPassword.length > 0 && editPassword.length < 6) || (!!editEmail.trim() && !isDeliverableEmail(editEmail))}
                            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--p-550) 100%)' }}
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

      {/* CELEBRATORY WELCOME & CREDENTIALS MODAL */}
      {createdAccount && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 md:p-6 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) setCreatedAccount(null) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Selamat! Akun Anda Berhasil Dibuat"
            className="relative flex w-full max-w-4xl max-h-[92vh] flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl animate-in zoom-in-95 duration-200"
          >
            {/* Festive ambient background glow */}
            <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-emerald-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 -left-24 size-72 rounded-full bg-primary/20 blur-3xl" />

            {/* Top Close Button (X) */}
            <button
              type="button"
              onClick={() => setCreatedAccount(null)}
              aria-label="Tutup"
              className="absolute right-4 top-4 z-20 grid size-9 place-items-center rounded-full border border-border/60 bg-card/80 text-muted-foreground backdrop-blur-sm transition hover:bg-secondary hover:text-foreground cursor-pointer shadow-xs"
            >
              <X className="size-4" />
            </button>

            {/* Scrollable Content Container */}
            <div className="overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
              {/* Header with celebration badge */}
              <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pr-10 border-b border-border/60 pb-4">
                <div className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-sm">
                  <UserCheck className="size-7" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-mono text-[10.5px] font-bold text-accent uppercase tracking-widest">
                    <ShieldCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Akun Baru Berhasil Didaftarkan</span>
                  </div>
                  <h3 className="mt-0.5 font-display text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    Selamat! Akun Anda Berhasil Dibuat
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Akun telah aktif di sistem <strong>ISMS Portal PT. JAI</strong> dan siap digunakan untuk otorisasi &amp; layanan keamanan informasi.
                  </p>
                </div>
              </div>

              {/* Landscape 2-Column Grid */}
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Column 1: Kredensial Akses Pengguna */}
                <div className="rounded-2xl border border-border/80 bg-secondary/40 p-4 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="font-mono text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                      Kredensial Akses Pengguna
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${ROLE_TONE[createdAccount.role]}`}>
                      {ROLE_LABEL[createdAccount.role]}
                    </span>
                  </div>

                  {/* Username Field */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Username Login</label>
                    <div className="flex items-center justify-between rounded-xl border border-input bg-card px-3.5 py-2 shadow-xs">
                      <span className="font-mono text-sm font-bold text-foreground tracking-wide">
                        {createdAccount.username}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(createdAccount.username, 'username')}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/60 px-2 py-1 text-[11px] font-semibold text-foreground transition hover:bg-secondary cursor-pointer"
                      >
                        {copiedField === 'username' ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                        <span>{copiedField === 'username' ? 'Tersalin' : 'Salin'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Password Akses</label>
                    <div className="flex items-center justify-between rounded-xl border border-input bg-card px-3.5 py-2 shadow-xs">
                      <span className="font-mono text-sm font-bold text-foreground tracking-wide">
                        {showPassword ? createdAccount.password : '••••••••••••'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
                          title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        >
                          {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyText(createdAccount.password, 'password')}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/60 px-2 py-1 text-[11px] font-semibold text-foreground transition hover:bg-secondary cursor-pointer"
                        >
                          {copiedField === 'password' ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                          <span>{copiedField === 'password' ? 'Tersalin' : 'Salin'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {createdAccount.email && (
                    <div className="pt-1.5 text-xs flex items-center justify-between">
                      <span className="text-muted-foreground">Email Terdaftar:</span>
                      <span className="font-mono font-medium text-foreground">{createdAccount.email}</span>
                    </div>
                  )}
                </div>

                {/* Column 2: Status Pengiriman Email & Pemberitahuan Keamanan */}
                <div className="flex flex-col gap-3">
                  {/* Email Delivery Status */}
                  {createdAccount.email && (
                    <div>
                      {createdAccount.emailSent ? (
                        <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-300">
                          <Check className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                          <span className="leading-relaxed">Email ucapan selamat &amp; kredensial akun telah otomatis dikirim ke <strong>{createdAccount.email}</strong>. Pemilik akun dapat langsung mengetahui jika sudah memiliki akun.</span>
                        </div>
                      ) : createdAccount.emailError ? (
                        <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
                          <span className="leading-relaxed">Pengiriman email belum berhasil: {createdAccount.emailError}</span>
                          <button
                            type="button"
                            onClick={resendWelcomeFromModal}
                            disabled={resendingModal}
                            className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                          >
                            {resendingModal ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                            <span>Kirim Ulang Email</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-800 dark:text-blue-300">
                          <span className="leading-relaxed">Kirim email ucapan selamat &amp; kredensial ke pemilik akun:</span>
                          <button
                            type="button"
                            onClick={resendWelcomeFromModal}
                            disabled={resendingModal}
                            className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                          >
                            {resendingModal ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                            <span>Kirim Email Akun</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Security Caution Notice */}
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <p className="text-[11.5px] leading-relaxed">
                        <strong>Pemberitahuan Keamanan:</strong> Demi mematuhi ISO/IEC 27001, password asli hanya ditampilkan satu kali ini. Harap segera catat kredensial ini dan minta pemilik akun melakukan penggantian password saat login pertama kali.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons Footer (sticky bottom bar) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-border/80 bg-secondary/30 px-5 py-3.5 sm:px-8">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadCredentialsTxt}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-xs transition hover:bg-secondary cursor-pointer"
                >
                  <Download className="size-3.5" />
                  <span>Unduh Slip (.TXT)</span>
                </button>

                <button
                  type="button"
                  onClick={copyFullWelcomeMessage}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-accent-foreground shadow-sm transition hover:brightness-110 cursor-pointer"
                >
                  {copiedField === 'all' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  <span>{copiedField === 'all' ? 'Tersalin!' : 'Salin Format Pesan'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setCreatedAccount(null)}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 cursor-pointer"
              >
                Selesai &amp; Tutup
              </button>
            </div>
          </div>
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
