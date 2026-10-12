// app/api/vendor-registrations/scan/route.ts
//
// "Scan Kartu" at a kiosk: one scan of a card does what that card calls for at
// that post, so nobody has to look the guest up in the list first.
//
// Pos Security
//   - a Security card a guest is holding      → scan OUT: the visit is closed;
//   - a card nobody holds                     → scan IN: the guests waiting for
//     approval are returned, to pick who gets this card.
// Admin Lobby
//   - a Lobby card a guest is holding         → scan OUT: taken back (the guest
//     goes back to the Security card, or the visit is closed when the Lobby
//     registered the guest itself);
//   - a Security card a guest arrives with    → 'swap': the guest is returned so
//     the Lobby can scan the Lobby card to hand over;
//   - a card nobody holds                     → 'unknown': register a new guest
//     with it.
// Two guests can hold the same number on different kinds of card (the sets are
// separate): then 'choose' lists them and the scan is repeated with `id`.

import { NextRequest, NextResponse } from 'next/server'
import { stationOffMessage } from '@/lib/kiosk-stations'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

type CardType = 'visitor' | 'vendor' | 'supplier' | 'affiliate' | 'special_area' | 'photography'
type Row = {
  id: number
  full_name: string
  pic_jai: string
  company_remark: string
  entry_path: 'security' | 'lobby_affiliate'
  stage: 'pending_approval' | 'active' | 'closed'
  current_card_type: CardType | null
  security_card_type: 'visitor' | 'vendor' | 'supplier'
  security_card_barcode: string | null
  at_work_area: boolean
  entry_at: string | null
  exit_at: string | null
}

const SELECT_COLUMNS = `id, full_name, id_card, pic_jai, purpose, company_remark,
  registered_at, entry_at, exit_at, created_by, entry_path, registered_station, stage, current_card_type,
  visitor_card_barcode, vendor_card_barcode, affiliate_card_barcode,
  special_area_card_barcode, photography_card_barcode, supplier_card_barcode,
  security_card_type, security_card_barcode, at_work_area`

const CARD_LABEL: Record<CardType, string> = {
  visitor: 'Visitor', vendor: 'Vendor', supplier: 'Supplier', affiliate: 'Affiliate', special_area: 'Special Area', photography: 'Photography',
}
// "Holds a Lobby card with this number": the card in hand is not the Security one.
const HOLDS_LOBBY_CARD = `stage = 'active' AND (entry_path <> 'security' OR at_work_area) AND (
  (current_card_type = 'visitor' AND visitor_card_barcode = $1) OR
  (current_card_type = 'vendor' AND vendor_card_barcode = $1) OR
  (current_card_type = 'affiliate' AND affiliate_card_barcode = $1) OR
  (current_card_type = 'special_area' AND special_area_card_barcode = $1) OR
  (current_card_type = 'photography' AND photography_card_barcode = $1))`

export async function POST(request: NextRequest) {
  const session = getKioskAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  const off = await stationOffMessage(session.role)
  if (off) return NextResponse.json({ message: off }, { status: 403 })

  try {
    const body = await request.json().catch(() => ({})) as { barcode?: string; station?: string; id?: number }
    const barcode = typeof body.barcode === 'string' ? body.barcode.trim() : ''
    if (!barcode) return NextResponse.json({ message: 'Barcode wajib diisi.' }, { status: 400 })
    const station = session.role === 'security' ? 'security' : session.role === 'lobby' ? 'lobby' : body.station === 'security' ? 'security' : 'lobby'
    const pick = Number.isInteger(body.id) ? Number(body.id) : null
    const only = (rows: Row[]) => (pick ? rows.filter((row) => row.id === pick) : rows)

    if (station === 'security') {
      const holders = only((await query<Row>(
        `SELECT ${SELECT_COLUMNS} FROM vendor_registrations
         WHERE stage = 'active' AND entry_path = 'security' AND security_card_barcode = $1 ORDER BY entry_at DESC`, [barcode]
      )).rows)
      if (holders.length > 1) return NextResponse.json({ result: 'choose', candidates: holders, message: 'Nomor ini dipakai di lebih dari satu jenis kartu — pilih tamunya.' })
      if (holders.length === 1) {
        const guest = holders[0]
        if (guest.at_work_area) {
          return NextResponse.json({ result: 'blocked', registration: guest, message: `${guest.full_name} masih memegang kartu Lobby — tukar kembali di Lobby dulu, baru kartu Security bisa ditutup.` }, { status: 409 })
        }
        const closed = await query<Row>(
          `UPDATE vendor_registrations SET stage = 'closed', current_card_type = NULL, at_work_area = false, exit_at = now()
           WHERE id = $1 AND stage = 'active' RETURNING ${SELECT_COLUMNS}`, [guest.id]
        )
        return NextResponse.json({ result: 'out', registration: closed.rows[0] ?? guest, message: `Scan out — ${guest.full_name} keluar, kartu ${CARD_LABEL[guest.security_card_type]} dikembalikan.` })
      }
      // nobody holds it: a card about to be handed to a guest who is waiting
      const waiting = (await query<Row>(
        `SELECT ${SELECT_COLUMNS} FROM vendor_registrations WHERE stage = 'pending_approval' ORDER BY registered_at ASC`
      )).rows
      if (waiting.length === 0) {
        return NextResponse.json({ result: 'unknown', message: 'Kartu ini tidak sedang dipakai, dan tidak ada tamu yang menunggu approval. Daftarkan tamunya dulu.' })
      }
      return NextResponse.json({ result: 'in', candidates: waiting, message: 'Scan in — kartu ini belum dipakai. Berikan kepada:' })
    }

    // Admin Lobby
    const holders = only((await query<Row>(`SELECT ${SELECT_COLUMNS} FROM vendor_registrations WHERE ${HOLDS_LOBBY_CARD} ORDER BY entry_at DESC`, [barcode])).rows)
    if (holders.length > 1) return NextResponse.json({ result: 'choose', candidates: holders, message: 'Nomor ini dipakai di lebih dari satu jenis kartu — pilih tamunya.' })
    if (holders.length === 1) {
      const guest = holders[0]
      const card = CARD_LABEL[guest.current_card_type as CardType]
      if (guest.entry_path === 'security') {
        // back on the Security card; the visit is closed at Pos Security
        const column = `${guest.security_card_type}_card_barcode`
        const back = await query<Row>(
          `UPDATE vendor_registrations
           SET current_card_type = security_card_type, ${column} = security_card_barcode, at_work_area = false
           WHERE id = $1 AND stage = 'active' RETURNING ${SELECT_COLUMNS}`, [guest.id]
        )
        return NextResponse.json({ result: 'returned', registration: back.rows[0] ?? guest, message: `Scan out — kartu ${card} Lobby dari ${guest.full_name} diterima. Tamu kembali memegang kartu ${CARD_LABEL[guest.security_card_type]} Security.` })
      }
      const closed = await query<Row>(
        `UPDATE vendor_registrations SET stage = 'closed', current_card_type = NULL, exit_at = now()
         WHERE id = $1 AND stage = 'active' RETURNING ${SELECT_COLUMNS}`, [guest.id]
      )
      return NextResponse.json({ result: 'out', registration: closed.rows[0] ?? guest, message: `Scan out — ${guest.full_name} keluar, kartu ${card} dikembalikan.` })
    }
    // a guest arriving from Pos Security with its card
    const arriving = only((await query<Row>(
      `SELECT ${SELECT_COLUMNS} FROM vendor_registrations
       WHERE stage = 'active' AND entry_path = 'security' AND NOT at_work_area AND security_card_barcode = $1 ORDER BY entry_at DESC`, [barcode]
    )).rows)
    if (arriving.length > 1) return NextResponse.json({ result: 'choose', candidates: arriving, message: 'Nomor ini dipakai di lebih dari satu jenis kartu Security — pilih tamunya.' })
    if (arriving.length === 1) {
      return NextResponse.json({ result: 'swap', registration: arriving[0], message: `Scan in — ${arriving[0].full_name} membawa kartu ${CARD_LABEL[arriving[0].security_card_type]} Security. Scan kartu Lobby yang akan diberikan.` })
    }
    return NextResponse.json({ result: 'unknown', message: 'Kartu ini tidak sedang dipakai tamu mana pun. Daftarkan tamu baru dengan kartu ini:' })
  } catch (error) {
    console.error('[vendor-registrations/scan]', error)
    return NextResponse.json({ message: 'Gagal memproses scan kartu.' }, { status: 500 })
  }
}
