import { NextRequest, NextResponse } from 'next/server'
import { stationOffMessage } from '@/lib/kiosk-stations'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'
import { lobbyCardProblem, normalizeCardNo } from '@/lib/card-ranges'

type EntryPath = 'security' | 'lobby_affiliate'
type Stage = 'pending_approval' | 'active' | 'closed'
type CardType = 'visitor' | 'vendor' | 'supplier' | 'affiliate' | 'special_area' | 'photography'
// The cards Pos Security hands out at approval.
type SecurityCardType = 'visitor' | 'vendor' | 'supplier'
// The Lobby cards a guest can swap into.
type SwapCardType = 'visitor' | 'vendor'
type Action = 'approve' | 'swapToWorkArea' | 'returnWorkArea' | 'close' | 'returnDirect' | 'editDetails' | 'forceClose'
type CardColumn = 'visitor_card_barcode' | 'vendor_card_barcode' | 'supplier_card_barcode' | 'affiliate_card_barcode' | 'special_area_card_barcode' | 'photography_card_barcode'

type VendorRegistrationRow = {
  id: number
  full_name: string
  id_card: string
  pic_jai: string
  purpose: string
  company_remark: string
  registered_at: string
  entry_at: string | null
  exit_at: string | null
  created_by: string | null
  entry_path: EntryPath
  stage: Stage
  current_card_type: CardType | null
  visitor_card_barcode: string | null
  vendor_card_barcode: string | null
  affiliate_card_barcode: string | null
  special_area_card_barcode: string | null
  photography_card_barcode: string | null
  supplier_card_barcode: string | null
  security_card_type: SecurityCardType
  security_card_barcode: string | null
  at_work_area: boolean
  closed_note: string | null
}

const SELECT_COLUMNS = `id, full_name, id_card, pic_jai, purpose, company_remark,
  registered_at, entry_at, exit_at, created_by, entry_path, registered_station, stage, current_card_type,
  visitor_card_barcode, vendor_card_barcode, affiliate_card_barcode,
  special_area_card_barcode, photography_card_barcode, supplier_card_barcode,
  security_card_type, security_card_barcode, at_work_area, closed_note`

const ACTIONS: Action[] = ['approve', 'swapToWorkArea', 'returnWorkArea', 'close', 'returnDirect', 'editDetails', 'forceClose']
function isAction(value: unknown): value is Action {
  return typeof value === 'string' && (ACTIONS as string[]).includes(value)
}

const SECURITY_CARD_TYPES: SecurityCardType[] = ['visitor', 'vendor', 'supplier']
function isSecurityCardType(value: unknown): value is SecurityCardType {
  return typeof value === 'string' && (SECURITY_CARD_TYPES as string[]).includes(value)
}
// At the Lobby a guest swaps the card in hand for a Lobby VISITOR or VENDOR
// card. (Special Area and Photography cards are not swapped here any more:
// they go out with an Izin Area Special / Ijin Foto-Video, which lists them
// under "Kartu Sedang Digunakan" by itself. Rows that still hold one from
// before can be returned as usual.)
const SWAP_TYPES: SwapCardType[] = ['visitor', 'vendor']
function isSwapCardType(value: unknown): value is SwapCardType {
  return typeof value === 'string' && (SWAP_TYPES as string[]).includes(value)
}

const CARD_COLUMN: Record<CardType, CardColumn> = {
  visitor: 'visitor_card_barcode',
  vendor: 'vendor_card_barcode',
  supplier: 'supplier_card_barcode',
  affiliate: 'affiliate_card_barcode',
  special_area: 'special_area_card_barcode',
  photography: 'photography_card_barcode',
}
const CARD_LABEL: Record<CardType, string> = {
  visitor: 'Visitor',
  vendor: 'Vendor',
  supplier: 'Supplier',
  affiliate: 'Affiliate',
  special_area: 'Special Area',
  photography: 'Photography',
}

// A guest registered at Security holds the Security card until it is swapped
// at the Lobby (at_work_area), and again after swapping back.
function holdsSecurityCard(row: VendorRegistrationRow) {
  return row.entry_path === 'security' && row.stage === 'active' && !row.at_work_area
}

// Security's cards and the Lobby's are two different sets, so each is only
// checked against its own. A Security card stays out for the whole visit,
// also while the guest carries a Lobby card.
async function securityCardInUse(cardType: SecurityCardType, barcode: string, excludeId: string) {
  const result = await query(
    `SELECT 1 FROM vendor_registrations
     WHERE stage = 'active' AND entry_path = 'security' AND security_card_type = $1 AND security_card_barcode = $2 AND id <> $3`,
    [cardType, barcode, excludeId]
  )
  return result.rows.length > 0
}

async function lobbyCardInUse(cardType: CardType, barcode: string, excludeId: string) {
  const result = await query(
    `SELECT 1 FROM vendor_registrations
     WHERE stage = 'active' AND current_card_type = $1 AND ${CARD_COLUMN[cardType]} = $2 AND id <> $3
       AND (entry_path <> 'security' OR at_work_area)`,
    [cardType, barcode, excludeId]
  )
  return result.rows.length > 0
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  const session = getKioskAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  // A post that is switched off (Pengaturan Pos) can't change guest data.
  const off = await stationOffMessage(session.role)
  if (off) return NextResponse.json({ message: off }, { status: 403 })

  try {
    const body = await request.json() as {
      action?: string; barcode?: string; cardType?: string; securityCardType?: string
      fullName?: string; idCard?: string; picJai?: string; purpose?: string; companyRemark?: string; reason?: string
    }
    if (!isAction(body.action)) return NextResponse.json({ message: 'Aksi tidak valid.' }, { status: 400 })
    const barcode = normalizeCardNo(body.barcode)
    if (body.action !== 'editDetails' && body.action !== 'forceClose' && !barcode) return NextResponse.json({ message: 'Barcode wajib diisi.' }, { status: 400 })

    const existing = await query<VendorRegistrationRow>(`SELECT ${SELECT_COLUMNS} FROM vendor_registrations WHERE id = $1`, [id])
    const row = existing.rows[0]
    if (!row) return NextResponse.json({ message: 'Pendaftaran tidak ditemukan.' }, { status: 404 })

    switch (body.action) {
      case 'editDetails': {
        const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
        const idCard = typeof body.idCard === 'string' ? body.idCard.trim() : ''
        const picJai = typeof body.picJai === 'string' ? body.picJai.trim() : ''
        const purpose = typeof body.purpose === 'string' ? body.purpose.trim() : ''
        const companyRemark = typeof body.companyRemark === 'string' ? body.companyRemark.trim() : ''
        // Affiliate registrations carry no identity card / PIC JAI (stored as "-").
        const isAffiliate = row.current_card_type === 'affiliate' || row.affiliate_card_barcode !== null
        if (!fullName || !purpose || !companyRemark || (!isAffiliate && (!idCard || !picJai))) {
          return NextResponse.json({ message: 'Semua field data tamu wajib diisi.' }, { status: 400 })
        }
        // The kind of Security card can still be corrected until the card is handed out.
        const securityCardType = row.stage === 'pending_approval' && isSecurityCardType(body.securityCardType) ? body.securityCardType : row.security_card_type
        const result = await query<VendorRegistrationRow>(
          `UPDATE vendor_registrations
           SET full_name = $1, id_card = $2, pic_jai = $3, purpose = $4, company_remark = $5, security_card_type = $7
           WHERE id = $6 RETURNING ${SELECT_COLUMNS}`,
          [fullName, idCard || '-', picJai || '-', purpose, companyRemark, id, securityCardType]
        )
        await logActivity(session, 'update', 'vendor_registration', id, `Mengubah data pendaftaran "${row.full_name}"${fullName !== row.full_name ? ` menjadi "${fullName}"` : ''}`)
        return NextResponse.json({ registration: result.rows[0] })
      }
      case 'approve': {
        if (row.stage !== 'pending_approval') {
          return NextResponse.json({ message: 'Pendaftaran ini sudah diproses sebelumnya.' }, { status: 409 })
        }
        // The card handed out is the kind the guest was registered as.
        const cardType = row.security_card_type
        if (await securityCardInUse(cardType, barcode, id)) {
          return NextResponse.json({ message: `Barcode kartu ${CARD_LABEL[cardType]} ini sedang digunakan oleh tamu lain.` }, { status: 409 })
        }
        const result = await query<VendorRegistrationRow>(
          `UPDATE vendor_registrations
           SET security_card_barcode = $1, ${CARD_COLUMN[cardType]} = $1, current_card_type = $2,
               at_work_area = false, stage = 'active', entry_at = now()
           WHERE id = $3 RETURNING ${SELECT_COLUMNS}`,
          [barcode, cardType, id]
        )
        return NextResponse.json({ registration: result.rows[0] })
      }

      case 'swapToWorkArea': {
        if (!isSwapCardType(body.cardType)) {
          return NextResponse.json({ message: 'Jenis kartu tidak valid.' }, { status: 400 })
        }
        const fromSecurity = holdsSecurityCard(row)
        // A guest the Lobby registered itself with a Visitor card can move on to a Vendor card.
        const fromLobbyVisitor = row.stage === 'active' && row.entry_path !== 'security' && row.current_card_type === 'visitor' && body.cardType === 'vendor'
        // The card handed over is one of the Lobby's own of that kind (lib/card-ranges.ts).
        if (session.role !== 'security') {
          const wrong = lobbyCardProblem(barcode, body.cardType)
          if (wrong) return NextResponse.json({ message: wrong }, { status: 400 })
        }
        if (!fromSecurity && !fromLobbyVisitor) {
          return NextResponse.json({ message: 'Kartu tamu ini tidak bisa ditukar ke kartu tersebut.' }, { status: 409 })
        }
        if (await lobbyCardInUse(body.cardType, barcode, id)) {
          return NextResponse.json({ message: `Barcode kartu ${CARD_LABEL[body.cardType]} ini sedang digunakan oleh tamu lain.` }, { status: 409 })
        }
        const result = await query<VendorRegistrationRow>(
          `UPDATE vendor_registrations
           SET ${CARD_COLUMN[body.cardType]} = $1, current_card_type = $2, at_work_area = $4
           WHERE id = $3 RETURNING ${SELECT_COLUMNS}`,
          [barcode, body.cardType, id, fromSecurity]
        )
        return NextResponse.json({ registration: result.rows[0] })
      }

      case 'returnWorkArea': {
        const cardType = row.current_card_type
        const holdsWorkCard = row.stage === 'active' && cardType !== null && (row.entry_path === 'security'
          ? row.at_work_area
          : cardType === 'vendor' || cardType === 'special_area' || cardType === 'photography')
        if (!holdsWorkCard || !cardType) {
          return NextResponse.json({ message: 'Tamu ini tidak sedang memegang kartu area kerja.' }, { status: 409 })
        }
        if (row[CARD_COLUMN[cardType]] !== barcode) {
          return NextResponse.json({ message: `Barcode tidak cocok dengan kartu ${CARD_LABEL[cardType]} yang terdaftar.` }, { status: 400 })
        }
        // A guest who came through Security still has the Security card to
        // go back to (it is closed there); one the Lobby registered itself
        // has nothing underneath, so returning the card ends the visit.
        const result = row.entry_path === 'security'
          ? await query<VendorRegistrationRow>(
              `UPDATE vendor_registrations
               SET current_card_type = security_card_type, ${CARD_COLUMN[row.security_card_type]} = security_card_barcode, at_work_area = false
               WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
              [id]
            )
          : await query<VendorRegistrationRow>(
              `UPDATE vendor_registrations SET stage = 'closed', current_card_type = NULL, exit_at = now() WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
              [id]
            )
        return NextResponse.json({ registration: result.rows[0] })
      }

      case 'close': {
        if (row.entry_path !== 'security') {
          return NextResponse.json({ message: 'Pendaftaran ini ditutup lewat aksi pengembalian kartu langsung, bukan lewat Security.' }, { status: 409 })
        }
        if (!holdsSecurityCard(row)) {
          return NextResponse.json({ message: 'Tamu ini masih memegang kartu Lobby — tukar kembali di Lobby dulu.' }, { status: 409 })
        }
        if (row.security_card_barcode !== barcode) {
          return NextResponse.json({ message: `Barcode tidak cocok dengan kartu ${CARD_LABEL[row.security_card_type]} yang terdaftar.` }, { status: 400 })
        }
        const result = await query<VendorRegistrationRow>(
          `UPDATE vendor_registrations SET stage = 'closed', current_card_type = NULL, at_work_area = false, exit_at = now() WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
          [id]
        )
        return NextResponse.json({ registration: result.rows[0] })
      }

      // Closes a registration whose CURRENT card (whichever type it is) was
      // issued directly at Lobby, skipping Security entirely — the
      // complement of 'close' above, which only handles guests registered
      // at Security.
      case 'returnDirect': {
        if (row.stage !== 'active' || !row.current_card_type || row.entry_path === 'security') {
          return NextResponse.json({ message: 'Tamu ini tidak sedang memegang kartu yang diterbitkan langsung dari Lobby.' }, { status: 409 })
        }
        const cardType = row.current_card_type
        const column = CARD_COLUMN[cardType]
        if (row[column] !== barcode) {
          return NextResponse.json({ message: `Barcode tidak cocok dengan kartu ${CARD_LABEL[cardType]} yang terdaftar.` }, { status: 400 })
        }
        const result = await query<VendorRegistrationRow>(
          `UPDATE vendor_registrations SET stage = 'closed', current_card_type = NULL, exit_at = now() WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
          [id]
        )
        return NextResponse.json({ registration: result.rows[0] })
      }

      // "Tutup Manual": the card can't be scanned back (lost, the guest left
      // with it, a wrong number recorded). The visit is closed without the
      // card, every card on it is freed, and the reason stays on the record.
      case 'forceClose': {
        const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : ''
        if (reason.length < 3) return NextResponse.json({ message: 'Tulis alasannya (mis. kartu hilang).' }, { status: 400 })
        if (row.stage === 'closed') return NextResponse.json({ message: 'Pendaftaran ini sudah selesai.' }, { status: 409 })
        const card = row.current_card_type ? row[CARD_COLUMN[row.current_card_type]] : null
        const held = row.stage === 'active' && row.current_card_type
          ? `kartu ${CARD_LABEL[row.current_card_type]} ${card ?? ''}`.trim() + (row.entry_path === 'security' && row.at_work_area ? ` + kartu ${CARD_LABEL[row.security_card_type]} Security ${row.security_card_barcode ?? ''}`.trimEnd() : '')
          : 'belum memegang kartu'
        const note = `Ditutup manual oleh ${session.username}: ${reason}`
        const result = await query<VendorRegistrationRow>(
          `UPDATE vendor_registrations
           SET stage = 'closed', current_card_type = NULL, at_work_area = false, exit_at = now(), closed_note = $2
           WHERE id = $1 AND stage <> 'closed' RETURNING ${SELECT_COLUMNS}`,
          [id, note]
        )
        if (!result.rows[0]) return NextResponse.json({ message: 'Pendaftaran ini sudah selesai.' }, { status: 409 })
        await logActivity(session, 'update', 'vendor_registration', id, `Menutup manual pendaftaran "${row.full_name}" (${held}) — ${reason}`)
        return NextResponse.json({ registration: result.rows[0] })
      }
    }
  } catch (error) {
    console.error('[vendor-registrations/[id]/PUT]', error)
    return NextResponse.json({ message: 'Gagal memperbarui pendaftaran.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  const session = getKioskAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  // A post that is switched off (Pengaturan Pos) can't change guest data.
  const off = await stationOffMessage(session.role)
  if (off) return NextResponse.json({ message: off }, { status: 403 })

  try {
    const result = await query<{ id: number; full_name: string }>('DELETE FROM vendor_registrations WHERE id = $1 RETURNING id, full_name', [id])
    if (result.rows.length === 0) return NextResponse.json({ message: 'Pendaftaran tidak ditemukan.' }, { status: 404 })
    await logActivity(session, 'delete', 'vendor_registration', id, `Menghapus pendaftaran "${result.rows[0].full_name}"`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[vendor-registrations/[id]/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus pendaftaran.' }, { status: 500 })
  }
}
