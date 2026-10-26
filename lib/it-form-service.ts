// lib/it-form-service.ts
import 'server-only'
import path from 'node:path'
import crypto from 'node:crypto'
import { query } from '@/lib/db'
import { getSmtpSettings, sendMail } from '@/lib/smtp'
import { resolveAppBaseUrl } from '@/lib/request-origin'
import { API_BASE_PATH } from '@/lib/config'
import {
  buildItFormApprovalEmail,
  buildItFormCompletedEmail,
  buildItFormRejectedEmail,
  LOGO_CID,
} from '@/lib/email-templates'
import {
  IT_FORM_DEFINITIONS,
  type ItFormApprover,
  type ItFormSubmission,
  type ItFormSignature,
} from '@/lib/it-form-shared'

export {
  IT_FORM_DEFINITIONS,
  type ItFormApprover,
  type ItFormSubmission,
  type ItFormSignature,
}

let initialized = false

export async function ensureItFormTables() {
  if (initialized) return
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS it_form_approvers (
        id SERIAL PRIMARY KEY,
        form_code VARCHAR(40) NOT NULL,
        form_name VARCHAR(150) NOT NULL,
        slot_number INT NOT NULL,
        slot_label VARCHAR(80) NOT NULL,
        role_title VARCHAR(150) NOT NULL,
        person_name VARCHAR(150) NOT NULL,
        salutation VARCHAR(20) DEFAULT 'Bapak',
        initials VARCHAR(10) DEFAULT '',
        email VARCHAR(150),
        department VARCHAR(100),
        is_active BOOLEAN NOT NULL DEFAULT true,
        sort_order INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await query(`CREATE INDEX IF NOT EXISTS idx_it_form_approvers_form_code ON it_form_approvers (form_code, sort_order);`)

    await query(`
      CREATE TABLE IF NOT EXISTS it_form_submissions (
        id SERIAL PRIMARY KEY,
        request_no VARCHAR(60) NOT NULL UNIQUE,
        form_code VARCHAR(40) NOT NULL,
        form_name VARCHAR(150) NOT NULL,
        request_date DATE NOT NULL DEFAULT CURRENT_DATE,
        applicant_name VARCHAR(150) NOT NULL,
        applicant_nik VARCHAR(50),
        applicant_position VARCHAR(120),
        employee_status VARCHAR(50) DEFAULT 'TETAP',
        department VARCHAR(120) NOT NULL,
        company_name VARCHAR(150),
        purpose TEXT,
        form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        current_step INT NOT NULL DEFAULT 1,
        total_steps INT NOT NULL DEFAULT 1,
        token VARCHAR(64) UNIQUE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await query(`CREATE INDEX IF NOT EXISTS idx_it_form_submissions_form_code ON it_form_submissions (form_code);`)
    await query(`CREATE INDEX IF NOT EXISTS idx_it_form_submissions_status ON it_form_submissions (status);`)
    await query(`CREATE INDEX IF NOT EXISTS idx_it_form_submissions_token ON it_form_submissions (token);`)

    await query(`
      CREATE TABLE IF NOT EXISTS it_form_signatures (
        id SERIAL PRIMARY KEY,
        submission_id INT NOT NULL REFERENCES it_form_submissions(id) ON DELETE CASCADE,
        step_number INT NOT NULL,
        slot_label VARCHAR(80) NOT NULL,
        role_title VARCHAR(150) NOT NULL,
        approver_name VARCHAR(150) NOT NULL,
        approver_email VARCHAR(150),
        status VARCHAR(30) NOT NULL DEFAULT 'waiting',
        verification_code VARCHAR(30),
        signed_at TIMESTAMPTZ,
        signature_note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await query(`CREATE INDEX IF NOT EXISTS idx_it_form_signatures_sub_step ON it_form_signatures (submission_id, step_number);`)

    // Seed defaults if empty
    const checkCount = await query<{ count: string }>('SELECT COUNT(*) as count FROM it_form_approvers')
    if (Number(checkCount.rows[0]?.count ?? 0) === 0) {
      await seedDefaultApprovers()
    } else {
      // Ensure ISMS-F-02-00-002 has its default approver (Teguh Sunjoyo, IAA)
      const checkFinger = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM it_form_approvers WHERE form_code = $1',
        ['ISMS-F-02-00-002']
      )
      if (Number(checkFinger.rows[0]?.count ?? 0) === 0) {
        await query(
          `INSERT INTO it_form_approvers (form_code, form_name, slot_number, slot_label, role_title, person_name, salutation, initials, email, department, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            'ISMS-F-02-00-002',
            'Pengajuan Registrasi Finger Print Special Security Area',
            1,
            'MENYETUJUI / APPROVAL',
            'Information Assets Administrator (IAA)',
            'Teguh Sunjoyo',
            'Bapak',
            'IAA',
            'teguh.sunjoyo@jai.co.id',
            'Information Assets Administrator',
            1,
          ]
        )
      }
    }

    initialized = true
  } catch (err) {
    console.error('ensureItFormTables error:', err)
  }
}

export async function seedDefaultApprovers() {
  const defaults = [
    // ISMS-F-010-001
    {
      form_code: 'ISMS-F-010-001',
      form_name: 'Form Pengadaan Baru atau Pembaharuan PC/Laptop',
      slot_number: 1,
      slot_label: 'Persetujuan dari MGR/J.MGR',
      role_title: 'Departemen MANAGER / J. MANAGER',
      person_name: 'Departemen Manager',
      salutation: 'Bapak',
      initials: 'MGR',
      email: 'dept.manager@jai.co.id',
      department: 'Departemen Pemohon',
      sort_order: 1,
    },
    {
      form_code: 'ISMS-F-010-001',
      form_name: 'Form Pengadaan Baru atau Pembaharuan PC/Laptop',
      slot_number: 2,
      slot_label: 'CEK oleh IT Section',
      role_title: 'IT Section / System Security Admin',
      person_name: 'IT Security Admin',
      salutation: 'Bapak',
      initials: 'SSA',
      email: 'it.security@jai.co.id',
      department: 'IT Section',
      sort_order: 2,
    },
    // ISMS-F-010-003
    {
      form_code: 'ISMS-F-010-003',
      form_name: 'Form Pengadaan Baru atau Pembaharuan Software',
      slot_number: 1,
      slot_label: 'Persetujuan MGR/J.MGR',
      role_title: 'Departemen MANAGER / J. MANAGER',
      person_name: 'Departemen Manager',
      salutation: 'Bapak',
      initials: 'MGR',
      email: 'dept.manager@jai.co.id',
      department: 'Departemen Pemohon',
      sort_order: 1,
    },
    {
      form_code: 'ISMS-F-010-003',
      form_name: 'Form Pengadaan Baru atau Pembaharuan Software',
      slot_number: 2,
      slot_label: 'CEK oleh IT Section',
      role_title: 'IT Section / System Security Admin',
      person_name: 'IT Security Admin',
      salutation: 'Bapak',
      initials: 'SSA',
      email: 'it.security@jai.co.id',
      department: 'IT Section',
      sort_order: 2,
    },
    // ISMS-F-010-006
    {
      form_code: 'ISMS-F-010-006',
      form_name: 'Pengajuan / Perubahan Email & User ID',
      slot_number: 1,
      slot_label: 'CHECK',
      role_title: 'IT SPV / System Security Administrator',
      person_name: 'IT Supervisor',
      salutation: 'Bapak',
      initials: 'SSA',
      email: 'it.spv@jai.co.id',
      department: 'IT Section',
      sort_order: 1,
    },
    {
      form_code: 'ISMS-F-010-006',
      form_name: 'Pengajuan / Perubahan Email & User ID',
      slot_number: 2,
      slot_label: 'MENGETAHUI',
      role_title: 'IR / HR SPV atau Departemen IR / HR',
      person_name: 'IR/HR Supervisor',
      salutation: 'Bapak',
      initials: 'HR',
      email: 'hr.spv@jai.co.id',
      department: 'IR / HR',
      sort_order: 2,
    },
    {
      form_code: 'ISMS-F-010-006',
      form_name: 'Pengajuan / Perubahan Email & User ID',
      slot_number: 3,
      slot_label: 'MENYETUJUI',
      role_title: 'Departemen MANAGER / J. MANAGER',
      person_name: 'Departemen Manager',
      salutation: 'Bapak',
      initials: 'MGR',
      email: 'dept.manager@jai.co.id',
      department: 'Departemen Pemohon',
      sort_order: 3,
    },
    // ISMS-F-010-007
    {
      form_code: 'ISMS-F-010-007',
      form_name: 'Request Penghapusan Email & User ID',
      slot_number: 1,
      slot_label: 'DIREQUESTKAN OLEH',
      role_title: 'IR SPV / HR SPV atau Departemen IR/HR',
      person_name: 'IR/HR Supervisor',
      salutation: 'Bapak',
      initials: 'HR',
      email: 'hr.spv@jai.co.id',
      department: 'IR / HR',
      sort_order: 1,
    },
    {
      form_code: 'ISMS-F-010-007',
      form_name: 'Request Penghapusan Email & User ID',
      slot_number: 2,
      slot_label: 'MENGETAHUI',
      role_title: 'Departemen MANAGER / J. MANAGER',
      person_name: 'Departemen Manager',
      salutation: 'Bapak',
      initials: 'MGR',
      email: 'dept.manager@jai.co.id',
      department: 'Departemen Pemohon',
      sort_order: 2,
    },
    {
      form_code: 'ISMS-F-010-007',
      form_name: 'Request Penghapusan Email & User ID',
      slot_number: 3,
      slot_label: 'MENYETUJUI',
      role_title: 'IT SPV / Security System Administrator',
      person_name: 'IT Supervisor / SSA',
      salutation: 'Bapak',
      initials: 'SSA',
      email: 'it.spv@jai.co.id',
      department: 'IT Section',
      sort_order: 3,
    },
    // ISMS-F-03-00-003
    {
      form_code: 'ISMS-F-03-00-003',
      form_name: 'Company Network Connection Application Form',
      slot_number: 1,
      slot_label: 'IT SECTION CHECK',
      role_title: 'IT Section / System Security Admin',
      person_name: 'IT Security Admin',
      salutation: 'Bapak',
      initials: 'SSA',
      email: 'it.security@jai.co.id',
      department: 'IT Section',
      sort_order: 1,
    },
    {
      form_code: 'ISMS-F-03-00-003',
      form_name: 'Company Network Connection Application Form',
      slot_number: 2,
      slot_label: 'APPROVAL',
      role_title: 'Information Assets Administrator',
      person_name: 'TEGUH SUNJOYO',
      salutation: 'Bapak',
      initials: 'IAA',
      email: 'teguh.sunjoyo@jai.co.id',
      department: 'Management / IT',
      sort_order: 2,
    },
    // ISMS-F-03-00-001
    {
      form_code: 'ISMS-F-03-00-001',
      form_name: 'Ijin Membawa Masuk/Keluar Alat IT',
      slot_number: 1,
      slot_label: 'IT CHECK & APPROVAL',
      role_title: 'System Security Administrator (IT)',
      person_name: 'System Security Admin',
      salutation: 'Bapak',
      initials: 'SSA',
      email: 'it.admin@jai.co.id',
      department: 'IT Section',
      sort_order: 1,
    },
    // ISMS-F-02-00-002 (Fingerprint Special Security Area)
    {
      form_code: 'ISMS-F-02-00-002',
      form_name: 'Pengajuan Registrasi Finger Print Special Security Area',
      slot_number: 1,
      slot_label: 'MENYETUJUI / APPROVAL',
      role_title: 'Information Assets Administrator (IAA)',
      person_name: 'Teguh Sunjoyo',
      salutation: 'Bapak',
      initials: 'IAA',
      email: 'teguh.sunjoyo@jai.co.id',
      department: 'Information Assets Administrator',
      sort_order: 1,
    },
  ]

  for (const item of defaults) {
    await query(
      `INSERT INTO it_form_approvers (form_code, form_name, slot_number, slot_label, role_title, person_name, salutation, initials, email, department, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        item.form_code,
        item.form_name,
        item.slot_number,
        item.slot_label,
        item.role_title,
        item.person_name,
        item.salutation,
        item.initials,
        item.email,
        item.department,
        item.sort_order,
      ]
    )
  }
}

export async function getItApprovers(formCode?: string, department?: string): Promise<ItFormApprover[]> {
  await ensureItFormTables()

  if (department && formCode) {
    const res = await query<ItFormApprover>(
      `SELECT * FROM it_form_approvers
       WHERE form_code = $1 AND is_active = true
       ORDER BY slot_number ASC,
         (CASE
            WHEN lower(trim(COALESCE(department, ''))) = lower(trim($2)) THEN 0
            WHEN lower(trim(COALESCE(department, ''))) = 'departemen pemohon' THEN 1
            ELSE 2
          END) ASC,
         sort_order ASC`,
      [formCode, department]
    )

    // Deduplicate by slot_number (prioritizing the best matched department per slot)
    const slotMap = new Map<number, ItFormApprover>()
    for (const app of res.rows) {
      if (!slotMap.has(app.slot_number)) {
        slotMap.set(app.slot_number, app)
      }
    }
    const deduplicated = Array.from(slotMap.values()).sort((a, b) => a.slot_number - b.slot_number)

    if (deduplicated.length === 0 && formCode === 'ISMS-F-02-00-002') {
      deduplicated.push({
        id: 0,
        form_code: 'ISMS-F-02-00-002',
        form_name: 'Pengajuan Registrasi Finger Print Special Security Area',
        slot_number: 1,
        slot_label: 'MENYETUJUI / APPROVAL',
        role_title: 'Information Assets Administrator (IAA)',
        person_name: 'Teguh Sunjoyo',
        salutation: 'Bapak',
        initials: 'IAA',
        email: 'teguh.sunjoyo@jai.co.id',
        department: 'Information Assets Administrator',
        is_active: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
    return deduplicated
  }

  let sql = 'SELECT * FROM it_form_approvers'
  const params: any[] = []
  if (formCode) {
    sql += ' WHERE form_code = $1'
    params.push(formCode)
  }
  sql += ' ORDER BY form_code ASC, sort_order ASC, slot_number ASC, id ASC'
  const res = await query<ItFormApprover>(sql, params)
  return res.rows
}

export async function addItApprover(data: {
  form_code: string
  form_name?: string
  slot_number: number
  slot_label: string
  role_title: string
  person_name: string
  salutation?: string
  initials?: string
  email?: string | null
  department?: string | null
  is_active?: boolean
  sort_order?: number
}): Promise<ItFormApprover> {
  await ensureItFormTables()
  const formDef = IT_FORM_DEFINITIONS.find((d) => d.code === data.form_code)
  const formName = data.form_name || formDef?.name || data.form_code

  const res = await query<ItFormApprover>(
    `INSERT INTO it_form_approvers (
       form_code, form_name, slot_number, slot_label, role_title, person_name,
       salutation, initials, email, department, is_active, sort_order
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      data.form_code,
      formName,
      data.slot_number || 1,
      data.slot_label,
      data.role_title,
      data.person_name,
      data.salutation || 'Bapak',
      data.initials || '',
      data.email || null,
      data.department || null,
      data.is_active !== false,
      data.sort_order || data.slot_number || 1,
    ]
  )
  return res.rows[0]
}

export async function updateItApprover(
  id: number,
  data: Partial<{
    slot_number: number
    slot_label: string
    role_title: string
    person_name: string
    salutation: string
    initials: string
    email: string | null
    department: string | null
    is_active: boolean
    sort_order: number
  }>
): Promise<ItFormApprover | null> {
  await ensureItFormTables()
  const fields: string[] = []
  const values: any[] = []
  let idx = 1

  if (data.slot_number !== undefined) {
    fields.push(`slot_number = $${idx++}`)
    values.push(data.slot_number)
  }
  if (data.slot_label !== undefined) {
    fields.push(`slot_label = $${idx++}`)
    values.push(data.slot_label)
  }
  if (data.role_title !== undefined) {
    fields.push(`role_title = $${idx++}`)
    values.push(data.role_title)
  }
  if (data.person_name !== undefined) {
    fields.push(`person_name = $${idx++}`)
    values.push(data.person_name)
  }
  if (data.salutation !== undefined) {
    fields.push(`salutation = $${idx++}`)
    values.push(data.salutation)
  }
  if (data.initials !== undefined) {
    fields.push(`initials = $${idx++}`)
    values.push(data.initials)
  }
  if (data.email !== undefined) {
    fields.push(`email = $${idx++}`)
    values.push(data.email)
  }
  if (data.department !== undefined) {
    fields.push(`department = $${idx++}`)
    values.push(data.department)
  }
  if (data.is_active !== undefined) {
    fields.push(`is_active = $${idx++}`)
    values.push(data.is_active)
  }
  if (data.sort_order !== undefined) {
    fields.push(`sort_order = $${idx++}`)
    values.push(data.sort_order)
  }

  fields.push(`updated_at = NOW()`)

  values.push(id)
  const res = await query<ItFormApprover>(
    `UPDATE it_form_approvers SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  )
  return res.rows[0] || null
}

export async function deleteItApprover(id: number): Promise<boolean> {
  await ensureItFormTables()
  const res = await query('DELETE FROM it_form_approvers WHERE id = $1', [id])
  return (res.rowCount ?? 0) > 0
}

export async function createItFormSubmission(data: {
  form_code: string
  applicant_name: string
  applicant_nik?: string
  applicant_position?: string
  employee_status?: string
  department: string
  company_name?: string
  purpose?: string
  form_data: Record<string, any>
  notes?: string
}): Promise<ItFormSubmission> {
  await ensureItFormTables()

  const formDef = IT_FORM_DEFINITIONS.find((d) => d.code === data.form_code)
  const formName = formDef?.name || data.form_code

  // Generate request number: e.g. IT-010-006-20261016-1234
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  const codeShort = data.form_code.replace(/[^A-Za-z0-9]/g, '').slice(-6)
  const request_no = `REQ-${codeShort}-${dateStr}-${randomSuffix}`

  const token = crypto.randomBytes(24).toString('hex')

  // Get active approvers configured for this form, prioritizing matches for applicant's department
  const approvers = await query<ItFormApprover>(
    `SELECT * FROM it_form_approvers
     WHERE form_code = $1 AND is_active = true
     ORDER BY slot_number ASC,
       (CASE
          WHEN lower(trim(COALESCE(department, ''))) = lower(trim($2)) THEN 0
          WHEN lower(trim(COALESCE(department, ''))) = 'departemen pemohon' THEN 1
          ELSE 2
        END) ASC,
       sort_order ASC`,
    [data.form_code, data.department]
  )

  // Deduplicate by slot_number (keeping the best matching approver per slot)
  const slotMap = new Map<number, ItFormApprover>()
  for (const app of approvers.rows) {
    if (!slotMap.has(app.slot_number)) {
      slotMap.set(app.slot_number, app)
    }
  }
  const activeApprovers = Array.from(slotMap.values()).sort((a, b) => a.slot_number - b.slot_number)

  if (activeApprovers.length === 0 && data.form_code === 'ISMS-F-02-00-002') {
    activeApprovers.push({
      id: 0,
      form_code: 'ISMS-F-02-00-002',
      form_name: 'Pengajuan Registrasi Finger Print Special Security Area',
      slot_number: 1,
      slot_label: 'MENYETUJUI / APPROVAL',
      role_title: 'Information Assets Administrator (IAA)',
      person_name: 'Teguh Sunjoyo',
      salutation: 'Bapak',
      initials: 'IAA',
      email: 'teguh.sunjoyo@jai.co.id',
      department: 'Information Assets Administrator',
      is_active: true,
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
  const total_steps = Math.max(activeApprovers.length, 1)

  const subRes = await query<ItFormSubmission>(
    `INSERT INTO it_form_submissions (
       request_no, form_code, form_name, request_date, applicant_name,
       applicant_nik, applicant_position, employee_status, department,
       company_name, purpose, form_data, status, current_step, total_steps,
       token, notes
     ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', 1, $12, $13, $14)
     RETURNING *`,
    [
      request_no,
      data.form_code,
      formName,
      data.applicant_name,
      data.applicant_nik || null,
      data.applicant_position || null,
      data.employee_status || 'TETAP',
      data.department,
      data.company_name || null,
      data.purpose || null,
      JSON.stringify(data.form_data || {}),
      total_steps,
      token,
      data.notes || null,
    ]
  )

  const submission = subRes.rows[0]

  // Insert signatures chain
  for (let i = 0; i < activeApprovers.length; i++) {
    const approver = activeApprovers[i]
    const stepNum = i + 1
    const status = stepNum === 1 ? 'pending' : 'waiting'
    await query(
      `INSERT INTO it_form_signatures (
         submission_id, step_number, slot_label, role_title, approver_name, approver_email, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        submission.id,
        stepNum,
        approver.slot_label,
        approver.role_title,
        approver.person_name,
        approver.email,
        status,
      ]
    )
  }

  const sigs = await query<ItFormSignature>(
    `SELECT * FROM it_form_signatures WHERE submission_id = $1 ORDER BY step_number ASC`,
    [submission.id]
  )

  submission.signatures = sigs.rows

  // Asynchronously send notification email to Step 1 approver
  sendItFormApprovalEmail(submission.id, 1).catch((err) => {
    console.error('[it-form-service] Error sending initial approval email:', err)
  })

  return submission
}

export async function getItFormSubmissions(filters?: {
  form_code?: string
  status?: string
  search?: string
  limit?: number
}): Promise<ItFormSubmission[]> {
  await ensureItFormTables()
  let sql = 'SELECT * FROM it_form_submissions WHERE 1=1'
  const params: any[] = []
  let idx = 1

  if (filters?.form_code) {
    sql += ` AND form_code = $${idx++}`
    params.push(filters.form_code)
  }
  if (filters?.status && filters.status !== 'all') {
    sql += ` AND status = $${idx++}`
    params.push(filters.status)
  }
  if (filters?.search?.trim()) {
    const q = `%${filters.search.trim()}%`
    sql += ` AND (request_no ILIKE $${idx} OR applicant_name ILIKE $${idx} OR applicant_nik ILIKE $${idx} OR department ILIKE $${idx} OR form_data::text ILIKE $${idx})`
    params.push(q)
    idx++
  }

  sql += ' ORDER BY created_at DESC'
  if (filters?.limit) {
    sql += ` LIMIT $${idx++}`
    params.push(filters.limit)
  }

  const res = await query<ItFormSubmission>(sql, params)
  const submissions = res.rows

  // Populate signatures
  for (const sub of submissions) {
    const sigs = await query<ItFormSignature>(
      `SELECT * FROM it_form_signatures WHERE submission_id = $1 ORDER BY step_number ASC`,
      [sub.id]
    )
    sub.signatures = sigs.rows
  }

  return submissions
}

export async function getItFormSubmissionByToken(token: string): Promise<ItFormSubmission | null> {
  await ensureItFormTables()
  const res = await query<ItFormSubmission>(
    `SELECT * FROM it_form_submissions WHERE token = $1 LIMIT 1`,
    [token]
  )
  if (!res.rowCount || res.rowCount === 0) return null
  const sub = res.rows[0]
  const sigs = await query<ItFormSignature>(
    `SELECT * FROM it_form_signatures WHERE submission_id = $1 ORDER BY step_number ASC`,
    [sub.id]
  )
  sub.signatures = sigs.rows
  return sub
}

export async function signItFormStep(
  submissionId: number,
  stepNumber: number,
  data: {
    decision: 'approve' | 'reject'
    approverName: string
    signatureNote?: string
  }
): Promise<{ success: boolean; message: string; submission?: ItFormSubmission }> {
  await ensureItFormTables()

  const subRes = await query<ItFormSubmission>(
    `SELECT * FROM it_form_submissions WHERE id = $1 LIMIT 1`,
    [submissionId]
  )
  if (!subRes.rowCount || subRes.rowCount === 0) {
    return { success: false, message: 'Permohonan form tidak ditemukan' }
  }
  const sub = subRes.rows[0]

  if (sub.status === 'rejected') {
    return { success: false, message: 'Permohonan sudah ditolak sebelumnya' }
  }
  if (sub.status === 'approved') {
    return { success: false, message: 'Permohonan sudah selesai disetujui seluruhnya' }
  }

  const sigRes = await query<ItFormSignature>(
    `SELECT * FROM it_form_signatures WHERE submission_id = $1 AND step_number = $2 LIMIT 1`,
    [submissionId, stepNumber]
  )
  if (!sigRes.rowCount || sigRes.rowCount === 0) {
    return { success: false, message: 'Tahapan approval tidak valid' }
  }
  const sig = sigRes.rows[0]

  const verCode = `IT-ESIGN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

  if (data.decision === 'reject') {
    // Mark signature rejected
    await query(
      `UPDATE it_form_signatures
       SET status = 'rejected', approver_name = $1, signature_note = $2, verification_code = $3, signed_at = NOW(), updated_at = NOW()
       WHERE id = $4`,
      [data.approverName || sig.approver_name, data.signatureNote || null, verCode, sig.id]
    )

    // Mark submission rejected
    await query(
      `UPDATE it_form_submissions
       SET status = 'rejected', notes = $1, updated_at = NOW()
       WHERE id = $2`,
      [data.signatureNote || 'Ditolak oleh ' + (data.approverName || sig.approver_name), submissionId]
    )

    // Asynchronously send notification email to approvers/applicant
    sendItFormRejectedEmail(
      submissionId,
      data.approverName || sig.approver_name,
      sig.role_title,
      data.signatureNote
    ).catch((err) => {
      console.error('[it-form-service] Error sending rejection email:', err)
    })

    const updated = await getItFormSubmissionByToken(sub.token)
    return { success: true, message: 'Permohonan berhasil ditolak / diminta revisi', submission: updated || undefined }
  }

  // Decision approve
  await query(
    `UPDATE it_form_signatures
     SET status = 'approved', approver_name = $1, signature_note = $2, verification_code = $3, signed_at = NOW(), updated_at = NOW()
     WHERE id = $4`,
    [data.approverName || sig.approver_name, data.signatureNote || null, verCode, sig.id]
  )

  // Check next step
  const nextStep = stepNumber + 1
  if (nextStep <= sub.total_steps) {
    // Advance step
    await query(
      `UPDATE it_form_signatures
       SET status = 'pending', updated_at = NOW()
       WHERE submission_id = $1 AND step_number = $2`,
      [submissionId, nextStep]
    )
    await query(
      `UPDATE it_form_submissions
       SET current_step = $1, updated_at = NOW()
       WHERE id = $2`,
      [nextStep, submissionId]
    )

    // Asynchronously send notification email to next approver
    sendItFormApprovalEmail(submissionId, nextStep).catch((err) => {
      console.error('[it-form-service] Error sending next step approval email:', err)
    })
  } else {
    // All steps complete!
    await query(
      `UPDATE it_form_submissions
       SET status = 'approved', current_step = $1, updated_at = NOW()
       WHERE id = $2`,
      [nextStep, submissionId]
    )

    // Asynchronously send notification email when all steps are approved
    sendItFormCompletedEmail(submissionId).catch((err) => {
      console.error('[it-form-service] Error sending completion email:', err)
    })
  }

  const updated = await getItFormSubmissionByToken(sub.token)
  return { success: true, message: 'Approval berhasil disimpan', submission: updated || undefined }
}

/**
 * Sends an email notification to the approver of a specific step in an IT Form submission.
 * Includes direct action links and request details.
 */
export async function sendItFormApprovalEmail(submissionId: number, stepNumber: number): Promise<boolean> {
  try {
    const subRes = await query<ItFormSubmission>(`SELECT * FROM it_form_submissions WHERE id = $1`, [submissionId])
    if (!subRes.rowCount || subRes.rowCount === 0) return false
    const sub = subRes.rows[0]

    const sigsRes = await query<ItFormSignature>(
      `SELECT * FROM it_form_signatures WHERE submission_id = $1 ORDER BY step_number ASC`,
      [submissionId]
    )
    const sigs = sigsRes.rows
    const currentSig = sigs.find((s) => s.step_number === stepNumber)
    if (!currentSig || !currentSig.approver_email || !currentSig.approver_email.trim()) {
      console.log(`[it-form/email] No approver email configured for step ${stepNumber} on submission ${submissionId}`)
      return false
    }

    const settings = await getSmtpSettings()
    if (!settings?.host || !settings.port || !settings.senderEmail) {
      console.log('[it-form/email] SMTP settings not configured, skipping approval email')
      return false
    }

    const baseUrl = `${resolveAppBaseUrl(settings.appUrl)}${API_BASE_PATH}`
    const isFingerprint = sub.form_code === 'ISMS-F-02-00-002'
    const targetPath = isFingerprint ? '/registrasi-fingerprint' : '/form-it-esign'
    const directActionPath = `${API_BASE_PATH}${targetPath}?token=${encodeURIComponent(sub.token)}`
    const actionUrl = `${baseUrl}/api/auth/approver-token-login?token=${encodeURIComponent(sub.token)}&next=${encodeURIComponent(directActionPath)}`
    const dashboardUrl = `${baseUrl}/api/auth/approver-token-login?token=${encodeURIComponent(sub.token)}&next=${encodeURIComponent(`${API_BASE_PATH}/persetujuan-saya`)}`

    const chain = sigs.map((s) => ({
      roleTitle: s.role_title,
      name: s.approver_name,
      state: (s.status === 'approved' ? 'done' : s.step_number === stepNumber ? 'current' : 'waiting') as 'done' | 'current' | 'waiting',
      decidedAt: s.signed_at,
    }))

    const { subject, html } = buildItFormApprovalEmail({
      approverName: currentSig.approver_name,
      approverSalutation: 'Bapak',
      roleTitle: currentSig.role_title,
      requestNo: sub.request_no,
      formCode: sub.form_code,
      formName: sub.form_name,
      applicantName: sub.applicant_name,
      applicantNik: sub.applicant_nik,
      applicantPosition: sub.applicant_position,
      department: sub.department,
      employeeStatus: sub.employee_status,
      purpose: sub.purpose,
      requestDate: typeof sub.request_date === 'string' ? sub.request_date : new Date(sub.request_date).toISOString(),
      stepNumber,
      totalSteps: sub.total_steps,
      actionUrl,
      dashboardUrl,
      isFingerprint,
      chain,
    })

    const logoPath = path.join(process.cwd(), 'public', 'images', 'yazaki-logo.jpg')
    const attachments = [{ filename: 'yazaki-logo.jpg', path: logoPath, cid: LOGO_CID }]

    await sendMail(settings, {
      to: currentSig.approver_email.trim(),
      subject,
      html,
      attachments,
    })

    console.log(`[it-form/email] Sent approval notification for ${sub.request_no} (step ${stepNumber}) to ${currentSig.approver_email}`)
    return true
  } catch (err) {
    console.error(`[it-form/email] Failed to send approval email for submission ${submissionId}:`, err)
    return false
  }
}

/**
 * Sends notification email when all approval steps of an IT Form or Special Area submission have been completed.
 * Notifies all approvers in the chain with their verification codes and a link to view/download the signed PDF.
 */
export async function sendItFormCompletedEmail(submissionId: number): Promise<boolean> {
  try {
    const subRes = await query<ItFormSubmission>(`SELECT * FROM it_form_submissions WHERE id = $1`, [submissionId])
    if (!subRes.rowCount || subRes.rowCount === 0) return false
    const sub = subRes.rows[0]

    const sigsRes = await query<ItFormSignature>(
      `SELECT * FROM it_form_signatures WHERE submission_id = $1 ORDER BY step_number ASC`,
      [submissionId]
    )
    const sigs = sigsRes.rows
    const recipientEmails = Array.from(
      new Set(
        sigs
          .map((s) => s.approver_email?.trim())
          .filter((e): e is string => Boolean(e && e.length > 0))
      )
    )

    if (recipientEmails.length === 0) {
      console.log(`[it-form/email] No approver emails to notify for completed submission ${submissionId}`)
      return false
    }

    const settings = await getSmtpSettings()
    if (!settings?.host || !settings.port || !settings.senderEmail) {
      return false
    }

    const baseUrl = `${resolveAppBaseUrl(settings.appUrl)}${API_BASE_PATH}`
    const isFingerprint = sub.form_code === 'ISMS-F-02-00-002'
    const targetPath = isFingerprint ? '/registrasi-fingerprint' : '/form-it-esign'
    const actionUrl = `${baseUrl}${targetPath}?token=${sub.token}`
    const pdfUrl = `${baseUrl}/api/it-form-submissions/${sub.id}/pdf?token=${sub.token}`

    const chain = sigs.map((s) => ({
      roleTitle: s.role_title,
      name: s.approver_name,
      verificationCode: s.verification_code,
      decidedAt: s.signed_at,
    }))

    const { subject, html } = buildItFormCompletedEmail({
      requestNo: sub.request_no,
      formCode: sub.form_code,
      formName: sub.form_name,
      applicantName: sub.applicant_name,
      department: sub.department,
      purpose: sub.purpose,
      requestDate: typeof sub.request_date === 'string' ? sub.request_date : new Date(sub.request_date).toISOString(),
      completedDate: new Date().toISOString(),
      actionUrl,
      pdfUrl,
      isFingerprint,
      chain,
    })

    const logoPath = path.join(process.cwd(), 'public', 'images', 'yazaki-logo.jpg')
    const attachments = [{ filename: 'yazaki-logo.jpg', path: logoPath, cid: LOGO_CID }]

    for (const email of recipientEmails) {
      await sendMail(settings, {
        to: email,
        subject,
        html,
        attachments,
      }).catch((e) => console.error(`Failed to send completion email to ${email}:`, e))
    }

    console.log(`[it-form/email] Sent completion notification for ${sub.request_no} to ${recipientEmails.join(', ')}`)
    return true
  } catch (err) {
    console.error(`[it-form/email] Failed to send completion email for submission ${submissionId}:`, err)
    return false
  }
}

/**
 * Sends notification email when an IT Form or Special Area submission is rejected or needs revision.
 */
export async function sendItFormRejectedEmail(
  submissionId: number,
  rejectorName: string,
  rejectorRole: string,
  reasonNote?: string | null
): Promise<boolean> {
  try {
    const subRes = await query<ItFormSubmission>(`SELECT * FROM it_form_submissions WHERE id = $1`, [submissionId])
    if (!subRes.rowCount || subRes.rowCount === 0) return false
    const sub = subRes.rows[0]

    const sigsRes = await query<ItFormSignature>(
      `SELECT * FROM it_form_signatures WHERE submission_id = $1 ORDER BY step_number ASC`,
      [submissionId]
    )
    const sigs = sigsRes.rows
    const recipientEmails = Array.from(
      new Set(
        sigs
          .map((s) => s.approver_email?.trim())
          .filter((e): e is string => Boolean(e && e.length > 0))
      )
    )

    if (recipientEmails.length === 0) return false

    const settings = await getSmtpSettings()
    if (!settings?.host || !settings.port || !settings.senderEmail) return false

    const baseUrl = `${resolveAppBaseUrl(settings.appUrl)}${API_BASE_PATH}`
    const isFingerprint = sub.form_code === 'ISMS-F-02-00-002'
    const targetPath = isFingerprint ? '/registrasi-fingerprint' : '/form-it-esign'
    const directActionPath = `${API_BASE_PATH}${targetPath}?token=${encodeURIComponent(sub.token)}`
    const actionUrl = `${baseUrl}/api/auth/approver-token-login?token=${encodeURIComponent(sub.token)}&next=${encodeURIComponent(directActionPath)}`

    const { subject, html } = buildItFormRejectedEmail({
      requestNo: sub.request_no,
      formCode: sub.form_code,
      formName: sub.form_name,
      applicantName: sub.applicant_name,
      department: sub.department,
      rejectorName,
      rejectorRole,
      reasonNote,
      actionUrl,
      isFingerprint,
    })

    const logoPath = path.join(process.cwd(), 'public', 'images', 'yazaki-logo.jpg')
    const attachments = [{ filename: 'yazaki-logo.jpg', path: logoPath, cid: LOGO_CID }]

    for (const email of recipientEmails) {
      await sendMail(settings, {
        to: email,
        subject,
        html,
        attachments,
      }).catch((e) => console.error(`Failed to send rejection email to ${email}:`, e))
    }

    console.log(`[it-form/email] Sent rejection notification for ${sub.request_no} to ${recipientEmails.join(', ')}`)
    return true
  } catch (err) {
    console.error(`[it-form/email] Failed to send rejection email for submission ${submissionId}:`, err)
    return false
  }
}


