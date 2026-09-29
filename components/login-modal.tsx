// components/login-modal.tsx
'use client'

import { useState, useEffect, useRef, type FormEvent } from 'react'
import { X, ShieldCheck, Eye, EyeOff, Lock, User, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'

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
      <style>{`
        @keyframes lm-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes lm-orb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -15px) scale(1.1); }
        }
        @keyframes lm-orb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-15px, 20px) scale(1.08); }
        }
        .lm-top-bar {
          background: linear-gradient(90deg, var(--p-600) 0%, var(--p-700) 40%, var(--p-600) 100%);
          background-size: 200% auto;
          animation: lm-shimmer 3s linear infinite;
        }
        .lm-btn-submit {
          background: linear-gradient(135deg, var(--p-700) 0%, var(--p-600) 100%);
          box-shadow: 0 6px 20px color-mix(in oklch, var(--p-600) 40%, transparent), 0 2px 6px color-mix(in oklch, var(--p-950) 20%, transparent);
          transition: background 200ms, box-shadow 200ms, transform 150ms;
        }
        .lm-btn-submit:not(:disabled):hover {
          background: linear-gradient(135deg, var(--p-700) 0%, var(--p-600) 100%);
          box-shadow: 0 8px 26px color-mix(in oklch, var(--p-600) 52%, transparent), 0 2px 8px color-mix(in oklch, var(--p-950) 25%, transparent);
          transform: translateY(-1px) scale(1.01);
        }
        .lm-btn-submit:not(:disabled):active {
          transform: translateY(0) scale(0.99);
          box-shadow: 0 4px 14px color-mix(in oklch, var(--p-600) 30%, transparent);
        }
        .lm-btn-submit:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .lm-shimmer-overlay {
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%);
          background-size: 200% auto;
          animation: lm-shimmer 2.5s linear infinite;
        }
        .lm-input {
          height: 48px;
          width: 100%;
          border-radius: 14px;
          border: 1.5px solid var(--p-border);
          background: var(--p-surface);
          color: var(--p-800);
          font-size: 14px;
          font-weight: 500;
          outline: none;
          box-shadow: inset 0 1px 3px color-mix(in oklch, var(--p-950) 6%, transparent);
          transition: border-color 180ms, box-shadow 180ms, background 180ms;
          padding: 0 46px 0 52px;
        }
        .lm-input::placeholder {
          color: var(--p-muted2);
          font-weight: 400;
        }
        .lm-field-wrap:focus-within .lm-input {
          border-color: var(--p-600);
          box-shadow: 0 0 0 3px color-mix(in oklch, var(--p-600) 13%, transparent), inset 0 1px 3px color-mix(in oklch, var(--p-950) 4%, transparent);
          background: #ffffff;
        }
        .lm-close-btn {
          transition: background 150ms, color 150ms;
        }
        .lm-close-btn:hover {
          background: var(--p-surface2);
          color: var(--p-800);
        }
        .lm-eye-btn {
          transition: color 150ms;
          color: var(--p-muted);
        }
        .lm-eye-btn:hover { color: var(--p-600); }
        .lm-orb-1 { animation: lm-orb1 7s ease-in-out infinite; }
        .lm-orb-2 { animation: lm-orb2 9s ease-in-out infinite; }
        @keyframes lm-banner-drift {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-3%, -3%) rotate(3deg); }
        }
        .lm-banner-glow { animation: lm-banner-drift 10s ease-in-out infinite; }
        .lm-field-icon {
          background: var(--p-surface2);
          color: var(--p-muted);
          transition: background 180ms, color 180ms;
        }
        .lm-field-wrap:focus-within .lm-field-icon {
          background: linear-gradient(135deg, var(--p-700) 0%, var(--p-600) 100%);
          color: #ffffff;
        }
        @keyframes lm-pop-in {
          0% { opacity: 0; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes lm-circle-draw {
          from { stroke-dashoffset: 152; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes lm-check-draw {
          from { stroke-dashoffset: 40; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes lm-ring-pulse {
          0% { transform: scale(0.75); opacity: 0.55; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes lm-spark-burst {
          0% { transform: scale(0); opacity: 0; }
          35% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.4); opacity: 0; }
        }
        @keyframes lm-badge-bounce {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .lm-success-overlay {
          animation: lm-pop-in 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .lm-success-badge {
          animation: lm-badge-bounce 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .lm-success-circle {
          stroke: var(--p-600);
          stroke-width: 3;
          stroke-linecap: round;
          stroke-dasharray: 152;
          stroke-dashoffset: 152;
          animation: lm-circle-draw 550ms ease-out 120ms forwards;
        }
        .lm-success-check-path {
          stroke: var(--p-600);
          stroke-width: 4;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 40;
          stroke-dashoffset: 40;
          animation: lm-check-draw 320ms ease-out 620ms forwards;
        }
        .lm-success-ring {
          border: 2px solid color-mix(in oklch, var(--p-600) 50%, transparent);
          animation: lm-ring-pulse 1500ms ease-out infinite;
        }
        .lm-success-ring-delay {
          animation-delay: 750ms;
        }
        .lm-success-spark {
          animation: lm-spark-burst 750ms ease-out 550ms both;
        }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: isVisible ? 1 : 0,
        }}
      >
        {/* Backdrop — full-screen building photo behind a brand-teal wash */}
        <div className="absolute inset-0" onClick={onClose}>
          <img
            src={`${API_BASE_PATH}/images/yazaki-building.jpg`}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at 60% 40%, color-mix(in oklch, var(--p-950) 72%, transparent) 0%, color-mix(in oklch, var(--p-950) 88%, transparent) 100%)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
            }}
          />
        </div>

        {/* Glowing orbs */}
        <div
          className="lm-orb-1 pointer-events-none absolute left-1/4 top-1/4 h-64 w-64 rounded-full"
          style={{
            background: 'radial-gradient(circle, color-mix(in oklch, var(--p-600) 18%, transparent) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="lm-orb-2 pointer-events-none absolute bottom-1/4 right-1/3 h-48 w-48 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(90,120,200,0.14) 0%, transparent 70%)',
            filter: 'blur(32px)',
          }}
        />

        {/* Modal Card */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Login Admin"
          className="relative z-10 w-full max-w-[420px]"
          style={{
            transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 280ms ease',
            transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.93) translateY(18px)',
            opacity: isVisible ? 1 : 0,
          }}
        >
          <div
            className="relative overflow-hidden rounded-3xl"
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, color-mix(in oklch, var(--p-surface2) 99%, transparent) 100%)',
              boxShadow:
                '0 32px 80px color-mix(in oklch, var(--p-950) 38%, transparent), 0 0 0 1px rgba(255,255,255,0.65), inset 0 1px 0 rgba(255,255,255,0.95)',
            }}
          >
            {/* Success takeover — celebratory checkmark before the modal auto-closes */}
            {success && (
              <div
                className="lm-success-overlay absolute inset-0 z-20 flex flex-col items-center justify-center gap-3"
                style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, color-mix(in oklch, var(--p-surface2) 99%, transparent) 100%)' }}
              >
                <div className="lm-success-badge relative flex h-24 w-24 items-center justify-center">
                  <span className="lm-success-ring absolute inset-0 rounded-full" />
                  <span className="lm-success-ring lm-success-ring-delay absolute inset-0 rounded-full" />
                  {Array.from({ length: 8 }).map((_, i) => (
                    <span
                      key={i}
                      className="pointer-events-none absolute left-1/2 top-1/2 block h-0 w-0"
                      style={{ transform: `rotate(${i * 45}deg) translateY(-34px)` }}
                    >
                      <span
                        className="lm-success-spark absolute block h-1.5 w-1.5 rounded-full"
                        style={{
                          left: '-3px',
                          top: '-3px',
                          background: i % 2 === 0 ? 'var(--p-600)' : 'var(--p-700)',
                          animationDelay: `${550 + i * 35}ms`,
                        }}
                      />
                    </span>
                  ))}
                  <svg viewBox="0 0 52 52" className="h-16 w-16">
                    <circle className="lm-success-circle" cx="26" cy="26" r="24" fill="none" />
                    <path className="lm-success-check-path" fill="none" d="M14 27l7 7 16-16" />
                  </svg>
                </div>
                <p className="text-[16px] font-bold" style={{ color: 'var(--p-900)' }}>
                  Login berhasil{username ? `, ${username}` : ''}
                </p>
                <p className="text-[12px]" style={{ color: 'var(--p-muted)' }}>
                  Mengalihkan ke Portal ISMS...
                </p>
              </div>
            )}

            {/* Hero gradient banner */}
            <div
              className="relative h-28 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, var(--p-950) 0%, var(--p-700) 55%, var(--p-600) 100%)' }}
            >
              {/* Dot-grid pattern */}
              <div
                className="absolute inset-0 opacity-[0.14]"
                style={{
                  backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
                  backgroundSize: '16px 16px',
                }}
              />
              {/* Drifting glow */}
              <div
                className="lm-banner-glow pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 70%)' }}
              />
              <div
                className="pointer-events-none absolute -bottom-12 -left-6 h-36 w-36 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)' }}
              />

              <p
                className="absolute left-8 top-6 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: 'rgba(255,255,255,0.75)' }}
              >
                Admin Access
              </p>

              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            {/* Floating avatar badge, overlapping the banner/form seam */}
            <div className="relative px-8">
              <div
                className="absolute -top-9 flex h-[72px] w-[72px] items-center justify-center rounded-[22px]"
                style={{
                  background: 'linear-gradient(135deg, var(--p-700) 0%, var(--p-600) 100%)',
                  boxShadow: '0 10px 26px color-mix(in oklch, var(--p-600) 40%, transparent), 0 0 0 5px #ffffff',
                }}
              >
                <ShieldCheck className="h-8 w-8 text-white" />
              </div>
            </div>

            {/* Animated accent bar beneath the banner */}
            <div className="lm-top-bar h-[3px] w-full" />

            <div className="px-8 pb-8 pt-12">
              <h2 className="text-[21px] font-bold leading-tight" style={{ color: 'var(--p-900)' }}>
                Login Admin
              </h2>
              <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: 'var(--p-muted)' }}>
                Masuk untuk mengelola konten Portal ISMS
              </p>

              {/* Divider */}
              <div
                className="mb-6 mt-5 h-px w-full"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, var(--p-border) 25%, var(--p-border) 75%, transparent 100%)',
                }}
              />

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* Username */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="lm-username"
                    className="text-[11.5px] font-bold uppercase tracking-[0.1em]"
                    style={{ color: 'var(--p-ink2)' }}
                  >
                    Username
                  </label>
                  <div className="lm-field-wrap relative">
                    <span className="lm-field-icon pointer-events-none absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px]">
                      <User className="h-4 w-4" />
                    </span>
                    <input
                      id="lm-username"
                      ref={usernameRef}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                      placeholder="Masukkan username"
                      className="lm-input"
                      style={{ paddingRight: '16px' }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="lm-password"
                    className="text-[11.5px] font-bold uppercase tracking-[0.1em]"
                    style={{ color: 'var(--p-ink2)' }}
                  >
                    Password
                  </label>
                  <div className="lm-field-wrap relative">
                    <span className="lm-field-icon pointer-events-none absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px]">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      id="lm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="lm-input"
                      style={{ paddingRight: '44px' }}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      onClick={() => setShowPassword((v) => !v)}
                      className="lm-eye-btn absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div
                    className="flex items-start gap-2.5 rounded-xl px-4 py-3"
                    style={{
                      background: 'linear-gradient(135deg, #fff0f0 0%, #fde8e8 100%)',
                      border: '1px solid rgba(179,65,58,0.18)',
                    }}
                  >
                    <AlertCircle
                      className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
                      style={{ color: '#b3413a' }}
                    />
                    <p
                      className="text-[12.5px] font-medium leading-snug"
                      style={{ color: '#b3413a' }}
                    >
                      {error}
                    </p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="lm-btn-submit relative mt-1 flex h-12 w-full items-center justify-center overflow-hidden rounded-xl text-[14px] font-semibold text-white"
                >
                  {!submitting && (
                    <span className="lm-shimmer-overlay pointer-events-none absolute inset-0 rounded-xl" />
                  )}
                  {submitting ? (
                    <span className="relative flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memproses...
                    </span>
                  ) : (
                    <span className="relative flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Masuk ke Sistem
                    </span>
                  )}
                </button>
              </form>

              {/* Footer */}
              <p
                className="mt-5 text-center text-[11px] leading-relaxed"
                style={{ color: 'var(--p-muted2)' }}
              >
                Akses terbatas untuk administrator sistem ISMS
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}