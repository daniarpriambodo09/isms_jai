// app/api/theme/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { clearKioskTheme, getTheme, saveTheme } from '@/lib/theme-store'
import { THEME_PRESETS, THEME_TARGET_LABEL, isThemeTarget, sanitizeThemeParams, type ThemeTarget } from '@/lib/theme'

// ?target=lobby|security: that post's theme (its own, or the portal's when it follows it).
const targetOf = (value: unknown): ThemeTarget => (isThemeTarget(value) ? value : 'portal')

// Who may set which theme: the ISM Admin any of them; the Lobby and Security
// accounts only their own post's (the "Tema" button on their page).
function mayEdit(role: string, target: ThemeTarget) {
  return role === 'ism_admin' || (target !== 'portal' && role === target)
}
const NOT_YOURS = 'Akun ini hanya bisa mengatur tema posnya sendiri.'
import { logActivity } from '@/lib/activity-log'

export const dynamic = 'force-dynamic'

// Public — every page (logged in or not, kiosk included) paints itself with
// the site theme on load.
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ theme: await getTheme(targetOf(request.nextUrl.searchParams.get('target'))) })
  } catch (error) {
    console.error('[theme/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat tema.' }, { status: 500 })
  }
}

// ISM Admin: any theme. Lobby / Security account: its own post's.
export async function PUT(request: NextRequest) {
  const session = getKioskAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json()
    const params = sanitizeThemeParams(body.params)
    if (!params) return NextResponse.json({ message: 'Parameter tema tidak valid.' }, { status: 400 })
    const presetId = typeof body.presetId === 'string' && THEME_PRESETS.some((p) => p.id === body.presetId) ? body.presetId : null

    const target = targetOf(body.target)
    if (!mayEdit(session.role, target)) return NextResponse.json({ message: NOT_YOURS }, { status: 403 })
    const theme = await saveTheme(params, presetId, session.username, target)
    const label = presetId ? THEME_PRESETS.find((p) => p.id === presetId)!.name : 'Kustom'
    await logActivity(session, 'update', 'theme', null, `Mengubah tema warna ${target === 'portal' ? 'portal' : THEME_TARGET_LABEL[target]} menjadi "${label}"`)
    return NextResponse.json({ theme })
  } catch (error) {
    console.error('[theme/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan tema.' }, { status: 500 })
  }
}

// A post (lobby / security) goes back to following the portal's theme — by the ISM Admin or the post's own account.
export async function DELETE(request: NextRequest) {
  const session = getKioskAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    const target = targetOf(request.nextUrl.searchParams.get('target'))
    if (target === 'portal') return NextResponse.json({ message: 'Tema portal tidak bisa dihapus.' }, { status: 400 })
    if (!mayEdit(session.role, target)) return NextResponse.json({ message: NOT_YOURS }, { status: 403 })
    const theme = await clearKioskTheme(target)
    await logActivity(session, 'update', 'theme', null, `Tema ${THEME_TARGET_LABEL[target]} kembali mengikuti tema portal`)
    return NextResponse.json({ theme })
  } catch (error) {
    console.error('[theme/DELETE]', error)
    return NextResponse.json({ message: 'Gagal mengembalikan tema.' }, { status: 500 })
  }
}
