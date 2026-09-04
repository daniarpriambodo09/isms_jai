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

// Look up a guest by whichever card they're currently holding (Lobby scans the
// physical card in front of them — could be a VISITOR, VENDOR, or AFFILIATE card).
export async function GET(request: NextRequest) {
  if (!getKioskAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const barcode = request.nextUrl.searchParams.get('barcode')?.trim()
    if (!barcode) return NextResponse.json({ message: 'Barcode wajib diisi.' }, { status: 400 })

    const result = await query<VendorRegistrationRow>(
      `SELECT ${SELECT_COLUMNS} FROM vendor_registrations
       WHERE stage = 'active' AND (
         (current_card_type = 'visitor' AND visitor_card_barcode = $1) OR
         (current_card_type = 'vendor' AND vendor_card_barcode = $1) OR
         (current_card_type = 'affiliate' AND affiliate_card_barcode = $1)
       )
       LIMIT 1`,
      [barcode]
    )
    if (result.rows.length === 0) {
      return NextResponse.json({ message: 'Tidak ada tamu aktif dengan barcode kartu ini.' }, { status: 404 })
    }
    return NextResponse.json({ registration: result.rows[0] })
  } catch (error) {
    console.error('[vendor-registrations/search/GET]', error)
    return NextResponse.json({ message: 'Gagal mencari data.' }, { status: 500 })
  }
}
