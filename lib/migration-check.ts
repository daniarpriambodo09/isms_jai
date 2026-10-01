// lib/migration-check.ts
//
// Run once when the server starts (instrumentation.ts): if this database is
// missing migrations from db/migrations/, say so loudly in the server log
// (pm2 logs) — instead of pages failing later with "Gagal memuat…" because
// a table or column doesn't exist. Never throws; never blocks for long.

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { query } from '@/lib/db'

// Brings the database up to date before the first request: pending files in
// db/migrations/ are applied by the same runner as `npm run migrate` (one
// transaction each, recorded in schema_migrations, advisory-locked), so after
// a `git pull` + restart nobody has to look up what changed in the database.
// AUTO_MIGRATE=false turns this into a warning only.
export async function migrateOnStartup() {
  if (process.env.AUTO_MIGRATE !== 'false') {
    try {
      const output = execFileSync(process.execPath, [path.join(process.cwd(), 'scripts', 'migrate.mjs')], {
        cwd: process.cwd(),
        env: process.env,
        encoding: 'utf8',
        timeout: 120_000,
      })
      const summary = output.trim()
      if (summary && !/is up to date/.test(summary)) console.log(`[migrations]\n${summary}`)
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string; message: string }
      console.error(`[migrations] ✗ automatic migration failed — the app starts anyway, but some pages may fail.\n${(e.stdout ?? '') + (e.stderr ?? '') || e.message}`)
    }
  }
  // Still pending (failed above, or AUTO_MIGRATE=false)? Say so in the log.
  await Promise.race([
    warnPendingMigrations().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ])
}

export async function warnPendingMigrations() {
  const dir = path.join(process.cwd(), 'db', 'migrations')
  if (!fs.existsSync(dir)) return
  const files = fs.readdirSync(dir).filter((f) => /^\d{4}_[\w-]+\.sql$/.test(f)).sort()
  if (!files.length) return

  let applied = new Set<string>()
  try {
    const result = await query<{ name: string }>('SELECT name FROM schema_migrations')
    applied = new Set(result.rows.map((row) => row.name))
  } catch (error) {
    // 42P01 = schema_migrations doesn't exist yet → everything is pending.
    if ((error as { code?: string }).code !== '42P01') {
      console.warn('[migrations] could not check the database:', (error as Error).message)
      return
    }
  }

  const pending = files.filter((f) => !applied.has(f))
  if (pending.length) {
    console.warn(
      `\n[migrations] ⚠ ${pending.length} database migration(s) NOT applied: ${pending.join(', ')}\n` +
      '[migrations]   Some pages may fail until you run:  npm run migrate   (then restart)\n'
    )
  }
}
