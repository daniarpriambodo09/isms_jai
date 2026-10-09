// app/api/kiosk-stations/route.ts
//
// GET (anyone — the kiosk pages read it before login): which guest posts are
// in use. PUT (ISM Admin): switch Admin Lobby / Pos Security on or off; at
// least one stays on.

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { getKioskStations, saveKioskStations } from '@/lib/kiosk-stations'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await getKioskStations())
  } catch (error) {
    console.error('[kiosk-stations/GET]', error)
    return NextResponse.json({ lobby: true, security: true, updatedAt: null, updatedBy: null })
  }
}

export async function PUT(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body.lobby !== 'boolean' || typeof body.security !== 'boolean') return NextResponse.json({ message: 'Pengaturan tidak valid.' }, { status: 400 })
    const saved = await saveKioskStations({ lobby: body.lobby, security: body.security }, session.username)
    if (!saved) return NextResponse.json({ message: 'Minimal satu pos harus tetap aktif.' }, { status: 400 })
    const word = (on: boolean) => (on ? 'aktif' : 'nonaktif')
    await logActivity(session, 'update', 'kiosk_stations', null, `Mengatur pos pendaftaran tamu: Admin Lobby ${word(saved.lobby)}, Pos Security ${word(saved.security)}`)
    return NextResponse.json(await getKioskStations())
  } catch (error) {
    console.error('[kiosk-stations/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan pengaturan pos.' }, { status: 500 })
  }
}
