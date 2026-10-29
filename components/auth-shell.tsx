// components/auth-shell.tsx
//
// Corporate Authentication Screen (PT. Jatim Autocomp Indonesia)
// Shared between the /login page, admin login modal, and Kiosk stations.
// Balanced Japanese Industrial aesthetic: warm portal background,
// authentic Yazaki duotone branding, and a crisp elevated card container.
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
import { SignalGrid } from '@/components/backgrounds'

// ─── Styles ───

function AuthStyles() {
  return (
    <style>{`
      @keyframes auth-kenburns {
        from { transform: scale(1.04) translate3d(0, 0, 0); }
        to { transform: scale(1.12) translate3d(-1.5%, -1%, 0); }
      }
      @keyframes auth-rise {
        from { opacity: 0; transform: translateY(14px); }
        to { opacity: 1; transform: none; }
      }
      @keyframes auth-msg-in {
        from { opacity: 0; transform: translateY(10px); filter: blur(3px); }
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
      .auth-kenburns { animation: auth-kenburns 24s ease-in-out infinite alternate; }
      .auth-rise { animation: auth-rise .45s cubic-bezier(.22, 1, .36, 1) both; }
      .auth-msg-in { animation: auth-msg-in .55s cubic-bezier(.22, 1, .36, 1) both; }
      .auth-progress { transform-origin: left; animation: auth-progress var(--auth-rotate, 5s) linear both; }
      .auth-success { animation: auth-pop .3s cubic-bezier(.34, 1.56, .64, 1) both; }
      .auth-success-circle { stroke: var(--p-600); stroke-width: 3; stroke-dasharray: 152; stroke-dashoffset: 152; animation: auth-circle .55s ease-out .1s forwards; }
      .auth-success-check { stroke: var(--primary); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 40; stroke-dashoffset: 40; animation: auth-check .32s ease-out .6s forwards; }
      @media (prefers-reduced-motion: reduce) {
        .auth-kenburns, .auth-rise, .auth-msg-in, .auth-progress { animation: none; }
      }
    `}</style>
  )
}

// ─── Brand Telemetry Panel ───

type Stats = { documents: number; proceduresApproved: number; visitsTotal: number; specialAreaApproved: number; photoApproved: number }

const ACCESS_OPTIONS: { role: AdminRole; label: string; shortLabel: string; description: string; code: string; icon: typeof ShieldCheck }[] = [
  { role: 'ism_admin', label: 'Admin ISMS', shortLabel: 'ISMS', description: 'Tata Kelola Portal & Dokumen', code: 'SYS-ADMIN', icon: ShieldCheck },
  { role: 'it', label: 'Admin IT', shortLabel: 'IT Ops', description: 'Izin Alat IT & E-Sign Services', code: 'IT-OPS', icon: Laptop },
  { role: 'lobby', label: 'Admin Lobby', shortLabel: 'Lobby', description: 'Pendaftaran & Kartu Tamu', code: 'LOBBY', icon: Building2 },
  { role: 'security', label: 'Admin Security', shortLabel: 'Security', description: 'Pos Security & Gatepass', code: 'GATE-SEC', icon: KeyRound },
  { role: 'approver', label: 'Approver Dokumen', shortLabel: 'Approver', description: 'Verifikasi & Pengesahan Persetujuan', code: 'DOC-APPR', icon: FileCheck2 },
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
    <aside className="relative isolate flex min-h-[250px] flex-col overflow-hidden bg-[color:var(--p-950)] text-white lg:min-h-0 border-b lg:border-b-0 lg:border-r border-border">
      {/* Building photo in a duotone of the theme */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <img
          src={`${API_BASE_PATH}/images/yazaki-building.jpg`}
          alt=""
          className="auth-kenburns size-full object-cover grayscale contrast-125"
        />
        <div
          className="absolute inset-0 mix-blend-multiply"
          style={{ background: 'linear-gradient(150deg, var(--primary) 0%, var(--p-900) 55%, var(--p-950) 100%)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 85% 10%, color-mix(in oklch, var(--accent) 35%, transparent), transparent 60%), linear-gradient(to top, color-mix(in oklch, var(--p-950) 92%, transparent) 0%, transparent 60%)',
          }}
        />
        <SignalGrid
          color="#93c5fd"
          anchor="left"
          speed={0.4}
          opacity={0.35}
          gridStep={20}
          squareSize={7}
          className="mix-blend-screen pointer-events-none"
        />
      </div>

      {/* Top: Brand Badge */}
      <div className="flex items-center gap-3 p-6 lg:p-10">
        <span className="rounded-xl bg-white px-3 py-1.5 shadow-md">
          <img src={`${API_BASE_PATH}/images/yazaki-logo.jpg`} alt="Yazaki" className="h-5 w-auto" />
        </span>
        <span className="font-mono text-[11px] font-bold text-white/80 tracking-wide">
          ISMS {kiosk ? 'Kiosk' : 'Portal'} · PT. JAI
        </span>
      </div>

      {/* Middle: Statement & Telemetry */}
      <div className="hidden flex-1 flex-col justify-center px-10 lg:flex xl:px-14">
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          ISO/IEC 27001 Certified System
        </div>
        <h2 className="mt-4 max-w-[32rem] font-display text-[clamp(2.1rem,3.2vw,3.2rem)] font-bold tracking-tight text-white leading-[1.1]">
          Keamanan Informasi, Dijaga Bersama.
        </h2>
        <p className="mt-2.5 text-xs sm:text-sm text-white/80 max-w-md leading-relaxed">
          Sistem manajemen terintegrasi untuk perlindungan aset informasi dan kepatuhan standar industri internasional PT. Jatim Autocomp Indonesia.
        </p>

        {/* Realtime Telemetry Panel */}
        <div className="mt-8 max-w-[30rem] rounded-2xl border border-white/15 bg-white/10 p-4.5 backdrop-blur-md shadow-xs">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/15">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/90">
              Realtime Telemetry
            </span>
            <span className="font-mono text-[9.5px] text-white/60">
              PT. JAI Network
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {statItems.map(([label, value]) => (
              <div key={label}>
                <p className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-white">
                  {value === undefined ? '—' : nf.format(value)}
                </p>
                <p className="mt-1 text-[11px] text-white/70 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom: Rotating Messages */}
      <div className="mt-auto p-6 pt-0 lg:p-10 xl:px-14">
        <div key={index} className="auth-msg-in flex max-w-[30rem] items-start gap-3">
          <span className="grid size-9 flex-none place-items-center rounded-xl bg-white/15 border border-white/20 text-white">
            <Icon className="size-4" />
          </span>
          <div>
            <p className="text-[14px] font-bold text-white">{message.title}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-white/70">{message.body}</p>
          </div>
        </div>
        <div className="mt-4 flex max-w-[30rem] gap-2" aria-hidden>
          {MESSAGES.map((m, i) => (
            <button
              key={m.title}
              type="button"
              tabIndex={-1}
              onClick={() => setIndex(i)}
              className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20 cursor-pointer"
            >
              {i === index && (
                <span
                  className="auth-progress block h-full bg-white"
                  style={{ '--auth-rotate': `${ROTATE_MS}ms` } as React.CSSProperties}
                />
              )}
              {i < index && <span className="block h-full bg-white/70" />}
            </button>
          ))}
        </div>
      </div>
    </aside>
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
    <div className="grid min-h-screen w-full grid-cols-1 bg-background lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <AuthStyles />
      <BrandPanel kiosk={kiosk} />

      {/* Right Form Section: Clean Elevated Card on Warm Canvas */}
      <section className="relative flex flex-col justify-center px-4 py-8 sm:px-8 lg:px-12 xl:px-16 overflow-hidden">
        <SignalGrid color="var(--primary)" opacity={0.08} speed={0.3} anchor="right" squareSize={6} gridStep={24} />
        {topRight && <div className="absolute right-5 top-5 z-20">{topRight}</div>}

        <div className="auth-rise mx-auto my-auto w-full max-w-[440px]">
          {/* Crisp Elevated Card Container */}
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs">
            {success ? (
              <div className="auth-success flex flex-col items-center gap-3 py-10 text-center">
                <svg viewBox="0 0 52 52" className="size-16">
                  <circle className="auth-success-circle" cx="26" cy="26" r="24" fill="none" />
                  <path className="auth-success-check" fill="none" d="M14 27l7 7 16-16" />
                </svg>
                <p className="font-display text-2xl font-bold text-foreground">
                  Login berhasil{username ? `, ${username}` : ''}
                </p>
                <p className="text-xs font-mono text-muted-foreground">{successSubtitle}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="size-1.5 rounded-full bg-primary" />
                  <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                    {eyebrow}
                  </p>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  Selamat Datang Kembali
                </h1>
                <p className="mt-1.5 text-xs sm:text-[13px] text-muted-foreground leading-relaxed">
                  {subtitle}
                </p>

                <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                  {/* Clean Segmented Role Selector */}
                  {accessSelector && (
                    <fieldset className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <legend className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                          Pilih Hak Akses (Role)
                        </legend>
                        <span className="font-mono text-[10px] text-primary font-bold">
                          {activeOption?.code}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {ACCESS_OPTIONS.map((option, idx) => {
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
                              className={`group rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                                idx === 4 ? 'col-span-2' : ''
                              } ${
                                isSelected
                                  ? 'border-primary bg-primary/10 shadow-2xs ring-1 ring-primary/30'
                                  : 'border-border bg-secondary/40 hover:bg-secondary hover:border-border/80'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                  {option.label}
                                </span>
                                <span
                                  className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                                    isSelected
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-card border border-border text-muted-foreground'
                                  }`}
                                >
                                  {option.code}
                                </span>
                              </div>
                              <span className="mt-0.5 block text-[10.5px] leading-snug text-muted-foreground line-clamp-1">
                                {option.description}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </fieldset>
                  )}

                  {/* Username Boxed Input */}
                  <div className="space-y-1.5 text-left">
                    <label
                      htmlFor={kiosk ? 'klf-username' : 'lm-username'}
                      className="block text-xs font-bold text-foreground"
                    >
                      Username Akun
                    </label>
                    <div className="group relative flex items-center rounded-xl border border-border bg-card transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 shadow-2xs">
                      <div className="grid size-10 place-items-center text-muted-foreground group-focus-within:text-primary shrink-0">
                        <User className="size-4" />
                      </div>
                      <input
                        id={kiosk ? 'klf-username' : 'lm-username'}
                        ref={usernameRef}
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoFocus={kiosk}
                        autoComplete="username"
                        placeholder="Masukkan username akun"
                        className="h-10 w-full bg-transparent pr-4 text-xs sm:text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>

                  {/* Password Boxed Input */}
                  <div className="space-y-1.5 text-left">
                    <label
                      htmlFor={kiosk ? 'klf-password' : 'lm-password'}
                      className="block text-xs font-bold text-foreground"
                    >
                      Kata Sandi (Password)
                    </label>
                    <div className="group relative flex items-center rounded-xl border border-border bg-card transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 shadow-2xs">
                      <div className="grid size-10 place-items-center text-muted-foreground group-focus-within:text-primary shrink-0">
                        <KeyRound className="size-4" />
                      </div>
                      <input
                        id={kiosk ? 'klf-password' : 'lm-password'}
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        placeholder="••••••••••••"
                        onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                        className="h-10 w-full bg-transparent pr-10 text-xs sm:text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        className="absolute right-2 grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                    {capsLock && (
                      <p className="mt-1 text-[11px] font-mono font-medium text-amber-600 dark:text-amber-400">
                        ▲ Peringatan: Caps Lock sedang aktif
                      </p>
                    )}
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive font-medium"
                    >
                      <AlertCircle className="mt-0.5 size-4 flex-none" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Clean Primary Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="group relative flex h-11 w-full items-center justify-between rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-2xs transition hover:bg-primary/90 active:scale-[0.99] disabled:opacity-60 cursor-pointer mt-1"
                  >
                    <span className="flex items-center gap-2">
                      {submitting ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Memverifikasi kredensial...</span>
                        </>
                      ) : (
                        <>
                          <LockKeyhole className="size-3.5 text-primary-foreground/80" />
                          <span>
                            {accessSelector
                              ? `Masuk sebagai ${activeOption?.label || 'Admin'}`
                              : 'Masuk ke Sistem'}
                          </span>
                        </>
                      )}
                    </span>
                    <span className="flex items-center gap-1 rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2 py-0.5 font-mono text-[9.5px] text-primary-foreground/90">
                      <span>Enter</span>
                      <span className="font-sans">↵</span>
                    </span>
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <a
                      href={`${API_BASE_PATH}/reset-password`}
                      className="font-medium text-muted-foreground hover:text-primary transition underline underline-offset-4"
                    >
                      Lupa kata sandi?
                    </a>
                  </div>
                </form>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-[11px] text-muted-foreground font-mono">
                  <span className="flex items-center gap-1.5">
                    <LockKeyhole className="size-3 text-primary" />
                    {kiosk ? 'Perangkat Kiosk Resmi' : 'Internal · ISO/IEC 27001'}
                  </span>
                  <span>
                    Bantuan: <strong className="text-foreground">Admin IT / IAA</strong>
                  </span>
                </div>

                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground cursor-pointer active:scale-95"
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
