// app/api/auth/approver-token-login/route.ts
//
// Authenticates an approver into the ISMS dashboard without manual password entry,
// provided that the one-time approval token matches a valid pending/decided request.
// If an admin account exists for the approver's email, or is auto-provisioned,
// a valid session cookie is issued and the user is redirected to the destination URL.

import { NextRequest, NextResponse } from 'next/server'
import jwt, { type SignOptions } from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { isHttpsRequest } from '@/lib/auth'
import { findAdminByEmail, findApproverEmailByToken, type MatchedAdminAccount } from '@/lib/approver-auth'
import { query } from '@/lib/db'
import { API_BASE_PATH } from '@/lib/config'

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'isms_admin_session'
const JWT_SECRET = process.env.JWT_SECRET as string
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8 // 8 hours

async function getOrProvisionAdmin(approverEmail: string): Promise<MatchedAdminAccount | null> {
  let admin = await findAdminByEmail(approverEmail)
  if (!admin) {
    try {
      const usernameBase = approverEmail.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase() || 'approver'
      let finalUsername = usernameBase
      const existing = await query('SELECT 1 FROM admins WHERE username = $1', [finalUsername])
      if (existing.rows.length > 0) {
        finalUsername = `${usernameBase}_${Math.floor(100 + Math.random() * 900)}`
      }
      const randomPass = crypto.randomUUID()
      const hash = await bcrypt.hash(randomPass, 10)
      const inserted = await query<MatchedAdminAccount>(
        `INSERT INTO admins (username, email, password_hash, role)
         VALUES ($1, $2, $3, 'approver')
         RETURNING id, username, email, role`,
        [finalUsername, approverEmail.toLowerCase().trim(), hash]
      )
      if (inserted.rows[0]) {
        admin = inserted.rows[0]
      }
    } catch (err) {
      console.error('[auth/approver-token-login/auto-provision]', err)
    }
  }
  return admin
}

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

    const admin = await getOrProvisionAdmin(approverEmail)
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
    const nextParam = request.nextUrl.searchParams.get('next')?.trim() || ''

    // Determine target destination
    let targetUrl: URL
    if (nextParam) {
      if (nextParam.startsWith('/') && !nextParam.startsWith('//')) {
        targetUrl = new URL(nextParam, request.url)
      } else if (nextParam.startsWith(request.nextUrl.origin)) {
        targetUrl = new URL(nextParam)
      } else {
        targetUrl = new URL(`${API_BASE_PATH}/persetujuan-saya`, request.url)
        if (token) targetUrl.searchParams.set('token', token)
      }
    } else {
      targetUrl = new URL(`${API_BASE_PATH}/persetujuan-saya`, request.url)
      if (token) targetUrl.searchParams.set('token', token)
    }

    if (!token) {
      return NextResponse.redirect(targetUrl)
    }

    const approverEmail = await findApproverEmailByToken(token)
    if (!approverEmail) {
      return NextResponse.redirect(targetUrl)
    }

    const admin = await getOrProvisionAdmin(approverEmail)
    const redirectResponse = NextResponse.redirect(targetUrl)

    if (admin) {
      const signOptions: SignOptions = {
        expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'],
      }
      const sessionJwt = jwt.sign({ sub: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, signOptions)

      redirectResponse.cookies.set(COOKIE_NAME, sessionJwt, {
        httpOnly: true,
        secure: isHttpsRequest(request),
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE_SECONDS,
      })
    }

    return redirectResponse
  } catch (error) {
    console.error('[auth/approver-token-login/GET]', error)
    return NextResponse.redirect(new URL(`${API_BASE_PATH}/persetujuan-saya`, request.url))
  }
}
