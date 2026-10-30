// app/api/it-equipment-requests/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import crypto from 'crypto'
import { query } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'
import type { ItEquipmentItem, ItEquipmentRequest } from '@/lib/it-equipment-shared'

let schemaChecked = false
async function ensureEquipmentRequestColumns() {
  if (schemaChecked) return
  try {
    await query(`
      ALTER TABLE it_equipment_requests
      ADD COLUMN IF NOT EXISTS it_checked_by VARCHAR(150),
      ADD COLUMN IF NOT EXISTS it_checked_title VARCHAR(150),
      ADD COLUMN IF NOT EXISTS it_checked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS it_check_notes TEXT;
    `)
    schemaChecked = true
  } catch {
    // Ignore if table not created yet or restricted
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureEquipmentRequestColumns()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const formType = searchParams.get('form_type')
    const search = searchParams.get('q')?.trim()
    const token = searchParams.get('token')

    // If querying by visitor public tracking token
    if (token) {
      const res = await query<ItEquipmentRequest>(
        `SELECT er.*,
                gl.link_code,
                gl.network_username,
                gl.network_password,
                gl.network_ssid,
                gl.assigned_ip,
                gl.subnet_mask,
                gl.gateway,
                gl.dns_primary,
                gl.dns_secondary,
                gl.ip_mode
         FROM it_equipment_requests er
         LEFT JOIN guest_it_access_links gl ON gl.equipment_request_id = er.id
         WHERE er.token = $1
         LIMIT 1`,
        [token]
      )
      if (res.rowCount === 0) {
        return NextResponse.json({ error: 'Pengajuan tidak ditemukan' }, { status: 404 })
      }
      return NextResponse.json({ request: res.rows[0] })
    }

    // Allow transparent listing for portal users; redact network password if not admin
    const admin = await getAdminFromRequest(request)
    const isAdmin = !!admin

    const conditions: string[] = []
    const values: any[] = []

    if (status && status !== 'all') {
      values.push(status)
      conditions.push(`status = $${values.length}`)
    }

    if (formType && formType !== 'all') {
      values.push(formType)
      conditions.push(`form_type = $${values.length}`)
    }

    if (search) {
      values.push(`%${search}%`)
      conditions.push(
        `(request_no ILIKE $${values.length} OR applicant_name ILIKE $${values.length} OR company_name ILIKE $${values.length} OR department ILIKE $${values.length})`
      )
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const res = await query<ItEquipmentRequest>(
      `SELECT * FROM it_equipment_requests ${whereClause} ORDER BY created_at DESC LIMIT 150`,
      values
    )

    const requests = res.rows.map((r) => ({
      ...r,
      network_password: isAdmin ? r.network_password : (r.network_password ? '••••••••' : null),
    }))

    return NextResponse.json({ requests })
  } catch (error: any) {
    console.error('Error fetching IT equipment requests:', error)
    return NextResponse.json({ error: 'Gagal memuat data pengajuan' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      form_type = 'in',
      applicant_name,
      applicant_nik = '',
      company_name,
      department,
      section = '',
      location,
      purpose,
      date_in,
      date_out_plan,
      items = [],
      applicant_phone = '',
      applicant_email = '',
      agree_rules = true,
    } = body

    const finalCompany =
      form_type === 'out'
        ? (company_name?.trim() || 'PT. Jatim Autocomp Indonesia')
        : company_name?.trim()

    if (!applicant_name || !finalCompany || !department || !location || !purpose || !date_in || !date_out_plan) {
      return NextResponse.json(
        { error: 'Mohon lengkapi seluruh kolom formulir wajib.' },
        { status: 400 }
      )
    }

    if (!section?.trim()) {
      return NextResponse.json(
        { error: 'Seksi / Bagian pembawa device wajib diisi.' },
        { status: 400 }
      )
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Mohon tambahkan minimal 1 alat yang dibawa.' },
        { status: 400 }
      )
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (!it.brand?.trim() || !it.serial_no?.trim() || !it.id_no?.trim()) {
        return NextResponse.json(
          { error: `Alat #${i + 1}: Produsen/Merk, Serial Number, dan No. / Nama Identifikasi Alat wajib diisi.` },
          { status: 400 }
        )
      }
    }

    // Generate request number format: IT-IN-YYYYMMDD-XXXX or IT-OUT-YYYYMMDD-XXXX
    const typePrefix = form_type === 'out' ? 'IT-OUT' : 'IT-IN'
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const dateStr = `${yyyy}${mm}${dd}`

    // Count today's requests for sequence
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM it_equipment_requests WHERE request_no LIKE $1`,
      [`${typePrefix}-${dateStr}-%`]
    )
    const seq = Number(countRes.rows[0]?.count || 0) + 1
    const request_no = `${typePrefix}-${dateStr}-${String(seq).padStart(3, '0')}`
    const token = crypto.randomBytes(24).toString('hex')

    const cleanItems: ItEquipmentItem[] = items.map((it: any, idx: number) => ({
      id: String(idx + 1),
      equipment_type: it.equipment_type || 'PC / Laptop',
      id_no: it.id_no || '',
      brand: it.brand || '',
      model: it.model || '',
      serial_no: it.serial_no || '',
    }))

    const insertRes = await query<ItEquipmentRequest>(
      `INSERT INTO it_equipment_requests (
        request_no, form_type, applicant_name, applicant_nik, company_name, department, section,
        location, purpose, date_in, date_out_plan, items, applicant_phone, applicant_email,
        agree_rules, status, token
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending', $16)
      RETURNING *`,
      [
        request_no,
        form_type,
        applicant_name.trim(),
        applicant_nik?.trim() || null,
        finalCompany,
        department.trim(),
        section.trim(),
        location.trim(),
        purpose.trim(),
        date_in,
        date_out_plan,
        JSON.stringify(cleanItems),
        applicant_phone?.trim() || null,
        applicant_email?.trim() || null,
        Boolean(agree_rules),
        token,
      ]
    )

    return NextResponse.json({
      success: true,
      request: insertRes.rows[0],
    })
  } catch (error: any) {
    console.error('Error creating IT equipment request:', error)
    return NextResponse.json({ error: 'Gagal mengirim pengajuan' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (admin.role !== 'it' && admin.role !== 'ism_admin') {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya Admin IT atau ISMS Admin yang dapat menghapus data pengajuan.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')
    if (!idParam || isNaN(Number(idParam))) {
      return NextResponse.json({ error: 'ID pengajuan tidak valid' }, { status: 400 })
    }

    const delRes = await query(`DELETE FROM it_equipment_requests WHERE id = $1`, [Number(idParam)])
    if ((delRes.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: 'Data pengajuan tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Data pengajuan izin alat IT berhasil dihapus.',
    })
  } catch (error: any) {
    console.error('Error deleting IT equipment request:', error)
    return NextResponse.json({ error: 'Gagal menghapus data pengajuan' }, { status: 500 })
  }
}
