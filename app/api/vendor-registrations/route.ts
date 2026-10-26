import { NextRequest, NextResponse } from 'next/server'
import { stationOffMessage } from '@/lib/kiosk-stations'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { query, withTransaction } from '@/lib/db'
import { parseVisitDate } from '@/lib/visit-date'
import { COMPANIONS_SQL, parseCompanions, replaceCompanions, type Companion } from '@/lib/registration-companions'
import { logActivity } from '@/lib/activity-log'
import { lobbyCardProblem, normalizeCardNo } from '@/lib/card-ranges'

type EntryPath = 'security' | 'lobby_affiliate'
type Stage = 'pending_approval' | 'active' | 'closed'
type CardType = 'visitor' | 'vendor' | 'supplier' | 'affiliate' | 'special_area' | 'photography'
type SecurityCardType = 'visitor' | 'vendor' | 'supplier'
const SECURITY_CARD_TYPES: SecurityCardType[] = ['visitor', 'vendor', 'supplier']

type LobbyCardType = Exclude<CardType, 'supplier'>
const CARD_TYPES: LobbyCardType[] = ['visitor', 'vendor', 'affiliate', 'special_area', 'photography']
function isCardType(value: unknown): value is LobbyCardType { return typeof value === 'string' && (CARD_TYPES as string[]).includes(value) }
const CARD_COLUMN: Record<LobbyCardType, 'visitor_card_barcode' | 'vendor_card_barcode' | 'affiliate_card_barcode' | 'special_area_card_barcode' | 'photography_card_barcode'> = {
  visitor: 'visitor_card_barcode',
  vendor: 'vendor_card_barcode',
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
  visit_date: string | null
  id_verified_at: string | null
  id_verified_by: string | null
  id_returned_at: string | null
  companions: Companion[]
}

const SELECT_COLUMNS = `id, full_name, id_card, pic_jai, purpose, company_remark,
  registered_at, entry_at, exit_at, created_by, entry_path, registered_station, stage, current_card_type,
  visitor_card_barcode, vendor_card_barcode, affiliate_card_barcode,
  special_area_card_barcode, photography_card_barcode, supplier_card_barcode,
  security_card_type, security_card_barcode, at_work_area, closed_note,
  to_char(visit_date, 'YYYY-MM-DD') AS visit_date,
  id_verified_at, id_verified_by, id_returned_at, ${COMPANIONS_SQL}`

function maskIdCard(idCard: string | null): string {
  if (!idCard) return ''
  return idCard.length <= 4 ? '*'.repeat(idCard.length) : `${idCard.slice(0, 2)}${'*'.repeat(idCard.length - 4)}${idCard.slice(-2)}`
}

export async function GET(request: NextRequest) {
  const session = getKioskAdminFromRequest(request)

  try {
    const params = request.nextUrl.searchParams
    const stage = params.get('stage')
    const entryPath = params.get('entryPath')
    const sort = request.nextUrl.searchParams.get('sort') === 'oldest' ? 'ASC' : 'DESC'
    const station = params.get('station')
    const context = params.get('context')
    const month = params.get('month')
    const year = params.get('year')
    const search = params.get('query')?.trim()
    const hasPagination = params.has('page') || params.has('limit')
    const requestedPage = Number(params.get('page'))
    const requestedLimit = Number(params.get('limit'))
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 10_000) : 20

    const conditions: string[] = []
    const values: (string | number)[] = []
    const stationSql = `COALESCE(registered_station, CASE WHEN entry_path = 'security' THEN 'security' ELSE 'lobby' END)`
    if (stage) { values.push(stage); conditions.push(`stage = $${values.length}`) }
    if (entryPath) { values.push(entryPath); conditions.push(`entry_path = $${values.length}`) }
    if (station === 'lobby' || station === 'security') { values.push(station); conditions.push(`${stationSql} = $${values.length}`) }
    if (context === 'lobby') conditions.push(`${stationSql} = 'lobby'`)
    if (context === 'waiting_security') conditions.push(`${stationSql} = 'security' AND stage = 'pending_approval'`)
    if (context === 'holding_lobby') conditions.push(`stage = 'active' AND (entry_path <> 'security' OR at_work_area)`)
    if (context === 'closed') conditions.push(`stage = 'closed'`)
    if (month != null && /^(0|[1-9]|1[01])$/.test(month)) { values.push(Number(month) + 1); conditions.push(`EXTRACT(MONTH FROM registered_at AT TIME ZONE 'Asia/Jakarta') = $${values.length}`) }
    if (year != null && /^\d{4}$/.test(year)) { values.push(Number(year)); conditions.push(`EXTRACT(YEAR FROM registered_at AT TIME ZONE 'Asia/Jakarta') = $${values.length}`) }
    if (search) {
      values.push(`%${search}%`)
      conditions.push(`(full_name ILIKE $${values.length} OR pic_jai ILIKE $${values.length} OR company_remark ILIKE $${values.length})`)
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = hasPagination
      ? await query<VendorRegistrationRow>(
          `SELECT ${SELECT_COLUMNS} FROM vendor_registrations ${whereClause} ORDER BY registered_at ${sort} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
          [...values, limit, (page - 1) * limit]
        )
      : await query<VendorRegistrationRow>(`SELECT ${SELECT_COLUMNS} FROM vendor_registrations ${whereClause} ORDER BY registered_at ${sort}`, values)
    const registrations = session
      ? result.rows
      : result.rows.map((row) => ({ ...row, id_card: maskIdCard(row.id_card), companions: row.companions.map((c) => ({ ...c, id_no: maskIdCard(c.id_no) })) }))
    if (!hasPagination) return NextResponse.json({ registrations })

    const [totalResult, yearsResult] = await Promise.all([
      query<{ total: string }>(`SELECT count(*)::text AS total FROM vendor_registrations ${whereClause}`, values),
      query<{ year: string }>(`SELECT DISTINCT EXTRACT(YEAR FROM registered_at AT TIME ZONE 'Asia/Jakarta')::text AS year FROM vendor_registrations ${whereClause} ORDER BY year DESC`, values),
    ])
    return NextResponse.json({
      registrations,
      pagination: { page, limit, total: Number(totalResult.rows[0]?.total ?? 0) },
      years: yearsResult.rows.map((row) => Number(row.year)).filter(Number.isFinite),
    })
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
    const body = await request.json() as Partial<Record<'fullName' | 'idCard' | 'picJai' | 'purpose' | 'companyRemark' | 'cardType' | 'barcode' | 'station' | 'securityCardType' | 'visitDate', string>> & { companions?: unknown }
    // Where the guest is being registered ("Asal"): a kiosk account is its own
    // post; the ISM Admin works from whichever kiosk page they have open.
    const station = session.role === 'security' ? 'security' : session.role === 'lobby' ? 'lobby' : body.station === 'security' ? 'security' : 'lobby'
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const idCard = typeof body.idCard === 'string' ? body.idCard.trim() : ''
    const picJai = typeof body.picJai === 'string' ? body.picJai.trim() : ''
    const purpose = typeof body.purpose === 'string' ? body.purpose.trim() : ''
    const companyRemark = typeof body.companyRemark === 'string' ? body.companyRemark.trim() : ''
    const barcode = normalizeCardNo(body.barcode)

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
      // At the Lobby the number must be one of that kind's own cards (lib/card-ranges.ts).
      // (Pos Security, when it runs the whole flow by itself, hands out its own set.)
      if (station === 'lobby') {
        const wrong = lobbyCardProblem(barcode, cardType)
        if (wrong) return NextResponse.json({ message: wrong }, { status: 400 })
      }
      const column = CARD_COLUMN[cardType]

      const collision = await query(
        // Lobby cards only: a Security card of the same kind is another set.
        `SELECT 1 FROM vendor_registrations WHERE stage = 'active' AND current_card_type = $1 AND ${column} = $2
           AND (entry_path <> 'security' OR at_work_area)`,
        [cardType, barcode]
      )
      if (collision.rows.length > 0) {
        return NextResponse.json({ message: `Barcode kartu ${CARD_LABEL[cardType]} ini sedang digunakan oleh tamu lain.` }, { status: 409 })
      }

      const directVisitDate = parseVisitDate(body.visitDate)
      if (directVisitDate === undefined) return NextResponse.json({ message: 'Tanggal kunjungan tidak valid.' }, { status: 400 })
      const directCompanions = parseCompanions(body.companions)
      if (directCompanions === undefined) return NextResponse.json({ message: 'Data orang tambahan tidak valid: nama dan nomor KTP wajib diisi keduanya (maks. 20 orang).' }, { status: 400 })

      const direct = await withTransaction(async () => {
        const result = await query<VendorRegistrationRow>(
          `INSERT INTO vendor_registrations
             (full_name, id_card, pic_jai, purpose, company_remark, created_by,
              entry_path, stage, current_card_type, ${column}, entry_at, registered_station, visit_date)
           VALUES ($1, $2, $3, $4, $5, $6, 'lobby_affiliate', 'active', $7, $8, now(), $9, $10)
           RETURNING ${SELECT_COLUMNS}`,
          [fullName, idCard || '-', picJai || '-', purpose, companyRemark, session.username, cardType, barcode, station, directVisitDate]
        )
        await replaceCompanions(result.rows[0].id, directCompanions ?? [])
        return { ...result.rows[0], companions: directCompanions ?? [] }
      })
      await logActivity(session, 'create', 'vendor_registration', direct.id, `Mendaftarkan tamu ${CARD_LABEL[cardType]} "${direct.full_name}"${direct.companions.length ? ` + ${direct.companions.length} orang` : ''}`)
      return NextResponse.json({ registration: direct }, { status: 201 })
    }

    // Default path: Security registers, still pending approval (no card yet).
    // The guest is registered as a Visitor, Vendor or Supplier — the kind of
    // Security card handed out at approval.
    const securityCardType = SECURITY_CARD_TYPES.find((type) => type === body.securityCardType) ?? 'visitor'
    const visitDate = parseVisitDate(body.visitDate)
    if (visitDate === undefined) return NextResponse.json({ message: 'Tanggal kunjungan tidak valid.' }, { status: 400 })
    const companions = parseCompanions(body.companions)
    if (companions === undefined) return NextResponse.json({ message: 'Data orang tambahan tidak valid: nama dan nomor KTP wajib diisi keduanya (maks. 20 orang).' }, { status: 400 })
    const row = await withTransaction(async () => {
      const result = await query<VendorRegistrationRow>(
        `INSERT INTO vendor_registrations (full_name, id_card, pic_jai, purpose, company_remark, created_by, registered_station, security_card_type, visit_date)
         VALUES ($1, $2, $3, $4, $5, $6, 'security', $7, $8)
         RETURNING ${SELECT_COLUMNS}`,
        [fullName, idCard, picJai, purpose, companyRemark, session.username, securityCardType, visitDate]
      )
      await replaceCompanions(result.rows[0].id, companions ?? [])
      return { ...result.rows[0], companions: companions ?? [] }
    })
    await logActivity(session, 'create', 'vendor_registration', row.id, `Mendaftarkan tamu ${CARD_LABEL[securityCardType]} "${row.full_name}"${row.companions.length ? ` + ${row.companions.length} orang` : ''}`)
    return NextResponse.json({ registration: row }, { status: 201 })
  } catch (error) {
    console.error('[vendor-registrations/POST]', error)
    return NextResponse.json({ message: 'Gagal menyimpan pendaftaran.' }, { status: 500 })
  }
}
