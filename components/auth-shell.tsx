// components/auth-shell.tsx
//
// Unified Dark Glassmorphism Authentication Screen
// Shared between the /login page, the admin login modal, and Kiosk stations.
// Crafted with Japanese corporate precision, frosted glassmorphism,
// and realtime ISO/IEC 27001 telemetry.
'use client'

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Eye,
  EyeOff,
  FileCheck2,
  KeyRound,
  Laptop,
  Loader2,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react'
import { useAuth, type AdminRole, type AdminUser } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { welcomeAdmin, WELCOME_COVERED_MS } from '@/components/admin-welcome'

// ─── Styles ───

function AuthStyles() {
  return (
    <style>{`
      @keyframes auth-kenburns {
        from { transform: scale(1.04) translate3d(0, 0, 0); }
        to { transform: scale(1.12) translate3d(-1.5%, -1%, 0); }
      }
      @keyframes auth-rise {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: none; }
      }
      @keyframes auth-msg-in {
        from { opacity: 0; transform: translateY(12px); filter: blur(3px); }
        to { opacity: 1; transform: none; filter: none; }
      }
      @keyframes auth-progress {
        from { transform: scaleX(0); }
        to { transform: scaleX(1); }
      }
      @keyframes auth-pop {
        0% { opacity: 0; transform: scale(.92); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes auth-circle {
        from { stroke-dashoffset: 152; }
        to { stroke-dashoffset: 0; }
      }
      @keyframes auth-check {
        from { stroke-dashoffset: 40; }
        to { stroke-dashoffset: 0; }
      }
      .auth-kenburns { animation: auth-kenburns 26s ease-in-out infinite alternate; }
      .auth-rise { animation: auth-rise .5s cubic-bezier(.22, 1, .36, 1) both; }
      .auth-msg-in { animation: auth-msg-in .6s cubic-bezier(.22, 1, .36, 1) both; }
      .auth-progress { transform-origin: left; animation: auth-progress var(--auth-rotate, 5s) linear both; }
      .auth-success { animation: auth-pop .3s cubic-bezier(.34, 1.56, .64, 1) both; }
      .auth-success-circle { stroke: #3b82f6; stroke-width: 3; stroke-dasharray: 152; stroke-dashoffset: 152; animation: auth-circle .55s ease-out .1s forwards; }
      .auth-success-check { stroke: #60a5fa; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 40; stroke-dashoffset: 40; animation: auth-check .32s ease-out .6s forwards; }
      @media (prefers-reduced-motion: reduce) {
        .auth-kenburns, .auth-rise, .auth-msg-in, .auth-progress { animation: none; }
      }
    `}</style>
  )
}

// ─── Brand Telemetry Panel ───

type Stats = { documents: number; proceduresApproved: number; visitsTotal: number; specialAreaApproved: number; photoApproved: number }

const ACCESS_OPTIONS: { role: AdminRole; label: string; shortLabel: string; description: string; code: string; icon: typeof ShieldCheck }[] = [
  { role: 'ism_admin', label: 'Admin ISMS', shortLabel: 'ISMS', description: 'Tata Kelola Portal & Dokumen', code: 'SYS', icon: ShieldCheck },
  { role: 'it', label: 'Admin IT', shortLabel: 'IT Ops', description: 'Izin Alat IT & E-Sign Services', code: 'IT', icon: Laptop },
  { role: 'lobby', label: 'Admin Lobby', shortLabel: 'Lobby', description: 'Pendaftaran Tamu & Visitor Pass', code: 'LBY', icon: Building2 },
  { role: 'security', label: 'Admin Security', shortLabel: 'Security', description: 'Pos Security & Gatepass', code: 'SEC', icon: KeyRound },
  { role: 'approver', label: 'Approver Dokumen', shortLabel: 'Approver', description: 'Verifikasi & Pengesahan Persetujuan', code: 'APR', icon: FileCheck2 },
]

const MESSAGES = [
  { icon: FileCheck2, title: 'Dokumen Terkendali', body: 'Prosedur, form, dan standar ISMS selalu tersedia dalam revisi terbaru.' },
  { icon: QrCode, title: 'Pengesahan Elektronik (E-Sign)', body: 'Approver menandatangani dengan QR Code terenkripsi langsung dari email & portal.' },
  { icon: Users, title: 'Akses & Gatepass Tercatat', body: 'Tamu, vendor, dan izin area special terekam terpadu dari Pos Security hingga Lobby.' },
] as const

const ROTATE_MS = 5000
const nf = new Intl.NumberFormat('id-ID')

function BrandPanel({ kiosk }: { kiosk: boolean }) {
  const [index, setIndex] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % MESSAGES.length), ROTATE_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/home-stats`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

  const message = MESSAGES[index]
  const Icon = message.icon
  const statItems: [string, number | undefined][] = [
    ['Dokumen Terkendali', stats?.documents],
    ['Telah Disahkan', stats?.proceduresApproved],
    ['Tamu & Kunjungan', stats?.visitsTotal],
  ]

  return (
    <aside className="relative isolate flex min-h-[260px] flex-col overflow-hidden bg-slate-950 text-white lg:min-h-0 border-b lg:border-b-0 lg:border-r border-white/10">
      {/* Cinematic Yazaki Architecture Photo */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <img
          src={`${API_BASE_PATH}/images/yazaki-building.jpg`}
          alt=""
          className="auth-kenburns size-full object-cover grayscale contrast-125 opacity-40"
        />
        <div
          className="absolute inset-0 mix-blend-multiply"
          style={{ background: 'linear-gradient(150deg, #0f172a 0%, #090e17 60%, #030712 100%)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 80% 20%, rgba(37,99,235,0.18), transparent 65%), linear-gradient(to top, rgba(3,7,18,0.95) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />
      </div>

      {/* Top: Brand Badge */}
      <div className="flex items-center gap-3 p-6 lg:p-10">
        <span className="rounded-xl bg-white px-3 py-1.5 shadow-lg shadow-black/40">
          <img src={`${API_BASE_PATH}/images/yazaki-logo.jpg`} alt="Yazaki" className="h-5 w-auto" />
        </span>
        <div className="space-y-0.5">
          <span className="block font-mono text-[11px] font-bold text-white/90 tracking-wide">
            ISMS {kiosk ? 'Kiosk' : 'Portal'} · PT. JAI
          </span>
          <span className="block font-mono text-[9.5px] text-white/50">
            PT. Jatim Autocomp Indonesia
          </span>
        </div>
      </div>

      {/* Middle: Statement & Realtime Telemetry Panel */}
      <div className="hidden flex-1 flex-col justify-center px-10 lg:flex xl:px-14">
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[10px] font-mono font-bold tracking-wider text-blue-300 uppercase">
          <span className="size-1.5 rounded-full bg-blue-400 animate-ping" />
          ISO/IEC 27001 Certified System
        </div>

        <h2 className="mt-4 max-w-[34rem] font-display text-[clamp(2.2rem,3.4vw,3.4rem)] font-bold tracking-tight text-white leading-[1.08]">
          Keamanan Informasi,{' '}
          <span className="bg-gradient-to-r from-blue-300 via-sky-200 to-indigo-300 bg-clip-text text-transparent italic">
            Dijaga
          </span>{' '}
          Bersama.
        </h2>
        <p className="mt-3 text-xs sm:text-sm text-slate-300/80 max-w-lg leading-relaxed">
          Sistem manajemen terintegrasi untuk perlindungan aset informasi, kerahasiaan operasional, dan kepatuhan standar industri internasional.
        </p>

        {/* Realtime Telemetry Glass Box */}
        <div className="mt-8 max-w-[32rem] rounded-2xl border border-white/10 bg-white/[0.04] p-4.5 backdrop-blur-xl shadow-2xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-white/90">
                Live Audit Telemetry
              </span>
            </div>
            <span className="font-mono text-[10px] text-white/50">
              Active Server Sync
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {statItems.map(([label, value]) => (
              <div key={label}>
                <p className="font-mono text-xl sm:text-2xl font-bold tabular-nums leading-none text-white">
                  {value === undefined ? '—' : nf.format(value)}
                </p>
                <p className="mt-1.5 text-[11px] font-medium text-slate-400 leading-snug">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom: Rotating ISMS Messages */}
      <div className="mt-auto p-6 pt-0 lg:p-10 xl:px-14">
        <div key={index} className="auth-msg-in flex max-w-[30rem] items-start gap-3">
          <span className="grid size-9 flex-none place-items-center rounded-xl bg-blue-500/15 border border-blue-400/20 text-blue-300">
            <Icon className="size-4" />
          </span>
          <div>
            <p className="text-[14px] font-bold text-white tracking-tight">{message.title}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-slate-300/80">{message.body}</p>
          </div>
        </div>
        <div className="mt-4 flex max-w-[30rem] gap-2" aria-hidden>
          {MESSAGES.map((m, i) => (
            <button
              key={m.title}
              type="button"
              tabIndex={-1}
              onClick={() => setIndex(i)}
              className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/15 cursor-pointer"
            >
              {i === index && (
                <span
                  className="auth-progress block h-full bg-blue-400"
                  style={{ '--auth-rotate': `${ROTATE_MS}ms` } as React.CSSProperties}
                />
              )}
              {i < index && <span className="block h-full bg-white/60" />}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}

// ─── Precision Dark Field ───

function DarkField({
  id,
  label,
  icon: Icon,
  type = 'text',
  value,
  onChange,
  autoComplete,
  autoFocus,
  inputRef,
  trailing,
  onKeyUp,
  placeholder,
}: {
  id: string
  label: string
  icon: typeof User
  type?: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  autoFocus?: boolean
  inputRef?: React.RefObject<HTMLInputElement | null>
  trailing?: ReactNode
  onKeyUp?: (e: KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5 text-left">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-300 tracking-wide font-mono">
        {label}
      </label>
      <div className="group relative flex items-center rounded-xl border border-white/15 bg-white/[0.05] backdrop-blur-md transition-all focus-within:border-blue-400 focus-within:bg-white/[0.08] focus-within:ring-2 focus-within:ring-blue-400/25 shadow-inner">
        <div className="grid size-11 place-items-center text-white/40 transition-colors group-focus-within:text-blue-400 shrink-0">
          <Icon className="size-4" />
        </div>
        <input
          id={id}
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={onKeyUp}
          required
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          placeholder={placeholder || (label.includes('Username') ? 'Masukkan username admin / NIK' : '••••••••••••')}
          className="h-11 w-full bg-transparent pr-10 text-xs sm:text-sm font-medium text-white outline-none placeholder:text-white/30"
        />
        {trailing && <div className="absolute right-2.5 flex items-center">{trailing}</div>}
      </div>
    </div>
  )
}

// ─── Main AuthSplitLogin Component ───

export function AuthSplitLogin({
  kiosk = false,
  eyebrow,
  title,
  subtitle,
  successSubtitle,
  onSuccess,
  onBack,
  topRight,
  usernameRef,
  accessSelector = false,
}: {
  kiosk?: boolean
  eyebrow: string
  title: ReactNode
  subtitle: string
  successSubtitle: string
  onSuccess: (user: AdminUser) => void
  onBack?: () => void
  topRight?: ReactNode
  usernameRef?: React.RefObject<HTMLInputElement | null>
  accessSelector?: boolean
}) {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [selectedRole, setSelectedRole] = useState<AdminRole>('ism_admin')
  const timer = useRef<number | null>(null)

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await login(username, password, accessSelector ? selectedRole : undefined)
    setSubmitting(false)
    if (result.success) {
      setSuccess(true)
      welcomeAdmin(username)
      timer.current = window.setTimeout(() => {
        onSuccess(result.user)
        setSuccess(false)
        setUsername('')
        setPassword('')
      }, WELCOME_COVERED_MS)
    } else {
      setError(result.message)
    }
  }

  const activeOption = ACCESS_OPTIONS.find((opt) => opt.role === selectedRole)

  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-[#090f17] text-white lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] relative overflow-hidden">
      {/* Ambient background glow effects */}
      <div aria-hidden className="pointer-events-none absolute -top-40 right-0 size-[500px] rounded-full bg-blue-600/10 blur-[130px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/3 size-[500px] rounded-full bg-indigo-600/10 blur-[150px]" />

      <AuthStyles />
      <BrandPanel kiosk={kiosk} />

      {/* Right Form Section with Frosted Glass Card Container */}
      <section className="relative flex flex-col justify-center px-4 py-8 sm:px-8 lg:px-10 xl:px-14">
        {topRight && <div className="absolute right-5 top-5 z-20">{topRight}</div>}

        <div className="auth-rise mx-auto my-auto w-full max-w-[460px]">
          {/* Frosted Glass Floating Card */}
          <div className="relative rounded-3xl border border-white/10 bg-slate-900/65 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]">
            <span aria-hidden className="absolute inset-x-8 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />

            {success ? (
              <div className="auth-success flex flex-col items-center gap-3 py-12 text-center">
                <svg viewBox="0 0 52 52" className="size-16">
                  <circle className="auth-success-circle" cx="26" cy="26" r="24" fill="none" />
                  <path className="auth-success-check" fill="none" d="M14 27l7 7 16-16" />
                </svg>
                <p className="font-display text-2xl font-bold text-white">
                  Login berhasil{username ? `, ${username}` : ''}
                </p>
                <p className="text-xs font-mono text-slate-400">{successSubtitle}</p>
              </div>
            ) : (
              <>
                {/* Header Badge & Title */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="size-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <p className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-blue-300">
                    {eyebrow}
                  </p>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                  {title}
                </h1>
                <p className="mt-1.5 text-xs sm:text-[13px] leading-relaxed text-slate-300/80 font-normal">
                  {subtitle}
                </p>

                <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
                  {/* High-Craft Segmented Role Selector */}
                  {accessSelector && (
                    <fieldset className="space-y-2">
                      <div className="flex items-center justify-between">
                        <legend className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                          Pilih Hak Akses (Role)
                        </legend>
                        <span className="font-mono text-[10px] text-blue-300/90 font-semibold">
                          {activeOption?.code}
                        </span>
                      </div>

                      {/* 5-item Segmented Control Bar */}
                      <div className="grid grid-cols-5 gap-1.5 p-1 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md">
                        {ACCESS_OPTIONS.map((option) => {
                          const OptionIcon = option.icon
                          const isSelected = selectedRole === option.role
                          return (
                            <button
                              key={option.role}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => {
                                setSelectedRole(option.role)
                                setError(null)
                              }}
                              title={option.description}
                              className={`group relative flex flex-col items-center justify-center gap-1 rounded-xl py-2 px-1 text-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 text-white border border-blue-400/60 shadow-[0_0_18px_rgba(37,99,235,0.45)] ring-1 ring-blue-400/40'
                                  : 'text-slate-400 hover:text-white hover:bg-white/[0.08] border border-transparent'
                              }`}
                            >
                              <OptionIcon className={`size-4 ${isSelected ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                              <span className="text-[10px] font-bold tracking-tight leading-none">
                                {option.shortLabel}
                              </span>
                              <span
                                className={`font-mono text-[8px] font-bold uppercase tracking-wider ${
                                  isSelected ? 'text-blue-100' : 'text-slate-500'
                                }`}
                              >
                                {option.code}
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Active Role Helper Banner */}
                      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300 font-mono">
                        <span className="inline-block size-1.5 rounded-full bg-blue-400" />
                        <span className="truncate">
                          Otorisasi: <strong className="text-white">{activeOption?.label}</strong> — {activeOption?.description}
                        </span>
                      </div>
                    </fieldset>
                  )}

                  <DarkField
                    id={kiosk ? 'klf-username' : 'lm-username'}
                    label="Username Akun / NIK"
                    icon={User}
                    value={username}
                    onChange={setUsername}
                    autoComplete="username"
                    autoFocus={kiosk}
                    inputRef={usernameRef}
                  />

                  <div>
                    <DarkField
                      id={kiosk ? 'klf-password' : 'lm-password'}
                      label="Kata Sandi (Password)"
                      icon={KeyRound}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={setPassword}
                      autoComplete="current-password"
                      onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                      trailing={
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                          className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      }
                    />
                    {capsLock && (
                      <p className="mt-1.5 text-[11px] font-medium text-amber-400 font-mono">
                        ▲ Peringatan: Tombol Caps Lock sedang aktif
                      </p>
                    )}
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-300 font-medium"
                    >
                      <AlertCircle className="mt-0.5 size-4 flex-none text-rose-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Shimmering Executive Action Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="group relative flex h-12 w-full items-center justify-between rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_4px_22px_rgba(37,99,235,0.4)] transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer px-4.5"
                  >
                    <span className="flex items-center gap-2">
                      {submitting ? (
                        <>
                          <Loader2 className="size-4 animate-spin text-white" />
                          <span>Memverifikasi Kredensial...</span>
                        </>
                      ) : (
                        <>
                          <LockKeyhole className="size-4 text-white/90" />
                          <span>
                            {accessSelector ? `Masuk sebagai ${activeOption?.shortLabel || 'Admin'}` : 'Masuk ke Sistem'}
                          </span>
                        </>
                      )}
                    </span>
                    <span className="flex items-center gap-1 rounded-md border border-white/25 bg-white/15 px-2 py-0.5 font-mono text-[9.5px] text-white">
                      <span>Enter</span>
                      <span className="font-sans">↵</span>
                    </span>
                  </button>

                  <div className="flex items-center justify-between text-xs">
                    <a
                      href={`${API_BASE_PATH}/reset-password`}
                      className="font-medium text-slate-400 hover:text-blue-300 transition underline underline-offset-4"
                    >
                      Lupa kata sandi?
                    </a>
                    <span className="font-mono text-[10px] text-slate-400 flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      Otorisasi Terenkripsi
                    </span>
                  </div>
                </form>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1.5">
                    <LockKeyhole className="size-3 text-blue-400" />
                    {kiosk ? 'Perangkat Kiosk Resmi' : 'ISO/IEC 27001 Security Standard'}
                  </span>
                  <span>
                    Bantuan: <strong className="text-white">Admin IT / IAA</strong>
                  </span>
                </div>

                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-white cursor-pointer active:scale-95"
                  >
                    <ArrowLeft className="size-3.5" />
                    <span>Kembali ke portal</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
