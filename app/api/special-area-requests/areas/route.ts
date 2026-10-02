// app/api/special-area-requests/areas/route.ts
//
// The list of Special Security areas offered in the request form.
// GET     any admin session (ISM Admin, Lobby, Security — whoever opens the form)
// PUT     ISM Admin: { areas: string[] } replaces the list
// DELETE  ISM Admin: back to the built-in list

import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest, getIsmsAdminFromRequest } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { getAreaList, resetAreaList, saveAreaList } from '@/lib/special-area'
import { parseAreaList } from '@/lib/special-area-shared'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!getAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    return NextResponse.json(await getAreaList())
  } catch (error) {
    console.error('[special-area-requests/areas/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar area.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = parseAreaList(body.areas)
    if ('error' in parsed) return NextResponse.json({ message: parsed.error }, { status: 400 })
    await saveAreaList(parsed.areas, session.username)
    await logActivity(session, 'update', 'special_area_list', null, `Mengubah daftar Area Special (${parsed.areas.length} area): ${parsed.areas.join(', ').slice(0, 400)}`)
    return NextResponse.json({ ...(await getAreaList()), message: `Daftar area disimpan (${parsed.areas.length} area).` })
  } catch (error) {
    console.error('[special-area-requests/areas/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan daftar area.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    await resetAreaList()
    await logActivity(session, 'update', 'special_area_list', null, 'Mengembalikan daftar Area Special ke daftar bawaan')
    return NextResponse.json({ ...(await getAreaList()), message: 'Daftar area dikembalikan ke daftar bawaan.' })
  } catch (error) {
    console.error('[special-area-requests/areas/DELETE]', error)
    return NextResponse.json({ message: 'Gagal mengembalikan daftar area.' }, { status: 500 })
  }
}
