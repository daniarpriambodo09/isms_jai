import { NextRequest, NextResponse } from 'next/server'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'

type EntryPath = 'security' | 'lobby_affiliate'
type Stage = 'pending_approval' | 'active' | 'closed'
type CardType = 'visitor' | 'vendor' | 'affiliate'

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
}

const SELECT_COLUMNS = `id, full_name, id_card, pic_jai, purpose, company_remark,
  registered_at, entry_at, exit_at, created_by, entry_path, stage, current_card_type,
  visitor_card_barcode, vendor_card_barcode, affiliate_card_barcode`

export async function GET(request: NextRequest) {
  const session = getKioskAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

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
    return NextResponse.json({ registrations: result.rows })
  } catch (error) {
    console.error('[vendor-registrations/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar pendaftaran.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getKioskAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json() as Partial<Record<'fullName' | 'idCard' | 'picJai' | 'purpose' | 'companyRemark' | 'affiliateBarcode', string>>
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const idCard = typeof body.idCard === 'string' ? body.idCard.trim() : ''
    const picJai = typeof body.picJai === 'string' ? body.picJai.trim() : ''
    const purpose = typeof body.purpose === 'string' ? body.purpose.trim() : ''
    const companyRemark = typeof body.companyRemark === 'string' ? body.companyRemark.trim() : ''
    const affiliateBarcode = typeof body.affiliateBarcode === 'string' ? body.affiliateBarcode.trim() : ''

    if (!fullName) return NextResponse.json({ message: 'Nama lengkap wajib diisi.' }, { status: 400 })
    if (!idCard) return NextResponse.json({ message: 'Kartu identitas wajib diisi.' }, { status: 400 })
    if (!picJai) return NextResponse.json({ message: 'PIC JAI yang ditemui wajib diisi.' }, { status: 400 })
    if (!purpose) return NextResponse.json({ message: 'Tujuan wajib diisi.' }, { status: 400 })
    if (!companyRemark) return NextResponse.json({ message: 'Keterangan (perusahaan) wajib diisi.' }, { status: 400 })

    // Affiliate path: Lobby registers and issues the card in one step.
    if (affiliateBarcode) {
      const collision = await query(
        `SELECT 1 FROM vendor_registrations WHERE stage = 'active' AND current_card_type = 'affiliate' AND affiliate_card_barcode = $1`,
        [affiliateBarcode]
      )
      if (collision.rows.length > 0) {
        return NextResponse.json({ message: 'Barcode kartu Affiliate ini sedang digunakan oleh tamu lain.' }, { status: 409 })
      }

      const result = await query<VendorRegistrationRow>(
        `INSERT INTO vendor_registrations
           (full_name, id_card, pic_jai, purpose, company_remark, created_by,
            entry_path, stage, current_card_type, affiliate_card_barcode, entry_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'lobby_affiliate', 'active', 'affiliate', $7, now())
         RETURNING ${SELECT_COLUMNS}`,
        [fullName, idCard, picJai, purpose, companyRemark, session.username, affiliateBarcode]
      )
      return NextResponse.json({ registration: result.rows[0] }, { status: 201 })
    }

    // Default path: Security registers, still pending approval (no card yet).
    const result = await query<VendorRegistrationRow>(
      `INSERT INTO vendor_registrations (full_name, id_card, pic_jai, purpose, company_remark, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SELECT_COLUMNS}`,
      [fullName, idCard, picJai, purpose, companyRemark, session.username]
    )
    return NextResponse.json({ registration: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[vendor-registrations/POST]', error)
    return NextResponse.json({ message: 'Gagal menyimpan pendaftaran.' }, { status: 500 })
  }
}
