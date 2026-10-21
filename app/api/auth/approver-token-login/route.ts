// app/api/auth/approver-token-login/route.ts
//
// Authenticates an approver into the ISMS dashboard without manual password entry,
// provided that the one-time approval token matches a valid pending/decided request
// AND the approver's notification email matches an active account in the `admins` table.

import { NextRequest, NextResponse } from 'next/server'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { isHttpsRequest } from '@/lib/auth'
import { findAdminByEmail, findApproverEmailByToken } from '@/lib/approver-auth'
import { API_BASE_PATH } from '@/lib/config'

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'isms_admin_session'
const JWT_SECRET = process.env.JWT_SECRET as string
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8 // 8 hours

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = typeof body?.token === 'string' ? body.token.trim() : ''

    if (!token) {
      return NextResponse.json({ success: false, message: 'Token persetujuan tidak boleh kosong.' }, { status: 400 })
    }

    const approverEmail = await findApproverEmailByToken(token)
    if (!approverEmail) {
      return NextResponse.json(
        {
          success: false,
          reason: 'invalid_token',
          message: 'Token persetujuan tidak valid atau dokumen tidak ditemukan.',
        },
        { status: 404 }
      )
    }

    const admin = await findAdminByEmail(approverEmail)
    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          matchedEmail: approverEmail,
          reason: 'no_account',
          message: `Email notifikasi persetujuan (${approverEmail}) belum terdaftar sebagai akun di ISMS. Hubungi Admin ISMS untuk mendaftarkan email akun Anda.`,
        },
        { status: 403 }
      )
    }

    const signOptions: SignOptions = {
      expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'],
    }
    const sessionJwt = jwt.sign({ sub: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, signOptions)

    const response = NextResponse.json({
      success: true,
      matchedEmail: approverEmail,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
      message: `Berhasil terhubung ke akun ${admin.username} (${approverEmail}).`,
    })

    response.cookies.set(COOKIE_NAME, sessionJwt, {
      httpOnly: true,
      secure: isHttpsRequest(request),
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE_SECONDS,
    })

    return response
  } catch (error) {
    console.error('[auth/approver-token-login/POST]', error)
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan pada server saat autentikasi token.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')?.trim() || ''
    const fallbackUrl = new URL(`${API_BASE_PATH}/persetujuan-saya`, request.url)

    if (!token) {
      return NextResponse.redirect(fallbackUrl)
    }

    const approverEmail = await findApproverEmailByToken(token)
    if (!approverEmail) {
      fallbackUrl.searchParams.set('error', 'invalid_token')
      return NextResponse.redirect(fallbackUrl)
    }

    const admin = await findAdminByEmail(approverEmail)
    if (!admin) {
      fallbackUrl.searchParams.set('error', 'no_account')
      fallbackUrl.searchParams.set('email', approverEmail)
      return NextResponse.redirect(fallbackUrl)
    }

    const signOptions: SignOptions = {
      expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'],
    }
    const sessionJwt = jwt.sign({ sub: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, signOptions)

    const targetUrl = new URL(`${API_BASE_PATH}/persetujuan-saya`, request.url)
    targetUrl.searchParams.set('token', token)

    const redirectResponse = NextResponse.redirect(targetUrl)
    redirectResponse.cookies.set(COOKIE_NAME, sessionJwt, {
      httpOnly: true,
      secure: isHttpsRequest(request),
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE_SECONDS,
    })

    return redirectResponse
  } catch (error) {
    console.error('[auth/approver-token-login/GET]', error)
    return NextResponse.redirect(new URL(`${API_BASE_PATH}/persetujuan-saya`, request.url))
  }
}
