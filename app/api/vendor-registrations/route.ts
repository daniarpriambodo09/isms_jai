import { NextRequest, NextResponse } from 'next/server'
import { stationOffMessage } from '@/lib/kiosk-stations'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

type EntryPath = 'security' | 'lobby_affiliate'
type Stage = 'pending_approval' | 'active' | 'closed'
type CardType = 'visitor' | 'vendor' | 'affiliate' | 'special_area' | 'photography'

const CARD_TYPES: CardType[] = ['visitor', 'vendor', 'affiliate', 'special_area', 'photography']
function isCardType(value: unknown): value is CardType { return typeof value === 'string' && (CARD_TYPES as string[]).includes(value) }
const CARD_COLUMN: Record<CardType, 'visitor_card_barcode' | 'vendor_card_barcode' | 'affiliate_card_barcode' | 'special_area_card_barcode' | 'photography_card_barcode'> = {
  visitor: 'visitor_card_barcode',
  vendor: 'vendor_card_barcode',
  affiliate: 'affiliate_card_barcode',
  special_area: 'special_area_card_barcode',
  photography: 'photography_card_barcode',
}
const CARD_LABEL: Record<CardType, string> = {
  visitor: 'Visitor',
  vendor: 'Vendor',
  affiliate: 'Affiliate',
  special_area: 'Special Area',
  photography: 'Photography',
}

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
}

const SELECT_COLUMNS = `id, full_name, id_card, pic_jai, purpose, company_remark,
  registered_at, entry_at, exit_at, created_by, entry_path, registered_station, stage, current_card_type,
  visitor_card_barcode, vendor_card_barcode, affiliate_card_barcode,
  special_area_card_barcode, photography_card_barcode`

function maskIdCard(idCard: string | null): string {
  if (!idCard) return ''
  return idCard.length <= 4 ? '*'.repeat(idCard.length) : `${idCard.slice(0, 2)}${'*'.repeat(idCard.length - 4)}${idCard.slice(-2)}`
}

export async function GET(request: NextRequest) {
  const session = getKioskAdminFromRequest(request)

  try {
    const stage = request.nextUrl.searchParams.get('stage')
    const entryPath = request.nextUrl.searchParams.get('entryPath')
    const sort = request.nextUrl.searchParams.get('sort') === 'oldest' ? 'ASC' : 'DESC'

    const conditions: string[] = []
    const values: string[] = []
    if (stage) { values.push(stage); conditions.push(`stage = $${values.length}`) }
    if (entryPath) { values.push(entryPath); conditions.push(`entry_path = $${values.length}`) }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await query<VendorRegistrationRow>(
      `SELECT ${SELECT_COLUMNS} FROM vendor_registrations ${whereClause} ORDER BY registered_at ${sort}`,
      values
    )
    const registrations = session
      ? result.rows
      : result.rows.map((row) => ({ ...row, id_card: maskIdCard(row.id_card) }))

    return NextResponse.json({ registrations })
  } catch (error) {
    console.error('[vendor-registrations/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar pendaftaran.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getKioskAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  // A post that is switched off (Pengaturan Pos) can't change guest data.
  const off = await stationOffMessage(session.role)
  if (off) return NextResponse.json({ message: off }, { status: 403 })

  try {
    const body = await request.json() as Partial<Record<'fullName' | 'idCard' | 'picJai' | 'purpose' | 'companyRemark' | 'cardType' | 'barcode' | 'station', string>>
    // Where the guest is being registered ("Asal"): a kiosk account is its own
    // post; the ISM Admin works from whichever kiosk page they have open.
    const station = session.role === 'security' ? 'security' : session.role === 'lobby' ? 'lobby' : body.station === 'security' ? 'security' : 'lobby'
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const idCard = typeof body.idCard === 'string' ? body.idCard.trim() : ''
    const picJai = typeof body.picJai === 'string' ? body.picJai.trim() : ''
    const purpose = typeof body.purpose === 'string' ? body.purpose.trim() : ''
    const companyRemark = typeof body.companyRemark === 'string' ? body.companyRemark.trim() : ''
    const barcode = typeof body.barcode === 'string' ? body.barcode.trim() : ''

    // Affiliate guests (Yazaki group colleagues) are registered without an
    // identity card or a PIC JAI to meet — both stored as "-" (NOT NULL columns).
    const isAffiliate = body.cardType === 'affiliate'

    if (!fullName) return NextResponse.json({ message: 'Nama lengkap wajib diisi.' }, { status: 400 })
    if (!idCard && !isAffiliate) return NextResponse.json({ message: 'Kartu identitas wajib diisi.' }, { status: 400 })
    if (!picJai && !isAffiliate) return NextResponse.json({ message: 'PIC JAI yang ditemui wajib diisi.' }, { status: 400 })
    if (!purpose) return NextResponse.json({ message: 'Tujuan wajib diisi.' }, { status: 400 })
    if (!companyRemark) return NextResponse.json({ message: 'Keterangan (perusahaan) wajib diisi.' }, { status: 400 })

    // Direct-issue path: Lobby registers and issues the card in one step,
    // for any of the five card types (Visitor, Vendor, Special Area,
    // Photography, Affiliate) — skipping Security's pending-approval flow.
    if (body.cardType) {
      if (!isCardType(body.cardType)) return NextResponse.json({ message: 'Jenis kartu tidak valid.' }, { status: 400 })
      if (!barcode) return NextResponse.json({ message: 'Barcode kartu wajib diisi.' }, { status: 400 })
      const cardType = body.cardType
      const column = CARD_COLUMN[cardType]

      const collision = await query(
        `SELECT 1 FROM vendor_registrations WHERE stage = 'active' AND current_card_type = $1 AND ${column} = $2`,
        [cardType, barcode]
      )
      if (collision.rows.length > 0) {
        return NextResponse.json({ message: `Barcode kartu ${CARD_LABEL[cardType]} ini sedang digunakan oleh tamu lain.` }, { status: 409 })
      }

      const result = await query<VendorRegistrationRow>(
        `INSERT INTO vendor_registrations
           (full_name, id_card, pic_jai, purpose, company_remark, created_by,
            entry_path, stage, current_card_type, ${column}, entry_at, registered_station)
         VALUES ($1, $2, $3, $4, $5, $6, 'lobby_affiliate', 'active', $7, $8, now(), $9)
         RETURNING ${SELECT_COLUMNS}`,
        [fullName, idCard || '-', picJai || '-', purpose, companyRemark, session.username, cardType, barcode, station]
      )
      await logActivity(session, 'create', 'vendor_registration', result.rows[0].id, `Mendaftarkan tamu ${CARD_LABEL[cardType]} "${result.rows[0].full_name}"`)
      return NextResponse.json({ registration: result.rows[0] }, { status: 201 })
    }

    // Default path: Security registers, still pending approval (no card yet).
    const result = await query<VendorRegistrationRow>(
      `INSERT INTO vendor_registrations (full_name, id_card, pic_jai, purpose, company_remark, created_by, registered_station)
       VALUES ($1, $2, $3, $4, $5, $6, 'security')
       RETURNING ${SELECT_COLUMNS}`,
      [fullName, idCard, picJai, purpose, companyRemark, session.username]
    )
    await logActivity(session, 'create', 'vendor_registration', result.rows[0].id, `Mendaftarkan tamu "${result.rows[0].full_name}"`)
    return NextResponse.json({ registration: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[vendor-registrations/POST]', error)
    return NextResponse.json({ message: 'Gagal menyimpan pendaftaran.' }, { status: 500 })
  }
}
