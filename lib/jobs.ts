// lib/jobs.ts
//
// Small in-process scheduler for the long-running server (started once from
// instrumentation.ts): every hour, after 07:00 WIB, it sends the weekly
// document-review reminder if it hasn't gone out this week yet. Sending is
// idempotent (recorded in app_settings), so restarts or several checks a day
// never send twice.

import 'server-only'
import { sendWeeklyReviewDigest } from '@/lib/document-review'

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
}

export function startBackgroundJobs() {
  if (global.ismsJobsStarted || process.env.ISMS_JOBS === 'false') return
  global.ismsJobsStarted = true
  setTimeout(() => { void tick() }, 60_000) // shortly after start-up
  setInterval(() => { void tick() }, HOUR).unref?.()
}
