// lib/document-review.ts
//
// Periodic review of controlled documents (ISO/IEC 27001 asks for documents
// to be reviewed at planned intervals): a procedure, TMMIN standard or
// working standard is due for review REVIEW_MONTHS after its effective date.
// Listed on the admin dashboard and in the bell; the ISM Admins also get one
// summary email per week (sendWeeklyReviewDigest, run by lib/jobs.ts).

import 'server-only'
import { query } from '@/lib/db'
import { buildReviewDigestEmail } from '@/lib/email-templates'
import { portalBaseUrl, sendToAdmins } from '@/lib/admin-mail'

export const REVIEW_MONTHS = 12
export const REVIEW_SOON_DAYS = 30

export type ReviewItem = {
  kind: 'procedure' | 'standard' | 'working-standard'
  kindLabel: string
  id: number
  controlNo: string
  title: string
  revision: number | null
  effDate: string
  dueDate: string
  /** Days until due; negative = overdue by that many days. */
  daysLeft: number
  href: string
}

const KIND_LABEL: Record<ReviewItem['kind'], string> = {
  procedure: 'Prosedur ISMS',
  standard: 'Standard TMMIN',
  'working-standard': 'Working Standard',
}

function hrefFor(kind: ReviewItem['kind'], controlNo: string) {
  const base = kind === 'procedure' ? '/prosedur-isms' : kind === 'standard' ? '/standard-isms-p14' : '/working-standard'
  return `${base}?q=${encodeURIComponent(controlNo)}`
}

// Documents overdue for review, or due within REVIEW_SOON_DAYS (WIB dates).
export async function listReviewItems(): Promise<{ overdue: ReviewItem[]; soon: ReviewItem[] }> {
  const rows = (await query<{ kind: ReviewItem['kind']; id: number; control_no: string; title: string; revision: number | null; eff_date: string; due_date: string; days_left: number }>(
    `WITH docs AS (
       SELECT CASE WHEN kind = 'working_standard' THEN 'working-standard' ELSE 'procedure' END AS kind, id, control_no, title, revision, elf_date AS eff FROM procedure_documents
       UNION ALL SELECT 'standard', id, control_no, title, revision, eff_date FROM standard_isms_p14_documents
     ), due AS (
       SELECT *, (eff + make_interval(months => $1))::date AS due FROM docs WHERE eff IS NOT NULL
     )
     SELECT kind, id, control_no, title, revision,
            to_char(eff, 'YYYY-MM-DD') AS eff_date, to_char(due, 'YYYY-MM-DD') AS due_date,
            (due - (now() AT TIME ZONE 'Asia/Jakarta')::date) AS days_left
     FROM due
     WHERE due <= (now() AT TIME ZONE 'Asia/Jakarta')::date + $2::int
     ORDER BY due, control_no`,
    [REVIEW_MONTHS, REVIEW_SOON_DAYS]
  )).rows
  const items: ReviewItem[] = rows.map((r) => ({
    kind: r.kind,
    kindLabel: KIND_LABEL[r.kind],
    id: r.id,
    controlNo: r.control_no,
    title: r.title,
    revision: r.revision,
    effDate: r.eff_date,
    dueDate: r.due_date,
    daysLeft: Number(r.days_left),
    href: hrefFor(r.kind, r.control_no),
  }))
  return { overdue: items.filter((i) => i.daysLeft < 0), soon: items.filter((i) => i.daysLeft >= 0) }
}

// Monday (WIB) of the week `now` falls in, as YYYY-MM-DD.
export function weekKey(now: Date) {
  const wib = new Date(now.getTime() + 7 * 3_600_000)
  const day = (wib.getUTCDay() + 6) % 7 // 0 = Monday
  const monday = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() - day))
  return monday.toISOString().slice(0, 10)
}

/**
 * Emails the ISM Admins the review list at most once per week (first run of
 * the week). Returns what happened, for logs/tests.
 */
export async function sendWeeklyReviewDigest(now = new Date()): Promise<'sent' | 'already' | 'nothing' | 'no-smtp' | 'failed'> {
  const key = weekKey(now)
  const last = (await query<{ value: { week?: string } }>("SELECT value FROM app_settings WHERE key = 'review_digest'")).rows[0]?.value?.week
  if (last === key) return 'already'

  const record = () => query(
    `INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ('review_digest', $1::jsonb, now(), 'system')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = 'system'`,
    [JSON.stringify({ week: key, at: now.toISOString() })]
  )

  const { overdue, soon } = await listReviewItems()
  if (!overdue.length && !soon.length) { await record(); return 'nothing' }

  const base = await portalBaseUrl()
  if (!base) return 'no-smtp' // try again once SMTP is configured
  const toDigest = (i: ReviewItem) => ({ kindLabel: i.kindLabel, controlNo: i.controlNo, title: i.title, revision: i.revision, effDate: i.effDate, dueDate: i.dueDate, overdueDays: -i.daysLeft })
  const { subject, html } = buildReviewDigestEmail({
    months: REVIEW_MONTHS,
    overdue: overdue.map(toDigest),
    soon: soon.map(toDigest),
    dashboardUrl: `${base}/dashboard-admin`,
  })
  if (!(await sendToAdmins(subject, html))) return 'failed'
  await record()
  return 'sent'
}
