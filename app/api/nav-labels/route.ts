import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getIsmsAdminFromRequest } from '@/lib/auth'

// Default label fallback — mirrors portal-data.ts mainNav
export const DEFAULT_NAV_LABELS: Record<string, string> = {
  home:             'Home',
  kebijakan:        'ISMS Basic Policy',
  prosedur:         'ISMS Procedures',
  working_standard: 'Working Standard',
  edukasi:          'Education & Training',
  form_cs:          'Forms & CS Control',
  departemen:       'Departments',
}

type NavLabelRow = { key: string; label: string }

// Ensure table exists on first use — idempotent
async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS nav_labels (
      key   VARCHAR(50) PRIMARY KEY,
      label VARCHAR(100) NOT NULL
    )
  `)
  // Seed defaults for keys that are missing
  for (const [key, label] of Object.entries(DEFAULT_NAV_LABELS)) {
    await query(
      `INSERT INTO nav_labels (key, label) VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING`,
      [key, label]
    )
  }
}

// GET /api/nav-labels — public, used by navbar on every load
export async function GET() {
  try {
    await ensureTable()
    const result = await query<NavLabelRow>('SELECT key, label FROM nav_labels')
    const labels: Record<string, string> = { ...DEFAULT_NAV_LABELS }
    for (const row of result.rows) {
      labels[row.key] = row.label
    }
    return NextResponse.json({ labels })
  } catch (error) {
    console.error('[nav-labels/GET]', error)
    // On DB error, return defaults so navbar never breaks
    return NextResponse.json({ labels: DEFAULT_NAV_LABELS })
  }
}

// PUT /api/nav-labels — admin only
export async function PUT(req: NextRequest) {
  const session = getIsmsAdminFromRequest(req)
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const body = await req.json() as { key: string; label: string }[]
    if (!Array.isArray(body)) {
      return NextResponse.json({ message: 'Body harus berupa array.' }, { status: 400 })
    }

    await ensureTable()

    for (const { key, label } of body) {
      if (!DEFAULT_NAV_LABELS[key]) continue // ignore unknown keys
      const trimmed = label.trim()
      if (!trimmed) continue
      await query(
        `INSERT INTO nav_labels (key, label) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label`,
        [key, trimmed]
      )
    }

    const result = await query<NavLabelRow>('SELECT key, label FROM nav_labels')
    const labels: Record<string, string> = { ...DEFAULT_NAV_LABELS }
    for (const row of result.rows) {
      labels[row.key] = row.label
    }

    return NextResponse.json({ labels })
  } catch (error) {
    console.error('[nav-labels/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan label.' }, { status: 500 })
  }
}
