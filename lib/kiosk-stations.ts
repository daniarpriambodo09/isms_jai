// lib/kiosk-stations.ts
//
// Which guest posts are in use: Admin Lobby and Pos Security (app_settings
// key 'kiosk_stations'). Normally both: guests register at Security and get
// their work-area card at the Lobby. Once registration is centralised at
// one post, the other can be switched off — its page then only says so, its
// account can't change guest data, and the post still in use takes over the
// whole flow. At least one post always stays on.

import 'server-only'
import { query } from '@/lib/db'

export type KioskStations = { lobby: boolean; security: boolean }
export type KioskStation = keyof KioskStations

const KEY = 'kiosk_stations'
const DEFAULT: KioskStations = { lobby: true, security: true }

async function ensureSettingsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(60) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by VARCHAR(100)
    )`)
}

export async function getKioskStations(): Promise<KioskStations & { updatedAt: string | null; updatedBy: string | null }> {
  await ensureSettingsTable()
  const row = (await query<{ value: Partial<KioskStations>; updated_at: string; updated_by: string | null }>(
    'SELECT value, updated_at, updated_by FROM app_settings WHERE key = $1', [KEY]
  )).rows[0]
  const value = { ...DEFAULT, ...(row?.value ?? {}) }
  // never both off, whatever was stored
  if (!value.lobby && !value.security) value.lobby = value.security = true
  return { lobby: value.lobby !== false, security: value.security !== false, updatedAt: row?.updated_at ?? null, updatedBy: row?.updated_by ?? null }
}

/** Saves the setting; null when it would switch both posts off. */
export async function saveKioskStations(next: KioskStations, username: string): Promise<KioskStations | null> {
  if (!next.lobby && !next.security) return null
  await ensureSettingsTable()
  await query(
    `INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ($1, $2, now(), $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [KEY, JSON.stringify({ lobby: next.lobby, security: next.security }), username]
  )
  return next
}

/** For a kiosk account: the message to refuse with when its post is switched off (null = allowed). The ISM Admin is never refused. */
export async function stationOffMessage(role: string): Promise<string | null> {
  if (role !== 'lobby' && role !== 'security') return null
  const stations = await getKioskStations()
  if (stations[role]) return null
  return role === 'lobby'
    ? 'Admin Lobby sedang dinonaktifkan — semua pendaftaran dipusatkan di Pos Security.'
    : 'Pos Security sedang dinonaktifkan — semua pendaftaran dipusatkan di Admin Lobby.'
}
