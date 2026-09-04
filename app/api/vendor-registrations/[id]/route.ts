import { NextRequest, NextResponse } from 'next/server'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'

type EntryPath = 'security' | 'lobby_affiliate'
type Stage = 'pending_approval' | 'active' | 'closed'
type CardType = 'visitor' | 'vendor' | 'affiliate'
type Action = 'approve' | 'swapToVendor' | 'returnVendor' | 'close' | 'returnAffiliate'

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

const ACTIONS: Action[] = ['approve', 'swapToVendor', 'returnVendor', 'close', 'returnAffiliate']
function isAction(value: unknown): value is Action {
  return typeof value === 'string' && (ACTIONS as string[]).includes(value)
}

async function barcodeInUse(column: 'visitor_card_barcode' | 'vendor_card_barcode' | 'affiliate_card_barcode', cardType: CardType, barcode: string, excludeId: string) {
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
  if (!getKioskAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json() as { action?: string; barcode?: string }
    if (!isAction(body.action)) return NextResponse.json({ message: 'Aksi tidak valid.' }, { status: 400 })
    const barcode = typeof body.barcode === 'string' ? body.barcode.trim() : ''
    if (!barcode) return NextResponse.json({ message: 'Barcode wajib diisi.' }, { status: 400 })

    const existing = await query<VendorRegistrationRow>(`SELECT ${SELECT_COLUMNS} FROM vendor_registrations WHERE id = $1`, [id])
    const row = existing.rows[0]
    if (!row) return NextResponse.json({ message: 'Pendaftaran tidak ditemukan.' }, { status: 404 })

    switch (body.action) {
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

      case 'swapToVendor': {
        if (row.stage !== 'active' || row.current_card_type !== 'visitor') {
          return NextResponse.json({ message: 'Tamu ini tidak sedang memegang kartu Visitor.' }, { status: 409 })
        }
        if (await barcodeInUse('vendor_card_barcode', 'vendor', barcode, id)) {
          return NextResponse.json({ message: 'Barcode kartu Vendor ini sedang digunakan oleh tamu lain.' }, { status: 409 })
        }
        const result = await query<VendorRegistrationRow>(
          `UPDATE vendor_registrations
           SET vendor_card_barcode = $1, current_card_type = 'vendor'
           WHERE id = $2 RETURNING ${SELECT_COLUMNS}`,
          [barcode, id]
        )
        return NextResponse.json({ registration: result.rows[0] })
      }

      case 'returnVendor': {
        if (row.stage !== 'active' || row.current_card_type !== 'vendor') {
          return NextResponse.json({ message: 'Tamu ini tidak sedang memegang kartu Vendor.' }, { status: 409 })
        }
        if (row.vendor_card_barcode !== barcode) {
          return NextResponse.json({ message: 'Barcode tidak cocok dengan kartu Vendor yang terdaftar.' }, { status: 400 })
        }
        const result = await query<VendorRegistrationRow>(
          `UPDATE vendor_registrations SET current_card_type = 'visitor' WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
          [id]
        )
        return NextResponse.json({ registration: result.rows[0] })
      }

      case 'close': {
        if (row.entry_path !== 'security') {
          return NextResponse.json({ message: 'Pendaftaran Affiliate ditutup lewat Lobby, bukan Security.' }, { status: 409 })
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

      case 'returnAffiliate': {
        if (row.stage !== 'active' || row.current_card_type !== 'affiliate') {
          return NextResponse.json({ message: 'Tamu ini tidak sedang memegang kartu Affiliate.' }, { status: 409 })
        }
        if (row.affiliate_card_barcode !== barcode) {
          return NextResponse.json({ message: 'Barcode tidak cocok dengan kartu Affiliate yang terdaftar.' }, { status: 400 })
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
