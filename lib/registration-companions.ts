import { query } from '@/lib/db'

export type Companion = { name: string; id_no: string }

const MAX_COMPANIONS = 20

// Extra people from a request body ([{ name, idNo }]). Blank rows are dropped;
// a half-filled row or a non-array -> undefined (reject with 400). Omitted -> null (leave as is).
export function parseCompanions(value: unknown): Companion[] | null | undefined {
  if (value == null) return null
  if (!Array.isArray(value) || value.length > MAX_COMPANIONS) return undefined
  const list: Companion[] = []
  for (const item of value) {
    const name = typeof item?.name === 'string' ? item.name.trim() : ''
    const idNo = typeof item?.idNo === 'string' ? item.idNo.trim() : ''
    if (!name && !idNo) continue
    if (!name || !idNo || name.length > 255 || idNo.length > 255) return undefined
    list.push({ name, id_no: idNo })
  }
  return list
}

// Runs inside the caller's transaction when there is one (see withTransaction).
export async function replaceCompanions(registrationId: string | number, list: Companion[]) {
  await query('DELETE FROM registration_ids WHERE registration_id = $1', [registrationId])
  for (const c of list) {
    await query('INSERT INTO registration_ids (registration_id, name, id_no) VALUES ($1, $2, $3)', [registrationId, c.name, c.id_no])
  }
}

// Subselect for SELECT_COLUMNS: the extra people of a registration as JSON.
export const COMPANIONS_SQL = `COALESCE((SELECT json_agg(json_build_object('name', c.name, 'id_no', c.id_no) ORDER BY c.id)
  FROM registration_ids c WHERE c.registration_id = vendor_registrations.id), '[]'::json) AS companions`
