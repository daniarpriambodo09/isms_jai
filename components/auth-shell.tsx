// components/auth-shell.tsx
//
// The one sign-in screen used everywhere (admin modal + Lobby/Security
// kiosks), laid out as a split screen after the strongest patterns in
// current login design (Wise / Headspace / Rive style): a full-bleed brand
// panel — the Yazaki building in a duotone of the theme colours, a rotating
// ISMS message carousel and a live "status" panel with portal numbers — next
// to an open, card-less form with floating-label underline fields. On phones
// the brand panel collapses into a banner above the form. Every colour is a
// theme token, so it follows Tema Warna.
'use client'

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, FileCheck2, KeyRound, Loader2, LockKeyhole, QrCode, ShieldCheck, User, Users } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'

// ─── styles ───

function AuthStyles() {
  return (
    <style>{`
      @keyframes auth-kenburns { from { transform: scale(1.06) translate3d(0,0,0); } to { transform: scale(1.16) translate3d(-2%, -1.5%, 0); } }
      @keyframes auth-scan { 0% { transform: translateY(-120%); } 100% { transform: translateY(220%); } }
      @keyframes auth-pulse { 0%, 100% { opacity: .55; transform: scale(1); } 50% { opacity: 0; transform: scale(1.55); } }
      @keyframes auth-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
      @keyframes auth-msg-in { from { opacity: 0; transform: translateY(14px); filter: blur(4px); } to { opacity: 1; transform: none; filter: none; } }
      @keyframes auth-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      @keyframes auth-pop { 0% { opacity: 0; transform: scale(.9); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes auth-circle { from { stroke-dashoffset: 152; } to { stroke-dashoffset: 0; } }
      @keyframes auth-check { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } }
      .auth-kenburns { animation: auth-kenburns 24s ease-in-out infinite alternate; }
      .auth-scan { animation: auth-scan 2.8s cubic-bezier(.45,0,.55,1) infinite; }
      .auth-ping { animation: auth-pulse 2.4s ease-out infinite; }
      .auth-rise { animation: auth-rise .6s cubic-bezier(.22,1,.36,1) both; }
      .auth-msg-in { animation: auth-msg-in .7s cubic-bezier(.22,1,.36,1) both; }
      .auth-progress { transform-origin: left; animation: auth-progress var(--auth-rotate, 5s) linear both; }
      .auth-success { animation: auth-pop .3s cubic-bezier(.34,1.56,.64,1) both; }
      .auth-success-circle { stroke: var(--p-600); stroke-width: 3; stroke-dasharray: 152; stroke-dashoffset: 152; animation: auth-circle .55s ease-out .1s forwards; }
      .auth-success-check { stroke: var(--primary); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 40; stroke-dashoffset: 40; animation: auth-check .32s ease-out .6s forwards; }
      /* Underline field with floating label */
      .auth-field input { background: transparent; }
      .auth-field input:-webkit-autofill { -webkit-box-shadow: 0 0 0 1000px var(--background) inset; -webkit-text-fill-color: var(--foreground); caret-color: var(--foreground); }
      .auth-field label { transform-origin: left top; transition: transform .2s cubic-bezier(.22,1,.36,1), color .2s; }
      .auth-field input:focus ~ label, .auth-field input:not(:placeholder-shown) ~ label { transform: translateY(-17px) scale(.78); }
      .auth-field input:focus ~ label { color: var(--p-600); }
      .auth-field .auth-underline { transform: scaleX(0); transform-origin: left; transition: transform .35s cubic-bezier(.22,1,.36,1); }
      .auth-field input:focus ~ .auth-underline { transform: scaleX(1); }
      .auth-field:focus-within .auth-field-icon { color: var(--p-600); }
      .auth-submit .auth-submit-arrow { transition: transform .25s cubic-bezier(.22,1,.36,1); }
      .auth-submit:not(:disabled):hover .auth-submit-arrow { transform: translateX(4px); }
      @media (prefers-reduced-motion: reduce) {
        .auth-kenburns, .auth-scan, .auth-ping, .auth-rise, .auth-msg-in, .auth-progress { animation: none; }
      }
    `}</style>
  )
}

// ─── brand panel ───

type Stats = { documents: number; proceduresApproved: number; visitsTotal: number; specialAreaApproved: number; photoApproved: number }

const MESSAGES = [
  { icon: FileCheck2, title: 'Dokumen terkendali', body: 'Prosedur, form, dan standar ISMS selalu tersedia dalam revisi terbaru.' },
  { icon: QrCode, title: 'Pengesahan elektronik', body: 'Approver menandatangani dengan QR langsung dari email — tanpa kertas, bisa diverifikasi.' },
  { icon: Users, title: 'Akses tercatat', body: 'Tamu, vendor, dan izin area special terekam dari Pos Security hingga Lobby.' },
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
    ['Dokumen', stats?.documents],
    ['Disahkan', stats?.proceduresApproved],
    ['Kunjungan', stats?.visitsTotal],
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
        <span className="font-mono-label text-[10.5px] text-white/70">ISMS {kiosk ? 'Kiosk' : 'Portal'} · PT. Jatim Autocomp Indonesia</span>
      </div>

      {/* Middle: statement (desktop) */}
      <div className="hidden flex-1 flex-col justify-center px-10 lg:flex xl:px-14">
        <p className="font-mono-label text-[10.5px] text-white/60">Information Security Management System</p>
        <h2 className="mt-4 max-w-[34rem] font-display text-[clamp(2.4rem,3.6vw,3.6rem)] font-semibold leading-[1.02]">
          Keamanan informasi, <span className="font-serif-accent text-[color:color-mix(in_oklch,var(--accent)_70%,white)]">dijaga</span> bersama.
        </h2>

        {/* Live status panel */}
        <div className="mt-10 flex max-w-[30rem] items-center gap-5 rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-md">
          <div className="relative grid size-16 flex-none place-items-center overflow-hidden rounded-xl bg-white/10">
            <span className="auth-ping absolute inset-2 rounded-full border-2 border-white/40" />
            <ShieldCheck className="relative size-8" />
            <span className="auth-scan absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-transparent via-white/25 to-transparent" />
          </div>
          <div className="grid flex-1 grid-cols-3 gap-3">
            {statItems.map(([label, value]) => (
              <div key={label}>
                <p className="font-display text-2xl font-semibold tabular-nums leading-none">{value === undefined ? '—' : nf.format(value)}</p>
                <p className="mt-1 text-[11px] text-white/60">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom: rotating messages */}
      <div className="mt-auto p-6 pt-0 lg:p-10 xl:px-14">
        <div key={index} className="auth-msg-in flex max-w-[30rem] items-start gap-3">
          <span className="grid size-9 flex-none place-items-center rounded-full bg-white/12 ring-1 ring-white/20"><Icon className="size-4" /></span>
          <div>
            <p className="text-[15px] font-semibold">{message.title}</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-white/70">{message.body}</p>
          </div>
        </div>
        <div className="mt-5 flex max-w-[30rem] gap-2" aria-hidden>
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

function Field({ id, label, icon: Icon, type = 'text', value, onChange, autoComplete, autoFocus, inputRef, trailing, onKeyUp }: {
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
}) {
  return (
    <div className="auth-field relative pt-3">
      <Icon className="auth-field-icon pointer-events-none absolute bottom-3.5 left-0 size-[18px] text-muted-foreground transition-colors" />
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
        placeholder=" "
        className="peer h-12 w-full border-0 border-b-2 border-border pl-8 pr-10 text-[15.5px] text-foreground outline-none"
      />
      <label htmlFor={id} className="pointer-events-none absolute bottom-3.5 left-8 text-[15px] text-muted-foreground">{label}</label>
      <span aria-hidden className="auth-underline absolute bottom-0 left-0 h-[2px] w-full bg-[color:var(--p-600)]" />
      {trailing && <div className="absolute bottom-2 right-0">{trailing}</div>}
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
}: {
  kiosk?: boolean
  eyebrow: string
  title: ReactNode
  subtitle: string
  successSubtitle: string
  /** Called after the success animation. */
  onSuccess: () => void
  onBack?: () => void
  topRight?: ReactNode
  usernameRef?: React.RefObject<HTMLInputElement | null>
}) {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await login(username, password)
    setSubmitting(false)
    if (result.success) {
      setSuccess(true)
      timer.current = window.setTimeout(() => {
        onSuccess()
        setSuccess(false)
        setUsername('')
        setPassword('')
      }, 1300)
    } else {
      setError(result.message)
    }
  }

  return (
    <div className="grid min-h-full w-full grid-cols-1 bg-background lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <AuthStyles />
      <BrandPanel kiosk={kiosk} />

      <section className="relative flex flex-col px-6 py-10 sm:px-10 lg:px-16">
        {topRight && <div className="absolute right-5 top-5 z-10">{topRight}</div>}

        <div className="auth-rise mx-auto my-auto w-full max-w-[400px]">
          {success ? (
            <div className="auth-success flex flex-col items-center gap-3 py-16 text-center">
              <svg viewBox="0 0 52 52" className="size-16">
                <circle className="auth-success-circle" cx="26" cy="26" r="24" fill="none" />
                <path className="auth-success-check" fill="none" d="M14 27l7 7 16-16" />
              </svg>
              <p className="font-display text-2xl font-semibold text-foreground">Login berhasil{username ? `, ${username}` : ''}</p>
              <p className="text-sm text-muted-foreground">{successSubtitle}</p>
            </div>
          ) : (
            <>
              <p className="flex items-center gap-2 font-mono-label text-[10.5px] text-[color:var(--p-600)]">
                <span className="size-1.5 rounded-full bg-[color:var(--p-600)]" /> {eyebrow}
              </p>
              <h1 className="mt-4 font-display text-[clamp(2.1rem,4vw,2.9rem)] font-semibold leading-[1.02] text-foreground">{title}</h1>
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">{subtitle}</p>

              <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-7">
                <Field id={kiosk ? 'klf-username' : 'lm-username'} label="Username" icon={User} value={username} onChange={setUsername} autoComplete="username" autoFocus={kiosk} inputRef={usernameRef} />
                <div>
                  <Field
                    id={kiosk ? 'klf-password' : 'lm-password'}
                    label="Password"
                    icon={KeyRound}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                    onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                    trailing={(
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    )}
                  />
                  {capsLock && <p className="mt-2 text-xs font-medium text-amber-700">Caps Lock aktif</p>}
                </div>

                {error && (
                  <p role="alert" className="flex items-start gap-2 text-[13px] leading-snug text-destructive">
                    <AlertCircle className="mt-px size-4 flex-none" /> {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="auth-submit group mt-1 flex h-[52px] w-full items-center justify-between rounded-full bg-primary pl-7 pr-2 text-[15px] font-semibold text-primary-foreground shadow-[0_10px_28px_color-mix(in_oklch,var(--primary)_32%,transparent)] transition hover:brightness-110 disabled:opacity-70"
                >
                  {submitting ? 'Memproses…' : 'Masuk'}
                  <span className="grid size-10 place-items-center rounded-full bg-primary-foreground/15">
                    {submitting ? <Loader2 className="size-[18px] animate-spin" /> : <ArrowRight className="auth-submit-arrow size-[18px]" />}
                  </span>
                </button>
              </form>

              <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-[12.5px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><LockKeyhole className="size-3.5" /> {kiosk ? 'Khusus perangkat kiosk resmi' : 'Internal · ISO/IEC 27001'}</span>
                <span>Lupa password? <span className="font-semibold text-[color:var(--p-600)]">Hubungi Admin ISM</span></span>
              </div>
              {onBack && (
                <button type="button" onClick={onBack} className="mt-4 flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition hover:text-foreground">
                  <ArrowLeft className="size-3.5" /> Kembali ke portal
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
