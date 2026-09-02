// app/pengaturan/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, RotateCcw, Settings } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'

const NAV_ITEMS: { key: string; description: string }[] = [
  { key: 'home',             description: 'Menu utama / halaman beranda' },
  { key: 'kebijakan',        description: 'Kebijakan Dasar ISMS' },
  { key: 'prosedur',         description: 'Prosedur ISMS' },
  { key: 'working_standard', description: 'Working Standard (TMMIN)' },
  { key: 'edukasi',          description: 'Edukasi & Pelatihan' },
  { key: 'form_cs',          description: 'Form & Kontrol CS (label dropdown)' },
  { key: 'departemen',       description: 'Departemen (label dropdown)' },
]

const DEFAULT_LABELS: Record<string, string> = {
  home:             'Home',
  kebijakan:        'ISMS Basic Policy',
  prosedur:         'ISMS Procedures',
  working_standard: 'Working Standard',
  edukasi:          'Education & Training',
  form_cs:          'Forms & CS Control',
  departemen:       'Departments',
}

type Status = 'idle' | 'saving' | 'saved' | 'error'

export default function PengaturanPage() {
  const { isLoggedIn, isLoading } = useAuth()
  const router = useRouter()

  const [labels, setLabels] = useState<Record<string, string>>(DEFAULT_LABELS)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!isLoading && !isLoggedIn) router.replace('/')
  }, [isLoading, isLoggedIn, router])

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/nav-labels`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { labels: DEFAULT_LABELS }))
      .then((d: { labels: Record<string, string> }) =>
        setLabels({ ...DEFAULT_LABELS, ...d.labels })
      )
      .catch(() => {})
      .finally(() => setFetchLoading(false))
  }, [])

  if (isLoading || !isLoggedIn) return null

  const handleChange = (key: string, value: string) => {
    setLabels((prev) => ({ ...prev, [key]: value }))
    setStatus('idle')
  }

  const handleReset = (key: string) => {
    setLabels((prev) => ({ ...prev, [key]: DEFAULT_LABELS[key] }))
    setStatus('idle')
  }

  const handleSave = async () => {
    setStatus('saving')
    setErrorMsg('')
    try {
      const body = Object.entries(labels).map(([key, label]) => ({ key, label }))
      const res = await fetch(`${API_BASE_PATH}/api/nav-labels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Gagal menyimpan.')
      }
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2500)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Terjadi kesalahan.')
      setStatus('error')
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <span
              className="flex size-11 items-center justify-center rounded-xl"
              style={{
                background: 'linear-gradient(135deg, oklch(0.39 0.09 205 / 18%) 0%, oklch(0.48 0.12 180 / 10%) 100%)',
                border: '1px solid oklch(0.39 0.09 205 / 22%)',
              }}
            >
              <Settings className="size-5" style={{ color: 'oklch(0.48 0.12 180)' }} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Pengaturan Admin
              </p>
              <h1 className="text-xl font-bold text-foreground">Kelola Nama Menu Navbar</h1>
            </div>
          </div>
          <p className="ml-[56px] text-sm text-muted-foreground">
            Ubah teks yang tampil di menu navigasi. Perubahan langsung berlaku untuk semua pengguna.
          </p>
        </div>

        {/* Form */}
        {fetchLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Label Menu Navbar
              </p>
            </div>

            <div className="divide-y divide-border">
              {NAV_ITEMS.map(({ key, description }) => (
                <div key={key} className="flex items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-xs text-muted-foreground">{description}</p>
                    <input
                      id={`nav-label-${key}`}
                      type="text"
                      value={labels[key] ?? ''}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                      placeholder={DEFAULT_LABELS[key]}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleReset(key)}
                    title="Reset ke default"
                    className="mt-5 grid size-9 flex-none place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    <RotateCcw className="size-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border px-5 py-4">
              {status === 'error' && (
                <p className="text-sm text-destructive">{errorMsg}</p>
              )}
              {status === 'saved' && (
                <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <Check className="size-4" /> Perubahan disimpan
                </p>
              )}
              {(status === 'idle' || status === 'saving') && <span />}

              <button
                type="button"
                onClick={handleSave}
                disabled={status === 'saving'}
                className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.39 0.09 205) 0%, oklch(0.48 0.12 180) 100%)',
                  boxShadow: '0 3px 12px oklch(0.39 0.09 205 / 35%)',
                }}
              >
                {status === 'saving' && <Loader2 className="size-4 animate-spin" />}
                Simpan Perubahan
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
