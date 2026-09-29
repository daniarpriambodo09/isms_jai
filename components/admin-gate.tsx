// components/admin-gate.tsx
'use client'

import { Lock, ShieldCheck } from 'lucide-react'

export function AdminGate({
  title = 'Akses terbatas',
  message = 'Halaman ini khusus untuk admin yang sudah login. Masuk terlebih dahulu untuk melanjutkan.',
}: {
  title?: string
  message?: string
}) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl p-10 text-center"
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, color-mix(in oklch, var(--p-surface2) 99%, transparent) 100%)',
        boxShadow: '0 20px 50px color-mix(in oklch, var(--p-950) 12%, transparent), 0 0 0 1px color-mix(in oklch, var(--p-600) 12%, transparent)',
      }}
    >
      <style>{`
        @keyframes gate-ring-pulse {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes gate-cta-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .gate-ring { animation: gate-ring-pulse 2.2s ease-out infinite; }
        .gate-cta {
          transition: transform 180ms, box-shadow 180ms;
        }
        .gate-cta:hover {
          transform: translateY(-1px) scale(1.02);
          box-shadow: 0 10px 24px color-mix(in oklch, var(--p-600) 45%, transparent);
        }
        .gate-cta-shimmer {
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%);
          background-size: 200% auto;
          animation: gate-cta-shimmer 2.5s linear infinite;
        }
      `}</style>

      {/* Dot-grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: 'radial-gradient(circle, var(--p-600) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
      />

      <div className="relative mx-auto flex max-w-sm flex-col items-center gap-4">
        <div
          className="relative flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: 'linear-gradient(135deg, var(--p-700) 0%, var(--p-600) 100%)', boxShadow: '0 10px 26px color-mix(in oklch, var(--p-600) 35%, transparent)' }}
        >
          <span className="gate-ring absolute inset-0 rounded-2xl" style={{ border: '2px solid color-mix(in oklch, var(--p-600) 40%, transparent)' }} />
          <Lock className="h-7 w-7 text-white" />
        </div>

        <div>
          <h3 className="text-[16px] font-bold" style={{ color: 'var(--p-900)' }}>{title}</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--p-muted)' }}>{message}</p>
        </div>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-admin-login'))}
          className="gate-cta relative mt-1 inline-flex items-center gap-2 overflow-hidden rounded-full px-5 py-2.5 text-[13px] font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, var(--p-700) 0%, var(--p-600) 100%)', boxShadow: '0 6px 18px color-mix(in oklch, var(--p-600) 35%, transparent)' }}
        >
          <span className="gate-cta-shimmer pointer-events-none absolute inset-0" />
          <ShieldCheck className="relative h-4 w-4" />
          <span className="relative">Login Admin</span>
        </button>
      </div>
    </section>
  )
}
