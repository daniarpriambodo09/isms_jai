// app/api/health/route.ts
//
// Liveness/readiness probe for uptime monitoring — an external service
// (cron job, load balancer health check, status page) can poll this to
// know the app is up and the database is reachable. Unauthenticated on
// purpose: monitoring tools don't carry an admin session cookie.

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  const startedAt = Date.now()
  try {
    await query('SELECT 1')
    return NextResponse.json({
      status: 'ok',
      database: 'up',
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[health/GET]', error)
    return NextResponse.json(
      { status: 'error', database: 'down', timestamp: new Date().toISOString() },
      { status: 503 }
    )
  }
}
