// lib/email-address.ts
//
// Whether an address can actually receive mail from the internet. Catches the
// placeholder kind ("admin@jai.local") that made Gmail bounce every admin
// notification: reserved/internal TLDs never resolve outside the LAN.

const UNDELIVERABLE_TLDS = ['local', 'localhost', 'lan', 'internal', 'intranet', 'home', 'corp', 'test', 'example', 'invalid']

export function isDeliverableEmail(value: string | null | undefined): value is string {
  if (!value) return false
  const email = value.trim()
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return false
  const tld = email.split('.').pop()!.toLowerCase()
  return !UNDELIVERABLE_TLDS.includes(tld)
}

export const EMAIL_HINT = 'Gunakan alamat email yang benar-benar aktif (mis. nama@jai.co.id atau @gmail.com) — domain seperti .local tidak bisa menerima email.'
