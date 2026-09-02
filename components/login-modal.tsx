// components/login-modal.tsx
'use client'

import { useState, useEffect, useRef, type FormEvent } from 'react'
import { X, ShieldCheck, Eye, EyeOff, Lock, User, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setTimeout(() => usernameRef.current?.focus(), 80)
    } else {
      const timer = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(timer)
    }
  }, [open])

  if (!open && !mounted) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const result = await login(username, password)

    setSubmitting(false)

    if (result.success) {
      setUsername('')
      setPassword('')
      onClose()
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
          background: linear-gradient(90deg, #278e84 0%, #1a5f7a 40%, #278e84 100%);
          background-size: 200% auto;
          animation: lm-shimmer 3s linear infinite;
        }
        .lm-btn-submit {
          background: linear-gradient(135deg, #1a5f7a 0%, #278e84 100%);
          box-shadow: 0 6px 20px rgba(39,142,132,0.4), 0 2px 6px rgba(14,34,53,0.2);
          transition: background 200ms, box-shadow 200ms, transform 150ms;
        }
        .lm-btn-submit:not(:disabled):hover {
          background: linear-gradient(135deg, #154e65 0%, #1f7a70 100%);
          box-shadow: 0 8px 26px rgba(39,142,132,0.52), 0 2px 8px rgba(14,34,53,0.25);
          transform: translateY(-1px) scale(1.01);
        }
        .lm-btn-submit:not(:disabled):active {
          transform: translateY(0) scale(0.99);
          box-shadow: 0 4px 14px rgba(39,142,132,0.3);
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
          height: 44px;
          width: 100%;
          border-radius: 12px;
          border: 1.5px solid #dce6ed;
          background: #f8fafc;
          color: #20354a;
          font-size: 13.5px;
          outline: none;
          box-shadow: inset 0 1px 3px rgba(14,34,53,0.06);
          transition: border-color 180ms, box-shadow 180ms, background 180ms;
          padding: 0 44px 0 44px;
        }
        .lm-input:focus {
          border-color: #278e84;
          box-shadow: 0 0 0 3px rgba(39,142,132,0.13), inset 0 1px 3px rgba(14,34,53,0.04);
          background: #ffffff;
        }
        .lm-input-end {
          padding-right: 44px;
        }
        .lm-close-btn {
          transition: background 150ms, color 150ms;
        }
        .lm-close-btn:hover {
          background: #f0f4f7;
          color: #20354a;
        }
        .lm-eye-btn {
          transition: color 150ms;
          color: #7290a5;
        }
        .lm-eye-btn:hover { color: #278e84; }
        .lm-orb-1 { animation: lm-orb1 7s ease-in-out infinite; }
        .lm-orb-2 { animation: lm-orb2 9s ease-in-out infinite; }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: isVisible ? 1 : 0,
        }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 60% 40%, rgba(14,34,53,0.72) 0%, rgba(8,18,32,0.88) 100%)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
          onClick={onClose}
        />

        {/* Glowing orbs */}
        <div
          className="lm-orb-1 pointer-events-none absolute left-1/4 top-1/4 h-64 w-64 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(39,142,132,0.18) 0%, transparent 70%)',
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
          className="relative z-10 w-full max-w-[420px]"
          style={{
            transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 280ms ease',
            transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.93) translateY(18px)',
            opacity: isVisible ? 1 : 0,
          }}
        >
          <div
            className="overflow-hidden rounded-3xl"
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(240,247,251,0.99) 100%)',
              boxShadow:
                '0 32px 80px rgba(14,34,53,0.38), 0 0 0 1px rgba(255,255,255,0.65), inset 0 1px 0 rgba(255,255,255,0.95)',
            }}
          >
            {/* Animated top gradient bar */}
            <div className="lm-top-bar h-[3px] w-full" />

            <div className="px-8 pb-8 pt-7">
              {/* Header */}
              <div className="mb-6 flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div
                    className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-2xl"
                    style={{
                      background: 'linear-gradient(135deg, #1a5f7a 0%, #278e84 100%)',
                      boxShadow: '0 6px 18px rgba(39,142,132,0.38)',
                    }}
                  >
                    <ShieldCheck className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p
                      className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: '#278e84' }}
                    >
                      Admin Access
                    </p>
                    <h2 className="text-[20px] font-bold leading-tight" style={{ color: '#12293a' }}>
                      Login Admin
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup"
                  className="lm-close-btn flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ color: '#7290a5' }}
                >
                  <X className="h-[18px] w-[18px]" />
                </button>
              </div>

              {/* Divider */}
              <div
                className="mb-6 h-px w-full"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, #dce6ed 25%, #dce6ed 75%, transparent 100%)',
                }}
              />

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* Username */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="lm-username"
                    className="text-[11.5px] font-bold uppercase tracking-[0.1em]"
                    style={{ color: '#4a6278' }}
                  >
                    Username
                  </label>
                  <div className="relative">
                    <User
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: '#7290a5' }}
                    />
                    <input
                      id="lm-username"
                      ref={usernameRef}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                      placeholder="Masukkan username"
                      className="lm-input"
                      style={{ paddingLeft: '44px', paddingRight: '16px' }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="lm-password"
                    className="text-[11.5px] font-bold uppercase tracking-[0.1em]"
                    style={{ color: '#4a6278' }}
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: '#7290a5' }}
                    />
                    <input
                      id="lm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="lm-input"
                      style={{ paddingLeft: '44px', paddingRight: '44px' }}
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
                style={{ color: '#9ab0be' }}
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