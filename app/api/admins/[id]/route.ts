// app/api/admins/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getIsmsAdminFromRequest, type AdminRole } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

type AdminRow = { id: number; username: string; email: string | null; role: AdminRole; created_at: string }
const ROLES: AdminRole[] = ['ism_admin', 'lobby', 'security']

// Self-service (changing your own password) goes through /api/auth/change-password
// instead — these routes only ever touch OTHER accounts, so an ism_admin can never
// accidentally lock themselves out or demote themselves via this admin-management UI.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  if (session.sub === Number(id)) return NextResponse.json({ message: 'Gunakan halaman Pengaturan untuk mengubah akun Anda sendiri.' }, { status: 403 })

  try {
    const body = await request.json() as { role?: string; newPassword?: string }
    const existing = await query<AdminRow>('SELECT id, username, email, role, created_at FROM admins WHERE id = $1', [id])
    const target = existing.rows[0]
    if (!target) return NextResponse.json({ message: 'Akun admin tidak ditemukan.' }, { status: 404 })

    if (body.role !== undefined) {
      if (!ROLES.includes(body.role as AdminRole)) return NextResponse.json({ message: 'Role tidak valid.' }, { status: 400 })
      if (target.role === 'ism_admin' && body.role !== 'ism_admin') {
        const countResult = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM admins WHERE role = 'ism_admin'")
        if (Number(countResult.rows[0].count) <= 1) {
          return NextResponse.json({ message: 'Tidak bisa mengubah role — ini satu-satunya akun ism_admin yang tersisa.' }, { status: 409 })
        }
      }
      await query('UPDATE admins SET role = $1 WHERE id = $2', [body.role, id])
      await logActivity(session, 'update', 'admin', id, `Mengubah role "${target.username}" dari ${target.role} ke ${body.role}`)
    }

    if (body.newPassword !== undefined) {
      if (body.newPassword.length < 6) return NextResponse.json({ message: 'Password minimal 6 karakter.' }, { status: 400 })
      const passwordHash = await bcrypt.hash(body.newPassword, 10)
      await query('UPDATE admins SET password_hash = $1 WHERE id = $2', [passwordHash, id])
      await logActivity(session, 'update', 'admin', id, `Mereset password akun "${target.username}"`)
    }

    const updated = await query<AdminRow>('SELECT id, username, email, role, created_at FROM admins WHERE id = $1', [id])
    return NextResponse.json({ admin: updated.rows[0] })
  } catch (error) {
    console.error('[admins/[id]/PUT]', error)
    return NextResponse.json({ message: 'Gagal memperbarui akun admin.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  if (session.sub === Number(id)) return NextResponse.json({ message: 'Tidak bisa menghapus akun Anda sendiri.' }, { status: 403 })

  try {
    const existing = await query<AdminRow>('SELECT id, username, role FROM admins WHERE id = $1', [id])
    const target = existing.rows[0]
    if (!target) return NextResponse.json({ message: 'Akun admin tidak ditemukan.' }, { status: 404 })

    if (target.role === 'ism_admin') {
      const countResult = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM admins WHERE role = 'ism_admin'")
      if (Number(countResult.rows[0].count) <= 1) {
        return NextResponse.json({ message: 'Tidak bisa menghapus — ini satu-satunya akun ism_admin yang tersisa.' }, { status: 409 })
      }
    }

    await query('DELETE FROM admins WHERE id = $1', [id])
    await logActivity(session, 'delete', 'admin', id, `Menghapus akun admin "${target.username}" (role: ${target.role})`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admins/[id]/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus akun admin.' }, { status: 500 })
  }
}
