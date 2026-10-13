// components/admin/ApproverAccountButton.tsx
'use client'

// Approver Pengesahan: beside each approver, whether the address already has
// a login for "Persetujuan Saya" — and a button to make one right there
// (role Approver, the same e-mail), instead of retyping it in Kelola Admin.

import { useState, type FormEvent } from 'react'
import { Check, Copy, KeyRound, Loader2, UserCheck, UserPlus, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'

export type ApproverAccount = { username: string; role: string }

// "Teguh Sunjoyo" → "teguh.sunjoyo"; never empty
function suggestUsername(name: string, email: string) {
  const fromName = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s.]/g, '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '')
  return fromName || email.split('@')[0].toLowerCase().replace(/[^a-z0-9.]/g, '') || 'approver'
}
// 10 characters without look-alikes (0/O, 1/l/I), easy to read out
function randomPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = new Uint32Array(10)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join('')
}

const ROLE_LABEL: Record<string, string> = { ism_admin: 'ISM Admin', lobby: 'Lobby', security: 'Security', approver: 'Approver' }
const inputClass = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'

export function ApproverAccountButton({ name, email, account, onCreated }: { name: string; email: string; account: ApproverAccount | null; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  const close = () => { setOpen(false); if (done) onCreated() }
  useEscapeClose(open, close)

  if (account) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700" title={`Email ini bisa login sebagai "${account.username}" (${ROLE_LABEL[account.role] ?? account.role}) dan membuka Persetujuan Saya`}>
        <UserCheck className="size-3.5" />Akun: {account.username}
      </span>
    )
  }

  const start = () => { setUsername(suggestUsername(name, email)); setPassword(randomPassword()); setError(null); setDone(false); setCopied(false); setOpen(true) }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password, role: 'approver', email }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.message ?? 'Gagal membuat akun.'); return }
      setDone(true)
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setBusy(false)
    }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(`Portal ISMS — akun approver\nUsername: ${username.trim()}\nPassword: ${password}\nMasuk lewat tombol Admin Login, lalu buka Persetujuan Saya.`); setCopied(true) } catch { /* clipboard not available */ }
  }

  return (
    <>
      <button type="button" onClick={start} title="Buat akun login untuk approver ini (Persetujuan Saya)" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary">
        <UserPlus className="size-3.5" /> Buatkan akun
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]">
          <div role="dialog" aria-modal="true" aria-label="Buatkan akun approver" className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><KeyRound className="size-4" /></span>
                <div>
                  <p className="text-sm font-bold text-foreground">{done ? 'Akun dibuat' : 'Buatkan akun approver'}</p>
                  <p className="text-xs text-muted-foreground">{name} · {email}</p>
                </div>
              </div>
              <button type="button" onClick={close} aria-label="Tutup" className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"><X className="size-4" /></button>
            </div>

            {done ? (
              <div className="flex flex-col gap-4 p-5">
                <p className="text-sm leading-6 text-muted-foreground">Berikan data ini kepada <strong className="text-foreground">{name}</strong>. Password hanya ditampilkan sekali di sini.</p>
                <dl className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm" data-testid="new-account">
                  <div className="flex justify-between gap-3 py-1"><dt className="text-muted-foreground">Username</dt><dd className="font-mono font-semibold text-foreground">{username.trim()}</dd></div>
                  <div className="flex justify-between gap-3 py-1"><dt className="text-muted-foreground">Password</dt><dd className="font-mono font-semibold text-foreground">{password}</dd></div>
                </dl>
                <p className="text-xs leading-5 text-muted-foreground">Approver masuk lewat tombol <strong>Admin Login</strong>, lalu membuka <strong>Persetujuan Saya</strong>. Ia bisa mengganti password di sana, atau memakai <strong>Lupa password?</strong> di layar login.</p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary">{copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}{copied ? 'Tersalin' : 'Salin'}</button>
                  <button type="button" onClick={close} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">Selesai</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-3.5 p-5">
                <p className="text-xs leading-5 text-muted-foreground">Akun <strong className="text-foreground">Approver</strong> hanya bisa membuka Persetujuan Saya: dokumen dan Form Review yang dikirim ke <strong className="text-foreground">{email}</strong>, disetujui tanpa kode.</p>
                <label>
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Username</span>
                  <input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus aria-label="Username akun approver" className={inputClass} />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Password awal</span>
                  <div className="flex gap-2">
                    <input value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} aria-label="Password awal" className={`${inputClass} font-mono`} />
                    <button type="button" onClick={() => setPassword(randomPassword())} className="flex-shrink-0 rounded-xl border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary">Acak lagi</button>
                  </div>
                </label>
                {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={close} className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary">Batal</button>
                  <button type="submit" disabled={busy || !username.trim() || password.length < 6} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}Buat akun
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
