// lib/theme.ts
//
// Site-wide color theming. Every brand color the UI uses is a CSS variable
// whose default (in app/globals.css) is the original portal color. A theme
// never picks colors one by one — it rotates whole color *families* by the
// same hue offset (and scales their chroma), so every relationship the
// original palette had (light vs dark shades, text vs background contrast,
// primary vs accent contrast) carries over intact. That's what keeps any
// preset or custom pick looking matched instead of clashing.
//
// Families:
//   primary — the teal/navy family (brand fills, navy text, blue-grey muted
//             text, cool borders/surfaces) — reference hue 205
//   accent  — the orange highlight family                  — reference hue 55
//   neutral — the cream paper tones                        — reference hue 92
//
// Status colors (red/green/amber badges) are deliberately NOT variables, so
// they keep their meaning under every theme.

export type ThemeFamily = 'primary' | 'accent' | 'neutral'

export type ThemeParams = {
  primaryHue: number
  primaryChroma: number // multiplier, 1 = original saturation
  accentHue: number
  accentChroma: number
  neutralHue: number
  neutralChroma: number
}

export const REFERENCE_HUES = { primary: 205, accent: 55, neutral: 92 } as const

export const DEFAULT_THEME: ThemeParams = {
  primaryHue: 205,
  primaryChroma: 1,
  accentHue: 55,
  accentChroma: 1,
  neutralHue: 92,
  neutralChroma: 1,
}

// name → [default color, family]. Must stay in sync with :root in globals.css.
export const THEME_VARS: Record<string, [string, ThemeFamily]> = {
  // core tokens
  '--background': ['oklch(0.96 0.025 92)', 'neutral'],
  '--foreground': ['oklch(0.24 0.035 210)', 'primary'],
  '--card': ['oklch(0.985 0.018 88)', 'neutral'],
  '--card-foreground': ['oklch(0.24 0.035 210)', 'primary'],
  '--popover': ['oklch(0.985 0.018 88)', 'neutral'],
  '--popover-foreground': ['oklch(0.24 0.035 210)', 'primary'],
  '--primary': ['oklch(0.39 0.09 205)', 'primary'],
  '--primary-foreground': ['oklch(0.98 0.018 88)', 'neutral'],
  '--secondary': ['oklch(0.88 0.08 92)', 'neutral'],
  '--secondary-foreground': ['oklch(0.3 0.055 205)', 'primary'],
  '--muted': ['oklch(0.92 0.035 92)', 'neutral'],
  '--muted-foreground': ['oklch(0.5 0.04 205)', 'primary'],
  '--accent': ['oklch(0.7 0.15 55)', 'accent'],
  '--accent-foreground': ['oklch(0.25 0.05 55)', 'accent'],
  '--border': ['oklch(0.82 0.045 92)', 'neutral'],
  '--input': ['oklch(0.82 0.045 92)', 'neutral'],
  '--ring': ['oklch(0.58 0.12 180)', 'primary'],
  // brand shades used directly by components (formerly hardcoded hex)
  '--p-950': ['#0e2235', 'primary'],
  '--p-900': ['#12293a', 'primary'],
  '--p-850': ['#1a3a52', 'primary'],
  '--p-800': ['#20354a', 'primary'],
  '--p-750': ['#284360', 'primary'],
  '--p-700': ['#1a5f7a', 'primary'],
  '--p-600': ['#278e84', 'primary'],
  '--p-550': ['oklch(0.48 0.12 180)', 'primary'],
  '--p-500': ['oklch(0.58 0.14 165)', 'primary'],
  '--p-400': ['#48beb1', 'primary'],
  '--p-ink2': ['#3c5369', 'primary'],
  '--p-muted': ['#7290a5', 'primary'],
  '--p-muted2': ['#8798a8', 'primary'],
  '--p-border': ['#dce6ed', 'primary'],
  '--p-surface': ['#fbfcfd', 'primary'],
  '--p-surface2': ['#f0f4f7', 'primary'],
  '--p-tint': ['#d6f8f1', 'primary'],
  '--a-bright': ['oklch(0.75 0.18 50)', 'accent'],
}

// Ready-made palettes for Kelola Tema, grouped by the colour of the brand
// (primary) family. Each one is just six numbers — hue and saturation of the
// primary, accent and neutral families — from which every colour of the
// portal is derived (computeThemeVars), so all of them keep the same
// contrast between text and background as the original theme.
export const THEME_GROUPS = ['Biru', 'Hijau & Teal', 'Merah & Hangat', 'Ungu & Merah Muda', 'Netral'] as const
export type ThemeGroup = (typeof THEME_GROUPS)[number]
export type ThemePreset = { id: string; group: ThemeGroup; name: string; description: string; params: ThemeParams }

export const THEME_PRESETS: ThemePreset[] = [
  // ── Biru ──
  { id: 'navy-gold', group: 'Biru', name: 'Navy & Emas', description: 'Biru navy korporat dengan aksen emas.', params: { primaryHue: 258, primaryChroma: 1.05, accentHue: 80, accentChroma: 1, neutralHue: 88, neutralChroma: 0.8 } },
  { id: 'navy-coral', group: 'Biru', name: 'Navy & Koral', description: 'Navy tegas dengan aksen koral hangat.', params: { primaryHue: 262, primaryChroma: 1, accentHue: 30, accentChroma: 1.05, neutralHue: 85, neutralChroma: 0.85 } },
  { id: 'ocean-coral', group: 'Biru', name: 'Samudra & Koral', description: 'Biru laut cerah dengan aksen koral.', params: { primaryHue: 235, primaryChroma: 1.15, accentHue: 32, accentChroma: 1.05, neutralHue: 80, neutralChroma: 0.7 } },
  { id: 'royal-orange', group: 'Biru', name: 'Biru Royal & Jingga', description: 'Biru terang yang berani dengan aksen jingga.', params: { primaryHue: 255, primaryChroma: 1.25, accentHue: 52, accentChroma: 1.1, neutralHue: 250, neutralChroma: 0.35 } },
  { id: 'sky-sunflower', group: 'Biru', name: 'Langit & Bunga Matahari', description: 'Biru langit dengan aksen kuning cerah.', params: { primaryHue: 232, primaryChroma: 1.05, accentHue: 92, accentChroma: 1.1, neutralHue: 95, neutralChroma: 0.6 } },
  { id: 'indigo-amber', group: 'Biru', name: 'Indigo & Amber', description: 'Indigo dalam dengan aksen amber.', params: { primaryHue: 278, primaryChroma: 1.05, accentHue: 72, accentChroma: 1.05, neutralHue: 85, neutralChroma: 0.7 } },
  { id: 'midnight-cyan', group: 'Biru', name: 'Tengah Malam & Cyan', description: 'Biru gelap dengan aksen cyan segar.', params: { primaryHue: 266, primaryChroma: 0.9, accentHue: 210, accentChroma: 1.2, neutralHue: 240, neutralChroma: 0.5 } },
  { id: 'steel-tangerine', group: 'Biru', name: 'Baja & Jeruk', description: 'Biru keabuan yang tenang dengan aksen jeruk.', params: { primaryHue: 245, primaryChroma: 0.55, accentHue: 48, accentChroma: 1.15, neutralHue: 240, neutralChroma: 0.4 } },
  // ── Hijau & Teal ──
  { id: 'teal-klasik', group: 'Hijau & Teal', name: 'Teal Klasik', description: 'Warna asli portal — teal, cream, aksen oranye.', params: DEFAULT_THEME },
  { id: 'teal-rose', group: 'Hijau & Teal', name: 'Teal & Mawar', description: 'Teal dengan aksen merah mawar.', params: { primaryHue: 198, primaryChroma: 1, accentHue: 8, accentChroma: 1, neutralHue: 80, neutralChroma: 0.8 } },
  { id: 'aqua-fuchsia', group: 'Hijau & Teal', name: 'Aqua & Fuchsia', description: 'Aqua segar dengan aksen fuchsia.', params: { primaryHue: 212, primaryChroma: 1.1, accentHue: 345, accentChroma: 1.05, neutralHue: 220, neutralChroma: 0.45 } },
  { id: 'forest-amber', group: 'Hijau & Teal', name: 'Hutan & Amber', description: 'Hijau tua alami dengan aksen amber hangat.', params: { primaryHue: 150, primaryChroma: 0.95, accentHue: 62, accentChroma: 1, neutralHue: 95, neutralChroma: 1 } },
  { id: 'emerald-gold', group: 'Hijau & Teal', name: 'Zamrud & Emas', description: 'Hijau zamrud dengan aksen emas.', params: { primaryHue: 162, primaryChroma: 1.15, accentHue: 88, accentChroma: 1.05, neutralHue: 95, neutralChroma: 0.8 } },
  { id: 'pine-terracotta', group: 'Hijau & Teal', name: 'Pinus & Terakota', description: 'Hijau pinus dengan aksen terakota.', params: { primaryHue: 172, primaryChroma: 0.8, accentHue: 40, accentChroma: 1.05, neutralHue: 80, neutralChroma: 1 } },
  { id: 'olive-brick', group: 'Hijau & Teal', name: 'Zaitun & Bata', description: 'Hijau zaitun dengan aksen merah bata.', params: { primaryHue: 122, primaryChroma: 0.7, accentHue: 30, accentChroma: 1, neutralHue: 95, neutralChroma: 1.1 } },
  { id: 'sage-peach', group: 'Hijau & Teal', name: 'Sage & Persik', description: 'Hijau sage lembut dengan aksen persik.', params: { primaryHue: 152, primaryChroma: 0.5, accentHue: 50, accentChroma: 0.85, neutralHue: 90, neutralChroma: 0.9 } },
  // ── Merah & Hangat ──
  { id: 'burgundy-sand', group: 'Merah & Hangat', name: 'Burgundy & Pasir', description: 'Merah anggur klasik dengan aksen pasir keemasan.', params: { primaryHue: 20, primaryChroma: 1, accentHue: 85, accentChroma: 0.85, neutralHue: 75, neutralChroma: 1.1 } },
  { id: 'crimson-slate', group: 'Merah & Hangat', name: 'Merah & Batu', description: 'Merah tegas dengan aksen biru keabuan.', params: { primaryHue: 25, primaryChroma: 1.15, accentHue: 245, accentChroma: 0.7, neutralHue: 250, neutralChroma: 0.35 } },
  { id: 'maroon-gold', group: 'Merah & Hangat', name: 'Marun & Emas', description: 'Marun gelap dengan aksen emas.', params: { primaryHue: 12, primaryChroma: 0.9, accentHue: 86, accentChroma: 1.05, neutralHue: 80, neutralChroma: 0.9 } },
  { id: 'terracotta-teal', group: 'Merah & Hangat', name: 'Terakota & Teal', description: 'Terakota hangat dengan aksen teal.', params: { primaryHue: 42, primaryChroma: 0.95, accentHue: 198, accentChroma: 1, neutralHue: 85, neutralChroma: 1 } },
  { id: 'espresso-orange', group: 'Merah & Hangat', name: 'Espresso & Jingga', description: 'Cokelat kopi dengan aksen jingga.', params: { primaryHue: 52, primaryChroma: 0.6, accentHue: 55, accentChroma: 1.2, neutralHue: 85, neutralChroma: 1.1 } },
  { id: 'cocoa-cream', group: 'Merah & Hangat', name: 'Kakao & Krem', description: 'Cokelat lembut dengan aksen krem keemasan.', params: { primaryHue: 62, primaryChroma: 0.7, accentHue: 88, accentChroma: 0.9, neutralHue: 88, neutralChroma: 1.2 } },
  // ── Ungu & Merah Muda ──
  { id: 'plum-rose', group: 'Ungu & Merah Muda', name: 'Plum & Mawar', description: 'Ungu plum elegan dengan aksen mawar.', params: { primaryHue: 318, primaryChroma: 0.95, accentHue: 12, accentChroma: 1, neutralHue: 70, neutralChroma: 0.7 } },
  { id: 'violet-lime', group: 'Ungu & Merah Muda', name: 'Violet & Lime', description: 'Ungu violet dengan aksen lime.', params: { primaryHue: 296, primaryChroma: 1, accentHue: 125, accentChroma: 1.15, neutralHue: 300, neutralChroma: 0.3 } },
  { id: 'grape-gold', group: 'Ungu & Merah Muda', name: 'Anggur & Emas', description: 'Ungu anggur dengan aksen emas.', params: { primaryHue: 305, primaryChroma: 1.05, accentHue: 85, accentChroma: 1.05, neutralHue: 80, neutralChroma: 0.7 } },
  { id: 'lavender-mint', group: 'Ungu & Merah Muda', name: 'Lavender & Mint', description: 'Lavender lembut dengan aksen mint.', params: { primaryHue: 290, primaryChroma: 0.6, accentHue: 168, accentChroma: 0.85, neutralHue: 290, neutralChroma: 0.3 } },
  { id: 'magenta-teal', group: 'Ungu & Merah Muda', name: 'Magenta & Teal', description: 'Magenta berani dengan aksen teal.', params: { primaryHue: 340, primaryChroma: 1.05, accentHue: 196, accentChroma: 1.05, neutralHue: 330, neutralChroma: 0.3 } },
  { id: 'berry-peach', group: 'Ungu & Merah Muda', name: 'Beri & Persik', description: 'Merah beri dengan aksen persik.', params: { primaryHue: 355, primaryChroma: 0.95, accentHue: 55, accentChroma: 0.95, neutralHue: 60, neutralChroma: 0.8 } },
  // ── Netral ──
  { id: 'charcoal-lime', group: 'Netral', name: 'Arang & Lime', description: 'Hampir monokrom dengan aksen lime berani.', params: { primaryHue: 205, primaryChroma: 0.15, accentHue: 125, accentChroma: 1.25, neutralHue: 95, neutralChroma: 0.45 } },
  { id: 'graphite-orange', group: 'Netral', name: 'Grafit & Jingga', description: 'Abu grafit dengan aksen jingga.', params: { primaryHue: 250, primaryChroma: 0.15, accentHue: 50, accentChroma: 1.25, neutralHue: 250, neutralChroma: 0.25 } },
  { id: 'graphite-blue', group: 'Netral', name: 'Grafit & Biru', description: 'Abu grafit dengan aksen biru.', params: { primaryHue: 250, primaryChroma: 0.12, accentHue: 250, accentChroma: 1.2, neutralHue: 250, neutralChroma: 0.3 } },
  { id: 'ink-red', group: 'Netral', name: 'Tinta & Merah', description: 'Hitam tinta dengan aksen merah.', params: { primaryHue: 265, primaryChroma: 0.2, accentHue: 25, accentChroma: 1.25, neutralHue: 265, neutralChroma: 0.2 } },
  { id: 'stone-emerald', group: 'Netral', name: 'Batu & Zamrud', description: 'Abu hangat dengan aksen hijau zamrud.', params: { primaryHue: 80, primaryChroma: 0.15, accentHue: 160, accentChroma: 1.15, neutralHue: 85, neutralChroma: 0.7 } },
]

export type Harmony = 'complementary' | 'analogous' | 'triadic'

// Custom mode: the admin picks one primary hue; the accent is derived from it
// with a classic harmony rule so the pair always works together.
export function accentHueFor(primaryHue: number, harmony: Harmony) {
  const offset = harmony === 'analogous' ? 40 : harmony === 'triadic' ? 120 : -150 // -150 is the original teal→orange relation
  return normalizeHue(primaryHue + offset)
}

export type NeutralTone = 'warm' | 'neutral' | 'cool'
export const NEUTRAL_TONES: Record<NeutralTone, { hue: number; chroma: number; label: string }> = {
  warm: { hue: 92, chroma: 1, label: 'Hangat (cream)' },
  neutral: { hue: 92, chroma: 0.3, label: 'Netral (abu)' },
  cool: { hue: 235, chroma: 0.55, label: 'Sejuk (kebiruan)' },
}

// ─── color math (sRGB ↔ OKLCH) ───

function normalizeHue(h: number) {
  return ((h % 360) + 360) % 360
}

function srgbToLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function hexToOklch(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  const r = srgbToLinear(((n >> 16) & 255) / 255)
  const g = srgbToLinear(((n >> 8) & 255) / 255)
  const b = srgbToLinear((n & 255) / 255)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [L, Math.sqrt(A * A + B * B), normalizeHue((Math.atan2(B, A) * 180) / Math.PI)]
}

function parseColor(value: string): [number, number, number] {
  if (value.startsWith('#')) return hexToOklch(value)
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value)
  if (!m) throw new Error(`Unsupported theme color: ${value}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

const PARSED = Object.fromEntries(Object.entries(THEME_VARS).map(([name, [value, family]]) => [name, { lch: parseColor(value), family }]))

export function isDefaultTheme(params: ThemeParams) {
  return (Object.keys(DEFAULT_THEME) as (keyof ThemeParams)[]).every((key) => Math.abs(params[key] - DEFAULT_THEME[key]) < 1e-6)
}

// Returns only the overrides a theme needs; an empty object for the default
// theme, so the untouched original colors in globals.css apply as-is.
export function computeThemeVars(params: ThemeParams): Record<string, string> {
  if (isDefaultTheme(params)) return {}
  const shift = {
    primary: { hue: params.primaryHue - REFERENCE_HUES.primary, chroma: params.primaryChroma },
    accent: { hue: params.accentHue - REFERENCE_HUES.accent, chroma: params.accentChroma },
    neutral: { hue: params.neutralHue - REFERENCE_HUES.neutral, chroma: params.neutralChroma },
  }
  const out: Record<string, string> = {}
  for (const [name, { lch, family }] of Object.entries(PARSED)) {
    const [L, C, H] = lch
    const { hue, chroma } = shift[family]
    out[name] = `oklch(${L.toFixed(4)} ${(C * chroma).toFixed(4)} ${normalizeHue(H + hue).toFixed(2)})`
  }
  return out
}

// Swatch preview for a set of params (used by the settings page).
export function themeSwatches(params: ThemeParams) {
  const vars = computeThemeVars(params)
  const pick = (name: string) => vars[name] ?? THEME_VARS[name][0]
  return [pick('--p-850'), pick('--primary'), pick('--p-600'), pick('--accent'), pick('--background')]
}

export function sanitizeThemeParams(raw: unknown): ThemeParams | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const num = (key: keyof ThemeParams, min: number, max: number) => {
    const v = Number(r[key])
    return Number.isFinite(v) && v >= min && v <= max ? v : null
  }
  const parsed = {
    primaryHue: num('primaryHue', 0, 360),
    primaryChroma: num('primaryChroma', 0, 2),
    accentHue: num('accentHue', 0, 360),
    accentChroma: num('accentChroma', 0, 2),
    neutralHue: num('neutralHue', 0, 360),
    neutralChroma: num('neutralChroma', 0, 2),
  }
  return Object.values(parsed).some((v) => v === null) ? null : (parsed as ThemeParams)
}

export const THEME_STORAGE_KEY = 'isms-theme-vars'

// Inlined into <head> by app/layout.tsx: paints the cached theme before first
// paint so there's no flash of the default colors. Plain, dependency-free JS.
export const THEME_BOOT_SCRIPT = `try{var v=JSON.parse(localStorage.getItem('${THEME_STORAGE_KEY}')||'{}');for(var k in v){document.documentElement.style.setProperty(k,v[k])}}catch(e){}`

// Applies overrides to <html>, clearing any var the new theme doesn't set.
export function applyThemeVars(vars: Record<string, string>) {
  const root = document.documentElement
  for (const name of Object.keys(THEME_VARS)) {
    if (vars[name]) root.style.setProperty(name, vars[name])
    else root.style.removeProperty(name)
  }
}
