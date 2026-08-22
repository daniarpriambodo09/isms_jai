// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { isHttpsRequest } from '@/lib/auth'

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'isms_admin_session'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ message: 'Logged out.' })

  // Expire the cookie immediately.
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: isHttpsRequest(request),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  return response
}