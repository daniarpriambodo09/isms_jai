// app/reset-password/page.tsx
'use client'

// "Lupa password". Without ?token: ask for the reset link (username or
// e-mail). With the token from that e-mail: set a new password.

import { Suspense, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, KeyRound, Loader2, MailCheck, XCircle } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

const inputClass = 'h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const card = 'mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm'
const openLogin = () => window.dispatchEvent(new Event('open-admin-login'))

function RequestLink() {
  const [identifier, setIdentifier] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier }) })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setError(body?.message ?? 'Gagal mengirim permintaan.'); return }
      setSent(body?.message ?? 'Permintaan terkirim.')
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className={`${card} text-center`}>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-700"><MailCheck className="size-7" /></span>
        <h2 className="mt-5 font-display text-2xl font-semibold text-foreground">Periksa email Anda</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground" role="status">{sent}</p>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">Tidak menerima email? Periksa folder spam, atau akun Anda belum punya alamat email — minta Admin ISM mengatur ulang password dari Kelola Admin.</p>
        <button type="button" onClick={() => { setSent(null); setIdentifier('') }} className="mt-5 text-sm font-semibold text-[color:var(--p-600)] hover:underline">Kirim untuk akun lain</button>
      </div>
    )
  }
  return (
    <form onSubmit={submit} className={card}>
      <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><KeyRound className="size-6" /></span>
      <h2 className="mt-5 font-display text-2xl font-semibold text-foreground">Lupa password</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Isi username atau email akun Anda. Link untuk membuat password baru dikirim ke alamat email akun tersebut.</p>
      <label className="mt-5 block">
        <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Username atau email</span>
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus required autoComplete="username" aria-label="Username atau email" className={inputClass} />
      </label>
      {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}
      <button type="submit" disabled={busy || !identifier.trim()} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
        {busy && <Loader2 className="size-4 animate-spin" />}Kirim link reset
      </button>
      <button type="button" onClick={openLogin} className="mt-4 block w-full text-center text-sm font-semibold text-[color:var(--p-600)] hover:underline">Kembali ke halaman masuk</button>
    </form>
  )
}

function NewPassword({ token }: { token: string }) {
  const [username, setUsername] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/auth/reset-password?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (res) => { const body = await res.json().catch(() => null); if (res.ok) setUsername(body.username); else setInvalid(body?.message ?? 'Link reset tidak berlaku.') })
      .catch(() => setInvalid('Tidak dapat menghubungi server.'))
  }, [token])

  const mismatch = again.length > 0 && password !== again
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password !== again) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/auth/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, newPassword: password }) })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setError(body?.message ?? 'Gagal mengganti password.'); return }
      setDone(body?.message ?? 'Password berhasil diganti.')
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className={`${card} text-center`}>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-700"><CheckCircle2 className="size-7" /></span>
        <h2 className="mt-5 font-display text-2xl font-semibold text-foreground">Password diganti</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground" role="status">{done}</p>
        <button type="button" onClick={openLogin} className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">Masuk</button>
      </div>
    )
  }
  if (invalid) {
    return (
      <div className={`${card} text-center`}>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-red-100 text-red-700"><XCircle className="size-7" /></span>
        <h2 className="mt-5 font-display text-2xl font-semibold text-foreground">Link tidak berlaku</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{invalid}</p>
        <Link href="/reset-password" className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">Minta link baru</Link>
      </div>
    )
  }
  if (!username) return <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="size-7 animate-spin" /></div>

  return (
    <form onSubmit={submit} className={card}>
      <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><KeyRound className="size-6" /></span>
      <h2 className="mt-5 font-display text-2xl font-semibold text-foreground">Buat password baru</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Untuk akun <strong className="text-foreground">{username}</strong>.</p>
      <label className="mt-5 block">
        <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Password baru</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required minLength={6} autoComplete="new-password" aria-label="Password baru" placeholder="minimal 6 karakter" className={inputClass} />
      </label>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Ulangi password baru</span>
        <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} required autoComplete="new-password" aria-label="Ulangi password baru" className={inputClass} />
      </label>
      {mismatch && <p className="mt-2 text-xs font-medium text-destructive">Kedua password belum sama.</p>}
      {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}
      <button type="submit" disabled={busy || password.length < 6 || password !== again} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
        {busy && <Loader2 className="size-4 animate-spin" />}Simpan password baru
      </button>
    </form>
  )
}

function ResetPasswordContent() {
  const token = useSearchParams().get('token')
  return <div className="py-6">{token ? <NewPassword token={token} /> : <RequestLink />}</div>
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="size-7 animate-spin" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}
