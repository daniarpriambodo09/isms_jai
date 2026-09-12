// app/global-error.tsx
'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

// Next.js requires global-error.tsx to render its own <html>/<body> — it
// replaces the ENTIRE root layout (including Navbar/PortalFrame) when a
// crash happens above the segment level that app/error.tsx can catch.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="id">
      <body style={{ margin: 0, background: '#f8fafc' }}>
        <div className="grid min-h-screen place-items-center p-6">
          <section
            className="relative w-full max-w-md overflow-hidden rounded-3xl p-10 text-center sm:p-16"
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(240,247,251,0.99) 100%)',
              boxShadow: '0 20px 50px rgba(14,34,53,0.12), 0 0 0 1px rgba(160,58,58,0.12)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{ backgroundImage: 'radial-gradient(circle, #a03a3a 1px, transparent 1px)', backgroundSize: '18px 18px' }}
            />

            <div className="relative mx-auto flex flex-col items-center gap-4">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-3xl"
                style={{ background: 'linear-gradient(135deg, #a03a3a 0%, #c24f3f 100%)', boxShadow: '0 10px 26px rgba(160,58,58,0.35)' }}
              >
                <AlertTriangle className="h-9 w-9 text-white" />
              </div>

              <div>
                <p className="text-[13px] font-bold uppercase tracking-[0.16em]" style={{ color: '#a03a3a' }}>Kesalahan sistem</p>
                <h1 className="mt-1 text-[22px] font-bold" style={{ color: '#12293a' }}>Aplikasi gagal dimuat</h1>
                <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: '#7290a5' }}>
                  Terjadi kesalahan yang tidak terduga. Coba muat ulang halaman — kalau masalah terus berlanjut, hubungi admin sistem ISMS.
                </p>
              </div>

              <button
                type="button"
                onClick={reset}
                className="mt-1 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                style={{ background: 'linear-gradient(135deg, #a03a3a 0%, #c24f3f 100%)', boxShadow: '0 6px 18px rgba(160,58,58,0.35)' }}
              >
                <RotateCw className="h-4 w-4" />
                Coba lagi
              </button>
            </div>
          </section>
        </div>
      </body>
    </html>
  )
}
