import { describe, it, expect } from 'vitest'
import { isDeliverableEmail } from './email-address'

describe('isDeliverableEmail', () => {
  it('accepts real internet addresses', () => {
    expect(isDeliverableEmail('ism@jai.co.id')).toBe(true)
    expect(isDeliverableEmail('  someone@gmail.com ')).toBe(true)
  })

  it('rejects internal / reserved domains that bounce', () => {
    for (const email of ['admin@jai.local', 'a@server.lan', 'x@corp.internal', 'y@foo.test', 'z@example.example']) {
      expect(isDeliverableEmail(email)).toBe(false)
    }
  })

  it('rejects empty and malformed values', () => {
    for (const email of [null, undefined, '', 'no-at-sign', 'a@b', 'a b@c.com', 'a@b.c']) {
      expect(isDeliverableEmail(email)).toBe(false)
    }
  })
})
