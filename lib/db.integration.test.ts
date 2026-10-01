// Needs a real PostgreSQL (DB_* env vars, e.g. from .env.local). Opt-in:
//   ISMS_DB_TESTS=1 npm test
// Uses a throw-away table, dropped afterwards.
import fs from 'node:fs'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const enabled = process.env.ISMS_DB_TESTS === '1'
// DB_* from .env.local when not already in the environment (before lib/db creates its pool).
if (enabled && fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(DB_[A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const table = `vitest_tx_${process.pid}`
// Imported after the env is set, so lib/db's pool sees DB_*.
let db: typeof import('./db')
const query: typeof db.query = (text, params) => db.query(text, params)
const withTransaction: typeof db.withTransaction = (fn) => db.withTransaction(fn)

describe.skipIf(!enabled)('withTransaction (PostgreSQL)', () => {
  beforeAll(async () => {
    db = await import('./db')
    await query(`CREATE TABLE ${table} (id serial PRIMARY KEY, label text NOT NULL)`)
  })

  afterAll(async () => {
    await query(`DROP TABLE IF EXISTS ${table}`)
    await db.pool.end()
  })

  const labels = async () => (await query<{ label: string }>(`SELECT label FROM ${table} ORDER BY id`)).rows.map((r) => r.label)

  it('commits every query made inside, including from nested helpers', async () => {
    const helper = () => query(`INSERT INTO ${table} (label) VALUES ('helper')`)
    await withTransaction(async () => {
      await query(`INSERT INTO ${table} (label) VALUES ('direct')`)
      await helper()
      await withTransaction(() => query(`INSERT INTO ${table} (label) VALUES ('nested')`))
    })
    expect(await labels()).toEqual(['direct', 'helper', 'nested'])
  })

  it('rolls everything back when the function throws', async () => {
    await query(`DELETE FROM ${table}`)
    await expect(withTransaction(async () => {
      await query(`INSERT INTO ${table} (label) VALUES ('lost')`)
      await withTransaction(() => query(`INSERT INTO ${table} (label) VALUES ('lost too')`))
      throw new Error('boom')
    })).rejects.toThrow('boom')
    expect(await labels()).toEqual([])
  })

  it('is invisible to other connections until it commits', async () => {
    await query(`DELETE FROM ${table}`)
    let seenOutside: string[] = ['not checked']
    await withTransaction(async () => {
      await query(`INSERT INTO ${table} (label) VALUES ('pending')`)
      seenOutside = (await db.pool.query<{ label: string }>(`SELECT label FROM ${table}`)).rows.map((r) => r.label)
    })
    expect(seenOutside).toEqual([])
    expect(await labels()).toEqual(['pending'])
  })
})
