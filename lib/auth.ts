// lib/auth.ts
import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'isms_admin_session'
const JWT_SECRET = process.env.JWT_SECRET as string

export type AdminRole = 'ism_admin' | 'lobby' | 'security'
type SessionPayload = { sub: number; username: string; role: AdminRole }

/**
 * Whether the incoming request actually arrived over HTTPS — checked
 * from the request itself (and the x-forwarded-proto header set by a
 * reverse proxy) rather than assumed from NODE_ENV. A cookie marked
 * Secure is silently dropped by the browser on a plain-HTTP origin
 * (e.g. an internal IP like 192.168.1.7), which is why login used to
 * appear to "not persist" after a refresh in that setup.
 */
export function isHttpsRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  if (forwardedProto) return forwardedProto === 'https'
  return request.nextUrl.protocol === 'https:'
}

/**
 * Reads and verifies the admin session cookie on an API route.
 * Returns the decoded session payload, or null if the request is
 * not from an authenticated admin (any role). Use this to guard any
 * modify/insert/update/delete endpoint that isn't role-specific.
 */
export function getAdminFromRequest(request: NextRequest): SessionPayload | null {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    if (typeof decoded === 'string' || typeof decoded.sub === 'undefined' || !('username' in decoded)) {
      return null
    }
    return decoded as unknown as SessionPayload
  } catch {
    return null
  }
}

/**
 * Same as getAdminFromRequest, but only returns a session for the
 * main ISMS admin role. Use this (instead of getAdminFromRequest) to
 * guard ISMS content-management endpoints — hero slides, schedules,
 * document registers, departments, nav labels, etc. — so the lobby/
 * security kiosk accounts can't incidentally write to them.
 */
export function getIsmsAdminFromRequest(request: NextRequest): SessionPayload | null {
  const session = getAdminFromRequest(request)
  return session?.role === 'ism_admin' ? session : null
}

/**
 * Same as getAdminFromRequest, but only returns a session for the
 * two vendor-gate kiosk roles (or the main ISMS admin, who can use
 * both kiosk pages too). Use this to guard /api/vendor-registrations.
 */
export function getKioskAdminFromRequest(request: NextRequest): SessionPayload | null {
  const session = getAdminFromRequest(request)
  if (!session) return null
  return session.role === 'lobby' || session.role === 'security' || session.role === 'ism_admin' ? session : null
}
