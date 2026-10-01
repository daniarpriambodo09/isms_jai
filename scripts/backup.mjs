#!/usr/bin/env node
// scripts/backup.mjs — `npm run backup`
//
// Daily backup of everything that exists ONLY on the server:
//   <BACKUP_DIR>/isms-YYYYMMDD-HHMMSS/
//     database.dump   pg_dump custom format (restore with pg_restore)
//     storage/        copy of every uploaded file
//     manifest.json   when, which commit, counts and sizes
// Keeps the newest BACKUP_KEEP backups (default 14) and deletes older ones.
//
// Settings (environment, or .env.local / .env): DB_HOST, DB_PORT, DB_NAME,
// DB_USER, DB_PASSWORD, BACKUP_DIR (default ./backups — point it at another
// disk or a network share), BACKUP_KEEP, PG_DUMP_PATH (if pg_dump isn't on PATH).

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile(file) {
  const full = path.join(ROOT, file)
  if (!fs.existsSync(full)) return
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

// pg_dump from PG_DUMP_PATH, PATH, or the standard Windows install folders.
function findPgDump() {
  if (process.env.PG_DUMP_PATH) return process.env.PG_DUMP_PATH
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['pg_dump'], { encoding: 'utf8' })
  if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim().split(/\r?\n/)[0]
  if (process.platform === 'win32') {
    for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean)) {
      const dir = path.join(base, 'PostgreSQL')
      if (!fs.existsSync(dir)) continue
      const versions = fs.readdirSync(dir).filter((v) => fs.existsSync(path.join(dir, v, 'bin', 'pg_dump.exe')))
        .sort((a, b) => Number(b) - Number(a))
      if (versions.length) return path.join(dir, versions[0], 'bin', 'pg_dump.exe')
    }
  }
  return null
}

function dirStats(dir) {
  let files = 0, bytes = 0
  if (!fs.existsSync(dir)) return { files, bytes }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) { files++; bytes += fs.statSync(path.join(entry.parentPath ?? entry.path, entry.name)).size }
  }
  return { files, bytes }
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`
// Folder names in WIB (UTC+7), so they match the server's clock.
const stamp = (d) => new Date(d.getTime() + 7 * 3_600_000).toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)

function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')
  const backupRoot = path.resolve(ROOT, process.env.BACKUP_DIR || 'backups')
  const keep = Math.max(1, Number(process.env.BACKUP_KEEP || 14))
  const started = new Date()
  const target = path.join(backupRoot, `isms-${stamp(started)}`)
  // A BACKUP_DIR on a drive / share that isn't there (e.g. E:\ on a machine
  // without an E: drive, a NAS that is offline) — say so plainly.
  const driveRoot = path.parse(backupRoot).root
  if (!fs.existsSync(driveRoot)) {
    throw new Error(`BACKUP_DIR "${backupRoot}" tidak bisa dipakai: drive/share "${driveRoot}" tidak ada di komputer ini. Ganti BACKUP_DIR di .env.local ke drive yang ada (cek dengan: Get-PSDrive -PSProvider FileSystem).`)
  }
  fs.mkdirSync(target, { recursive: true })
  console.log(`Backup → ${target}`)

  // 1) Database
  const pgDump = findPgDump()
  if (!pgDump) throw new Error('pg_dump tidak ditemukan. Install PostgreSQL client tools, atau set PG_DUMP_PATH di .env.local.')
  execFileSync(pgDump, [
    '--format=custom', '--no-owner', '--no-privileges',
    '--host', process.env.DB_HOST || 'localhost',
    '--port', String(process.env.DB_PORT || 5432),
    '--username', process.env.DB_USER,
    '--file', path.join(target, 'database.dump'),
    process.env.DB_NAME,
  ], { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }, stdio: ['ignore', 'inherit', 'inherit'] })
  const dbBytes = fs.statSync(path.join(target, 'database.dump')).size
  console.log(`✓ database ${process.env.DB_NAME}: ${mb(dbBytes)}`)

  // 2) Uploaded files
  const storage = path.join(ROOT, 'storage')
  if (fs.existsSync(storage)) fs.cpSync(storage, path.join(target, 'storage'), { recursive: true })
  const files = dirStats(path.join(target, 'storage'))
  console.log(`✓ storage: ${files.files} file(s), ${mb(files.bytes)}`)

  // 3) Manifest
  let commit = null
  try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim() } catch {}
  fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify({
    createdAt: started.toISOString(),
    database: process.env.DB_NAME,
    databaseBytes: dbBytes,
    storageFiles: files.files,
    storageBytes: files.bytes,
    gitCommit: commit,
    restore: 'pg_restore --clean --if-exists --no-owner -d <DB_NAME> database.dump  &&  copy storage/ back into the project folder',
  }, null, 2))

  // 4) Retention
  const backups = fs.readdirSync(backupRoot).filter((d) => /^isms-\d{8}-\d{6}$/.test(d)).sort().reverse()
  for (const old of backups.slice(keep)) {
    fs.rmSync(path.join(backupRoot, old), { recursive: true, force: true })
    console.log(`  removed old backup ${old}`)
  }
  console.log(`Done in ${((Date.now() - started.getTime()) / 1000).toFixed(1)} s — keeping the newest ${keep}.`)
}

try {
  main()
} catch (error) {
  console.error(`✗ Backup failed: ${error.message}`)
  process.exitCode = 1
}
