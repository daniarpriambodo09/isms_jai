// lib/trial-feedback.integration.test.ts
//
// Integration test verifying the 4 trial-feedback features:
// 1. Visit schedule (visit_date)
// 2. Repeat-visitor history autocomplete
// 3. Extra ID cards / companions (registration_ids table)
// 4. KTP verification & return (RBAC: security allowed, lobby forbidden)
//
// Runs with: npm run test:db

import fs from 'node:fs'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const enabled = process.env.ISMS_DB_TESTS === '1'
if (enabled && fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const TAG = `ZZ-FEEDBACK-${process.pid}`
let db: typeof import('./db')
let securityCookie = ''
let lobbyCookie = ''

const req = (url: string, method: string, body?: Record<string, unknown>, cookie?: string) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

describe.skipIf(!enabled)('Trial Feedback Features Integration (Poin 1 - 4)', () => {
  beforeAll(async () => {
    db = await import('./db')
    const jwt = (await import('jsonwebtoken')).default
    const secret = process.env.JWT_SECRET as string
    const cookieName = process.env.AUTH_COOKIE_NAME ?? 'isms_admin_session'

    securityCookie = `${cookieName}=${jwt.sign({ sub: 201, username: 'test_sec', role: 'security' }, secret, { expiresIn: '10m' })}`
    lobbyCookie = `${cookieName}=${jwt.sign({ sub: 202, username: 'test_lob', role: 'lobby' }, secret, { expiresIn: '10m' })}`

    await db.query('DELETE FROM vendor_registrations WHERE full_name LIKE $1', [`${TAG}%`])
  })

  afterAll(async () => {
    if (db) {
      await db.query('DELETE FROM vendor_registrations WHERE full_name LIKE $1', [`${TAG}%`])
      await db.pool.end()
    }
  })

  it('verifies visit_date, companions, history lookup, and KTP verification lifecycle', async () => {
    const regRoute = await import('@/app/api/vendor-registrations/route')
    const idRoute = await import('@/app/api/vendor-registrations/[id]/route')
    const historyRoute = await import('@/app/api/vendor-registrations/history/route')

    // 1. Pos Security registers a guest with visit_date and 2 companions (Poin 1 & 3)
    const fullName = `${TAG} Lead Visitor`
    const companionsInput = [
      { name: 'Companion One', idNo: '31710001' },
      { name: 'Companion Two', idNo: '31710002' },
    ]
    const regRes = await regRoute.POST(
      req('/api/vendor-registrations', 'POST', {
        fullName,
        idCard: '31710000',
        picJai: 'Pak Budi',
        purpose: 'Audit ISMS',
        companyRemark: 'PT Vendor Solusi',
        visitDate: '2026-10-30',
        companions: companionsInput,
        securityCardType: 'vendor',
      }, securityCookie)
    )
    expect(regRes.status).toBe(201)
    const regData = await regRes.json()
    const regId = regData.registration.id
    expect(regData.registration.visit_date).toBe('2026-10-30')
    expect(regData.registration.companions).toHaveLength(2)
    expect(regData.registration.companions[0]).toEqual({ name: 'Companion One', id_no: '31710001' })

    // Verify DB relation registration_ids directly
    const dbComp = await db.query('SELECT name, id_no FROM registration_ids WHERE registration_id = $1 ORDER BY id', [regId])
    expect(dbComp.rows).toEqual([
      { name: 'Companion One', id_no: '31710001' },
      { name: 'Companion Two', id_no: '31710002' },
    ])

    // 2. Repeat-visitor history autocomplete (Poin 2)
    const histRes = await historyRoute.GET(
      req(`/api/vendor-registrations/history?q=${encodeURIComponent(TAG)}`, 'GET', undefined, securityCookie)
    )
    expect(histRes.status).toBe(200)
    const histData = await histRes.json()
    const found = histData.history.find((h: { full_name: string }) => h.full_name === fullName)
    expect(found).toBeDefined()
    expect(found.id_card).toBe('31710000')
    expect(found.company_remark).toBe('PT Vendor Solusi')

    // 3. KTP verification RBAC (Poin 4)
    // Lobby attempts to verify KTP -> must be 403 Forbidden
    const lobVerifyRes = await idRoute.PUT(
      req(`/api/vendor-registrations/${regId}`, 'PUT', { action: 'verifyId' }, lobbyCookie),
      { params: Promise.resolve({ id: String(regId) }) }
    )
    expect(lobVerifyRes.status).toBe(403)

    // Pos Security verifies KTP -> 200 OK
    const secVerifyRes = await idRoute.PUT(
      req(`/api/vendor-registrations/${regId}`, 'PUT', { action: 'verifyId' }, securityCookie),
      { params: Promise.resolve({ id: String(regId) }) }
    )
    expect(secVerifyRes.status).toBe(200)
    const verifiedData = await secVerifyRes.json()
    expect(verifiedData.registration.id_verified_at).toBeTruthy()
    expect(verifiedData.registration.id_verified_by).toBe('test_sec')
    expect(verifiedData.registration.id_returned_at).toBeNull()

    // 4. Edit details: change companions and visit date
    const editRes = await idRoute.PUT(
      req(`/api/vendor-registrations/${regId}`, 'PUT', {
        action: 'editDetails',
        fullName,
        idCard: '31710000',
        picJai: 'Pak Budi Updated',
        purpose: 'Audit ISMS Final',
        companyRemark: 'PT Vendor Solusi',
        visitDate: '2026-11-05',
        companions: [{ name: 'Companion Solo', idNo: '31719999' }],
      }, securityCookie),
      { params: Promise.resolve({ id: String(regId) }) }
    )
    expect(editRes.status).toBe(200)
    const editData = await editRes.json()
    expect(editData.registration.visit_date).toBe('2026-11-05')
    expect(editData.registration.companions).toHaveLength(1)
    expect(editData.registration.companions[0]).toEqual({ name: 'Companion Solo', id_no: '31719999' })

    // 5. KTP return (Poin 4)
    const returnRes = await idRoute.PUT(
      req(`/api/vendor-registrations/${regId}`, 'PUT', { action: 'returnId' }, securityCookie),
      { params: Promise.resolve({ id: String(regId) }) }
    )
    expect(returnRes.status).toBe(200)
    const returnedData = await returnRes.json()
    expect(returnedData.registration.id_returned_at).toBeTruthy()

    // 6. Direct registration at Admin Lobby with companions & visit_date
    const directRes = await regRoute.POST(
      req('/api/vendor-registrations', 'POST', {
        fullName: `${TAG} Direct Lobby`,
        idCard: '31718888',
        picJai: 'Pak Anton',
        purpose: 'Meeting',
        companyRemark: 'PT Tamu Langsung',
        visitDate: '2026-10-31',
        companions: [{ name: 'Kawan Lobby', idNo: '31717777' }],
        cardType: 'visitor',
        barcode: 'L2020',
        station: 'lobby',
      }, lobbyCookie)
    )
    expect(directRes.status).toBe(201)
    const directData = await directRes.json()
    expect(directData.registration.visit_date).toBe('2026-10-31')
    expect(directData.registration.companions).toEqual([{ name: 'Kawan Lobby', id_no: '31717777' }])

    // Clean up direct registration
    await db.query('DELETE FROM vendor_registrations WHERE id = $1', [directData.registration.id])
  })
})
