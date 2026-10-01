// lib/policy-ack.ts
//
// "Saya sudah membaca & memahami" for the ISMS Basic Policy — evidence an
// auditor asks for. Employees don't have portal accounts, so they identify
// with NIK + name + department. One acknowledgement per NIK per policy
// VERSION; the version changes whenever the policy visuals change (images
// added or removed), so everyone is asked again after a policy update.

import 'server-only'
import { query } from '@/lib/db'

export type PolicyAck = { id: number; policy_version: string; nik: string; full_name: string; department: string; section: string | null; acknowledged_at: string }

// "v20260930-3": date of the newest policy image + how many there are.
export async function currentPolicyVersion(): Promise<{ version: string; label: string }> {
  const row = (await query<{ n: number; latest: string | null }>(
    "SELECT count(*)::int AS n, to_char(max(created_at) AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD') AS latest FROM policy_images"
  )).rows[0]
  if (!row || !row.n || !row.latest) return { version: 'v0', label: 'Belum ada visual kebijakan' }
  const d = row.latest
  return { version: `v${d}-${row.n}`, label: `Versi ${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)} · ${row.n} visual` }
}

export function normalizeNik(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, '').slice(0, 50) : ''
}

export async function findAck(version: string, nik: string) {
  return (await query<PolicyAck>(
    `SELECT id, policy_version, nik, full_name, department, section, acknowledged_at
     FROM policy_acknowledgements WHERE policy_version = $1 AND lower(nik) = lower($2)`,
    [version, nik]
  )).rows[0] ?? null
}

/** Records the acknowledgement; if this NIK already acknowledged this version, returns that one. */
export async function acknowledge(input: { version: string; nik: string; fullName: string; department: string; section: string | null; ip: string | null }) {
  const inserted = (await query<PolicyAck>(
    `INSERT INTO policy_acknowledgements (policy_version, nik, full_name, department, section, ip)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (policy_version, lower(nik)) DO NOTHING
     RETURNING id, policy_version, nik, full_name, department, section, acknowledged_at`,
    [input.version, input.nik, input.fullName, input.department, input.section, input.ip]
  )).rows[0]
  if (inserted) return { ack: inserted, created: true }
  return { ack: (await findAck(input.version, input.nik))!, created: false }
}

export async function ackSummary(version: string) {
  const [total, byDept, list] = await Promise.all([
    query<{ n: number }>('SELECT count(*)::int AS n FROM policy_acknowledgements WHERE policy_version = $1', [version]),
    query<{ department: string; n: number; last: string }>(
      `SELECT department, count(*)::int AS n, max(acknowledged_at) AS last FROM policy_acknowledgements
       WHERE policy_version = $1 GROUP BY department ORDER BY n DESC, department`,
      [version]
    ),
    query<PolicyAck>(
      `SELECT id, policy_version, nik, full_name, department, section, acknowledged_at FROM policy_acknowledgements
       WHERE policy_version = $1 ORDER BY acknowledged_at DESC`,
      [version]
    ),
  ])
  return { total: total.rows[0]?.n ?? 0, byDepartment: byDept.rows, list: list.rows }
}
