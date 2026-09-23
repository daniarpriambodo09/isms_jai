// lib/smtp.ts

import 'server-only'
import nodemailer from 'nodemailer'
import { query } from '@/lib/db'

export type Encryption = 'none' | 'tls' | 'ssl'

export type SmtpSettings = {
  host: string | null
  port: number | null
  encryption: Encryption
  username: string | null
  password: string | null
  senderEmail: string | null
  appUrl: string | null
  updatedAt: string | null
}

type SmtpSettingsRow = {
  host: string | null
  port: number | null
  encryption: Encryption
  username: string | null
  password: string | null
  sender_email: string | null
  app_url: string | null
  updated_at: string | null
}

export async function getSmtpSettings(): Promise<SmtpSettings | null> {
  const result = await query<SmtpSettingsRow>('SELECT host, port, encryption, username, password, sender_email, app_url, updated_at FROM smtp_settings WHERE id = 1')
  const row = result.rows[0]
  if (!row) return null
  return {
    host: row.host,
    port: row.port,
    encryption: row.encryption,
    username: row.username,
    password: row.password,
    senderEmail: row.sender_email,
    appUrl: row.app_url,
    updatedAt: row.updated_at,
  }
}

export async function saveSmtpSettings(settings: {
  host: string
  port: number
  encryption: Encryption
  username: string | null
  password: string | null
  senderEmail: string
  appUrl: string
}): Promise<SmtpSettings> {
  const result = await query<SmtpSettingsRow>(
    `INSERT INTO smtp_settings (id, host, port, encryption, username, password, sender_email, app_url, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (id) DO UPDATE SET
       host = EXCLUDED.host, port = EXCLUDED.port, encryption = EXCLUDED.encryption,
       username = EXCLUDED.username, password = EXCLUDED.password,
       sender_email = EXCLUDED.sender_email, app_url = EXCLUDED.app_url, updated_at = now()
     RETURNING host, port, encryption, username, password, sender_email, app_url, updated_at`,
    [settings.host, settings.port, settings.encryption, settings.username, settings.password, settings.senderEmail, settings.appUrl]
  )
  const row = result.rows[0]
  return {
    host: row.host,
    port: row.port,
    encryption: row.encryption,
    username: row.username,
    password: row.password,
    senderEmail: row.sender_email,
    appUrl: row.app_url,
    updatedAt: row.updated_at,
  }
}

function buildTransport(settings: SmtpSettings) {
  if (!settings.host || !settings.port) throw new Error('SMTP host/port belum dikonfigurasi.')
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.encryption === 'ssl',
    requireTLS: settings.encryption === 'tls',
    auth: settings.username ? { user: settings.username, pass: settings.password ?? undefined } : undefined,
  })
}

export async function verifySmtpConnection(settings: SmtpSettings): Promise<void> {
  const transport = buildTransport(settings)
  await transport.verify()
}

export type MailAttachment = { filename: string; path: string; cid: string }

export async function sendMail(
  settings: SmtpSettings,
  options: { to: string; subject: string; html: string; attachments?: MailAttachment[] }
): Promise<void> {
  if (!settings.senderEmail) throw new Error('Email pengirim belum dikonfigurasi.')
  const transport = buildTransport(settings)
  await transport.sendMail({
    from: settings.senderEmail,
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments,
  })
}
