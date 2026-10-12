// app/api/auth/reset-password/route.ts
//
// Public, secured by the one-off token from the "Lupa password" e-mail.
// GET: is the link still good (and whose account is it)? POST: set the new
// password — the link stops working.

import { NextRequest, NextResponse } from 'next/server'
import { resetLinkAccount, resetPassword } from '@/lib/password-reset'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const link = await resetLinkAccount(request.nextUrl.searchParams.get('token') ?? '')
    if (!link) return NextResponse.json({ message: 'Link reset tidak ditemukan, sudah dipakai, atau sudah kedaluwarsa.' }, { status: 404 })
    return NextResponse.json({ username: link.account.username })
  } catch (error) {
    console.error('[auth/reset-password/GET]', error)
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { token?: unknown; newPassword?: unknown }
    const token = typeof body.token === 'string' ? body.token : ''
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
    const result = await resetPassword(token, newPassword)
    if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 })
    return NextResponse.json({ message: 'Password berhasil diganti. Silakan masuk dengan password baru.', username: result.username })
  } catch (error) {
    console.error('[auth/reset-password/POST]', error)
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}
