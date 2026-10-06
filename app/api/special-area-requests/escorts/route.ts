// app/api/special-area-requests/escorts/route.ts
//
// The list of employees Lobby / Pos Security pick the PIC Pendamping from.
// GET  any admin session (ISM Admin, Lobby, Security)
// PUT  ISM Admin: { escorts: { name, dept }[] } replaces the list

import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest, getIsmsAdminFromRequest } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { getEscortList, saveEscortList } from '@/lib/special-area'
import { parseEscortList } from '@/lib/special-area-shared'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!getAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    return NextResponse.json(await getEscortList())
  } catch (error) {
    console.error('[special-area-requests/escorts/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar PIC pendamping.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = parseEscortList(body.escorts)
    if ('error' in parsed) return NextResponse.json({ message: parsed.error }, { status: 400 })
    await saveEscortList(parsed.escorts, session.username)
    await logActivity(session, 'update', 'special_area_escorts', null, `Mengubah daftar PIC Pendamping area special (${parsed.escorts.length} nama)`)
    return NextResponse.json({ ...(await getEscortList()), message: `Daftar PIC pendamping disimpan (${parsed.escorts.length} nama).` })
  } catch (error) {
    console.error('[special-area-requests/escorts/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan daftar PIC pendamping.' }, { status: 500 })
  }
}
