// lib/app-url-check.ts
//
// Every link in the e-mails (pengesahan, approve/reject, QR) is built from
// App URL (SMTP Settings). When this server gets its IP from DHCP the address
// can change — the links then time out for everyone. This compares App URL
// with the server's own LAN addresses so the admin pages can warn about it
// and offer the current address in one click.
//
// Only an App URL that is a bare IPv4 address (or localhost) is checked: a
// host name or an address of a reverse proxy elsewhere can't be judged from
// here, so it is left alone.

import 'server-only'
import os from 'os'

export type AppUrlWarning = {
  configured: string
  // The same URL with each of this server's LAN addresses instead (best first).
  suggestions: string[]
}

function lanAddresses(): string[] {
  const out: string[] = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push(a.address)
    }
  }
  // Typical office/home LAN ranges first.
  const rank = (ip: string) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : ip.startsWith('172.') ? 2 : 3)
  return [...new Set(out)].sort((a, b) => rank(a) - rank(b))
}

export function checkAppUrl(appUrl: string | null | undefined): AppUrlWarning | null {
  const raw = (appUrl ?? '').trim()
  if (!raw) return null
  let url: URL
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`) } catch { return null }
  const host = url.hostname
  const isLocal = host === 'localhost' || host === '127.0.0.1'
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  if (!isLocal && !isIp) return null
  const addresses = lanAddresses()
  if (!addresses.length || (!isLocal && addresses.includes(host))) return null
  const suggestions = addresses.map((ip) => {
    const next = new URL(url.toString())
    next.hostname = ip
    return next.origin + next.pathname.replace(/\/$/, '')
  })
  return { configured: url.origin + url.pathname.replace(/\/$/, ''), suggestions }
}
