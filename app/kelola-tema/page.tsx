// app/kelola-tema/page.tsx

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, Palette, RotateCcw, Save, Sparkles } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { AdminGate } from '@/components/admin-gate'
import {
  DEFAULT_THEME,
  NEUTRAL_TONES,
  THEME_PRESETS,
  THEME_STORAGE_KEY,
  accentHueFor,
  applyThemeVars,
  computeThemeVars,
  themeSwatches,
  type Harmony,
  type NeutralTone,
  type ThemeParams,
} from '@/lib/theme'

type StoredTheme = { params: ThemeParams; presetId: string | null; updatedAt: string | null; updatedBy: string | null }

const HARMONIES: { id: Harmony; label: string; hint: string }[] = [
  { id: 'complementary', label: 'Komplementer', hint: 'Aksen berseberangan — kontras kuat (seperti teal & oranye asli).' },
  { id: 'analogous', label: 'Analog', hint: 'Aksen bertetangga — kalem dan menyatu.' },
  { id: 'triadic', label: 'Triadik', hint: 'Aksen sepertiga lingkaran — ceria tapi seimbang.' },
]

// Rainbow track for the hue slider, at the same lightness/chroma the
// primary color sits at so the slider shows what you'll actually get.
const HUE_TRACK = `linear-gradient(90deg, ${Array.from({ length: 13 }, (_, i) => `oklch(0.52 0.12 ${i * 30})`).join(', ')})`

function guessHarmony(params: ThemeParams): Harmony {
  const diff = (((params.accentHue - params.primaryHue) % 360) + 360) % 360
  if (Math.abs(diff - 40) < 15) return 'analogous'
  if (Math.abs(diff - 120) < 15) return 'triadic'
  return 'complementary'
}

function guessNeutral(params: ThemeParams): NeutralTone {
  return (Object.entries(NEUTRAL_TONES) as [NeutralTone, (typeof NEUTRAL_TONES)[NeutralTone]][]).reduce((best, [id, tone]) =>
    Math.abs(tone.hue - params.neutralHue) + Math.abs(tone.chroma - params.neutralChroma) * 100 <
    Math.abs(NEUTRAL_TONES[best].hue - params.neutralHue) + Math.abs(NEUTRAL_TONES[best].chroma - params.neutralChroma) * 100
      ? id
      : best, 'warm' as NeutralTone)
}

function Swatches({ colors, size = 'md' }: { colors: string[]; size?: 'sm' | 'md' }) {
  return (
    <div className={`flex overflow-hidden rounded-xl border border-border ${size === 'sm' ? 'h-8' : 'h-12'}`}>
      {colors.map((color, i) => (
        <span key={i} className="flex-1" style={{ background: color }} />
      ))}
    </div>
  )
}

export default function KelolaTemaPage() {
  const { isLoggedIn, isLoading, adminUser } = useAuth()
  const [saved, setSaved] = useState<StoredTheme | null>(null)
  const [mode, setMode] = useState<'preset' | 'custom'>('preset')
  const [presetId, setPresetId] = useState('teal-klasik')
  const [hue, setHue] = useState(205)
  const [saturation, setSaturation] = useState(1)
  const [harmony, setHarmony] = useState<Harmony>('complementary')
  const [neutral, setNeutral] = useState<NeutralTone>('warm')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const savedRef = useRef<StoredTheme | null>(null)

  const isAdmin = adminUser?.role === 'ism_admin'

  useEffect(() => {
    if (!isAdmin) return
    fetch(`${API_BASE_PATH}/api/theme`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { theme: StoredTheme }) => {
        const theme = data.theme
        setSaved(theme)
        savedRef.current = theme
        const p = theme.params
        setHue(p.primaryHue)
        setSaturation(p.primaryChroma)
        setHarmony(guessHarmony(p))
        setNeutral(guessNeutral(p))
        if (theme.presetId) { setMode('preset'); setPresetId(theme.presetId) } else { setMode('custom') }
      })
      .catch(() => setMessage({ tone: 'error', text: 'Gagal memuat tema saat ini.' }))
  }, [isAdmin])

  const params: ThemeParams = useMemo(() => {
    if (mode === 'preset') return THEME_PRESETS.find((p) => p.id === presetId)?.params ?? DEFAULT_THEME
    const tone = NEUTRAL_TONES[neutral]
    return {
      primaryHue: hue,
      primaryChroma: saturation,
      accentHue: accentHueFor(hue, harmony),
      accentChroma: Math.min(1.3, 0.75 + saturation * 0.25),
      neutralHue: tone.hue,
      neutralChroma: tone.chroma,
    }
  }, [mode, presetId, hue, saturation, harmony, neutral])

  // Live preview: the whole page (navbar, header, this form) repaints as you pick.
  useEffect(() => {
    if (saved) applyThemeVars(computeThemeVars(params))
  }, [params, saved])

  // Leaving without saving puts the saved site theme back.
  useEffect(() => () => {
    if (savedRef.current) applyThemeVars(computeThemeVars(savedRef.current.params))
  }, [])

  const isDirty = saved !== null && JSON.stringify(params) !== JSON.stringify(saved.params)

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/theme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ params, presetId: mode === 'preset' ? presetId : null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Gagal menyimpan tema.')
      setSaved(data.theme)
      savedRef.current = data.theme
      try { localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(computeThemeVars(data.theme.params))) } catch { /* storage unavailable */ }
      setMessage({ tone: 'ok', text: 'Tema disimpan — semua pengguna akan melihat warna ini saat membuka portal.' })
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Terjadi kesalahan.' })
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    if (!saved) return
    const p = saved.params
    setHue(p.primaryHue); setSaturation(p.primaryChroma); setHarmony(guessHarmony(p)); setNeutral(guessNeutral(p))
    if (saved.presetId) { setMode('preset'); setPresetId(saved.presetId) } else { setMode('custom') }
    setMessage(null)
  }

  if (!isLoading && !isLoggedIn) return <AdminGate />
  if (!isLoading && adminUser && !isAdmin) return <AdminGate title="Akses terbatas" message="Halaman ini hanya untuk akun ISM Admin." />

  return (
    <div className="flex flex-col gap-7">
      <header className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8">
        <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-accent opacity-25 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
            <Palette className="size-3.5" /> Admin workspace
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Tema warna portal</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">
            Pilih palet siap pakai atau racik sendiri dari satu warna dasar — warna pendamping, teks, garis, dan latar ikut dihitung otomatis supaya selalu serasi. Perubahan langsung terlihat di halaman ini sebagai pratinjau; klik Simpan untuk menerapkannya ke semua pengguna.
          </p>
        </div>
      </header>

      {!saved ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-3 size-6 animate-spin" />Memuat tema…</div>
      ) : (
        <>
          {/* Mode switch */}
          <div className="inline-flex w-fit rounded-full border border-border bg-card p-1">
            {(['preset', 'custom'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {m === 'preset' ? 'Palet siap pakai' : 'Racik sendiri'}
              </button>
            ))}
          </div>

          {mode === 'preset' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {THEME_PRESETS.map((preset) => {
                const active = presetId === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setPresetId(preset.id)}
                    className={`group flex flex-col gap-3 rounded-2xl border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${active ? 'border-primary ring-2 ring-primary/25' : 'border-border'}`}
                  >
                    <Swatches colors={themeSwatches(preset.params)} />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{preset.name}</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{preset.description}</p>
                      </div>
                      {active && <span className="grid size-6 flex-none place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" /></span>}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
              <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Warna dasar</p>
                    <span className="font-mono-label text-[11px] text-muted-foreground">{Math.round(hue)}°</span>
                  </div>
                  <input
                    type="range" min={0} max={359} value={hue}
                    onChange={(e) => setHue(Number(e.target.value))}
                    aria-label="Warna dasar"
                    className="h-3 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
                    style={{ background: HUE_TRACK }}
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Kepekatan warna</p>
                    <span className="font-mono-label text-[11px] text-muted-foreground">{Math.round(saturation * 100)}%</span>
                  </div>
                  <input
                    type="range" min={0.1} max={1.4} step={0.05} value={saturation}
                    onChange={(e) => setSaturation(Number(e.target.value))}
                    aria-label="Kepekatan warna"
                    className="w-full cursor-pointer accent-[color:var(--primary)]"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Geser ke kiri untuk nuansa kalem/monokrom, ke kanan untuk lebih berani.</p>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-foreground">Warna aksen (otomatis serasi)</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {HARMONIES.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setHarmony(h.id)}
                        className={`rounded-xl border p-3 text-left transition ${harmony === h.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:bg-secondary/40'}`}
                      >
                        <p className="text-sm font-semibold text-foreground">{h.label}</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{h.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-foreground">Nuansa latar</p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(NEUTRAL_TONES) as [NeutralTone, (typeof NEUTRAL_TONES)[NeutralTone]][]).map(([id, tone]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setNeutral(id)}
                        className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${neutral === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-secondary/40'}`}
                      >
                        {tone.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-semibold text-foreground">Palet yang dihasilkan</p>
                <Swatches colors={themeSwatches(params)} />
                <p className="text-xs leading-5 text-muted-foreground">Semua warna diturunkan dari warna dasar dengan aturan yang sama seperti palet asli, jadi kontras teks dan latar tetap terjaga.</p>
              </div>
            </div>
          )}

          {/* Live preview of common UI pieces */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="portal-eyebrow mb-4">Pratinjau</p>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm text-primary-foreground">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[color:var(--p-800)]">LOGO</span>
                <span className="rounded-full bg-accent px-3 py-1 font-medium text-white">Menu aktif</span>
                <span className="px-2 text-primary-foreground/70">Menu</span>
                <span className="px-2 text-primary-foreground/70">Menu</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Tombol utama</button>
                <button type="button" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">Tombol aksen</button>
                <button type="button" className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground">Tombol garis</button>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">Badge</span>
                <span className="text-sm font-semibold text-[color:var(--p-600)]">Tautan</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="table-head-gradient px-4 py-2.5 font-mono-label text-[10px] text-muted-foreground">No. Kontrol · Nama Dokumen · Revisi</div>
                <div className="flex items-center gap-3 px-4 py-3 text-sm text-foreground"><Sparkles className="size-4 text-[color:var(--p-600)]" /> Contoh baris tabel dokumen</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
            <div className="text-xs text-muted-foreground">
              {message ? (
                <span className={message.tone === 'ok' ? 'font-medium text-[color:var(--p-600)]' : 'font-medium text-destructive'}>{message.text}</span>
              ) : isDirty ? (
                'Pratinjau belum disimpan — hanya kamu yang melihatnya.'
              ) : saved.updatedAt ? (
                `Tema aktif · diubah ${new Date(saved.updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}${saved.updatedBy ? ` oleh ${saved.updatedBy}` : ''}`
              ) : (
                'Tema aktif · Teal Klasik (bawaan)'
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setMode('preset'); setPresetId('teal-klasik') }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary/40"
              >
                <RotateCcw className="size-4" /> Warna bawaan
              </button>
              {isDirty && (
                <button type="button" onClick={discard} className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary/40">
                  Batalkan pratinjau
                </button>
              )}
              <button
                type="button"
                onClick={save}
                disabled={!isDirty || saving}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan untuk semua
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
