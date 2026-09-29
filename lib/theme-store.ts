// lib/theme-store.ts
import 'server-only'
import { query } from '@/lib/db'
import { DEFAULT_THEME, sanitizeThemeParams, type ThemeParams } from '@/lib/theme'

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

export type StoredTheme = { params: ThemeParams; presetId: string | null; updatedAt: string | null; updatedBy: string | null }

export async function getTheme(): Promise<StoredTheme> {
  await ensureTable()
  const result = await query<{ value: { params?: unknown; presetId?: string | null }; updated_at: string; updated_by: string | null }>(
    `SELECT value, updated_at, updated_by FROM app_settings WHERE key = 'theme'`
  )
  const row = result.rows[0]
  const params = row ? sanitizeThemeParams(row.value.params) : null
  return {
    params: params ?? DEFAULT_THEME,
    presetId: params ? (row!.value.presetId ?? null) : 'teal-klasik',
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
  }
}

export async function saveTheme(params: ThemeParams, presetId: string | null, username: string): Promise<StoredTheme> {
  await ensureTable()
  await query(
    `INSERT INTO app_settings (key, value, updated_at, updated_by)
     VALUES ('theme', $1, now(), $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [JSON.stringify({ params, presetId }), username]
  )
  return getTheme()
}
