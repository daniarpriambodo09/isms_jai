// app/api/special-area-requests/route.ts
//
// Pengajuan Ijin Masuk Area Special Security. Listing and submitting are
// kiosk-level (Lobby, Security, ISM Admin — the same roles as the vendor
// registrations); the decision itself is made by the IAA via the emailed link.

import { NextRequest, NextResponse } from 'next/server'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'
import { recordNotification } from '@/lib/admin-notifications'
import { SELECT_COLUMNS, ensureSpecialAreaSchema, getRequest, sendApprovalRequest } from '@/lib/special-area'
import type { SpecialAreaRequest } from '@/lib/special-area-shared'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!getKioskAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    await ensureSpecialAreaSchema()
    const status = request.nextUrl.searchParams.get('status')
    const valid = status === 'pending' || status === 'approved' || status === 'rejected'
    const result = await query<SpecialAreaRequest>(
      `SELECT ${SELECT_COLUMNS} FROM special_area_requests ${valid ? 'WHERE status = $1' : ''} ORDER BY submitted_at DESC`,
      valid ? [status] : []
    )
    return NextResponse.json({ requests: result.rows })
  } catch (error) {
    console.error('[special-area-requests/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar pengajuan.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getKioskAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    await ensureSpecialAreaSchema()
    const body = await request.json().catch(() => ({}))
    const str = (k: string, max = 255) => (typeof body[k] === 'string' ? body[k].trim().slice(0, max) : '')
    const requesterName = str('requesterName')
    const orgCompany = str('orgCompany')
    const department = str('department') || null
    const area = str('area')
    const purpose = str('purpose', 2000)
    const idCardNo = str('idCardNo', 100) || null
    // Masuk (dari): typed in by hand when given, otherwise the moment of submitting (stamped here).
    const manualFrom = str('fromAt')
    if (manualFrom && Number.isNaN(Date.parse(manualFrom))) return NextResponse.json({ message: 'Tanggal/jam masuk tidak valid.' }, { status: 400 })
    const fromAt = manualFrom ? new Date(manualFrom).toISOString() : new Date().toISOString()
    const toAt = str('toAt')

    if (!requesterName) return NextResponse.json({ message: 'Nama wajib diisi.' }, { status: 400 })
    if (!orgCompany) return NextResponse.json({ message: 'Nama organisasi/perusahaan wajib diisi.' }, { status: 400 })
    if (!area) return NextResponse.json({ message: 'Area special security wajib dipilih.' }, { status: 400 })
    if (!purpose) return NextResponse.json({ message: 'Tujuan keluar/masuk wajib diisi.' }, { status: 400 })

    if (!toAt || Number.isNaN(Date.parse(toAt))) return NextResponse.json({ message: 'Tanggal/jam keluar tidak valid.' }, { status: 400 })
    if (Date.parse(toAt) <= Date.parse(fromAt)) return NextResponse.json({ message: 'Waktu keluar harus setelah waktu masuk.' }, { status: 400 })

    const inserted = await query<{ id: number }>(
      `INSERT INTO special_area_requests (requester_name, org_company, department, from_at, to_at, area, purpose, id_card_no, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [requesterName, orgCompany, department, fromAt, toAt, area, purpose, idCardNo, session.username]
    )
    const id = inserted.rows[0].id
    const emailError = await sendApprovalRequest(id)
    await logActivity(session, 'create', 'special_area_request', id, `Mengajukan ijin masuk area special "${area}" untuk "${requesterName}"`)
    // Info in the ISM Admin bell; a failed e-mail shows live under "Perlu tindakan" instead.
    await recordNotification({
      kind: 'special_new', category: 'special', historyOnly: !!emailError,
      title: `Izin Area Special baru — ${requesterName}`,
      body: `${orgCompany} · ${area} · diajukan dari ${session.role === 'security' ? 'Pos Security' : session.role === 'lobby' ? 'Lobby' : session.username}${emailError ? ' · email ke approver gagal' : ''}`,
      href: '/kelola-izin-area-special',
    })
    return NextResponse.json({ request: await getRequest(id), emailError }, { status: 201 })
  } catch (error) {
    console.error('[special-area-requests/POST]', error)
    return NextResponse.json({ message: 'Gagal mengirim pengajuan.' }, { status: 500 })
  }
}
