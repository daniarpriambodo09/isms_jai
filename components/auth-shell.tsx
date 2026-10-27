// components/auth-shell.tsx
//
// The one sign-in screen used everywhere (admin modal + /login page + Lobby/Security
// kiosks), laid out as an executive split screen: a full-bleed brand
// panel — the Yazaki building in a duotone of the theme colours, a rotating
// ISMS message carousel and a live ISO 27001 telemetry panel — next
// to an open, precision boxed enterprise form with crisp micro-interactions.
'use client'

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { AlertCircle, ArrowLeft, Eye, EyeOff, FileCheck2, KeyRound, Loader2, LockKeyhole, QrCode, User, Users } from 'lucide-react'
import { useAuth, type AdminRole, type AdminUser } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { welcomeAdmin, WELCOME_COVERED_MS } from '@/components/admin-welcome'

// ─── styles ───

function AuthStyles() {
  return (
    <style>{`
      @keyframes auth-kenburns { from { transform: scale(1.06) translate3d(0,0,0); } to { transform: scale(1.16) translate3d(-2%, -1.5%, 0); } }
      @keyframes auth-pulse { 0%, 100% { opacity: .55; transform: scale(1); } 50% { opacity: 0; transform: scale(1.55); } }
      @keyframes auth-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
      @keyframes auth-msg-in { from { opacity: 0; transform: translateY(14px); filter: blur(4px); } to { opacity: 1; transform: none; filter: none; } }
      @keyframes auth-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      @keyframes auth-pop { 0% { opacity: 0; transform: scale(.9); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes auth-circle { from { stroke-dashoffset: 152; } to { stroke-dashoffset: 0; } }
      @keyframes auth-check { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } }
      .auth-kenburns { animation: auth-kenburns 24s ease-in-out infinite alternate; }
      .auth-ping { animation: auth-pulse 2.4s ease-out infinite; }
      .auth-rise { animation: auth-rise .6s cubic-bezier(.22,1,.36,1) both; }
      .auth-msg-in { animation: auth-msg-in .7s cubic-bezier(.22,1,.36,1) both; }
      .auth-progress { transform-origin: left; animation: auth-progress var(--auth-rotate, 5s) linear both; }
      .auth-success { animation: auth-pop .3s cubic-bezier(.34,1.56,.64,1) both; }
      .auth-success-circle { stroke: var(--p-600); stroke-width: 3; stroke-dasharray: 152; stroke-dashoffset: 152; animation: auth-circle .55s ease-out .1s forwards; }
      .auth-success-check { stroke: var(--primary); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 40; stroke-dashoffset: 40; animation: auth-check .32s ease-out .6s forwards; }
      @media (prefers-reduced-motion: reduce) {
        .auth-kenburns, .auth-ping, .auth-rise, .auth-msg-in, .auth-progress { animation: none; }
      }
    `}</style>
  )
}

// ─── brand panel ───

type Stats = { documents: number; proceduresApproved: number; visitsTotal: number; specialAreaApproved: number; photoApproved: number }

const ACCESS_OPTIONS: { role: AdminRole; label: string; description: string; code: string }[] = [
  { role: 'ism_admin', label: 'Admin ISMS', description: 'Tata Kelola Portal & Dokumen', code: 'SYS-ADMIN' },
  { role: 'it', label: 'Admin IT', description: 'Izin Alat IT & E-Sign Services', code: 'IT-OPS' },
  { role: 'lobby', label: 'Admin Lobby', description: 'Pendaftaran & Kartu Tamu', code: 'LOBBY' },
  { role: 'security', label: 'Admin Security', description: 'Pos Security & Gatepass', code: 'GATE-SEC' },
  { role: 'approver', label: 'Approver Dokumen', description: 'Verifikasi & Pengesahan Persetujuan', code: 'DOC-APPR' },
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
    <aside className="relative isolate flex min-h-[230px] flex-col overflow-hidden bg-[color:var(--p-950)] text-white lg:min-h-0">
      {/* Building photo in a duotone of the theme */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <img src={`${API_BASE_PATH}/images/yazaki-building.jpg`} alt="" className="auth-kenburns size-full object-cover grayscale contrast-125" />
        <div className="absolute inset-0 mix-blend-multiply" style={{ background: 'linear-gradient(150deg, var(--primary) 0%, var(--p-900) 55%, var(--p-950) 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 85% 10%, color-mix(in oklch, var(--accent) 35%, transparent), transparent 60%), linear-gradient(to top, color-mix(in oklch, var(--p-950) 92%, transparent) 0%, transparent 60%)' }} />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      {/* Top: brand */}
      <div className="flex items-center gap-3 p-6 lg:p-10">
        <span className="rounded-xl bg-white px-3 py-2 shadow-lg shadow-black/20">
          <img src={`${API_BASE_PATH}/images/yazaki-logo.jpg`} alt="Yazaki" className="h-5 w-auto" />
        </span>
        <span className="font-mono text-[11px] font-bold text-white/80 tracking-wide">
          ISMS {kiosk ? 'Kiosk' : 'Portal'} · PT. Jatim Autocomp Indonesia
        </span>
      </div>

      {/* Middle: statement (desktop) */}
      <div className="hidden flex-1 flex-col justify-center px-10 lg:flex xl:px-14">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-white/70">
            Information Security Management System
          </p>
        </div>
        <h2 className="mt-3.5 max-w-[34rem] font-display text-[clamp(2.4rem,3.6vw,3.6rem)] font-semibold leading-[1.02]">
          Keamanan informasi, <span className="font-serif-accent text-[color:color-mix(in_oklch,var(--accent)_70%,white)]">dijaga</span> bersama.
        </h2>

        {/* Realtime Telemetry Panel */}
        <div className="mt-8 max-w-[32rem] rounded-xl border border-white/15 bg-white/[0.06] p-4.5 backdrop-blur-md shadow-2xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-white/90">
                ISO/IEC 27001 Certified System
              </span>
            </div>
            <span className="font-mono text-[10px] text-white/60 font-medium">
              Live Telemetry
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {statItems.map(([label, value]) => (
              <div key={label}>
                <p className="font-mono text-xl sm:text-2xl font-bold tabular-nums leading-none text-white">
                  {value === undefined ? '—' : nf.format(value)}
                </p>
                <p className="mt-1.5 text-[11px] font-medium text-white/60">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom: rotating messages */}
      <div className="mt-auto p-6 pt-0 lg:p-10 xl:px-14">
        <div key={index} className="auth-msg-in flex max-w-[30rem] items-start gap-3">
          <span className="grid size-9 flex-none place-items-center rounded-full bg-white/12 ring-1 border border-white/20">
            <Icon className="size-4 text-white" />
          </span>
          <div>
            <p className="text-[14.5px] font-bold text-white">{message.title}</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/70">{message.body}</p>
          </div>
        </div>
        <div className="mt-4 flex max-w-[30rem] gap-2" aria-hidden>
          {MESSAGES.map((m, i) => (
            <button key={m.title} type="button" tabIndex={-1} onClick={() => setIndex(i)} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
              {i === index && <span className="auth-progress block h-full bg-white" style={{ '--auth-rotate': `${ROTATE_MS}ms` } as React.CSSProperties} />}
              {i < index && <span className="block h-full bg-white/70" />}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}

// ─── form ───

function Field({
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
      <label htmlFor={id} className="block text-xs font-bold text-foreground tracking-tight">
        {label}
      </label>
      <div className="group relative flex items-center rounded-xl border border-border bg-card transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 shadow-2xs">
        <div className="grid size-10 place-items-center text-muted-foreground transition-colors group-focus-within:text-primary shrink-0">
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
          placeholder={placeholder || (label.includes('Username') ? 'Masukkan username / NIK' : '••••••••••••')}
          className="h-10 w-full bg-transparent pr-10 text-xs sm:text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/45"
        />
        {trailing && <div className="absolute right-2 flex items-center">{trailing}</div>}
      </div>
    </div>
  )
}

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
  /** Called once the welcome curtain covers the screen. */
  onSuccess: (user: AdminUser) => void
  onBack?: () => void
  topRight?: ReactNode
  usernameRef?: React.RefObject<HTMLInputElement | null>
  /** Portal login: choose the destination role before entering credentials. */
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
      // Full-screen "masuk sebagai admin" sequence (components/admin-welcome.tsx);
      // this screen closes underneath once its curtain has shut.
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

  return (
    <div className="grid min-h-full w-full grid-cols-1 bg-background lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <AuthStyles />
      <BrandPanel kiosk={kiosk} />

      <section className="relative flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-16">
        {topRight && <div className="absolute right-5 top-5 z-10">{topRight}</div>}

        <div className="auth-rise mx-auto my-auto w-full max-w-[420px]">
          {success ? (
            <div className="auth-success flex flex-col items-center gap-3 py-16 text-center">
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
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" />
                <p className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-primary">
                  {eyebrow}
                </p>
              </div>
              <h1 className="mt-3 font-display text-[clamp(2rem,3.5vw,2.75rem)] font-extrabold leading-[1.05] tracking-tight text-foreground">
                {title}
              </h1>
              <p className="mt-2 text-xs sm:text-[13.5px] leading-relaxed text-muted-foreground font-normal">
                {subtitle}
              </p>

              <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
                {accessSelector && (
                  <fieldset>
                    <div className="mb-2 flex items-center justify-between">
                      <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                        Pilih Hak Akses (Role)
                      </legend>
                      <span className="font-mono text-[10px] text-muted-foreground font-medium">
                        Otorisasi ISO 27001
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {ACCESS_OPTIONS.map((option, idx) => (
                        <button
                          key={option.role}
                          type="button"
                          aria-pressed={selectedRole === option.role}
                          onClick={() => { setSelectedRole(option.role); setError(null) }}
                          className={`group rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                            idx === 4 ? 'col-span-2' : ''
                          } ${
                            selectedRole === option.role
                              ? 'border-primary bg-primary/10 shadow-2xs ring-1 ring-primary/30'
                              : 'border-border bg-card hover:bg-secondary/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-xs font-bold ${selectedRole === option.role ? 'text-primary' : 'text-foreground'}`}>
                              {option.label}
                            </span>
                            <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-tight ${
                              selectedRole === option.role
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-muted-foreground border border-border'
                            }`}>
                              {option.code}
                            </span>
                          </div>
                          <span className="mt-0.5 block text-[10.5px] leading-snug text-muted-foreground line-clamp-1">
                            {option.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}

                <Field
                  id={kiosk ? 'klf-username' : 'lm-username'}
                  label="Username Akun"
                  icon={User}
                  value={username}
                  onChange={setUsername}
                  autoComplete="username"
                  autoFocus={kiosk}
                  inputRef={usernameRef}
                />

                <div>
                  <Field
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
                        className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    }
                  />
                  {capsLock && (
                    <p className="mt-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 font-mono">
                      ▲ Peringatan: Caps Lock sedang aktif
                    </p>
                  )}
                </div>

                {error && (
                  <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
                    <AlertCircle className="mt-0.5 size-4 flex-none" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative flex h-11 w-full items-center justify-between rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-2xs transition hover:bg-primary/90 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
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
                            ? `Masuk sebagai ${ACCESS_OPTIONS.find((option) => option.role === selectedRole)?.label}`
                            : 'Masuk ke Sistem'}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="flex items-center gap-1 rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2 py-0.5 font-mono text-[10px] text-primary-foreground/90">
                    <span>Enter</span>
                    <span className="font-sans">↵</span>
                  </span>
                </button>

                <div className="flex items-center justify-between text-xs">
                  <a
                    href={`${API_BASE_PATH}/reset-password`}
                    className="font-medium text-muted-foreground hover:text-primary transition underline underline-offset-4"
                  >
                    Lupa kata sandi?
                  </a>
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    Otorisasi Terenkripsi
                  </span>
                </div>
              </form>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-[11.5px] text-muted-foreground">
                <span className="flex items-center gap-1.5 font-mono text-[10.5px]">
                  <LockKeyhole className="size-3 text-primary" />
                  {kiosk ? 'Perangkat Kiosk Resmi' : 'Internal Network · ISO/IEC 27001'}
                </span>
                <span className="text-[11px]">
                  Butuh bantuan?{' '}
                  <span className="font-bold text-foreground">Hubungi IT / IAA</span>
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
      </section>
    </div>
  )
}
