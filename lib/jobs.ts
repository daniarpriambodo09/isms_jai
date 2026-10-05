// lib/jobs.ts
//
// Small in-process scheduler for the long-running server (started once from
// instrumentation.ts): every hour, after 07:00 WIB, it sends the weekly
// document-review reminder if it hasn't gone out this week yet. Sending is
// idempotent (recorded in app_settings), so restarts or several checks a day
// never send twice. On working days until 17:00 WIB it also reminds approvers
// who have had a pending request for a few days (each step remembers when it
// was last reminded, so this is idempotent too).

import 'server-only'
import { sendWeeklyReviewDigest } from '@/lib/document-review'
import { sendApprovalReminders } from '@/lib/procedure-approval'

declare global {
  // eslint-disable-next-line no-var
  var ismsJobsStarted: boolean | undefined
}

const HOUR = 3_600_000

async function tick() {
  const wibHour = new Date(Date.now() + 7 * HOUR).getUTCHours()
  if (wibHour < 7) return
  try {
    const result = await sendWeeklyReviewDigest()
    if (result === 'sent') console.log('[jobs] weekly document-review reminder sent to ISM Admins')
    if (result === 'failed') console.warn('[jobs] weekly document-review reminder could not be sent — will retry next hour')
  } catch (error) {
    console.error('[jobs] review reminder', error)
  }

  const wibDay = new Date(Date.now() + 7 * HOUR).getUTCDay() // 0 = Sunday
  if (wibDay === 0 || wibDay === 6 || wibHour >= 17) return
  try {
    const { sent, failed } = await sendApprovalReminders()
    if (sent) console.log(`[jobs] ${sent} approval reminder(s) sent`)
    if (failed) console.warn(`[jobs] ${failed} approval reminder(s) could not be sent — will retry next hour`)
  } catch (error) {
    console.error('[jobs] approval reminders', error)
  }
}

export function startBackgroundJobs() {
  if (global.ismsJobsStarted || process.env.ISMS_JOBS === 'false') return
  global.ismsJobsStarted = true
  setTimeout(() => { void tick() }, 60_000) // shortly after start-up
  setInterval(() => { void tick() }, HOUR).unref?.()
}
