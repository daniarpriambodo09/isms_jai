// lib/secret-box.ts
//
// Encrypts secrets stored in the database (currently the SMTP password) so
// a leaked DB dump or backup file doesn't expose them in plain text.
// AES-256-GCM with a random IV per value; the key lives only in
// SMTP_ENCRYPTION_KEY (.env.local), never in the database.

import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const PREFIX = 'enc:v1:'

function getKey(): Buffer {
  const raw = process.env.SMTP_ENCRYPTION_KEY
  if (!raw) throw new Error('SMTP_ENCRYPTION_KEY belum diatur di .env.local.')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('SMTP_ENCRYPTION_KEY harus 32 byte (base64).')
  return key
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`
}

// A value without the prefix is a legacy plain-text password saved before
// encryption existed; it's returned as-is until the next save re-encrypts it.
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(':')
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}
