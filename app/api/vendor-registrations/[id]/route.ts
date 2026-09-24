import { NextRequest, NextResponse } from 'next/server'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

type EntryPath = 'security' | 'lobby_affiliate'
type Stage = 'pending_approval' | 'active' | 'closed'
type CardType = 'visitor' | 'vendor' | 'affiliate' | 'special_area' | 'photography'
type WorkAreaCardType = 'vendor' | 'special_area' | 'photography'
type Action = 'approve' | 'swapToWorkArea' | 'returnWorkArea' | 'close' | 'returnDirect' | 'editDetails'
type WorkAreaColumn = 'vendor_card_barcode' | 'special_area_card_barcode' | 'photography_card_barcode'
type CardColumn = WorkAreaColumn | 'visitor_card_barcode' | 'affiliate_card_barcode'

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
  registered_at, entry_at, exit_at, created_by, entry_path, stage, current_card_type,
  visitor_card_barcode, vendor_card_barcode, affiliate_card_barcode,
  special_area_card_barcode, photography_card_barcode`

const ACTIONS: Action[] = ['approve', 'swapToWorkArea', 'returnWorkArea', 'close', 'returnDirect', 'editDetails']
function isAction(value: unknown): value is Action {
  return typeof value === 'string' && (ACTIONS as string[]).includes(value)
}

// The card types a guest can swap into at Lobby once they hold a Visitor card,
// depending on which area they're entering — Vendor, Special Area, or
// Photography all follow the identical swap-in / scan-to-return pattern, just
// against a different barcode column, so they share one implementation here.
const WORK_AREA_TYPES: WorkAreaCardType[] = ['vendor', 'special_area', 'photography']
function isWorkAreaCardType(value: unknown): value is WorkAreaCardType {
  return typeof value === 'string' && (WORK_AREA_TYPES as string[]).includes(value)
}
const WORK_AREA_COLUMN: Record<WorkAreaCardType, WorkAreaColumn> = {
  vendor: 'vendor_card_barcode',
  special_area: 'special_area_card_barcode',
  photography: 'photography_card_barcode',
}
const WORK_AREA_LABEL: Record<WorkAreaCardType, string> = {
  vendor: 'Vendor',
  special_area: 'Special Area',
  photography: 'Photography',
}

// Full mapping (all five card types) used by the direct-issue return/close
// action below — WORK_AREA_COLUMN/LABEL above only cover the three
// swap-in-and-out-of types.
const CARD_COLUMN: Record<CardType, CardColumn> = {
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

async function barcodeInUse(column: string, cardType: CardType, barcode: string, excludeId: string) {
  const result = await query(
    `SELECT 1 FROM vendor_registrations
     WHERE stage = 'active' AND current_card_type = $1 AND ${column} = $2 AND id <> $3`,
    [cardType, barcode, excludeId]
  )
  return result.rows.length > 0
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  const session = getKioskAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json() as {
      action?: string; barcode?: string; cardType?: string
      fullName?: string; idCard?: string; picJai?: string; purpose?: string; companyRemark?: string
    }
    if (!isAction(body.action)) return NextResponse.json({ message: 'Aksi tidak valid.' }, { status: 400 })
    const barcode = typeof body.barcode === 'string' ? body.barcode.trim() : ''
    if (body.action !== 'editDetails' && !barcode) return NextResponse.json({ message: 'Barcode wajib diisi.' }, { status: 400 })

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
        if (!fullName || !idCard || !picJai || !purpose || !companyRemark) {
          return NextResponse.json({ message: 'Semua field data tamu wajib diisi.' }, { status: 400 })
        }
        const result = await query<VendorRegistrationRow>(
          `UPDATE vendor_registrations
           SET full_name = $1, id_card = $2, pic_jai = $3, purpose = $4, company_remark = $5
           WHERE id = $6 RETURNING ${SELECT_COLUMNS}`,
          [fullName, idCard, picJai, purpose, companyRemark, id]
        )
        await logActivity(session, 'update', 'vendor_registration', id, `Mengubah data pendaftaran "${row.full_name}"${fullName !== row.full_name ? ` menjadi "${fullName}"` : ''}`)
        return NextResponse.json({ registration: result.rows[0] })
      }
      case 'approve': {
        if (row.stage !== 'pending_approval') {
          return NextResponse.json({ message: 'Pendaftaran ini sudah diproses sebelumnya.' }, { status: 409 })
        }
        if (await barcodeInUse('visitor_card_barcode', 'visitor', barcode, id)) {
          return NextResponse.json({ message: 'Barcode kartu Visitor ini sedang digunakan oleh tamu lain.' }, { status: 409 })
        }
        const result = await query<VendorRegistrationRow>(
          `UPDATE vendor_registrations
           SET visitor_card_barcode = $1, current_card_type = 'visitor', stage = 'active', entry_at = now()
           WHERE id = $2 RETURNING ${SELECT_COLUMNS}`,
          [barcode, id]
        )
        return NextResponse.json({ registration: result.rows[0] })
      }

      case 'swapToWorkArea': {
        if (!isWorkAreaCardType(body.cardType)) {
          return NextResponse.json({ message: 'Jenis kartu tidak valid.' }, { status: 400 })
        }
        if (row.stage !== 'active' || row.current_card_type !== 'visitor') {
          return NextResponse.json({ message: 'Tamu ini tidak sedang memegang kartu Visitor.' }, { status: 409 })
        }
        const column = WORK_AREA_COLUMN[body.cardType]
        if (await barcodeInUse(column, body.cardType, barcode, id)) {
          return NextResponse.json({ message: `Barcode kartu ${WORK_AREA_LABEL[body.cardType]} ini sedang digunakan oleh tamu lain.` }, { status: 409 })
        }
        const result = await query<VendorRegistrationRow>(
          `UPDATE vendor_registrations
           SET ${column} = $1, current_card_type = $2
           WHERE id = $3 RETURNING ${SELECT_COLUMNS}`,
          [barcode, body.cardType, id]
        )
        return NextResponse.json({ registration: result.rows[0] })
      }

      case 'returnWorkArea': {
        if (row.stage !== 'active' || !isWorkAreaCardType(row.current_card_type)) {
          return NextResponse.json({ message: 'Tamu ini tidak sedang memegang kartu area kerja.' }, { status: 409 })
        }
        const cardType = row.current_card_type
        const column = WORK_AREA_COLUMN[cardType]
        if (row[column] !== barcode) {
          return NextResponse.json({ message: `Barcode tidak cocok dengan kartu ${WORK_AREA_LABEL[cardType]} yang terdaftar.` }, { status: 400 })
        }
        // Only a registration that went through Security first (and so
        // still physically holds a Visitor card underneath) reverts to
        // 'visitor' here — one issued directly at Lobby never had a
        // Visitor card to fall back to, so returning it closes the
        // registration entirely instead.
        const result = row.entry_path === 'security'
          ? await query<VendorRegistrationRow>(
              `UPDATE vendor_registrations SET current_card_type = 'visitor' WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
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
        if (row.stage !== 'active' || row.current_card_type !== 'visitor') {
          return NextResponse.json({ message: 'Tamu ini tidak sedang memegang kartu Visitor.' }, { status: 409 })
        }
        if (row.visitor_card_barcode !== barcode) {
          return NextResponse.json({ message: 'Barcode tidak cocok dengan kartu Visitor yang terdaftar.' }, { status: 400 })
        }
        const result = await query<VendorRegistrationRow>(
          `UPDATE vendor_registrations SET stage = 'closed', current_card_type = NULL, exit_at = now() WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
          [id]
        )
        return NextResponse.json({ registration: result.rows[0] })
      }

      // Closes a registration whose CURRENT card (whichever of the five
      // types it is) was issued directly at Lobby, skipping Security
      // entirely — the complement of 'close' above, which only handles
      // Security-registered Visitors.
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
