// instrumentation.ts — runs once when the Next.js server starts.
// The Node-only work lives in lib/migration-check.ts (this file is also
// compiled for the Edge runtime, which has no child_process / fs).

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { migrateOnStartup } = await import('./lib/migration-check')
  await migrateOnStartup()
  // Weekly document-review reminder (lib/jobs.ts).
  const { startBackgroundJobs } = await import('./lib/jobs')
  startBackgroundJobs()
}
