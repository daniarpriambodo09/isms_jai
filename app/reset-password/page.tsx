// app/reset-password/page.tsx
'use client'

// "Lupa password". Langsung memperbarui password akun berdasarkan email yang
// terdaftar di Manage Akun (Kelola Admin) atau melalui link token email.

import { Suspense, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  MailCheck,
  XCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
  ShieldCheck,
  ArrowLeft,
  Mail,
  Lock,
} from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { copyText } from '@/lib/clipboard'

const inputClass =
  'h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15'
const card =
  'mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm'
const openLogin = () => window.dispatchEvent(new Event('open-admin-login'))

function DirectResetForm() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Direct reset success state
  const [doneData, setDoneData] = useState<{
    username: string
    email: string | null
    passwordText: string
  } | null>(null)
  const [showDonePassword, setShowDonePassword] = useState(true)
  const [copiedPass, setCopiedPass] = useState(false)

  // Fallback email link mode
  const [useEmailLink, setUseEmailLink] = useState(false)
  const [emailLinkSent, setEmailLinkSent] = useState<string | null>(null)

  const mismatch = again.length > 0 && password !== again

  const handleDirectSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!identifier.trim()) {
      setError('Harap masukkan email atau username akun Anda.')
      return
    }
    if (password.length < 6) {
      setError('Password baru minimal 6 karakter.')
      return
    }
    if (password !== again) {
      setError('Konfirmasi password belum cocok.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier.trim(), newPassword: password }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(
          body?.message ??
            'Gagal mengganti password. Pastikan email Anda sudah terdaftar di Kelola Akun (Manage Akun).'
        )
        return
      }
      setDoneData({
        username: body.username || identifier,
        email: body.email || (identifier.includes('@') ? identifier : null),
        passwordText: password,
      })
    } catch {
      setError('Tidak dapat menghubungi server. Silakan coba beberapa saat lagi.')
    } finally {
      setBusy(false)
    }
  }

  const handleEmailLinkSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.message ?? 'Gagal mengirim permintaan.')
        return
      }
      setEmailLinkSent(body?.message ?? 'Link reset telah dikirim ke email akun.')
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setBusy(false)
    }
  }

  // JIKA PASSWORD BERHASIL DIGANTI SECARA LANGSUNG:
  if (doneData) {
    return (
      <div className={`${card} text-center space-y-4`}>
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-8" />
        </span>
        <div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full mb-1">
            <ShieldCheck className="size-3.5" /> SUKSES DIPERBARUI
          </span>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Password Berhasil Berganti!
          </h2>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Password untuk akun resmi <strong className="text-foreground">{doneData.username}</strong>{' '}
          {doneData.email ? `(${doneData.email})` : ''} telah berhasil diperbarui dan aktif di database sistem ISMS PT. JAI.
        </p>

        {/* Credential summary box with Eye button */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-left space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-semibold">Username Akun:</span>
            <span className="font-mono font-bold text-foreground">{doneData.username}</span>
          </div>
          {doneData.email && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-semibold">Email di Manage Akun:</span>
              <span className="font-mono font-semibold text-foreground">{doneData.email}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border">
            <span className="text-muted-foreground font-semibold">Password Baru:</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {showDonePassword ? doneData.passwordText : '••••••••••••'}
              </span>
              <button
                type="button"
                onClick={() => setShowDonePassword(!showDonePassword)}
                className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer transition"
                title={showDonePassword ? 'Sembunyikan password' : 'Lihat password'}
              >
                {showDonePassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyText(doneData.passwordText)
                  if (ok) {
                    setCopiedPass(true)
                    setTimeout(() => setCopiedPass(false), 2000)
                  }
                }}
                className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground hover:bg-secondary/80 cursor-pointer transition"
              >
                {copiedPass ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                <span>{copiedPass ? 'Tersalin' : 'Salin'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2 space-y-2">
          <Link
            href="/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 shadow-sm cursor-pointer"
          >
            Masuk Sekarang (Login)
          </Link>
          <button
            type="button"
            onClick={() => {
              setDoneData(null)
              setIdentifier('')
              setPassword('')
              setAgain('')
            }}
            className="block w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Ganti password untuk akun lain
          </button>
        </div>
      </div>
    )
  }

  // JIKA MODE KIRIM LINK EMAIL DAN SUDAH TERKIRIM:
  if (emailLinkSent) {
    return (
      <div className={`${card} text-center space-y-4`}>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-700">
          <MailCheck className="size-7" />
        </span>
        <h2 className="font-display text-2xl font-semibold text-foreground">Periksa email Anda</h2>
        <p className="text-sm leading-6 text-muted-foreground" role="status">
          {emailLinkSent}
        </p>
        <button
          type="button"
          onClick={() => {
            setEmailLinkSent(null)
            setUseEmailLink(false)
          }}
          className="mt-3 text-xs font-semibold text-primary hover:underline cursor-pointer block w-full"
        >
          &larr; Kembali ke ganti password langsung
        </button>
      </div>
    )
  }

  // FORM INPUT RESET PASSWORD LANGSUNG
  return (
    <form onSubmit={useEmailLink ? handleEmailLinkSubmit : handleDirectSubmit} className={card}>
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary shrink-0">
          <KeyRound className="size-6" />
        </span>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Pemulihan Akses Resmi ISMS
          </span>
          <h2 className="text-xl font-bold text-foreground">Lupa Password Akun</h2>
        </div>
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
        Masukkan <strong>email resmi</strong> yang terdaftar di Kelola Akun (Manage Akun) atau username Anda, lalu tentukan password baru secara langsung.
      </p>

      <div className="mt-5 space-y-3.5">
        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground">
            Email atau Username Akun Terdaftar <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoFocus
            required
            autoComplete="username"
            placeholder="Contoh: naufalaqil897@gmail.com / it.admin"
            className={inputClass}
          />
          <span className="mt-1 block text-[10px] text-muted-foreground">
            Tersambung langsung ke email akun yang tersimpan di sistem Manage Akun PT. JAI.
          </span>
        </div>

        {!useEmailLink && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-foreground">
                  Password Baru <span className="text-destructive">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                  <span>{showPassword ? 'Sembunyikan' : 'Lihat'}</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Minimal 6 karakter"
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-foreground">
                  Ulangi Password Baru <span className="text-destructive">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                  <span>{showConfirmPassword ? 'Sembunyikan' : 'Lihat'}</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={again}
                  onChange={(e) => setAgain(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Ketik ulang password baru"
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Lihat password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition"
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {mismatch && (
                <p className="mt-1 text-xs text-destructive font-medium">
                  Konfirmasi password belum cocok.
                </p>
              )}
              {again && !mismatch && password.length >= 6 && (
                <p className="mt-1 text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <Check className="size-3" /> Password cocok &amp; memenuhi syarat minimal.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive leading-relaxed"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={
          busy ||
          !identifier.trim() ||
          (!useEmailLink && (password.length < 6 || password !== again))
        }
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer shadow-sm"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {useEmailLink ? 'Kirim Tautan Reset ke Email' : 'Simpan & Ganti Password Baru'}
      </button>

      <div className="mt-4 flex flex-col items-center gap-2 text-center text-xs">
        <button
          type="button"
          onClick={() => {
            setUseEmailLink(!useEmailLink)
            setError(null)
          }}
          className="text-muted-foreground hover:text-foreground underline cursor-pointer"
        >
          {useEmailLink
            ? 'Atau langsung reset password di halaman ini'
            : 'Atau kirim link reset ke email dinas'}
        </button>

        <Link
          href="/login"
          className="font-semibold text-primary hover:underline cursor-pointer pt-1"
        >
          &larr; Kembali ke halaman masuk (Login)
        </Link>
      </div>
    </form>
  )
}

function NewPassword({ token }: { token: string }) {
  const [username, setUsername] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [showDonePassword, setShowDonePassword] = useState(true)
  const [copiedPass, setCopiedPass] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/auth/reset-password?token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (res.ok) {
          setUsername(body.username)
          if (body.email) setEmail(body.email)
        } else {
          setInvalid(body?.message ?? 'Link reset tidak berlaku.')
        }
      })
      .catch(() => setInvalid('Tidak dapat menghubungi server.'))
  }, [token])

  const mismatch = again.length > 0 && password !== again

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password !== again) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.message ?? 'Gagal mengganti password.')
        return
      }
      setDone(body?.message ?? 'Password berhasil diganti.')
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className={`${card} text-center space-y-4`}>
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-8" />
        </span>
        <h2 className="font-display text-2xl font-bold text-foreground">
          Password Berhasil Berganti!
        </h2>
        <p className="text-xs leading-5 text-muted-foreground" role="status">
          {done}
        </p>

        {/* Credential summary box with Eye button */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-left space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-semibold">Username Akun:</span>
            <span className="font-mono font-bold text-foreground">{username}</span>
          </div>
          {email && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-semibold">Email Terdaftar:</span>
              <span className="font-mono font-semibold text-foreground">{email}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border">
            <span className="text-muted-foreground font-semibold">Password Baru:</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {showDonePassword ? password : '••••••••••••'}
              </span>
              <button
                type="button"
                onClick={() => setShowDonePassword(!showDonePassword)}
                className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer transition"
                title={showDonePassword ? 'Sembunyikan password' : 'Lihat password'}
              >
                {showDonePassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyText(password)
                  if (ok) {
                    setCopiedPass(true)
                    setTimeout(() => setCopiedPass(false), 2000)
                  }
                }}
                className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground hover:bg-secondary/80 cursor-pointer transition"
              >
                {copiedPass ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                <span>{copiedPass ? 'Tersalin' : 'Salin'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Link
            href="/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 shadow-sm cursor-pointer"
          >
            Masuk Sekarang (Login)
          </Link>
        </div>
      </div>
    )
  }

  if (invalid) {
    return (
      <div className={`${card} text-center`}>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-red-100 text-red-700">
          <XCircle className="size-7" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-semibold text-foreground">Link tidak berlaku</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{invalid}</p>
        <Link
          href="/reset-password"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          Ganti password langsung
        </Link>
      </div>
    )
  }

  if (!username) {
    return (
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="size-7 animate-spin" />
      </div>
    )
  }

  return (
    <form onSubmit={submit} className={card}>
      <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <KeyRound className="size-6" />
      </span>
      <h2 className="mt-5 font-display text-2xl font-semibold text-foreground">Buat password baru</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Untuk akun <strong className="text-foreground">{username}</strong>.
      </p>

      <div className="mt-5 space-y-3.5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-foreground">Password baru</label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              {showPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              <span>{showPassword ? 'Sembunyikan' : 'Lihat'}</span>
            </button>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="minimal 6 karakter"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-foreground">Ulangi password baru</label>
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              {showConfirmPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              <span>{showConfirmPassword ? 'Sembunyikan' : 'Lihat'}</span>
            </button>
          </div>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Ketik ulang password baru"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
      </div>

      {mismatch && <p className="mt-2 text-xs font-medium text-destructive">Kedua password belum sama.</p>}
      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || password.length < 6 || password !== again}
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer shadow-sm"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        Simpan password baru
      </button>
    </form>
  )
}

function ResetPasswordContent() {
  const token = useSearchParams().get('token')
  return <div className="py-8 px-4">{token ? <NewPassword token={token} /> : <DirectResetForm />}</div>
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="size-7 animate-spin" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
