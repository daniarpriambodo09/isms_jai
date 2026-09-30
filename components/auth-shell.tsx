// components/auth-shell.tsx
//
// Shared look for every login screen (admin modal + Lobby/Security kiosks).
// Layout follows scrolltide.co's sign-in — glow from above, drifting colour
// haze, brand mark above a hairline card, solid primary button — but every
// colour is a portal theme token (--background, --card, --primary, --accent,
// --p-*), so it reads as the ISMS portal and follows Tema Warna.
'use client'

import { ShieldCheck } from 'lucide-react'

// Fine paper grain over the stage.
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")"

export const AUTH_ACCENT_TEXT = 'text-[color:var(--p-600)]'

export function AuthStyles() {
  return (
    <style>{`
      @keyframes auth-drift-a { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(4%, -3%) scale(1.08); } }
      @keyframes auth-drift-b { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-4%, 3%) scale(1.06); } }
      .auth-haze-a { animation: auth-drift-a 16s ease-in-out infinite; }
      .auth-haze-b { animation: auth-drift-b 19s ease-in-out infinite; }
      .auth-input {
        height: 44px; width: 100%; border-radius: 10px;
        border: 1px solid var(--border); background: var(--background); color: var(--foreground);
        font-size: 14px; outline: none; padding: 0 14px;
        transition: border-color 160ms, box-shadow 160ms, background 160ms;
      }
      .auth-input::placeholder { color: var(--muted-foreground); opacity: 0.7; }
      .auth-input:hover { border-color: color-mix(in oklch, var(--p-600) 35%, var(--border)); }
      .auth-input:focus {
        border-color: var(--p-600);
        box-shadow: 0 0 0 4px color-mix(in oklch, var(--p-600) 16%, transparent);
        background: var(--card);
      }
      .auth-primary { background: var(--primary); color: var(--primary-foreground); transition: filter 160ms, box-shadow 160ms, transform 160ms; }
      .auth-primary:not(:disabled):hover { filter: brightness(1.1); box-shadow: 0 8px 22px color-mix(in oklch, var(--primary) 30%, transparent); transform: translateY(-1px); }
      .auth-primary:disabled { opacity: 0.7; cursor: not-allowed; }
      @keyframes auth-pop { 0% { opacity: 0; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes auth-circle { from { stroke-dashoffset: 152; } to { stroke-dashoffset: 0; } }
      @keyframes auth-check { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } }
      @keyframes auth-ring { 0% { transform: scale(0.8); opacity: 0.5; } 100% { transform: scale(1.8); opacity: 0; } }
      @keyframes auth-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
      .auth-rise { animation: auth-rise 420ms cubic-bezier(0.22, 1, 0.36, 1) both; }
      .auth-success { animation: auth-pop 280ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
      .auth-success-circle { stroke: var(--p-600); stroke-width: 3; stroke-dasharray: 152; stroke-dashoffset: 152; animation: auth-circle 550ms ease-out 100ms forwards; }
      .auth-success-check { stroke: var(--primary); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 40; stroke-dashoffset: 40; animation: auth-check 320ms ease-out 600ms forwards; }
      .auth-success-ring { border: 1.5px solid color-mix(in oklch, var(--p-600) 55%, transparent); animation: auth-ring 1500ms ease-out infinite; }
      @media (prefers-reduced-motion: reduce) { .auth-haze-a, .auth-haze-b, .auth-success-ring, .auth-rise { animation: none; } }
    `}</style>
  )
}

// Theme stage: cream page background, a teal glow from above, drifting
// accent/teal haze, a faint dot grid and paper grain.
export function AuthBackdrop({ onClick }: { onClick?: () => void }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-background" onClick={onClick}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, color-mix(in oklch, var(--p-600) 22%, transparent) 0%, transparent 70%)' }} />
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: 'radial-gradient(color-mix(in oklch, var(--p-700) 18%, transparent) 1px, transparent 1.4px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 65% 60% at 50% 45%, black 0%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 65% 60% at 50% 45%, black 0%, transparent 80%)',
        }}
      />
      <div className="auth-haze-a pointer-events-none absolute -bottom-40 -left-40 h-[36rem] w-[36rem] rounded-full opacity-[0.28] blur-[120px]" style={{ background: 'var(--accent)' }} />
      <div className="auth-haze-b pointer-events-none absolute -right-40 top-1/4 h-[32rem] w-[32rem] rounded-full opacity-[0.22] blur-[120px]" style={{ background: 'var(--p-500)' }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-multiply" style={{ backgroundImage: GRAIN }} />
    </div>
  )
}

// Brand mark above the card — teal tile + two-tone wordmark.
export function AuthBrand({ suffix = 'portal' }: { suffix?: string }) {
  return (
    <div className="mb-7 flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-[10px] bg-primary text-primary-foreground shadow-[0_6px_16px_color-mix(in_oklch,var(--primary)_30%,transparent)]">
        <ShieldCheck className="size-[18px]" />
      </span>
      <span className="font-display text-[19px] font-semibold tracking-tight text-foreground">
        ISMS<span className={AUTH_ACCENT_TEXT}>{suffix}</span>
      </span>
    </div>
  )
}

// Card with a thin primary→accent bar along the top edge.
export const AUTH_CARD = "relative w-full overflow-hidden rounded-2xl border border-border bg-card/95 p-7 shadow-[0_24px_70px_color-mix(in_oklch,var(--p-950)_14%,transparent)] backdrop-blur-sm before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-[linear-gradient(90deg,var(--primary),var(--p-600),var(--accent))] before:content-['']"

export function AuthSuccess({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="auth-success absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-card">
      <div className="relative flex size-20 items-center justify-center">
        <span className="auth-success-ring absolute inset-0 rounded-full" />
        <svg viewBox="0 0 52 52" className="size-14">
          <circle className="auth-success-circle" cx="26" cy="26" r="24" fill="none" />
          <path className="auth-success-check" fill="none" d="M14 27l7 7 16-16" />
        </svg>
      </div>
      <p className="font-display text-[17px] font-semibold text-foreground">{title}</p>
      <p className="text-[12.5px] text-muted-foreground">{subtitle}</p>
    </div>
  )
}
