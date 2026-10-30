import { describe, it, expect } from 'vitest'

describe('Password Reset Validation and Flow', () => {
  it('validates password length >= 6', () => {
    const isPasswordValid = (pw: string) => pw.length >= 6
    expect(isPasswordValid('12345')).toBe(false)
    expect(isPasswordValid('123456')).toBe(true)
    expect(isPasswordValid('secretPass123')).toBe(true)
  })

  it('validates password matching confirmation', () => {
    const checkMatch = (pw: string, again: string) => pw === again && pw.length >= 6
    expect(checkMatch('secret123', 'secret123')).toBe(true)
    expect(checkMatch('secret123', 'different')).toBe(false)
  })

  it('matches identifier case-insensitively with email or username', () => {
    const accounts = [
      { username: 'naufal.aqil', email: 'naufalaqil897@gmail.com' },
      { username: 'it.admin', email: 'it.admin@jai.co.id' },
      { username: 'admin', email: 'admin@jai.local' },
    ]

    const findAccount = (identifier: string) => {
      const q = identifier.trim().toLowerCase()
      return accounts.find(
        (a) => a.email.toLowerCase() === q || a.username.toLowerCase() === q
      )
    }

    expect(findAccount('NAUFALAQIL897@GMAIL.COM')?.username).toBe('naufal.aqil')
    expect(findAccount('it.admin')?.email).toBe('it.admin@jai.co.id')
    expect(findAccount('nonexistent@jai.com')).toBeUndefined()
  })
})
