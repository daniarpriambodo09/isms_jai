// lib/theme-store.ts
import 'server-only'
import { query } from '@/lib/db'
import { DEFAULT_THEME, sanitizeThemeParams, type ThemeParams, type ThemeTarget } from '@/lib/theme'

// Generic key/value settings table. Created on first use so a deploy
// doesn't need a separate migration step for it.
let ensured = false
async function ensureTable() {
  if (ensured) return
  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(60) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by VARCHAR(100)
    )
  `)
  ensured = true
}

// own: false on a post (lobby / security) that has no theme of its own — it
// then shows the portal's, which is what params / presetId hold.
export type StoredTheme = { params: ThemeParams; presetId: string | null; updatedAt: string | null; updatedBy: string | null; own: boolean }

const KEY: Record<ThemeTarget, string> = { portal: 'theme', lobby: 'theme_lobby', security: 'theme_security' }

async function readTheme(target: ThemeTarget) {
  const result = await query<{ value: { params?: unknown; presetId?: string | null }; updated_at: string; updated_by: string | null }>(
    'SELECT value, updated_at, updated_by FROM app_settings WHERE key = $1', [KEY[target]]
  )
  const row = result.rows[0]
  const params = row ? sanitizeThemeParams(row.value.params) : null
  return params ? { params, presetId: row!.value.presetId ?? null, updatedAt: row!.updated_at, updatedBy: row!.updated_by } : null
}

export async function getTheme(target: ThemeTarget = 'portal'): Promise<StoredTheme> {
  await ensureTable()
  if (target !== 'portal') {
    const own = await readTheme(target)
    if (own) return { ...own, own: true }
  }
  const portal = await readTheme('portal')
  return portal
    ? { ...portal, own: target === 'portal' }
    : { params: DEFAULT_THEME, presetId: 'teal-klasik', updatedAt: null, updatedBy: null, own: target === 'portal' }
}

export async function saveTheme(params: ThemeParams, presetId: string | null, username: string, target: ThemeTarget = 'portal'): Promise<StoredTheme> {
  await ensureTable()
  await query(
    `INSERT INTO app_settings (key, value, updated_at, updated_by)
     VALUES ($3, $1, now(), $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [JSON.stringify({ params, presetId }), username, KEY[target]]
  )
  return getTheme(target)
}

/** A post goes back to following the portal's theme. */
export async function clearKioskTheme(target: Exclude<ThemeTarget, 'portal'>): Promise<StoredTheme> {
  await ensureTable()
  await query('DELETE FROM app_settings WHERE key = $1', [KEY[target]])
  return getTheme(target)
}
