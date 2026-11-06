import { query } from '@/lib/db'

export type Companion = {
  name: string
  id_no: string
  card_barcode?: string | null
  returned_at?: string | null
}

const MAX_COMPANIONS = 20

let colsEnsured = false
export async function ensureRegistrationIdsColumns(): Promise<void> {
  if (colsEnsured) return
  try {
    await query(`
      ALTER TABLE registration_ids
        ADD COLUMN IF NOT EXISTS card_barcode VARCHAR(100),
        ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;
    `)
    colsEnsured = true
  } catch (err) {
    console.error('[registration-companions] ensureRegistrationIdsColumns error:', err)
  }
}

// Extra people from a request body ([{ name, idNo, cardBarcode }]). Blank rows are dropped;
// a half-filled row or a non-array -> undefined (reject with 400). Omitted -> null (leave as is).
export function parseCompanions(value: unknown): Companion[] | null | undefined {
  if (value == null) return null
  if (!Array.isArray(value) || value.length > MAX_COMPANIONS) return undefined
  const list: Companion[] = []
  for (const item of value) {
    const name = typeof item?.name === 'string' ? item.name.trim() : ''
    const idNo = typeof item?.idNo === 'string' ? item.idNo.trim() : (typeof item?.id_no === 'string' ? item.id_no.trim() : '')
    const cardBarcode = typeof item?.cardBarcode === 'string' && item.cardBarcode.trim()
      ? item.cardBarcode.trim()
      : (typeof item?.barcode === 'string' && item.barcode.trim()
          ? item.barcode.trim()
          : (typeof item?.card_barcode === 'string' && item.card_barcode.trim() ? item.card_barcode.trim() : null))
    if (!name && !idNo && !cardBarcode) continue
    if (!name || !idNo || name.length > 255 || idNo.length > 255) return undefined
    const itemObj: Companion = { name, id_no: idNo }
    if (cardBarcode) itemObj.card_barcode = cardBarcode
    list.push(itemObj)
  }
  return list
}

// Runs inside the caller's transaction when there is one (see withTransaction).
export async function replaceCompanions(registrationId: string | number, list: Companion[]) {
  await ensureRegistrationIdsColumns()
  await query('DELETE FROM registration_ids WHERE registration_id = $1', [registrationId])
  for (const c of list) {
    await query(
      'INSERT INTO registration_ids (registration_id, name, id_no, card_barcode) VALUES ($1, $2, $3, $4)',
      [registrationId, c.name, c.id_no, c.card_barcode ?? null]
    )
  }
}

// Subselect for SELECT_COLUMNS: the extra people of a registration as JSON.
export const COMPANIONS_SQL = `COALESCE((SELECT json_agg(json_build_object(
  'name', c.name,
  'id_no', c.id_no,
  'card_barcode', c.card_barcode,
  'returned_at', c.returned_at
) ORDER BY c.id)
  FROM registration_ids c WHERE c.registration_id = vendor_registrations.id), '[]'::json) AS companions`
