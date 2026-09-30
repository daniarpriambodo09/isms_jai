// components/login-modal.tsx
//
// Admin login modal — scrolltide-style sign-in in the portal theme (see components/auth-shell.tsx,
// shared with the Lobby/Security kiosk login).
'use client'

import { useState, useEffect, useRef, type FormEvent } from 'react'
import { X, Eye, EyeOff, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { AUTH_ACCENT_TEXT, AUTH_CARD, AuthBackdrop, AuthBrand, AuthStyles, AuthSuccess } from '@/components/auth-shell'

export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)

  useEscapeClose(open, onClose)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setTimeout(() => usernameRef.current?.focus(), 80)
    } else {
      const timer = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    if (!open) setSuccess(false)
  }, [open])

  if (!open && !mounted) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const result = await login(username, password)

    setSubmitting(false)

    if (result.success) {
      setSuccess(true)
      setTimeout(() => {
        setUsername('')
        setPassword('')
        setSuccess(false)
        onClose()
      }, 1300)
    } else {
      setError(result.message)
    }
  }

  const isVisible = open && mounted

  return (
    <>
      <AuthStyles />

      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
        style={{ transition: 'opacity 280ms cubic-bezier(0.4, 0, 0.2, 1)', opacity: isVisible ? 1 : 0 }}
      >
        <AuthBackdrop onClick={onClose} />

        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute right-5 top-5 z-20 grid size-10 place-items-center rounded-full border border-border bg-card/80 text-muted-foreground shadow-sm transition hover:border-foreground/20 hover:text-foreground"
        >
          <X className="size-[18px]" />
        </button>

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Login Admin"
          className="relative z-10 flex w-full max-w-[384px] flex-col items-center"
          style={{
            transition: 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms ease',
            transform: isVisible ? 'translateY(0)' : 'translateY(16px)',
            opacity: isVisible ? 1 : 0,
          }}
        >
          <AuthBrand />

          <div className={AUTH_CARD}>
            {success && <AuthSuccess title={`Login berhasil${username ? `, ${username}` : ''}`} subtitle="Mengalihkan ke Portal ISMS…" />}

            <h2 className="font-display text-[21px] font-semibold tracking-tight text-foreground">Selamat datang kembali</h2>
            <p className="mt-1.5 text-[13.5px] text-muted-foreground">Masuk untuk mengelola konten Portal ISMS.</p>

            <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="lm-username" className="text-[12.5px] font-medium text-foreground/80">Username</label>
                <input
                  id="lm-username"
                  ref={usernameRef}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="nama.admin"
                  className="auth-input"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="lm-password" className="text-[12.5px] font-medium text-foreground/80">Password</label>
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
                  id="lm-password"
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

          <p className="mt-6 text-center text-[13.5px] text-muted-foreground">
            Lupa password? <span className={`font-semibold ${AUTH_ACCENT_TEXT}`}>Hubungi Admin ISM</span>
          </p>
          <button type="button" onClick={onClose} className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Kembali ke portal
          </button>
        </div>
      </div>
    </>
  )
}
