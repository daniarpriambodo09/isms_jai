// components/admin-welcome.tsx
//
// "Masuk sebagai admin" — the moment right after a successful login. A dark
// curtain in the theme colours covers the screen, a shield draws itself and
// gets its check mark, the admin is greeted by name and role, then the
// curtain parts like a pair of doors onto the portal, now in admin mode.
//
// Mounted once in app/layout.tsx. The login form (components/auth-shell.tsx)
// fires it with welcomeAdmin() the instant the server accepts the password;
// the login screen closes underneath while the curtain is shut. Under
// prefers-reduced-motion it is a short plain fade. (.welcome-* in globals.css)
'use client'

import { useEffect, useState } from 'react'
import { useAuth, type AdminRole } from '@/context/AuthContext'

const EVENT = 'isms-admin-welcome'
/** Whole sequence; the doors start opening at OPEN_AT. Keep in step with globals.css. */
const TOTAL_MS = 2500
const REDUCED_MS = 1100
/** When the curtain is fully shut — the login screen can go away behind it. */
export const WELCOME_COVERED_MS = 420

const ROLE_LABEL: Record<AdminRole, string> = {
  ism_admin: 'ISM Admin',
  lobby: 'Admin Lobby',
  security: 'Pos Security',
}

export function welcomeAdmin(username: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { username } }))
}

export function AdminWelcome() {
  const { adminUser } = useAuth()
  const [run, setRun] = useState<{ id: number; username: string; reduced: boolean } | null>(null)

  useEffect(() => {
    let timer = 0
    const onWelcome = (event: Event) => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const username = (event as CustomEvent<{ username: string }>).detail?.username ?? ''
      window.clearTimeout(timer)
      setRun({ id: Date.now(), username, reduced })
      timer = window.setTimeout(() => setRun(null), reduced ? REDUCED_MS : TOTAL_MS)
    }
    window.addEventListener(EVENT, onWelcome)
    return () => { window.removeEventListener(EVENT, onWelcome); window.clearTimeout(timer) }
  }, [])

  if (!run) return null

  const name = adminUser?.username || run.username
  const role = adminUser ? ROLE_LABEL[adminUser.role] : 'Admin'

  return (
    <div
      key={run.id}
      role="status"
      aria-live="polite"
      aria-label={`Login berhasil. Selamat datang, ${name}.`}
      className={`welcome fixed inset-0 z-[95] overflow-hidden ${run.reduced ? 'welcome-reduced' : ''}`}
    >
      {/* The two doors */}
      <div aria-hidden className="welcome-door welcome-door-left absolute inset-y-0 left-0 w-1/2 bg-[color:var(--p-950)]" />
      <div aria-hidden className="welcome-door welcome-door-right absolute inset-y-0 right-0 w-1/2 bg-[color:var(--p-950)]" />
      {/* Seam of light where they meet */}
      <div aria-hidden className="welcome-seam absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[color:color-mix(in_oklch,var(--accent)_70%,white)]" />

      <div className="welcome-content absolute inset-0 grid place-items-center px-6 text-center text-white">
        <div>
          <div className="relative mx-auto size-24">
            <span aria-hidden className="welcome-ring absolute inset-0 rounded-full border border-white/25" />
            <svg viewBox="0 0 64 64" className="relative size-24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path className="welcome-shield" pathLength={1} d="M32 6 L54 14 V30 C54 44 44.5 53.5 32 58 C19.5 53.5 10 44 10 30 V14 Z" stroke="color-mix(in oklch, var(--accent) 80%, white)" strokeWidth="2.4" />
              <path className="welcome-check" pathLength={1} d="M22 32.5 l7.5 7.5 L43 25.5" stroke="white" strokeWidth="3.4" />
            </svg>
          </div>

          <p className="welcome-line-1 mt-7 font-mono-label text-[10.5px] tracking-[0.22em] text-white/55">Login berhasil · Selamat datang</p>
          <p className="welcome-line-2 mt-3 font-display text-[clamp(2.2rem,6.5vw,4.4rem)] font-semibold leading-none">
            {name}<span className="text-[color:color-mix(in_oklch,var(--accent)_80%,white)]">.</span>
          </p>
          <p className="welcome-line-3 mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-white/85">
            <span className="size-1.5 rounded-full bg-[color:color-mix(in_oklch,var(--accent)_80%,white)]" />
            Masuk sebagai {role}
          </p>

          <span aria-hidden className="mx-auto mt-8 block h-[2px] w-40 overflow-hidden rounded-full bg-white/12">
            <span className="welcome-progress block h-full w-full origin-left bg-[color:color-mix(in_oklch,var(--accent)_80%,white)]" />
          </span>
        </div>
      </div>
    </div>
  )
}
