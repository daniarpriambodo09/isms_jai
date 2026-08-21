// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { query } from '@/lib/db'

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'isms_admin_session'
const JWT_SECRET = process.env.JWT_SECRET as string

type TokenPayload = { sub: number; username: string }
type AdminRow = { id: number; username: string; email: string | null }

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
    }

    const decoded = jwt.verify(token, JWT_SECRET)

    if (typeof decoded === 'string' || typeof decoded.sub === 'undefined' || !('username' in decoded)) {
      return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
    }

    const payload = decoded as unknown as TokenPayload

    const result = await query<AdminRow>('SELECT id, username, email FROM admins WHERE id = $1', [
      payload.sub,
    ])
    const admin = result.rows[0]

    if (!admin) {
      return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
    }

    return NextResponse.json({ admin })
  } catch {
    // Invalid/expired token, or DB lookup failed — treat as logged out.
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }
}