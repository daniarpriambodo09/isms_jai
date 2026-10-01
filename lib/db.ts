// lib/db.ts

import { AsyncLocalStorage } from 'async_hooks'
import { Pool, type PoolClient, type QueryResultRow } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined
}

function createPool() {
  return new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 10,
    idleTimeoutMillis: 30_000,
  })
}

export const pool = global.pgPool ?? createPool()

if (process.env.NODE_ENV !== 'production') {
  global.pgPool = pool
}

// The client of the transaction currently running (see withTransaction).
const transactionClient = new AsyncLocalStorage<PoolClient>()

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  // Inside withTransaction every query — including ones made by helper
  // functions that know nothing about the transaction — runs on its client.
  const client = transactionClient.getStore()
  return client ? client.query<T>(text, params) : pool.query<T>(text, params)
}

/**
 * Runs `fn` in one database transaction: every `query()` it makes (directly
 * or through other functions) commits together, or nothing does if it throws.
 * Keep slow work (sending email, rendering PDFs) outside — the transaction
 * holds locks until it ends. Nested calls simply join the outer transaction.
 */
export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  if (transactionClient.getStore()) return fn()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await transactionClient.run(client, fn)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
