'use client'

import { useState, type FormEvent } from 'react'
import { Lock, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'

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
      <style>{`
        @keyframes klf-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes klf-orb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -15px) scale(1.1); }
        }
        @keyframes klf-orb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-15px, 20px) scale(1.08); }
        }
        @keyframes klf-banner-drift {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-3%, -3%) rotate(3deg); }
        }
        @keyframes klf-card-in {
          0% { opacity: 0; transform: translateY(18px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes klf-pop-in {
          0% { opacity: 0; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes klf-circle-draw {
          from { stroke-dashoffset: 152; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes klf-check-draw {
          from { stroke-dashoffset: 40; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes klf-ring-pulse {
          0% { transform: scale(0.75); opacity: 0.55; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes klf-spark-burst {
          0% { transform: scale(0); opacity: 0; }
          35% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.4); opacity: 0; }
        }
        @keyframes klf-badge-bounce {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .klf-card { animation: klf-card-in 480ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .klf-orb-1 { animation: klf-orb1 7s ease-in-out infinite; }
        .klf-orb-2 { animation: klf-orb2 9s ease-in-out infinite; }
        .klf-banner-glow { animation: klf-banner-drift 10s ease-in-out infinite; }
        .klf-top-bar {
          background: linear-gradient(90deg, #278e84 0%, #1a5f7a 40%, #278e84 100%);
          background-size: 200% auto;
          animation: klf-shimmer 3s linear infinite;
        }
        .klf-btn-submit {
          background: linear-gradient(135deg, #1a5f7a 0%, #278e84 100%);
          box-shadow: 0 6px 20px rgba(39,142,132,0.4), 0 2px 6px rgba(14,34,53,0.2);
          transition: background 200ms, box-shadow 200ms, transform 150ms;
        }
        .klf-btn-submit:not(:disabled):hover {
          background: linear-gradient(135deg, #154e65 0%, #1f7a70 100%);
          box-shadow: 0 8px 26px rgba(39,142,132,0.52), 0 2px 8px rgba(14,34,53,0.25);
          transform: translateY(-1px) scale(1.01);
        }
        .klf-btn-submit:not(:disabled):active {
          transform: translateY(0) scale(0.99);
          box-shadow: 0 4px 14px rgba(39,142,132,0.3);
        }
        .klf-btn-submit:disabled { opacity: 0.65; cursor: not-allowed; }
        .klf-shimmer-overlay {
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%);
          background-size: 200% auto;
          animation: klf-shimmer 2.5s linear infinite;
        }
        .klf-input {
          height: 48px;
          width: 100%;
          border-radius: 14px;
          border: 1.5px solid #dce6ed;
          background: #f8fafc;
          color: #20354a;
          font-size: 14px;
          font-weight: 500;
          outline: none;
          box-shadow: inset 0 1px 3px rgba(14,34,53,0.06);
          transition: border-color 180ms, box-shadow 180ms, background 180ms;
          padding: 0 16px 0 52px;
        }
        .klf-input::placeholder { color: #a9bac8; font-weight: 400; }
        .klf-field-wrap:focus-within .klf-input {
          border-color: #278e84;
          box-shadow: 0 0 0 3px rgba(39,142,132,0.13), inset 0 1px 3px rgba(14,34,53,0.04);
          background: #ffffff;
        }
        .klf-field-icon {
          background: #eef3f6;
          color: #6d8598;
          transition: background 180ms, color 180ms;
        }
        .klf-field-wrap:focus-within .klf-field-icon {
          background: linear-gradient(135deg, #1a5f7a 0%, #278e84 100%);
          color: #ffffff;
        }
        .klf-success-overlay { animation: klf-pop-in 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .klf-success-badge { animation: klf-badge-bounce 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .klf-success-circle {
          stroke: #278e84;
          stroke-width: 3;
          stroke-linecap: round;
          stroke-dasharray: 152;
          stroke-dashoffset: 152;
          animation: klf-circle-draw 550ms ease-out 120ms forwards;
        }
        .klf-success-check-path {
          stroke: #278e84;
          stroke-width: 4;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 40;
          stroke-dashoffset: 40;
          animation: klf-check-draw 320ms ease-out 620ms forwards;
        }
        .klf-success-ring {
          border: 2px solid rgba(39,142,132,0.5);
          animation: klf-ring-pulse 1500ms ease-out infinite;
        }
        .klf-success-ring-delay { animation-delay: 750ms; }
        .klf-success-spark { animation: klf-spark-burst 750ms ease-out 550ms both; }
      `}</style>

      <div className="relative grid min-h-screen place-items-center overflow-hidden p-4">
        {/* Backdrop — full-screen building photo behind a brand-teal wash */}
        <div className="absolute inset-0">
          <img
            src={`${API_BASE_PATH}/images/yazaki-building.jpg`}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at 60% 40%, rgba(14,34,53,0.72) 0%, rgba(8,18,32,0.88) 100%)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
            }}
          />
        </div>

        {/* Glowing orbs */}
        <div
          className="klf-orb-1 pointer-events-none absolute left-1/4 top-1/4 h-64 w-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(39,142,132,0.18) 0%, transparent 70%)', filter: 'blur(40px)' }}
        />
        <div
          className="klf-orb-2 pointer-events-none absolute bottom-1/4 right-1/3 h-48 w-48 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(90,120,200,0.14) 0%, transparent 70%)', filter: 'blur(32px)' }}
        />

        {/* Card */}
        <div className="klf-card relative z-10 w-full max-w-sm">
          <div
            className="relative overflow-hidden rounded-[1.75rem]"
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(240,247,251,0.99) 100%)',
              boxShadow: '0 32px 80px rgba(14,34,53,0.38), 0 0 0 1px rgba(255,255,255,0.65), inset 0 1px 0 rgba(255,255,255,0.95)',
            }}
          >
            {/* Success takeover */}
            {success && (
              <div
                className="klf-success-overlay absolute inset-0 z-20 flex flex-col items-center justify-center gap-3"
                style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(240,247,251,0.99) 100%)' }}
              >
                <div className="klf-success-badge relative flex h-24 w-24 items-center justify-center">
                  <span className="klf-success-ring absolute inset-0 rounded-full" />
                  <span className="klf-success-ring klf-success-ring-delay absolute inset-0 rounded-full" />
                  {Array.from({ length: 8 }).map((_, i) => (
                    <span
                      key={i}
                      className="pointer-events-none absolute left-1/2 top-1/2 block h-0 w-0"
                      style={{ transform: `rotate(${i * 45}deg) translateY(-34px)` }}
                    >
                      <span
                        className="klf-success-spark absolute block h-1.5 w-1.5 rounded-full"
                        style={{
                          left: '-3px',
                          top: '-3px',
                          background: i % 2 === 0 ? '#278e84' : '#1a5f7a',
                          animationDelay: `${550 + i * 35}ms`,
                        }}
                      />
                    </span>
                  ))}
                  <svg viewBox="0 0 52 52" className="h-16 w-16">
                    <circle className="klf-success-circle" cx="26" cy="26" r="24" fill="none" />
                    <path className="klf-success-check-path" fill="none" d="M14 27l7 7 16-16" />
                  </svg>
                </div>
                <p className="text-[16px] font-bold" style={{ color: '#12293a' }}>
                  Login berhasil{username ? `, ${username}` : ''}
                </p>
                <p className="text-[12px]" style={{ color: '#7290a5' }}>
                  Membuka {title}...
                </p>
              </div>
            )}

            {/* Hero gradient banner */}
            <div
              className="relative h-28 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #0e2235 0%, #1a5f7a 55%, #278e84 100%)' }}
            >
              <div
                className="absolute inset-0 opacity-[0.14]"
                style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '16px 16px' }}
              />
              <div
                className="klf-banner-glow pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full"
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
                Kiosk Access
              </p>
            </div>

            {/* Floating avatar badge, overlapping the banner/form seam */}
            <div className="relative px-8">
              <div
                className="absolute -top-9 flex h-[72px] w-[72px] items-center justify-center rounded-[22px]"
                style={{
                  background: 'linear-gradient(135deg, #1a5f7a 0%, #278e84 100%)',
                  boxShadow: '0 10px 26px rgba(39,142,132,0.4), 0 0 0 5px #ffffff',
                }}
              >
                <ShieldCheck className="h-8 w-8 text-white" />
              </div>
            </div>

            {/* Animated accent bar beneath the banner */}
            <div className="klf-top-bar h-[3px] w-full" />

            <div className="px-8 pb-8 pt-12">
              <h2 className="text-[21px] font-bold leading-tight" style={{ color: '#12293a' }}>
                {title}
              </h2>
              <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: '#7290a5' }}>
                {subtitle}
              </p>

              <div
                className="mb-6 mt-5 h-px w-full"
                style={{ background: 'linear-gradient(90deg, transparent 0%, #dce6ed 25%, #dce6ed 75%, transparent 100%)' }}
              />

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="klf-username" className="text-[11.5px] font-bold uppercase tracking-[0.1em]" style={{ color: '#4a6278' }}>
                    Username
                  </label>
                  <div className="klf-field-wrap relative">
                    <span className="klf-field-icon pointer-events-none absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px]">
                      <User className="h-4 w-4" />
                    </span>
                    <input
                      id="klf-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoFocus
                      autoComplete="username"
                      placeholder="Masukkan username"
                      className="klf-input"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="klf-password" className="text-[11.5px] font-bold uppercase tracking-[0.1em]" style={{ color: '#4a6278' }}>
                    Password
                  </label>
                  <div className="klf-field-wrap relative">
                    <span className="klf-field-icon pointer-events-none absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px]">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      id="klf-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="klf-input"
                    />
                  </div>
                </div>

                {error && (
                  <div
                    className="flex items-start gap-2.5 rounded-xl px-4 py-3"
                    style={{ background: 'linear-gradient(135deg, #fff0f0 0%, #fde8e8 100%)', border: '1px solid rgba(179,65,58,0.18)' }}
                  >
                    <p className="text-[12.5px] font-medium leading-snug" style={{ color: '#b3413a' }}>
                      {error}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="klf-btn-submit relative mt-1 flex h-12 w-full items-center justify-center overflow-hidden rounded-xl text-[14px] font-semibold text-white"
                >
                  {!submitting && <span className="klf-shimmer-overlay pointer-events-none absolute inset-0 rounded-xl" />}
                  <span className="relative flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    {submitting ? 'Memproses...' : 'Masuk'}
                  </span>
                </button>
              </form>

              <p className="mt-5 text-center text-[11px] leading-relaxed" style={{ color: '#9ab0be' }}>
                Akses terbatas untuk perangkat kiosk resmi
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
