// Every document register, through its real route handlers and a real
// PostgreSQL: add → edit → save the order → delete. This is the test that
// catches a broken INSERT / UPDATE before it is pushed (the "Gagal menyimpan"
// bug of the sort_order insert got out because nothing uploaded a document).
//
// Opt-in, like lib/db.integration.test.ts (needs DB_* and JWT_SECRET, e.g.
// from .env.local, and the migrations applied):
//   npm run test:db
// Everything it creates carries TAG and is removed afterwards, files included.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const enabled = process.env.ISMS_DB_TESTS === '1'
if (enabled && fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const TAG = `ZZ-VITEST-${process.pid}`
const ROLE = `ZV${String(process.pid).slice(-6)}` // an approver position without an e-mail
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF')

let db: typeof import('./db')
let cookie = ''
let logMax = 0
let departmentId = 0

const pdfFile = () => new File([PDF], 'test.pdf', { type: 'application/pdf' })
const form = (fields: Record<string, string | File>) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); return f }
const req = (url: string, method: string, body?: FormData | Record<string, unknown>, admin = true) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: { ...(admin ? { cookie } : {}), ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}) },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
const idsOf = async (res: Response) => ((await res.json()).documents as { id: number }[]).map((d) => d.id)

describe.skipIf(!enabled)('document registers (PostgreSQL + route handlers)', () => {
  beforeAll(async () => {
    db = await import('./db')
    const jwt = (await import('jsonwebtoken')).default
    cookie = `${process.env.AUTH_COOKIE_NAME ?? 'isms_admin_session'}=${jwt.sign({ sub: 1, username: 'vitest', role: 'ism_admin' }, process.env.JWT_SECRET as string, { expiresIn: '10m' })}`
    logMax = Number((await db.query<{ m: string }>('SELECT COALESCE(max(id), 0) AS m FROM activity_log')).rows[0].m)
    departmentId = (await db.query<{ id: number }>('SELECT id FROM departments ORDER BY id LIMIT 1')).rows[0]?.id ?? 0
    await db.query("INSERT INTO procedure_approver_roles (code, kind, title, person_name, email, sort_order, is_default) VALUES ($1, 'procedure', 'Vitest', 'Tanpa Email', NULL, 98, false)", [ROLE])
  })

  afterAll(async () => {
    const files: string[] = []
    for (const [table, column] of [['procedure_documents', 'control_no'], ['form_cs_documents', 'control_no'], ['education_documents', 'title'], ['documents', 'title']] as const) {
      files.push(...(await db.query<{ file_path: string }>(`DELETE FROM ${table} WHERE ${column} LIKE $1 RETURNING file_path`, [`${TAG}%`])).rows.map((r) => r.file_path))
    }
    for (const f of files) fs.rmSync(path.join(process.cwd(), 'storage', f), { force: true })
    await db.query('DELETE FROM vendor_registrations WHERE full_name = $1', [TAG])
    await db.query('DELETE FROM procedure_approver_roles WHERE code = $1', [ROLE])
    await db.query("DELETE FROM activity_log WHERE id > $1 AND (description LIKE $2 OR description LIKE 'Mengubah urutan%')", [logMax, `%${TAG}%`])
    await db.pool.end()
  })

  for (const kind of ['procedure', 'working_standard', 'tmmin_standard'] as const) {
    it(`${kind}: add, edit, save order, delete`, async () => {
      const { documentHandlers } = await import('./controlled-documents-api')
      const h = documentHandlers(kind)
      const fields = { controlNo: TAG, title: `${TAG} dokumen`, elfDate: '2026-01-15', approvalRoles: '[]', note: '' }

      const created = await h.POST(req('/api/x', 'POST', form({ ...fields, file: pdfFile() })))
      expect(created.status).toBe(201)
      const id = (await created.json()).document.id as number

      const ids = await idsOf(await h.GET(req('/api/x', 'GET')))
      expect(ids.at(-1)).toBe(id) // a new document goes to the bottom

      expect((await h.POST(req('/api/x', 'POST', form({ ...fields, file: pdfFile() })))).status).toBe(409) // same control no.
      expect((await h.PUT(req('/api/x', 'PUT', form({ ...fields, id: String(id), title: `${TAG} diubah`, revision: '1' })))).status).toBe(200)
      expect((await h.PATCH(req('/api/x', 'PATCH', { order: ids }))).status).toBe(200)
      expect((await h.PATCH(req('/api/x', 'PATCH', { order: [id] }))).status).toBe(409) // not the whole list
      expect((await h.PATCH(req('/api/x', 'PATCH', { order: ids }, false))).status).toBe(401)
      expect((await h.DELETE(req(`/api/x?id=${id}`, 'DELETE'))).status).toBe(200)
    })
  }

  it('refuses a document whose approver position has no e-mail', async () => {
    const { documentHandlers } = await import('./controlled-documents-api')
    const res = await documentHandlers('procedure').POST(req('/api/x', 'POST', form({ controlNo: `${TAG}-R`, title: `${TAG} tanpa email`, elfDate: '2026-01-15', approvalRoles: JSON.stringify([ROLE]), note: '', file: pdfFile() })))
    expect(res.status).toBe(400)
    expect((await res.json()).message).toContain('belum punya email')
    expect((await db.query('SELECT 1 FROM procedure_documents WHERE control_no = $1', [`${TAG}-R`])).rows).toHaveLength(0)
  })

  for (const category of ['form-aplikasi', 'kontrol-cs'] as const) {
    it(`${category}: add (two files of one control no.), edit, save order, delete`, async () => {
      const route = await import('@/app/api/form-cs/[category]/route')
      const params = { params: Promise.resolve({ category }) }
      const fields = { controlNo: TAG, title: `${TAG} form`, language: 'IDN', keteranganType: 'none', fileKind: 'pdf' }

      const first = await route.POST(req('/api/x', 'POST', form({ ...fields, file: pdfFile() })), params)
      expect(first.status).toBe(201)
      const id = (await first.json()).document.id as number
      const second = await route.POST(req('/api/x', 'POST', form({ ...fields, language: 'ENG', file: pdfFile() })), params)
      expect(second.status).toBe(201)
      const id2 = (await second.json()).document.id as number

      const ids = await idsOf(await route.GET(req('/api/x', 'GET'), params))
      expect(ids.slice(-2).sort()).toEqual([id, id2].sort()) // both at the bottom, together

      expect((await route.PUT(req('/api/x', 'PUT', form({ ...fields, id: String(id), title: `${TAG} form diubah` })), params)).status).toBe(200)
      expect((await route.PATCH(req('/api/x', 'PATCH', { order: ids }), params)).status).toBe(200)
      expect((await route.PATCH(req('/api/x', 'PATCH', { order: [id] }), params)).status).toBe(409)
      for (const doc of [id, id2]) expect((await route.DELETE(req(`/api/x?id=${doc}`, 'DELETE'), params)).status).toBe(200)
    })
  }

  it('education: add, edit, save order, delete', async () => {
    const route = await import('@/app/api/education/route')
    const fields = { title: `${TAG} materi`, category: 'PDF', language: 'IDN' }
    const created = await route.POST(req('/api/x', 'POST', form({ ...fields, file: pdfFile() })))
    expect(created.status).toBe(201)
    const id = (await created.json()).document.id as number
    const ids = await idsOf(await route.GET())
    expect(ids.at(-1)).toBe(id)
    expect((await route.PUT(req('/api/x', 'PUT', form({ ...fields, id: String(id), title: `${TAG} materi diubah` })))).status).toBe(200)
    expect((await route.PATCH(req('/api/x', 'PATCH', { ids }))).status).toBe(200)
    expect((await route.PATCH(req('/api/x', 'PATCH', { ids: [id] }))).status).toBe(409)
    expect((await route.DELETE(req(`/api/x?id=${id}`, 'DELETE'))).status).toBe(200)
  })

  it('department documents: add, edit, save order, delete', async () => {
    if (!departmentId) return // no department to add to
    const route = await import('@/app/api/documents/route')
    const one = await import('@/app/api/documents/[id]/route')
    const created = await route.POST(req('/api/x', 'POST', form({ title: `${TAG} dept`, departmentId: String(departmentId), revision: '1', file: pdfFile() })))
    expect(created.status).toBe(201)
    const id = (await created.json()).document.id as number
    const scope = (await db.query<{ id: number }>('SELECT id FROM documents WHERE department_id = $1 AND section_id IS NULL ORDER BY sort_order ASC NULLS LAST, uploaded_at DESC, id DESC', [departmentId])).rows.map((r) => r.id)
    expect(scope.at(-1)).toBe(id)
    const params = { params: Promise.resolve({ id: String(id) }) }
    expect((await one.PUT(req('/api/x', 'PUT', form({ title: `${TAG} dept diubah`, revision: '2' })), params)).status).toBe(200)
    expect((await route.PATCH(req('/api/x', 'PATCH', { ids: scope }))).status).toBe(200)
    expect((await one.DELETE(req('/api/x', 'DELETE'), params)).status).toBe(200)
  })

  it('records the kiosk a guest was registered at', async () => {
    const route = await import('@/app/api/vendor-registrations/route')
    const body = { fullName: TAG, idCard: '1234567890', picJai: 'PIC', purpose: 'uji', companyRemark: 'uji', cardType: 'visitor', barcode: TAG, station: 'security' }
    const res = await route.POST(req('/api/x', 'POST', body))
    expect(res.status).toBe(201)
    expect((await res.json()).registration.registered_station).toBe('security')
  })
})
