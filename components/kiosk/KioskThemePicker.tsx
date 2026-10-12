// components/kiosk/KioskThemePicker.tsx
'use client'

// "Tema" in the header of Admin Lobby / Pos Security: the post's own account
// picks the colours of its page itself — no ISM Admin needed. It only changes
// that post's page; the portal and the other post keep theirs.

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, Palette, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import {
  KIOSK_THEME_ATTR,
  THEME_GROUPS,
  THEME_PRESETS,
  THEME_TARGET_LABEL,
  applyThemeVars,
  computeThemeVars,
  kioskThemeStorageKey,
  themeSwatches,
  type KioskThemeTarget,
  type ThemeParams,
} from '@/lib/theme'

type StoredTheme = { params: ThemeParams; presetId: string | null; own: boolean }
// 'portal' = no theme of its own
type Choice = { kind: 'portal' } | { kind: 'preset'; id: string }

export function KioskThemePicker({ station }: { station: KioskThemeTarget }) {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<StoredTheme | null>(null)
  const [portalParams, setPortalParams] = useState<ThemeParams | null>(null)
  const [choice, setChoice] = useState<Choice | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // what the page showed when the dialog opened — put back on "Batal"
  const shown = useRef<ThemeParams | null>(null)
  const name = THEME_TARGET_LABEL[station]

  const close = () => {
    if (shown.current) applyThemeVars(computeThemeVars(shown.current))
    setOpen(false)
  }
  useEscapeClose(open, close)

  useEffect(() => {
    if (!open) return
    setError(null)
    setChoice(null)
    Promise.all([
      fetch(`${API_BASE_PATH}/api/theme?target=${station}`, { cache: 'no-store' }).then((res) => res.json()),
      fetch(`${API_BASE_PATH}/api/theme`, { cache: 'no-store' }).then((res) => res.json()),
    ])
      .then(([mine, portal]: [{ theme: StoredTheme }, { theme: StoredTheme }]) => {
        setSaved(mine.theme)
        setPortalParams(portal.theme.params)
        shown.current = mine.theme.params
        setChoice(mine.theme.own && mine.theme.presetId ? { kind: 'preset', id: mine.theme.presetId } : mine.theme.own ? null : { kind: 'portal' })
      })
      .catch(() => setError('Gagal memuat tema.'))
  }, [open, station])

  // Live preview of the pick on the page behind the dialog.
  const pick = (next: Choice) => {
    setChoice(next)
    const params = next.kind === 'portal' ? portalParams : THEME_PRESETS.find((preset) => preset.id === next.id)?.params
    if (params) applyThemeVars(computeThemeVars(params))
  }

  const unchanged = !choice || !saved || (choice.kind === 'portal' ? !saved.own : saved.own && saved.presetId === choice.id)

  const save = async () => {
    if (!choice) return
    setSaving(true)
    setError(null)
    try {
      const preset = choice.kind === 'preset' ? THEME_PRESETS.find((item) => item.id === choice.id) : null
      const res = choice.kind === 'portal'
        ? await fetch(`${API_BASE_PATH}/api/theme?target=${station}`, { method: 'DELETE', credentials: 'include' })
        : await fetch(`${API_BASE_PATH}/api/theme`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ target: station, presetId: preset!.id, params: preset!.params }),
          })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.message ?? 'Gagal menyimpan tema.'); return }
      const theme = data.theme as StoredTheme
      const vars = computeThemeVars(theme.params)
      applyThemeVars(vars)
      try {
        if (theme.own) { localStorage.setItem(kioskThemeStorageKey(station), JSON.stringify(vars)); document.documentElement.setAttribute(KIOSK_THEME_ATTR, station) }
        else { localStorage.removeItem(kioskThemeStorageKey(station)); document.documentElement.removeAttribute(KIOSK_THEME_ATTR) }
      } catch { /* storage unavailable */ }
      shown.current = theme.params
      setSaved(theme)
      setOpen(false)
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Tema" title={`Tema warna ${name}`} className="flex items-center gap-1.5 rounded-md border border-primary-foreground/20 px-2.5 py-2 text-xs transition-colors hover:bg-primary-foreground/10 sm:px-3">
        <Palette className="size-4" /><span className="hidden sm:inline">Tema</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 text-foreground">
          <div role="dialog" aria-modal="true" aria-label={`Tema ${name}`} className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between gap-3 bg-primary px-5 py-4 text-primary-foreground">
              <div className="min-w-0">
                <h2 className="text-base font-bold">Tema {name}</h2>
                <p className="text-xs text-primary-foreground/75">Hanya mengubah warna halaman {name}. Klik sebuah palet untuk melihatnya langsung.</p>
              </div>
              <button type="button" onClick={close} aria-label="Tutup" className="grid size-8 flex-shrink-0 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground">
                <X className="size-[18px]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {!saved && !error && <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}
              {saved && (
                <div className="flex flex-col gap-5">
                  <button
                    type="button"
                    aria-pressed={choice?.kind === 'portal'}
                    onClick={() => pick({ kind: 'portal' })}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${choice?.kind === 'portal' ? 'border-primary ring-2 ring-primary/25' : 'border-border hover:bg-secondary/40'}`}
                  >
                    <span>
                      <span className="block text-sm font-semibold text-foreground">Ikuti tema portal</span>
                      <span className="block text-xs text-muted-foreground">Warna halaman ini selalu sama dengan portal ISMS.</span>
                    </span>
                    {choice?.kind === 'portal' && <span className="grid size-6 flex-none place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" /></span>}
                  </button>
                  {saved.own && !saved.presetId && !choice && (
                    <p className="rounded-xl bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">Saat ini memakai warna racikan khusus dari Admin ISM. Memilih palet di bawah akan menggantinya.</p>
                  )}
                  {THEME_GROUPS.map((group) => (
                    <section key={group}>
                      <p className="portal-eyebrow mb-2">{group}</p>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        {THEME_PRESETS.filter((preset) => preset.group === group).map((preset) => {
                          const active = choice?.kind === 'preset' && choice.id === preset.id
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() => pick({ kind: 'preset', id: preset.id })}
                              className={`flex flex-col gap-2 rounded-xl border bg-card p-2.5 text-left transition hover:shadow-md ${active ? 'border-primary ring-2 ring-primary/25' : 'border-border'}`}
                            >
                              <span className="flex h-8 overflow-hidden rounded-lg border border-border">
                                {themeSwatches(preset.params).map((color, index) => <span key={index} className="flex-1" style={{ background: color }} />)}
                              </span>
                              <span className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-foreground">{preset.name}</span>
                                {active && <Check className="size-3.5 flex-none text-primary" />}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
              {error && <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button type="button" onClick={close} className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary">Batal</button>
              <button type="button" onClick={save} disabled={saving || unchanged} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Simpan tema
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
