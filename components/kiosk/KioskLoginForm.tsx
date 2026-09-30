'use client'

// Full-page login for the Lobby / Pos Security kiosks — the same
// scrolltide-style sign-in in the portal theme as the admin modal (components/auth-shell.tsx).

import { useState, type FormEvent } from 'react'
import { AlertCircle, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { AUTH_ACCENT_TEXT, AUTH_CARD, AuthBackdrop, AuthBrand, AuthStyles, AuthSuccess } from '@/components/auth-shell'

export function KioskLoginForm({
  title,
  subtitle,
  onCelebrationDone,
}: {
  title: string
  subtitle: string
  onCelebrationDone?: () => void
}) {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const result = await login(username, password)

    setSubmitting(false)

    if (result.success) {
      setSuccess(true)
      setTimeout(() => onCelebrationDone?.(), 1300)
    } else {
      setError(result.message)
    }
  }

  return (
    <>
      <AuthStyles />

      <div className="relative grid min-h-screen place-items-center overflow-hidden p-4">
        <AuthBackdrop />

        <div className="auth-rise relative z-10 flex w-full max-w-[384px] flex-col items-center">
          <AuthBrand suffix="kiosk" />

          <div className={AUTH_CARD}>
            {success && <AuthSuccess title={`Login berhasil${username ? `, ${username}` : ''}`} subtitle={`Membuka ${title}…`} />}

            <p className={`font-mono-label text-[10.5px] font-semibold ${AUTH_ACCENT_TEXT}`}>PT. Jatim Autocomp Indonesia</p>
            <h2 className="mt-2 font-display text-[21px] font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="mt-1.5 text-[13.5px] text-muted-foreground">{subtitle}</p>

            <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="klf-username" className="text-[12.5px] font-medium text-foreground/80">Username</label>
                <input
                  id="klf-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="nama.petugas"
                  className="auth-input"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="klf-password" className="text-[12.5px] font-medium text-foreground/80">Password</label>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="flex items-center gap-1 text-[12px] text-muted-foreground transition hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                  </button>
                </div>
                <input
                  id="klf-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="auth-input"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-2.5">
                  <AlertCircle className="mt-0.5 size-3.5 flex-shrink-0 text-destructive" />
                  <p className="text-[12.5px] leading-snug text-destructive">{error}</p>
                </div>
              )}

              <button type="submit" disabled={submitting} className="auth-primary mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[14px] font-semibold">
                {submitting ? (<><Loader2 className="size-4 animate-spin" /> Memproses…</>) : 'Masuk'}
              </button>
            </form>
          </div>

          <p className="mt-6 flex items-center gap-1.5 text-center text-[12.5px] text-muted-foreground">
            <LockKeyhole className="size-3.5" /> Akses terbatas untuk perangkat kiosk resmi
          </p>
        </div>
      </div>
    </>
  )
}
