// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { query } from '@/lib/db'
import { getJwtSecret } from '@/lib/auth'

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'isms_admin_session'

type TokenPayload = { sub: number; username: string }
type AdminRow = { id: number; username: string; email: string | null; role: 'ism_admin' | 'lobby' | 'security' | 'approver' | 'it'; department?: string | null }

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
    }

    const decoded = jwt.verify(token, getJwtSecret())

    if (typeof decoded === 'string' || typeof decoded.sub === 'undefined' || !('username' in decoded)) {
      return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
    }

    const payload = decoded as unknown as TokenPayload

    const result = await query<AdminRow>('SELECT id, username, email, role FROM admins WHERE id = $1', [
      payload.sub,
    ])
    const admin = result.rows[0]

    if (!admin) {
      return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
    }

    let department: string | null = null
    if (admin.role === 'approver') {
      try {
        const picRes = await query<{ dept_name: string }>(
          `SELECT d.name as dept_name FROM pic_approvers p
           JOIN departments d ON d.id = p.department_id
           WHERE (p.email IS NOT NULL AND lower(trim(p.email)) = lower(trim($1)))
              OR (p.name IS NOT NULL AND lower(trim(p.name)) = lower(trim($2)))
           LIMIT 1`,
          [admin.email || '', admin.username || '']
        )
        if (picRes.rows[0]?.dept_name) {
          department = picRes.rows[0].dept_name
        } else {
          const itRes = await query<{ department: string }>(
            `SELECT department FROM it_form_approvers
             WHERE ((email IS NOT NULL AND lower(trim(email)) = lower(trim($1)))
                 OR (person_name IS NOT NULL AND lower(trim(person_name)) = lower(trim($2))))
               AND lower(trim(department)) <> 'departemen pemohon'
             LIMIT 1`,
            [admin.email || '', admin.username || '']
          )
          if (itRes.rows[0]?.department) {
            department = itRes.rows[0].department
          }
        }
      } catch (err) {
        console.error('Error resolving approver department:', err)
      }
    }

    return NextResponse.json({ admin: { ...admin, department } })
  } catch {
    // Invalid/expired token, or DB lookup failed — treat as logged out.
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 })
  }
}
