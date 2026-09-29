// app/api/theme/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { getTheme, saveTheme } from '@/lib/theme-store'
import { THEME_PRESETS, sanitizeThemeParams } from '@/lib/theme'
import { logActivity } from '@/lib/activity-log'

export const dynamic = 'force-dynamic'

// Public — every page (logged in or not, kiosk included) paints itself with
// the site theme on load.
export async function GET() {
  try {
    return NextResponse.json({ theme: await getTheme() })
  } catch (error) {
    console.error('[theme/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat tema.' }, { status: 500 })
  }
}

// ism_admin only.
export async function PUT(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json()
    const params = sanitizeThemeParams(body.params)
    if (!params) return NextResponse.json({ message: 'Parameter tema tidak valid.' }, { status: 400 })
    const presetId = typeof body.presetId === 'string' && THEME_PRESETS.some((p) => p.id === body.presetId) ? body.presetId : null

    const theme = await saveTheme(params, presetId, session.username)
    const label = presetId ? THEME_PRESETS.find((p) => p.id === presetId)!.name : 'Kustom'
    await logActivity(session, 'update', 'theme', null, `Mengubah tema warna portal menjadi "${label}"`)
    return NextResponse.json({ theme })
  } catch (error) {
    console.error('[theme/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan tema.' }, { status: 500 })
  }
}
