// lib/admin-followups.ts
//
// Things the ISM Admin still has to do or wants to see at a glance:
// - signatures whose QR has no place on the document yet (listUnplacedQr);
// - the month's guests per post and per kind of card, and the cards that
//   have been out for more than a day (guestRecap).

import 'server-only'
import { query } from '@/lib/db'
import { docKindInfo } from '@/lib/document-kinds'

// ─── QR not placed yet ───
// On Prosedur ISMS and Standard Requirement TMMIN the Admin ISM puts each QR
// on the page after its approver has signed ("Atur posisi QR"). Until then the
// document shows without that QR — easy to forget when nothing lists it.

export type UnplacedQrDocument = {
  documentId: number
  controlNo: string
  title: string
  revision: number
  kindLabel: string
  /** Register page, filtered to this document — where "Atur posisi QR" is. */
  href: string
  /** All approvers have signed: the document is published while still missing QR(s). */
  approved: boolean
  signatures: { roleCode: string; roleTitle: string; name: string | null; signedAt: string }[]
  /** The earliest of those signatures — how long the document has been waiting for its QR. */
  waitingSince: string
}

export async function listUnplacedQr(): Promise<UnplacedQrDocument[]> {
  const rows = (await query<{
    document_id: number; control_no: string; title: string; revision: number; kind: string; approval_status: string
    role_code: string; role_title: string; approver_name: string | null; decided_at: string
  }>(
    `SELECT d.id AS document_id, d.control_no, d.title, d.revision, d.kind, d.approval_status,
            a.role_code, a.role_title, a.approver_name, a.decided_at
     FROM procedure_approvals a
     JOIN procedure_documents d ON d.id = a.document_id AND d.revision = a.revision
     WHERE a.status = 'approved'
       AND NOT EXISTS (
         SELECT 1 FROM procedure_signature_slots s
         WHERE s.document_id = d.id AND s.role_code = a.role_code AND s.file_path IN (d.file_path, d.review_form_path)
       )
     ORDER BY a.decided_at ASC`
  )).rows

  const byDocument = new Map<number, UnplacedQrDocument>()
  for (const row of rows) {
    const info = docKindInfo(row.kind)
    const entry = byDocument.get(row.document_id) ?? {
      documentId: row.document_id,
      controlNo: row.control_no,
      title: row.title,
      revision: row.revision,
      kindLabel: info.label,
      href: `${info.path}?q=${encodeURIComponent(row.control_no)}`,
      approved: row.approval_status === 'approved',
      signatures: [],
      waitingSince: row.decided_at,
    }
    entry.signatures.push({ roleCode: row.role_code, roleTitle: row.role_title, name: row.approver_name, signedAt: row.decided_at })
    byDocument.set(row.document_id, entry)
  }
  return [...byDocument.values()]
}

// ─── monthly guest recap ───

export const GUEST_CARD_TYPES = ['visitor', 'vendor', 'supplier', 'affiliate', 'special_area', 'photography'] as const
export type GuestCardType = (typeof GUEST_CARD_TYPES)[number]
export const GUEST_CARD_LABEL: Record<GuestCardType, string> = {
  visitor: 'Visitor', vendor: 'Vendor', supplier: 'Supplier', affiliate: 'Affiliate', special_area: 'Special Area', photography: 'Photography',
}
type Station = 'lobby' | 'security'

// What a guest was registered as: at Pos Security the kind chosen there; at
// the Lobby the card issued (a closed visit no longer has a "current" card).
const KIND_SQL = `CASE
  WHEN entry_path = 'security' THEN security_card_type
  WHEN affiliate_card_barcode IS NOT NULL THEN 'affiliate'
  WHEN visitor_card_barcode IS NOT NULL THEN 'visitor'
  WHEN vendor_card_barcode IS NOT NULL THEN 'vendor'
  WHEN special_area_card_barcode IS NOT NULL THEN 'special_area'
  WHEN photography_card_barcode IS NOT NULL THEN 'photography'
  ELSE 'visitor' END`
const STATION_SQL = `COALESCE(registered_station, CASE WHEN entry_path = 'security' THEN 'security' ELSE 'lobby' END)`

export type OverdueCard = {
  id: number; name: string; company: string; picJai: string; station: Station; kind: GuestCardType
  /** The card in hand now; a Security guest holding a Lobby card also still has the Security one out. */
  cardLabel: string; cardNo: string | null; securityCardNo: string | null
  entryAt: string; days: number
}

export type GuestRecap = {
  year: number
  month: number // 1–12
  total: number
  byStation: Record<Station, number>
  byKind: Record<GuestCardType, number>
  /** counts[station][kind] */
  counts: Record<Station, Record<GuestCardType, number>>
  /** Registered that month and … */
  closed: number
  inside: number
  waitingApproval: number
  /** Busiest day of the month (Jakarta time), if any guest came. */
  busiestDay: { date: string; count: number } | null
  /** Every card that is out for more than a day right now — whatever month it went out. */
  overdue: OverdueCard[]
}

const zero = () => Object.fromEntries(GUEST_CARD_TYPES.map((kind) => [kind, 0])) as Record<GuestCardType, number>

export async function guestRecap(year: number, month: number): Promise<GuestRecap> {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  // the month as people at the plant see it (Asia/Jakarta), not in UTC
  const inMonth = `(registered_at AT TIME ZONE 'Asia/Jakarta') >= $1::date AND (registered_at AT TIME ZONE 'Asia/Jakarta') < ($1::date + interval '1 month')`

  const grouped = (await query<{ station: Station; kind: GuestCardType; stage: string; n: string }>(
    `SELECT ${STATION_SQL} AS station, ${KIND_SQL} AS kind, stage, count(*)::text AS n
     FROM vendor_registrations WHERE ${inMonth} GROUP BY 1, 2, 3`, [from]
  )).rows
  const recap: GuestRecap = {
    year, month, total: 0,
    byStation: { lobby: 0, security: 0 }, byKind: zero(), counts: { lobby: zero(), security: zero() },
    closed: 0, inside: 0, waitingApproval: 0, busiestDay: null, overdue: [],
  }
  for (const row of grouped) {
    const n = Number(row.n)
    const station: Station = row.station === 'security' ? 'security' : 'lobby'
    const kind = (GUEST_CARD_TYPES as readonly string[]).includes(row.kind) ? row.kind : 'visitor'
    recap.total += n
    recap.byStation[station] += n
    recap.byKind[kind] += n
    recap.counts[station][kind] += n
    if (row.stage === 'closed') recap.closed += n
    else if (row.stage === 'active') recap.inside += n
    else recap.waitingApproval += n
  }

  const busiest = (await query<{ day: string; n: string }>(
    `SELECT to_char((registered_at AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY-MM-DD') AS day, count(*)::text AS n
     FROM vendor_registrations WHERE ${inMonth} GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`, [from]
  )).rows[0]
  if (busiest) recap.busiestDay = { date: busiest.day, count: Number(busiest.n) }

  const overdue = (await query<{
    id: number; full_name: string; company_remark: string; pic_jai: string; station: Station; kind: GuestCardType
    current_card_type: GuestCardType | null; entry_path: string; at_work_area: boolean; security_card_type: GuestCardType; security_card_barcode: string | null
    visitor_card_barcode: string | null; vendor_card_barcode: string | null; supplier_card_barcode: string | null; affiliate_card_barcode: string | null; special_area_card_barcode: string | null; photography_card_barcode: string | null
    entry_at: string; hours: string
  }>(
    `SELECT id, full_name, company_remark, pic_jai, ${STATION_SQL} AS station, ${KIND_SQL} AS kind,
            current_card_type, entry_path, at_work_area, security_card_type, security_card_barcode,
            visitor_card_barcode, vendor_card_barcode, supplier_card_barcode, affiliate_card_barcode, special_area_card_barcode, photography_card_barcode,
            entry_at, (extract(epoch FROM now() - entry_at) / 3600)::text AS hours
     FROM vendor_registrations
     WHERE stage = 'active' AND entry_at IS NOT NULL AND entry_at < now() - interval '24 hours'
     ORDER BY entry_at ASC`
  )).rows
  recap.overdue = overdue.map((row) => {
    const onSecurityCard = row.entry_path === 'security' && !row.at_work_area
    const current = row.current_card_type ?? row.kind
    const cardNo = onSecurityCard ? row.security_card_barcode : (row[`${current}_card_barcode` as 'visitor_card_barcode'] ?? null)
    return {
      id: row.id,
      name: row.full_name,
      company: row.company_remark,
      picJai: row.pic_jai,
      station: row.station === 'security' ? 'security' : 'lobby',
      kind: row.kind,
      cardLabel: `${GUEST_CARD_LABEL[current] ?? current} (${onSecurityCard ? 'Security' : 'Lobby'})`,
      cardNo,
      securityCardNo: row.entry_path === 'security' && row.at_work_area ? row.security_card_barcode : null,
      entryAt: row.entry_at,
      days: Math.floor(Number(row.hours) / 24),
    }
  })
  return recap
}
