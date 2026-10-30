// lib/it-guest-link-service.ts
import 'server-only'
import crypto from 'node:crypto'
import { query } from '@/lib/db'
import type { ItEquipmentItem, ItEquipmentRequest } from '@/lib/it-equipment-shared'
import {
  createItFormSubmission,
  getItFormSubmissionById,
  ensureItFormTables,
} from '@/lib/it-form-service'
import {
  formatGuestLinkCode,
  buildSuggestedNetworkConfig,
  type ItGuestAccessLink,
} from '@/lib/it-guest-link-shared'

let tableInitialized = false

export async function ensureItGuestLinkTable() {
  if (tableInitialized) return
  try {
    await ensureItFormTables()
    await query(`
      CREATE TABLE IF NOT EXISTS it_guest_access_links (
        id SERIAL PRIMARY KEY,
        link_code VARCHAR(150) NOT NULL UNIQUE,
        token VARCHAR(64) NOT NULL UNIQUE,
        seq_year INT NOT NULL,
        seq_month INT NOT NULL,
        seq_no INT NOT NULL,
        guest_name VARCHAR(150) NOT NULL,
        company_name VARCHAR(150),
        department VARCHAR(120),
        visit_date DATE,
        visit_end_date DATE,
        is_walk_in BOOLEAN NOT NULL DEFAULT false,
        status VARCHAR(30) NOT NULL DEFAULT 'link_created',
        equipment_request_id INT REFERENCES it_equipment_requests(id) ON DELETE SET NULL,
        network_submission_id INT REFERENCES it_form_submissions(id) ON DELETE SET NULL,
        network_username VARCHAR(100),
        network_password VARCHAR(100),
        network_ssid VARCHAR(100),
        ip_mode VARCHAR(20) NOT NULL DEFAULT 'dhcp',
        assigned_ip VARCHAR(60),
        subnet_mask VARCHAR(60) DEFAULT '255.255.255.0',
        gateway VARCHAR(60),
        dns_primary VARCHAR(60),
        dns_secondary VARCHAR(60),
        approved_by VARCHAR(150),
        approved_at TIMESTAMPTZ,
        approval_notes TEXT,
        rejected_by VARCHAR(150),
        rejected_at TIMESTAMPTZ,
        rejection_reason TEXT,
        created_by VARCHAR(150),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_it_guest_links_period ON it_guest_access_links (seq_year, seq_month, seq_no);`)
    await query(`CREATE INDEX IF NOT EXISTS idx_it_guest_links_status ON it_guest_access_links (status);`)
    await query(`CREATE INDEX IF NOT EXISTS idx_it_guest_links_code ON it_guest_access_links (link_code);`)

    // Pastikan kolom verifikasi tahap 2 (IT Check) tersedia pada it_equipment_requests
    await query(`
      ALTER TABLE it_equipment_requests
      ADD COLUMN IF NOT EXISTS it_checked_by VARCHAR(150),
      ADD COLUMN IF NOT EXISTS it_checked_title VARCHAR(150),
      ADD COLUMN IF NOT EXISTS it_checked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS it_check_notes TEXT;
    `).catch(() => {})

    // Bersihkan tanda tangan slot APPROVAL (Pak Teguh Sunjoyo / IAA) yang sebelumnya ikut ter-approve otomatis
    // oleh kode verifikasi 'IT-GUEST-%' saat Admin IT meng-approve, agar tidak muncul sebelum IAA benar-benar approve.
    await query(`
      UPDATE it_form_signatures
      SET status = 'pending',
          verification_code = NULL,
          signed_at = NULL,
          updated_at = NOW()
      WHERE verification_code LIKE 'IT-GUEST-%'
        AND (UPPER(slot_label) LIKE '%APPROV%' OR UPPER(role_title) LIKE '%INFORMATION%' OR UPPER(approver_name) LIKE '%TEGUH%')
    `).catch(() => {})

    tableInitialized = true
  } catch (err) {
    console.error('[it-guest-link-service] ensureItGuestLinkTable error:', err)
  }
}

async function hydrateGuestLink(row: ItGuestAccessLink): Promise<ItGuestAccessLink> {
  const item = { ...row }
  if (item.equipment_request_id) {
    const eqRes = await query<ItEquipmentRequest>(
      `SELECT * FROM it_equipment_requests WHERE id = $1 LIMIT 1`,
      [item.equipment_request_id]
    )
    item.equipment_request = eqRes.rows[0] || null
  } else {
    item.equipment_request = null
  }

  if (item.network_submission_id) {
    item.network_submission = await getItFormSubmissionById(item.network_submission_id)
  } else {
    item.network_submission = null
  }

  return item
}

export async function getNextMonthlySequence(year: number, month: number): Promise<number> {
  await ensureItGuestLinkTable()
  const res = await query<{ max_seq: number | null }>(
    `SELECT MAX(seq_no) as max_seq FROM it_guest_access_links WHERE seq_year = $1 AND seq_month = $2`,
    [year, month]
  )
  const currentMax = Number(res.rows[0]?.max_seq || 0)
  return currentMax + 1
}

/**
 * Generate 1 atau banyak Link Tamu secara terpisah untuk masing-masing orang.
 * - Tahun mengikuti tahun berjalan (berganti otomatis tiap tahun).
 * - Nomor urut otomatis ke-reset ke 001 setiap pergantian bulan.
 */
export async function createItGuestAccessLinks(input: {
  guests: Array<{
    guest_name: string
    company_name?: string
    department?: string
    visit_date?: string
    visit_end_date?: string
  }>
  is_walk_in?: boolean
  created_by?: string
  reference_date?: Date
}): Promise<ItGuestAccessLink[]> {
  await ensureItGuestLinkTable()

  const refDate = input.reference_date || new Date()
  const seqYear = refDate.getFullYear()
  const seqMonth = refDate.getMonth() + 1

  let nextSeq = await getNextMonthlySequence(seqYear, seqMonth)
  const createdLinks: ItGuestAccessLink[] = []

  for (const guest of input.guests) {
    const rawName = guest.guest_name?.trim() || ''
    const seqNo = nextSeq++
    const cleanName =
      !rawName || /^guest(\s*#?\d*|$)/i.test(rawName)
        ? `Guest #${String(seqNo).padStart(3, '0')}`
        : rawName

    let linkCode = formatGuestLinkCode(cleanName, seqYear, seqNo, seqMonth)

    // Pastikan tidak bentrok jika ada kode identik
    const checkDup = await query<{ id: number }>(
      `SELECT id FROM it_guest_access_links WHERE link_code = $1 LIMIT 1`,
      [linkCode]
    )
    if ((checkDup.rowCount ?? 0) > 0) {
      const rand = crypto.randomBytes(2).toString('hex').toUpperCase()
      linkCode = `${linkCode}-${rand}`
    }

    const token = crypto.randomBytes(24).toString('hex')
    const suggested = buildSuggestedNetworkConfig({
      guest_name: cleanName,
      seq_year: seqYear,
      seq_month: seqMonth,
      seq_no: seqNo,
    })

    const insertRes = await query<ItGuestAccessLink>(
      `INSERT INTO it_guest_access_links (
        link_code, token, seq_year, seq_month, seq_no,
        guest_name, company_name, department, visit_date, visit_end_date,
        is_walk_in, status,
        network_username, network_password, network_ssid,
        ip_mode, assigned_ip, subnet_mask, gateway, dns_primary, dns_secondary,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, 'link_created',
        $12, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21
      ) RETURNING *`,
      [
        linkCode,
        token,
        seqYear,
        seqMonth,
        seqNo,
        cleanName,
        guest.company_name?.trim() || null,
        guest.department?.trim() || null,
        guest.visit_date || null,
        guest.visit_end_date || guest.visit_date || null,
        Boolean(input.is_walk_in),
        suggested.network_username,
        suggested.network_password,
        suggested.network_ssid,
        suggested.ip_mode,
        suggested.assigned_ip,
        suggested.subnet_mask,
        suggested.gateway,
        suggested.dns_primary,
        suggested.dns_secondary,
        input.created_by || 'Admin IT',
      ]
    )

    createdLinks.push(insertRes.rows[0])
  }

  return createdLinks
}

export async function getItGuestAccessLinks(filters?: {
  status?: string
  search?: string
  limit?: number
}): Promise<ItGuestAccessLink[]> {
  await ensureItGuestLinkTable()

  const conditions: string[] = []
  const params: any[] = []

  if (filters?.status && filters.status !== 'all') {
    params.push(filters.status)
    conditions.push(`status = $${params.length}`)
  }

  if (filters?.search?.trim()) {
    params.push(`%${filters.search.trim()}%`)
    const idx = params.length
    conditions.push(
      `(link_code ILIKE $${idx} OR guest_name ILIKE $${idx} OR company_name ILIKE $${idx} OR department ILIKE $${idx} OR network_username ILIKE $${idx} OR assigned_ip ILIKE $${idx})`
    )
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limitVal = filters?.limit || 150
  params.push(limitVal)

  const res = await query<ItGuestAccessLink>(
    `SELECT * FROM it_guest_access_links ${whereSql} ORDER BY seq_year DESC, seq_month DESC, seq_no DESC, id DESC LIMIT $${params.length}`,
    params
  )

  const hydrated: ItGuestAccessLink[] = []
  for (const row of res.rows) {
    hydrated.push(await hydrateGuestLink(row))
  }
  return hydrated
}

export async function getItGuestAccessLinkByCodeOrToken(identifier: string): Promise<ItGuestAccessLink | null> {
  await ensureItGuestLinkTable()
  const clean = identifier.trim()
  if (!clean) return null

  const res = await query<ItGuestAccessLink>(
    `SELECT * FROM it_guest_access_links
     WHERE UPPER(link_code) = UPPER($1) OR token = $1
     LIMIT 1`,
    [clean]
  )

  if (!res.rowCount || res.rowCount === 0) return null
  return hydrateGuestLink(res.rows[0])
}

export async function getItGuestAccessLinkById(id: number): Promise<ItGuestAccessLink | null> {
  await ensureItGuestLinkTable()
  const res = await query<ItGuestAccessLink>(
    `SELECT * FROM it_guest_access_links WHERE id = $1 LIMIT 1`,
    [id]
  )
  if (!res.rowCount || res.rowCount === 0) return null
  return hydrateGuestLink(res.rows[0])
}

/**
 * TAHAP 1: Tamu mengisi Form 1 terlebih dahulu (ISMS-F-03-00-001 Membawa Masuk atau ISMS-F-03-00-002 Membawa Keluar).
 * Sebelum Form 1 di-approve oleh Admin IT, Tamu belum bisa lanjut ke Form 2 (Penyambungan Jaringan Internal).
 */
export async function submitItGuestForm1(
  linkId: number,
  payload: {
    form_type?: 'in' | 'out'
    guest_name: string
    applicant_nik?: string
    company_name: string
    department: string
    section: string
    location: string
    purpose: string
    date_in: string
    date_out_plan: string
    applicant_phone?: string
    applicant_email?: string
    items: ItEquipmentItem[]
  }
): Promise<ItGuestAccessLink> {
  await ensureItGuestLinkTable()

  const existing = await getItGuestAccessLinkById(linkId)
  if (!existing) {
    throw new Error('Link akses tamu tidak ditemukan.')
  }

  const formType: 'in' | 'out' = payload.form_type === 'out' ? 'out' : 'in'
  const prefix = formType === 'out' ? 'IT-OUT' : 'IT-IN'

  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const dateStr = `${yyyy}${mm}${dd}`

  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM it_equipment_requests WHERE request_no LIKE $1`,
    [`${prefix}-${dateStr}-%`]
  )
  const seq = Number(countRes.rows[0]?.count || 0) + 1
  const randSuffix = Math.floor(10 + Math.random() * 89)
  const eqRequestNo = `${prefix}-${dateStr}-${String(seq).padStart(3, '0')}${randSuffix}`
  const eqToken = crypto.randomBytes(24).toString('hex')

  const cleanItems: ItEquipmentItem[] = (payload.items || []).map((it, idx) => ({
    id: String(idx + 1),
    equipment_type: it.equipment_type || 'PC / Laptop',
    id_no: it.id_no?.trim() || `GUEST-DEV-${idx + 1}`,
    brand: it.brand?.trim() || '-',
    model: it.model?.trim() || '-',
    serial_no: it.serial_no?.trim() || '-',
  }))

  let eqRowId = existing.equipment_request_id
  if (eqRowId) {
    await query(
      `UPDATE it_equipment_requests
       SET form_type = $1,
           applicant_name = $2,
           applicant_nik = $3,
           company_name = $4,
           department = $5,
           section = $6,
           location = $7,
           purpose = $8,
           date_in = $9,
           date_out_plan = $10,
           items = $11,
           applicant_phone = $12,
           applicant_email = $13,
           status = 'pending',
           updated_at = NOW()
       WHERE id = $14`,
      [
        formType,
        payload.guest_name.trim(),
        payload.applicant_nik?.trim() || null,
        payload.company_name.trim(),
        payload.department.trim(),
        payload.section.trim(),
        payload.location.trim(),
        payload.purpose.trim(),
        payload.date_in,
        payload.date_out_plan,
        JSON.stringify(cleanItems),
        payload.applicant_phone?.trim() || null,
        payload.applicant_email?.trim() || null,
        eqRowId,
      ]
    )
  } else {
    const eqInsert = await query<ItEquipmentRequest>(
      `INSERT INTO it_equipment_requests (
        request_no, form_type, applicant_name, applicant_nik, company_name, department, section,
        location, purpose, date_in, date_out_plan, items, applicant_phone, applicant_email,
        agree_rules, status, token
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, 'pending', $15)
      RETURNING *`,
      [
        eqRequestNo,
        formType,
        payload.guest_name.trim(),
        payload.applicant_nik?.trim() || null,
        payload.company_name.trim(),
        payload.department.trim(),
        payload.section.trim(),
        payload.location.trim(),
        payload.purpose.trim(),
        payload.date_in,
        payload.date_out_plan,
        JSON.stringify(cleanItems),
        payload.applicant_phone?.trim() || null,
        payload.applicant_email?.trim() || null,
        eqToken,
      ]
    )
    eqRowId = eqInsert.rows[0].id
  }

  const updRes = await query<ItGuestAccessLink>(
    `UPDATE it_guest_access_links
     SET guest_name = $1,
         company_name = $2,
         department = $3,
         visit_date = $4,
         visit_end_date = $5,
         status = 'submitted',
         equipment_request_id = $6,
         updated_at = NOW()
     WHERE id = $7
     RETURNING *`,
    [
      payload.guest_name.trim(),
      payload.company_name.trim(),
      payload.department.trim(),
      payload.date_in,
      payload.date_out_plan,
      eqRowId,
      linkId,
    ]
  )

  return hydrateGuestLink(updRes.rows[0])
}

/**
 * TAHAP 2: Tamu mengisi Form 2 (Penyambungan Jaringan Internal ISMS-F-03-00-003).
 * WAJIB: Form 1 (Izin Alat IT) harus sudah berstatus 'approved' terlebih dahulu!
 */
export async function submitItGuestForm2Network(
  linkId: number,
  payload: {
    connection_type?: string
    device_type?: string
    mac_address: string
    os_info: string
    antivirus_installed: string
    antivirus_name: string
    antivirus_version?: string
    antivirus_updated: string
    network_purpose?: string
    purpose_internet?: boolean
    purpose_email?: boolean
    purpose_web?: boolean
    purpose_ftp?: boolean
    purpose_others?: string
  }
): Promise<ItGuestAccessLink> {
  await ensureItGuestLinkTable()

  const existing = await getItGuestAccessLinkById(linkId)
  if (!existing) {
    throw new Error('Link akses tamu tidak ditemukan.')
  }

  const eq = existing.equipment_request
  const items = eq && Array.isArray(eq.items) ? eq.items : []
  const primaryDevice = items[0] || {
    equipment_type: payload.device_type || 'PC / Laptop',
    brand: '-',
    model: '-',
    serial_no: '-',
    id_no: '-',
  }

  const dateInStr = eq?.date_in
    ? String(eq.date_in).slice(0, 10)
    : existing.visit_date
    ? String(existing.visit_date).slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const dateOutStr = eq?.date_out_plan
    ? String(eq.date_out_plan).slice(0, 10)
    : existing.visit_end_date
    ? String(existing.visit_end_date).slice(0, 10)
    : dateInStr

  const applicantName = eq?.applicant_name || existing.guest_name || 'Tamu PT. JAI'
  const companyName = eq?.company_name || existing.company_name || 'PT. JAI Guest'
  const department = eq?.department || existing.department || 'Information Technology'
  const purpose = payload.network_purpose?.trim() || eq?.purpose || 'Koneksi Perangkat Tamu PT. JAI'

  const networkFormData: Record<string, any> = {
    guest_link_code: existing.link_code,
    section: eq?.section || '-',
    location: eq?.location || '-',
    connection_type: payload.connection_type || 'Wi-Fi Internal (Wireless)',
    device_type: payload.device_type || primaryDevice.equipment_type || 'Notebook / Laptop',
    device_brand: `${primaryDevice.brand || ''} ${primaryDevice.model || ''}`.trim() || '-',
    serial_number: primaryDevice.serial_no || '-',
    asset_no: primaryDevice.id_no || '-',
    mac_address: payload.mac_address.trim(),
    os_info: payload.os_info.trim(),
    antivirus_installed: payload.antivirus_installed || 'Ya',
    antivirus_name: payload.antivirus_name.trim(),
    antivirus_version: payload.antivirus_version?.trim() || 'Terbaru (Up-to-date)',
    antivirus_updated: payload.antivirus_updated || 'Ya',
    virus_definition_update:
      payload.antivirus_updated === 'Tidak' ? 'Belum Update' : dateInStr,
    period_from: dateInStr,
    period_to: dateOutStr,
    start_date: dateInStr,
    end_date: dateOutStr,
    purpose_internet: payload.purpose_internet ?? true,
    purpose_email: payload.purpose_email ?? true,
    purpose_web: Boolean(payload.purpose_web),
    purpose_ftp: Boolean(payload.purpose_ftp),
    purpose_others:
      payload.purpose_others !== undefined
        ? payload.purpose_others.trim()
        : (payload.network_purpose?.trim() || eq?.purpose || ''),
    applicant_phone: eq?.applicant_phone || '',
    applicant_email: eq?.applicant_email || '',
    ip_mode: existing.ip_mode || 'dhcp',
    assigned_ip: '',
    static_ip: '',
    static_subnet: existing.subnet_mask || '255.255.255.0',
    static_gateway: existing.gateway || '192.168.50.1',
    dns_priority: existing.dns_primary || '192.168.1.10',
    dns_secondary: existing.dns_secondary || '8.8.8.8',
    network_username: '',
    network_ssid: existing.network_ssid || 'JAI-CORP-GUEST',
  }

  const netSubmission = await createItFormSubmission({
    form_code: 'ISMS-F-03-00-003',
    applicant_name: applicantName,
    applicant_nik: eq?.applicant_nik || `GUEST-${existing.seq_year}-${String(existing.seq_no).padStart(3, '0')}`,
    applicant_position: `Tamu / Visitor (${companyName})`,
    employee_status: 'TAMU / VENDOR',
    department: department,
    company_name: companyName,
    purpose: purpose,
    form_data: networkFormData,
    notes: `Link Tamu Terpadu: ${existing.link_code}${eq ? ` (Izin Alat: ${eq.request_no})` : ''}`,
  })

  const updRes = await query<ItGuestAccessLink>(
    `UPDATE it_guest_access_links
     SET network_submission_id = $1,
         status = 'submitted',
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [netSubmission.id, linkId]
  )

  // Otomatisasi: Langsung approve IT Check & alokasikan IP sesuai nomor urut bulanan
  try {
    const suggested = buildSuggestedNetworkConfig(existing)
    const autoApproved = await approveOrRejectItGuestLink(linkId, {
      action: 'approve',
      approver_name: 'System Security Administrator (IT)',
      assigned_ip: existing.assigned_ip || suggested.assigned_ip,
      network_username: existing.network_username || suggested.network_username,
      network_password: existing.network_password || suggested.network_password,
      network_ssid: existing.network_ssid || suggested.network_ssid,
      subnet_mask: existing.subnet_mask || suggested.subnet_mask,
      gateway: existing.gateway || suggested.gateway,
      dns_primary: existing.dns_primary || suggested.dns_primary,
      dns_secondary: existing.dns_secondary || suggested.dns_secondary,
      approval_notes: `Otomatis Disetujui sesuai No. Urut #${String(existing.seq_no).padStart(3, '0')}. IP: ${suggested.assigned_ip}`,
    })
    return autoApproved
  } catch (autoErr) {
    console.warn('[submitItGuestForm2Network] Auto-approve fallback to submitted:', autoErr)
    return hydrateGuestLink(updRes.rows[0])
  }
}

/**
 * Ketika Tamu mengisi Link Khusus Guest (Kompatibilitas 2 Form)
 */
export async function submitItGuestCombinedForms(
  linkId: number,
  payload: {
    guest_name: string
    company_name: string
    department: string
    section: string
    location: string
    purpose: string
    date_in: string
    date_out_plan: string
    applicant_phone?: string
    applicant_email?: string
    items: ItEquipmentItem[]
    // Form 2: Network Connection Application (ISMS-F-03-00-003)
    connection_type?: string // 'Wi-Fi Internal (Wireless)' | 'LAN Kabel (Ethernet)'
    device_type?: string // 'Notebook / Laptop' | 'PC Desktop' | 'Smart Device'
    mac_address: string
    os_info: string
    antivirus_installed: string // 'Ya' | 'Tidak'
    antivirus_name: string
    antivirus_version?: string
    antivirus_updated: string // 'Ya' | 'Tidak'
    network_purpose?: string
    purpose_internet?: boolean
    purpose_email?: boolean
    purpose_web?: boolean
    purpose_ftp?: boolean
    purpose_others?: string
  }
): Promise<ItGuestAccessLink> {
  await ensureItGuestLinkTable()

  const existing = await getItGuestAccessLinkById(linkId)
  if (!existing) {
    throw new Error('Link akses tamu tidak ditemukan.')
  }

  // 1. Buat pengajuan Form Izin Masuk Alat IT (ISMS-F-03-00-001) di it_equipment_requests
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const dateStr = `${yyyy}${mm}${dd}`

  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM it_equipment_requests WHERE request_no LIKE $1`,
    [`IT-IN-${dateStr}-%`]
  )
  const seq = Number(countRes.rows[0]?.count || 0) + 1
  const randSuffix = Math.floor(10 + Math.random() * 89)
  const eqRequestNo = `IT-IN-${dateStr}-${String(seq).padStart(3, '0')}${randSuffix}`
  const eqToken = crypto.randomBytes(24).toString('hex')

  const cleanItems: ItEquipmentItem[] = (payload.items || []).map((it, idx) => ({
    id: String(idx + 1),
    equipment_type: it.equipment_type || 'PC / Laptop',
    id_no: it.id_no?.trim() || `GUEST-DEV-${idx + 1}`,
    brand: it.brand?.trim() || '-',
    model: it.model?.trim() || '-',
    serial_no: it.serial_no?.trim() || '-',
  }))

  const eqInsert = await query<ItEquipmentRequest>(
    `INSERT INTO it_equipment_requests (
      request_no, form_type, applicant_name, company_name, department, section,
      location, purpose, date_in, date_out_plan, items, applicant_phone, applicant_email,
      agree_rules, status, token
    ) VALUES ($1, 'in', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, 'pending', $13)
    RETURNING *`,
    [
      eqRequestNo,
      payload.guest_name.trim(),
      payload.company_name.trim(),
      payload.department.trim(),
      payload.section.trim(),
      payload.location.trim(),
      payload.purpose.trim(),
      payload.date_in,
      payload.date_out_plan,
      JSON.stringify(cleanItems),
      payload.applicant_phone?.trim() || null,
      payload.applicant_email?.trim() || null,
      eqToken,
    ]
  )
  const eqRow = eqInsert.rows[0]

  // 2. Buat pengajuan Form Penyambungan Jaringan Internal (ISMS-F-03-00-003) di it_form_submissions
  const primaryDevice = cleanItems[0] || {
    equipment_type: 'PC / Laptop',
    brand: '-',
    model: '-',
    serial_no: '-',
    id_no: '-',
  }

  const networkFormData: Record<string, any> = {
    guest_link_code: existing.link_code,
    section: payload.section.trim(),
    location: payload.location.trim(),
    connection_type: payload.connection_type || 'Wi-Fi Internal (Wireless)',
    device_type: payload.device_type || primaryDevice.equipment_type || 'Notebook / Laptop',
    device_brand: `${primaryDevice.brand} ${primaryDevice.model}`.trim(),
    serial_number: primaryDevice.serial_no,
    asset_no: primaryDevice.id_no,
    mac_address: payload.mac_address.trim(),
    os_info: payload.os_info.trim(),
    antivirus_installed: payload.antivirus_installed || 'Ya',
    antivirus_name: payload.antivirus_name.trim(),
    antivirus_version: payload.antivirus_version?.trim() || 'Terbaru (Up-to-date)',
    antivirus_updated: payload.antivirus_updated || 'Ya',
    virus_definition_update:
      payload.antivirus_updated === 'Tidak' ? 'Belum Update' : payload.date_in,
    period_from: payload.date_in,
    period_to: payload.date_out_plan,
    start_date: payload.date_in,
    end_date: payload.date_out_plan,
    purpose_internet: payload.purpose_internet ?? true,
    purpose_email: payload.purpose_email ?? true,
    purpose_web: Boolean(payload.purpose_web),
    purpose_ftp: Boolean(payload.purpose_ftp),
    purpose_others:
      payload.purpose_others !== undefined
        ? payload.purpose_others.trim()
        : (payload.network_purpose?.trim() || payload.purpose.trim()),
    applicant_phone: payload.applicant_phone?.trim() || '',
    applicant_email: payload.applicant_email?.trim() || '',
    ip_mode: existing.ip_mode || 'dhcp',
    assigned_ip: existing.assigned_ip || '',
    static_ip: existing.assigned_ip || '',
    static_subnet: existing.subnet_mask || '255.255.255.0',
    static_gateway: existing.gateway || '192.168.50.1',
    dns_priority: existing.dns_primary || '192.168.1.10',
    dns_secondary: existing.dns_secondary || '8.8.8.8',
    network_username: existing.network_username || '',
    network_ssid: existing.network_ssid || 'JAI-CORP-GUEST',
  }

  const netSubmission = await createItFormSubmission({
    form_code: 'ISMS-F-03-00-003',
    applicant_name: payload.guest_name.trim(),
    applicant_nik: `GUEST-${existing.seq_year}-${String(existing.seq_no).padStart(3, '0')}`,
    applicant_position: `Tamu / Visitor (${payload.company_name.trim()})`,
    employee_status: 'TAMU / VENDOR',
    department: payload.department.trim(),
    company_name: payload.company_name.trim(),
    purpose: payload.network_purpose?.trim() || payload.purpose.trim(),
    form_data: networkFormData,
    notes: `Link Tamu Terpadu: ${existing.link_code} (Izin Alat: ${eqRow.request_no})`,
  })

  // 3. Update record it_guest_access_links
  const updRes = await query<ItGuestAccessLink>(
    `UPDATE it_guest_access_links
     SET guest_name = $1,
         company_name = $2,
         department = $3,
         visit_date = $4,
         visit_end_date = $5,
         status = 'submitted',
         equipment_request_id = $6,
         network_submission_id = $7,
         updated_at = NOW()
     WHERE id = $8
     RETURNING *`,
    [
      payload.guest_name.trim(),
      payload.company_name.trim(),
      payload.department.trim(),
      payload.date_in,
      payload.date_out_plan,
      eqRow.id,
      netSubmission.id,
      linkId,
    ]
  )

  // Otomatisasi: Langsung approve IT Check & alokasikan IP sesuai nomor urut bulanan
  try {
    const suggested = buildSuggestedNetworkConfig(existing)
    const autoApproved = await approveOrRejectItGuestLink(linkId, {
      action: 'approve',
      approver_name: 'System Security Administrator (IT)',
      assigned_ip: existing.assigned_ip || suggested.assigned_ip,
      network_username: existing.network_username || suggested.network_username,
      network_password: existing.network_password || suggested.network_password,
      network_ssid: existing.network_ssid || suggested.network_ssid,
      subnet_mask: existing.subnet_mask || suggested.subnet_mask,
      gateway: existing.gateway || suggested.gateway,
      dns_primary: existing.dns_primary || suggested.dns_primary,
      dns_secondary: existing.dns_secondary || suggested.dns_secondary,
      approval_notes: `Otomatis Disetujui sesuai No. Urut #${String(existing.seq_no).padStart(3, '0')}. IP: ${suggested.assigned_ip}`,
    })
    return autoApproved
  } catch (autoErr) {
    console.warn('[submitItGuestCombinedForms] Auto-approve fallback to submitted:', autoErr)
    return hydrateGuestLink(updRes.rows[0])
  }
}

/**
 * Ketika Admin IT meng-approve (atau menolak) Link Tamu & memberikan Username + IP + Kredensial Jaringan Internal
 */
export async function approveOrRejectItGuestLink(
  linkId: number,
  input: {
    action: 'approve_form_1_manager' | 'approve_form_1' | 'approve' | 'approve_iaa' | 'reject'
    approver_name: string
    also_approve_iaa?: boolean
    network_username?: string
    network_password?: string
    network_ssid?: string
    ip_mode?: 'dhcp' | 'static'
    assigned_ip?: string
    subnet_mask?: string
    gateway?: string
    dns_primary?: string
    dns_secondary?: string
    approval_notes?: string
    rejection_reason?: string
  }
): Promise<ItGuestAccessLink> {
  await ensureItGuestLinkTable()

  const existing = await getItGuestAccessLinkById(linkId)
  if (!existing) {
    throw new Error('Data link tamu tidak ditemukan.')
  }

  const signerName = input.approver_name?.trim() || 'System Security Admin (IT)'

  if (input.action === 'reject') {
    const reason = input.rejection_reason?.trim() || 'Ditolak oleh Admin IT'

    if (existing.equipment_request_id) {
      await query(
        `UPDATE it_equipment_requests
         SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), rejection_reason = $2, updated_at = NOW()
         WHERE id = $3`,
        [signerName, reason, existing.equipment_request_id]
      )
    }

    if (existing.network_submission_id) {
      await query(
        `UPDATE it_form_submissions
         SET status = 'rejected', notes = $1, updated_at = NOW()
         WHERE id = $2`,
        [reason, existing.network_submission_id]
      )
      await query(
        `UPDATE it_form_signatures
         SET status = 'rejected', approver_name = $1, signature_note = $2, signed_at = NOW(), updated_at = NOW()
         WHERE submission_id = $3 AND status IN ('pending', 'waiting')`,
        [signerName, reason, existing.network_submission_id]
      )
    }

    const rejRes = await query<ItGuestAccessLink>(
      `UPDATE it_guest_access_links
       SET status = 'rejected',
           rejected_by = $1,
           rejected_at = NOW(),
           rejection_reason = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [signerName, reason, linkId]
    )
    return hydrateGuestLink(rejRes.rows[0])
  }

  // TAHAP 1A: Persetujuan IAA / Manager Departemen pada Form 1 (Izin Membawa Masuk/Keluar Alat IT ISMS-F-03-00-001 / 002)
  if (input.action === 'approve_form_1_manager') {
    if (!existing.equipment_request_id) {
      throw new Error('Tamu belum mengisi Formulir 1 (Izin Membawa Masuk/Keluar Alat IT).')
    }
    const mgrName = input.approver_name?.trim() || 'Manager Departemen / IAA'
    const notesMgr =
      input.approval_notes?.trim() ||
      'Tahap 1A Form 1 (IAA / Manager Departemen) Disetujui. Menunggu Tahap 1B (Check IT / SSA).'

    await query(
      `UPDATE it_equipment_requests
       SET status = 'approved_manager',
           approved_by = $1,
           approved_title = 'Manager Departemen / IAA',
           approved_at = NOW(),
           approval_notes = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [mgrName, notesMgr, existing.equipment_request_id]
    )

    await query(
      `UPDATE it_guest_access_links
       SET approval_notes = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [notesMgr, linkId]
    )

    const refreshed = await getItGuestAccessLinkById(linkId)
    return refreshed!
  }

  // TAHAP 1B: Verifikasi / Persetujuan IT (System Security Administrator) pada Form 1
  // WAJIB: Tahap 1A (IAA / Manager Departemen) harus sudah disetujui terlebih dahulu!
  if (input.action === 'approve_form_1') {
    if (!existing.equipment_request_id || !existing.equipment_request) {
      throw new Error('Tamu belum mengisi Formulir 1 (Izin Membawa Masuk/Keluar Alat IT).')
    }
    if (
      existing.equipment_request.status !== 'approved_manager' &&
      existing.equipment_request.status !== 'approved'
    ) {
      throw new Error(
        'Alur Bertahap: Formulir 1 (Izin Masuk/Keluar Alat IT) harus disetujui oleh IAA / Manager Departemen terlebih dahulu sebelum diverifikasi oleh IT.'
      )
    }

    const approvalCode =
      existing.equipment_request.approval_code || crypto.randomBytes(4).toString('hex').toUpperCase()
    const notes1 =
      input.approval_notes?.trim() ||
      'Form 1 (Izin Alat IT) telah disetujui IAA/Manager Departemen & diverifikasi IT. Silakan lanjutkan pengisian Form 2 (Network).'

    await query(
      `UPDATE it_equipment_requests
       SET status = 'approved',
           approval_code = $1,
           it_checked_by = $2,
           it_checked_title = 'System Security Administrator (IT)',
           it_checked_at = NOW(),
           it_check_notes = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [approvalCode, signerName, notes1, existing.equipment_request_id]
    )

    await query(
      `UPDATE it_guest_access_links
       SET approved_by = $1,
           approval_notes = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [signerName, notes1, linkId]
    )

    const refreshed = await getItGuestAccessLinkById(linkId)
    return refreshed!
  }

  // TAHAP 2B: Persetujuan Akhir oleh IAA (Pak Teguh Sunjoyo) pada Form 2 (ISMS-F-03-00-003)
  if (input.action === 'approve_iaa') {
    if (existing.equipment_request && existing.equipment_request.status === 'rejected') {
      throw new Error('Form 1 (Izin Alat IT) ditolak.')
    }
    if (!existing.network_submission_id || !existing.network_submission) {
      throw new Error('Form 2 (Penyambungan Jaringan) belum diisi.')
    }

    const sigIt = existing.network_submission.signatures?.find(
      (s) =>
        s.slot_label.toUpperCase().includes('CHECK') ||
        s.slot_label.toUpperCase().includes('CEK') ||
        s.role_title.toUpperCase().includes('IT SECTION') ||
        s.role_title.toUpperCase().includes('SECURITY')
    )
    if (!sigIt || sigIt.status !== 'approved') {
      throw new Error(
        'Alur Bertahap: Tahap 1 (IT Section Check & Alokasi IP) harus di-Approve oleh Admin IT terlebih dahulu sebelum dapat menyetujui Tahap 2 (Approval IAA - Bpk. Teguh Sunjoyo).'
      )
    }

    const iaaSigner = input.approver_name?.trim() || 'TEGUH SUNJOYO'
    const verCodeIaa = `IAA-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const noteIaa = input.approval_notes?.trim() || 'Approved by Information Assets Administrator (IAA)'

    await query(
      `UPDATE it_form_signatures
       SET status = 'approved',
           approver_name = $1,
           verification_code = COALESCE(verification_code, $2),
           signature_note = $3,
           signed_at = NOW(),
           updated_at = NOW()
       WHERE submission_id = $4
         AND (UPPER(slot_label) LIKE '%APPROV%' OR UPPER(role_title) LIKE '%INFORMATION%' OR UPPER(role_title) LIKE '%IAA%' OR UPPER(approver_name) LIKE '%TEGUH%')`,
      [iaaSigner, verCodeIaa, noteIaa, existing.network_submission_id]
    )

    await query(
      `UPDATE it_form_submissions
       SET status = 'approved',
           current_step = total_steps + 1,
           updated_at = NOW()
       WHERE id = $1`,
      [existing.network_submission_id]
    )

    const refreshed = await getItGuestAccessLinkById(linkId)
    return refreshed!
  }

  // TAHAP 2A: Action === 'approve' (IT Section Check & Alokasi Username + IP Address pada Form 2 ISMS-F-03-00-003)
  if (existing.equipment_request && existing.equipment_request.status === 'rejected') {
    throw new Error('Formulir 1 (Izin Membawa Masuk/Keluar Alat IT) ditolak.')
  }
  if (!existing.network_submission_id) {
    throw new Error(
      'Alur Bertahap: Tamu belum mengisi Formulir 2 (Penyambungan Jaringan Internal ISMS-F-03-00-003).'
    )
  }
  const suggested = buildSuggestedNetworkConfig(existing)
  const netUser = input.network_username?.trim() || existing.network_username || suggested.network_username
  const netPass = input.network_password?.trim() || existing.network_password || suggested.network_password
  const netSsid = input.network_ssid?.trim() || existing.network_ssid || suggested.network_ssid
  const ipMode = input.ip_mode || existing.ip_mode || 'dhcp'
  const assignedIp = input.assigned_ip?.trim() || existing.assigned_ip || suggested.assigned_ip
  const subnetMask = input.subnet_mask?.trim() || existing.subnet_mask || suggested.subnet_mask
  const gateway = input.gateway?.trim() || existing.gateway || suggested.gateway
  const dnsPrimary = input.dns_primary?.trim() || existing.dns_primary || suggested.dns_primary
  const dnsSecondary = input.dns_secondary?.trim() || existing.dns_secondary || suggested.dns_secondary
  const notes = input.approval_notes?.trim() || `Approved. User: ${netUser} | IP: ${assignedIp}`

  // 1. Approve linked Equipment Request (ISMS-F-03-00-001)
  if (existing.equipment_request_id) {
    const approvalCode = crypto.randomBytes(4).toString('hex').toUpperCase()
    await query(
      `UPDATE it_equipment_requests
       SET status = 'approved',
           approval_code = $1,
           approved_by = $2,
           approved_title = 'System Security Administrator (IT)',
           approved_at = NOW(),
           approval_notes = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [approvalCode, signerName, notes, existing.equipment_request_id]
    )
  }

  // 2. Update linked Network Connection Form (ISMS-F-03-00-003) & sync IP/Username into form_data
  if (existing.network_submission_id) {
    const sub = await getItFormSubmissionById(existing.network_submission_id)
    if (sub) {
      const currentData = typeof sub.form_data === 'object' && sub.form_data ? sub.form_data : {}
      const updatedFormData = {
        ...currentData,
        ip_mode: ipMode,
        assigned_ip: assignedIp,
        static_ip: assignedIp,
        ip_address: assignedIp,
        static_subnet: subnetMask,
        static_gateway: gateway,
        dns_priority: dnsPrimary,
        dns_secondary: dnsSecondary,
        network_username: netUser,
        network_password: netPass,
        network_ssid: netSsid,
      }
      const verCodeIt = `IT-CHK-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
      const alsoApproveIaa = Boolean(input.also_approve_iaa)

      // Tandatangani HANYA slot IT SECTION CHECK (Kotak Kiri) oleh Admin IT
      await query(
        `UPDATE it_form_signatures
         SET status = 'approved',
             step_number = 1,
             approver_name = $1,
             verification_code = COALESCE(verification_code, $2),
             signature_note = $3,
             signed_at = NOW(),
             updated_at = NOW()
         WHERE submission_id = $4
           AND (UPPER(slot_label) LIKE '%CHECK%' OR UPPER(slot_label) LIKE '%CEK%' OR UPPER(role_title) LIKE '%IT SECTION%' OR UPPER(role_title) LIKE '%SECURITY%')`,
        [signerName, verCodeIt, notes, existing.network_submission_id]
      )

      if (alsoApproveIaa) {
        const verCodeIaa = `IAA-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
        await query(
          `UPDATE it_form_signatures
           SET status = 'approved',
               step_number = 2,
               verification_code = COALESCE(verification_code, $1),
               signature_note = $2,
               signed_at = NOW(),
               updated_at = NOW()
           WHERE submission_id = $3
             AND (UPPER(slot_label) LIKE '%APPROV%' OR UPPER(role_title) LIKE '%INFORMATION%' OR UPPER(role_title) LIKE '%IAA%' OR UPPER(approver_name) LIKE '%TEGUH%')`,
          [verCodeIaa, notes, existing.network_submission_id]
        )
        await query(
          `UPDATE it_form_submissions
           SET form_data = $1,
               status = 'approved',
               current_step = total_steps + 1,
               notes = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [JSON.stringify(updatedFormData), notes, existing.network_submission_id]
        )
      } else {
        // Pastikan slot APPROVAL (Pak Teguh Sunjoyo / IAA) berada pada step 2 dengan status 'pending'
        // (Belum di-approve IAA, sehingga di PDF tidak muncul E-Sign Pak Teguh Sunjoyo sebelum beliau approve!)
        await query(
          `UPDATE it_form_signatures
           SET status = CASE WHEN status = 'approved' AND verification_code LIKE 'IT-GUEST-%' THEN 'pending' WHEN status = 'waiting' THEN 'pending' ELSE status END,
               step_number = 2,
               updated_at = NOW()
           WHERE submission_id = $1
             AND (UPPER(slot_label) LIKE '%APPROV%' OR UPPER(role_title) LIKE '%INFORMATION%' OR UPPER(role_title) LIKE '%IAA%' OR UPPER(approver_name) LIKE '%TEGUH%')`,
          [existing.network_submission_id]
        )
        await query(
          `UPDATE it_form_submissions
           SET form_data = $1,
               status = 'pending',
               current_step = 2,
               notes = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [JSON.stringify(updatedFormData), notes, existing.network_submission_id]
        )
      }
    }
  }

  // 3. Update it_guest_access_links
  const appRes = await query<ItGuestAccessLink>(
    `UPDATE it_guest_access_links
     SET status = 'approved',
         network_username = $1,
         network_password = $2,
         network_ssid = $3,
         ip_mode = $4,
         assigned_ip = $5,
         subnet_mask = $6,
         gateway = $7,
         dns_primary = $8,
         dns_secondary = $9,
         approved_by = $10,
         approved_at = NOW(),
         approval_notes = $11,
         updated_at = NOW()
     WHERE id = $12
     RETURNING *`,
    [
      netUser,
      netPass,
      netSsid,
      ipMode,
      assignedIp,
      subnetMask,
      gateway,
      dnsPrimary,
      dnsSecondary,
      signerName,
      notes,
      linkId,
    ]
  )

  return hydrateGuestLink(appRes.rows[0])
}

/**
 * Hapus data Link Tamu (beserta dokumen terkait jika ada)
 */
export async function deleteItGuestAccessLink(id: number, deleteLinkedForms = true): Promise<boolean> {
  await ensureItGuestLinkTable()
  const existing = await getItGuestAccessLinkById(id)
  if (!existing) return false

  const eqId = existing.equipment_request_id
  const netId = existing.network_submission_id

  const delRes = await query(`DELETE FROM it_guest_access_links WHERE id = $1`, [id])

  if (deleteLinkedForms) {
    if (eqId) {
      await query(`DELETE FROM it_equipment_requests WHERE id = $1`, [eqId]).catch(() => {})
    }
    if (netId) {
      await query(`DELETE FROM it_form_submissions WHERE id = $1`, [netId]).catch(() => {})
    }
  }

  return (delRes.rowCount ?? 0) > 0
}

