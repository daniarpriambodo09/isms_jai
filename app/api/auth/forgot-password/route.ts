// app/api/auth/forgot-password/route.ts
//
// Public. "Lupa password": asks for a reset link to be e-mailed to the
// account's own address. The answer is the same whether or not the account
// exists, so it cannot be used to find out usernames or addresses.

import { NextRequest, NextResponse } from 'next/server'
import { RESET_LINK_MINUTES, requestPasswordReset } from '@/lib/password-reset'

export const dynamic = 'force-dynamic'

// A plain per-address brake on top of the per-account one in lib/password-reset.ts.
const seen = new Map<string, number[]>()
function tooFast(key: string) {
  const now = Date.now()
  const recent = (seen.get(key) ?? []).filter((at) => now - at < 15 * 60_000)
  recent.push(now)
  seen.set(key, recent)
  return recent.length > 8
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { identifier?: unknown }
    const identifier = typeof body.identifier === 'string' ? body.identifier.trim().slice(0, 255) : ''
    if (!identifier) return NextResponse.json({ message: 'Isi username atau email akun Anda.' }, { status: 400 })
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    if (tooFast(ip)) return NextResponse.json({ message: 'Terlalu banyak permintaan. Coba lagi beberapa menit lagi.' }, { status: 429 })

    const outcome = await requestPasswordReset(identifier, request.nextUrl.origin)
    if (outcome !== 'sent') console.warn('[auth/forgot-password] tidak dikirim:', outcome)
    return NextResponse.json({
      message: `Jika akun itu terdaftar dan punya alamat email, link untuk mengatur ulang password sudah dikirim ke emailnya. Link berlaku ${RESET_LINK_MINUTES} menit.`,
    })
  } catch (error) {
    console.error('[auth/forgot-password]', error)
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}
