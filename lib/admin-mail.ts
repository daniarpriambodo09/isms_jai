// lib/admin-mail.ts
//
// One way to email the ISM Admins — who that is: see lib/admin-recipients.ts
// (the ism_admin accounts' addresses plus the extra ones set on Kelola Admin;
// with none reachable, the SMTP sender mailbox).

import 'server-only'
import path from 'path'
import { getSmtpSettings, sendMail } from '@/lib/smtp'
import { adminRecipients } from '@/lib/admin-recipients'
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
    const recipients = await adminRecipients(settings.senderEmail)
    await sendMail(settings, {
      to: recipients.to.join(', '),
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
