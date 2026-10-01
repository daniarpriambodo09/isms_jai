#!/usr/bin/env node
// scripts/backup-schedule.mjs — `npm run backup:schedule [HH:MM]`
//
// Registers the daily backup (scripts/backup.mjs) with the OS scheduler:
// Windows Task Scheduler task "ISMS Portal Backup" (default 02:00), output
// appended to <project>/backups/backup.log. On Linux/macOS it prints the
// crontab line to add instead.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const time = /^\d{2}:\d{2}$/.test(process.argv[2] ?? '') ? process.argv[2] : '02:00'
const logDir = path.join(ROOT, 'backups')
fs.mkdirSync(logDir, { recursive: true })
const log = path.join(logDir, 'backup.log')

if (process.platform === 'win32') {
  const command = `cmd /c cd /d "${ROOT}" && "${process.execPath}" scripts\\backup.mjs >> "${log}" 2>&1`
  const result = spawnSync('schtasks', ['/Create', '/F', '/SC', 'DAILY', '/ST', time, '/TN', 'ISMS Portal Backup', '/TR', command], { encoding: 'utf8' })
  process.stdout.write(result.stdout || '')
  process.stderr.write(result.stderr || '')
  if (result.status === 0) {
    console.log(`✓ Backup harian dijadwalkan pukul ${time} (Task Scheduler: "ISMS Portal Backup"). Log: ${log}`)
    console.log('  Uji sekarang: schtasks /Run /TN "ISMS Portal Backup"')
  } else {
    console.error('✗ Gagal membuat jadwal — jalankan PowerShell/Command Prompt sebagai Administrator lalu ulangi.')
    process.exitCode = 1
  }
} else {
  const [h, m] = time.split(':')
  console.log('Tambahkan baris ini ke crontab (crontab -e):')
  console.log(`${Number(m)} ${Number(h)} * * * cd "${ROOT}" && "${process.execPath}" scripts/backup.mjs >> "${log}" 2>&1`)
}
