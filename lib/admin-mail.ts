// lib/admin-mail.ts
//
// One way to email the ISM Admins: every ism_admin account with an address
// that can really receive mail (placeholders like *.local are skipped); if
// none qualifies, the SMTP sender mailbox gets it so it still lands somewhere.

import 'server-only'
import path from 'path'
import { query } from '@/lib/db'
import { getSmtpSettings, sendMail } from '@/lib/smtp'
import { isDeliverableEmail } from '@/lib/email-address'
import { LOGO_CID } from '@/lib/email-templates'
import { resolveAppBaseUrl } from '@/lib/request-origin'
import { API_BASE_PATH } from '@/lib/config'

// Base URL for links in emails (App URL from Kelola SMTP), or null if SMTP isn't set up.
export async function portalBaseUrl(): Promise<string | null> {
  const settings = await getSmtpSettings()
  if (!settings?.host || !settings.port || !settings.senderEmail) return null
  return `${resolveAppBaseUrl(settings.appUrl)}${API_BASE_PATH}`
}

/** Sends to the ISM Admins; returns false when SMTP isn't configured. Never throws. */
export async function sendToAdmins(subject: string, html: string): Promise<boolean> {
  try {
    const settings = await getSmtpSettings()
    if (!settings?.host || !settings.port || !settings.senderEmail) return false
    const admins = await query<{ email: string }>("SELECT email FROM admins WHERE role = 'ism_admin' AND email IS NOT NULL AND email <> ''")
    const deliverable = admins.rows.map((row) => row.email.trim()).filter(isDeliverableEmail)
    await sendMail(settings, {
      to: (deliverable.length ? deliverable : [settings.senderEmail]).join(', '),
      subject,
      html,
      attachments: [{ filename: 'yazaki-logo.jpg', path: path.join(process.cwd(), 'public', 'images', 'yazaki-logo.jpg'), cid: LOGO_CID }],
    })
    return true
  } catch (error) {
    console.error('[admin-mail]', error)
    return false
  }
}
