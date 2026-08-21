// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server'

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'isms_admin_session'

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out.' })

  // Expire the cookie immediately.
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  return response
}