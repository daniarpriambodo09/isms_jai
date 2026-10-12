// lib/admin-recipients.ts
//
// Who gets the e-mails meant for "the ISM Admin" (a document was approved or
// rejected, a new photo/video request, a document due for review, …):
// - every ism_admin account with an address that can really receive mail, and
// - the extra addresses kept here (app_settings key 'admin_notification_emails'),
//   so a second or third person — or whoever takes over as admin — is told
//   too, without needing an account of their own.
// With nobody reachable, the SMTP sender mailbox gets it so it still lands
// somewhere.

import 'server-only'
import { query } from '@/lib/db'
import { isDeliverableEmail } from '@/lib/email-address'

const KEY = 'admin_notification_emails'
export const MAX_EXTRA_ADMIN_EMAILS = 5

async function ensureSettingsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(60) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by VARCHAR(100)
    )`)
}

/** Trimmed, lower-cased, without repeats. */
function tidy(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const seen = new Set<string>()
  for (const value of values) {
    if (typeof value !== 'string') continue
    const email = value.trim().toLowerCase()
    if (email) seen.add(email)
  }
  return [...seen]
}

export async function getExtraAdminEmails(): Promise<{ emails: string[]; updatedAt: string | null; updatedBy: string | null }> {
  await ensureSettingsTable()
  const row = (await query<{ value: unknown; updated_at: string; updated_by: string | null }>(
    'SELECT value, updated_at, updated_by FROM app_settings WHERE key = $1', [KEY]
  )).rows[0]
  return { emails: tidy(row?.value), updatedAt: row?.updated_at ?? null, updatedBy: row?.updated_by ?? null }
}

/** Saves the list; returns a message instead when it can't be accepted. */
export async function saveExtraAdminEmails(values: unknown, username: string): Promise<{ emails: string[] } | { error: string }> {
  const emails = tidy(values)
  if (emails.length > MAX_EXTRA_ADMIN_EMAILS) return { error: `Maksimal ${MAX_EXTRA_ADMIN_EMAILS} alamat tambahan.` }
  const bad = emails.find((email) => !isDeliverableEmail(email))
  if (bad) return { error: `"${bad}" bukan alamat email yang bisa menerima email.` }
  await ensureSettingsTable()
  await query(
    `INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ($1, $2, now(), $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [KEY, JSON.stringify(emails), username]
  )
  return { emails }
}

/**
 * The addresses an admin notification goes to. fallback: the SMTP sender
 * mailbox, used only when no account and no extra address can receive mail.
 */
export async function adminRecipients(fallback: string): Promise<{ to: string[]; skipped: string[]; usedFallback: boolean }> {
  const accounts = (await query<{ email: string }>("SELECT email FROM admins WHERE role = 'ism_admin' AND email IS NOT NULL AND email <> ''")).rows.map((row) => row.email)
  const extra = (await getExtraAdminEmails()).emails
  const all = tidy([...accounts, ...extra])
  const to = all.filter(isDeliverableEmail)
  return { to: to.length ? to : [fallback], skipped: all.filter((email) => !isDeliverableEmail(email)), usedFallback: to.length === 0 }
}
