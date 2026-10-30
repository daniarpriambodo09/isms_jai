// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { query } from '@/lib/db'
import { getJwtSecret, isHttpsRequest } from '@/lib/auth'
import { isLoginLocked, recordLoginFailure, recordLoginSuccess } from '@/lib/rate-limit'

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'isms_admin_session'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8 // 8 hours

type AdminRow = {
  id: number
  username: string
  email: string | null
  password_hash: string
  role: 'ism_admin' | 'lobby' | 'security' | 'approver' | 'it'
}

export async function POST(request: NextRequest) {
  try {
    const { username, password, expectedRole } = await request.json()

    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return NextResponse.json({ message: 'Username/Email dan password wajib diisi.' }, { status: 400 })
    }

    const cleanIdentifier = username.trim()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const rateLimitKey = `${ip}:${cleanIdentifier.toLowerCase()}`
    const lockedForSeconds = isLoginLocked(rateLimitKey)
    if (lockedForSeconds) {
      return NextResponse.json(
        { message: `Terlalu banyak percobaan gagal. Coba lagi dalam ${Math.ceil(lockedForSeconds / 60)} menit.` },
        { status: 429 }
      )
    }

    // Support logging in via username or email (case-insensitive & trimmed)
    const result = await query<AdminRow>(
      'SELECT id, username, email, password_hash, role FROM admins WHERE LOWER(TRIM(username)) = LOWER(TRIM($1)) OR (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM($1))) LIMIT 1',
      [cleanIdentifier]
    )
    const admin = result.rows[0]

    // Same generic message whether the username doesn't exist or the
    // password is wrong, so we don't leak which usernames are valid.
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      recordLoginFailure(rateLimitKey)
      return NextResponse.json({ message: 'Username atau password salah.' }, { status: 401 })
    }

    // Role selected on the sign-in screen is a routing aid. We don't block
    // users if they forgot to change the tab, so they can seamlessly access their role dashboard.
    void expectedRole

    recordLoginSuccess(rateLimitKey)

    const signOptions: SignOptions = {
      expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'],
    }
    const token = jwt.sign({ sub: admin.id, username: admin.username, role: admin.role }, getJwtSecret(), signOptions)

    const response = NextResponse.json({
      admin: { id: admin.id, username: admin.username, email: admin.email, role: admin.role },
    })

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isHttpsRequest(request),
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE_SECONDS,
    })

    return response
  } catch (error) {
    console.error('[auth/login]', error)
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}
