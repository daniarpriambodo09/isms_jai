#!/usr/bin/env node
// scripts/migrate.mjs — database migrations for the ISMS Portal.
//
//   npm run migrate          apply every migration in db/migrations/ that this
//                            database hasn't run yet, in order
//   npm run migrate:status   list applied / pending (exit code 1 if any pending)
//
// Each file runs inside its own transaction and is recorded in the
// schema_migrations table, so it is applied exactly once per database; a
// failing file is rolled back and stops the run. An advisory lock keeps two
// runs (e.g. two deploys) from migrating at the same time.
//
// Connection settings come from the environment, falling back to .env.local
// and .env in the project root (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD).

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations')
const LOCK_KEY = 727001 // any constant; shared by every run of this script

function loadEnvFile(file) {
  const full = path.join(ROOT, file)
  if (!fs.existsSync(full)) return
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

function migrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return []
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_[\w-]+\.sql$/.test(f))
    .sort()
    .map((name) => {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8')
      return { name, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') }
    })
}

async function main() {
  const statusOnly = process.argv.includes('--status')
  loadEnvFile('.env.local')
  loadEnvFile('.env')
  const client = new pg.Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  })
  await client.connect()
  // RAISE WARNING / NOTICE from migrations (e.g. a skipped constraint).
  client.on('notice', (n) => { if (n.severity !== 'NOTICE' || process.env.MIGRATE_VERBOSE) console.log(`   ${n.severity}: ${n.message}`) })

  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`)
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY])

    const files = migrationFiles()
    const applied = new Map((await client.query('SELECT name, checksum, applied_at FROM schema_migrations')).rows.map((r) => [r.name, r]))
    const pending = files.filter((f) => !applied.has(f.name))
    const db = `${process.env.DB_NAME}@${process.env.DB_HOST ?? 'localhost'}`

    for (const f of files) {
      const row = applied.get(f.name)
      if (row && row.checksum !== f.checksum) {
        console.warn(`!  ${f.name} was changed after it was applied (${new Date(row.applied_at).toISOString().slice(0, 10)}). Never edit an applied migration — add a new file instead.`)
      }
    }

    if (statusOnly) {
      console.log(`Database ${db}`)
      for (const f of files) console.log(`  ${applied.has(f.name) ? '✓ applied ' : '… PENDING '} ${f.name}`)
      if (pending.length) {
        console.log(`\n${pending.length} migration(s) pending — run: npm run migrate`)
        process.exitCode = 1
      } else console.log('\nUp to date.')
      return
    }

    if (!pending.length) {
      console.log(`Database ${db} is up to date (${files.length} migration(s) applied).`)
      return
    }

    console.log(`Database ${db}: applying ${pending.length} migration(s)…`)
    for (const f of pending) {
      const started = Date.now()
      console.log(`→  ${f.name}`)
      try {
        await client.query('BEGIN')
        await client.query(f.sql)
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [f.name, f.checksum])
        await client.query('COMMIT')
        console.log(`✓  ${f.name} (${Date.now() - started} ms)`)
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        console.error(`✗  ${f.name} failed and was rolled back — nothing from this file was applied.`)
        console.error(`   ${error.message}${error.position ? ` (at character ${error.position})` : ''}`)
        process.exitCode = 1
        return
      }
    }
    console.log('Done.')
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {})
    await client.end()
  }
}

main().catch((error) => {
  console.error(`Migration error: ${error.message}`)
  process.exitCode = 1
})
