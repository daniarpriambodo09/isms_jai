// lib/email-templates.ts
//
// HTML email templates. Built as nested tables with inline styles only —
// no <style> blocks, flexbox, or grid — because that's what actually
// renders consistently across Gmail, Outlook, and mobile mail clients;
// anything fancier tends to silently degrade in one of them.

import 'server-only'
import { APP_TIME_ZONE } from '@/lib/config'

export type VisitorApprovalEmailData = {
  approverName: string
  requesterName: string
  deptOrCompany: string
  dept: string | null
  fromAt: string
  toAt: string
  location: string
  objective: string
  picJai: string
  approveUrl: string
  rejectUrl: string
}

// Content-ID the logo is attached under — see LOGO_CID usage in
// notifyVisitorApprover (route.ts), which reads the actual file and passes
// it as a MIME attachment. It has to travel with the email like this
// (never as an external <img src="https://...">) because this app is only
// reachable at a private LAN address — a mail provider's own servers
// (Gmail, Outlook, etc.) fetch external images from THEIR infrastructure,
// not the recipient's device, so they can never reach a 192.168.x.x URL.
// The proof this was the actual bug: the Setujui/Tolak links in the same
// email work fine, because those are opened by the recipient's own
// browser, which — unlike Gmail's servers — is actually on the LAN.
export const LOGO_CID = 'yazaki-logo'

function fmtDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', { timeZone: APP_TIME_ZONE, dateStyle: 'full', timeStyle: 'short' })
}

// Same palette as the web portal itself — the header gradient below is the
// exact 3-stop navy-to-teal used on the site's own hero/navbar
// (components/home/HeroCarousel.tsx), and ACCENT is that hero's gold/orange
// CTA gradient, converted from its oklch() source to hex since email
// clients don't parse oklch().
const NAVY = '#1a3a52'
const NAVY_MID = '#1a5f7a'
const TEAL = '#278e84'
const ACCENT = '#e48233'
const ACCENT_DARK = '#ff862e'
const ACCENT_TEXT = '#341a07'
const RED = '#c7161e'
const GREEN = '#1a6e3a'
const TEXT = '#22303c'
const MUTED = '#5b6b76'
const BORDER = '#e2e8ec'
const TEAL_TINT = '#eef6f5'

export function buildVisitorApprovalEmail(data: VisitorApprovalEmailData): { subject: string; html: string } {
  const period = `${fmtDateTime(data.fromAt)} &ndash; ${fmtDateTime(data.toAt)}`

  const row = (no: number, label: string, value: string, zebra: boolean) => `
    <tr>
      <td style="padding:12px 14px 12px 16px;background:${zebra ? '#f6f9fa' : '#ffffff'};border-bottom:1px solid ${BORDER};width:30px;vertical-align:top;">
        <span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;border-radius:50%;background:${TEAL};color:#ffffff;font-size:10.5px;font-weight:700;">${no}</span>
      </td>
      <td style="padding:12px 8px 12px 0;background:${zebra ? '#f6f9fa' : '#ffffff'};border-bottom:1px solid ${BORDER};font-size:13px;color:${MUTED};width:150px;vertical-align:top;white-space:nowrap;">${label}</td>
      <td style="padding:12px 16px 12px 0;background:${zebra ? '#f6f9fa' : '#ffffff'};border-bottom:1px solid ${BORDER};font-size:13.5px;color:${TEXT};font-weight:600;vertical-align:top;">${value}</td>
    </tr>`

  const rowsHtml = [
    row(1, 'Nama', data.requesterName, false),
    row(2, 'Company / Organization', data.deptOrCompany, true),
    row(3, 'Departement', data.dept ?? '-', false),
    row(4, 'Waktu', period, true),
    row(5, 'Lokasi', data.location, false),
    row(6, 'Tujuan', data.objective, true),
    row(7, 'PIC JAI', data.picJai, false),
  ].join('')

  const html = `
<!doctype html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef2f4;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f4;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(18,40,58,0.16);">

          <!-- Accent ribbon -->
          <tr>
            <td style="background:linear-gradient(90deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%);height:6px;line-height:6px;font-size:0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, ${NAVY} 0%, ${NAVY_MID} 45%, ${TEAL} 100%);background-color:${NAVY};padding:28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="display:inline-block;background:#ffffff;border-radius:8px;padding:6px 10px;line-height:0;">
                      <img src="cid:${LOGO_CID}" alt="YAZAKI" width="72" style="display:block;border:0;outline:none;height:auto;" />
                    </span>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;border:1px solid rgba(255,255,255,0.35);border-radius:999px;padding:5px 12px;color:#ffffff;font-size:10.5px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Portal ISMS</span>
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0;color:#ffffff;font-size:20px;font-weight:bold;line-height:1.3;">Permohonan Ijin Pengambilan Foto/Video</p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:12px;">PT. Jatim Autocomp Indonesia &middot; Menunggu persetujuan Anda</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 14px;font-size:14px;color:${TEXT};line-height:1.7;">Yth. Bapak/Ibu <strong>${data.approverName}</strong>,</p>
              <p style="margin:0 0 14px;font-size:13.5px;color:${TEXT};line-height:1.75;">Semoga Bapak/Ibu selalu dalam keadaan sehat dan sukses dalam menjalankan aktivitas.</p>
              <p style="margin:0 0 18px;font-size:13.5px;color:${TEXT};line-height:1.75;">Sehubungan dengan rencana pelaksanaan kegiatan <strong>${data.objective}</strong>, bersama email ini kami bermaksud untuk mengajukan permohonan izin pengambilan foto/video di area <strong>${data.location}</strong>.</p>
              <p style="margin:0 0 10px;font-size:13.5px;color:${TEXT};line-height:1.75;">Adapun rincian pelaksanaan pengambilan foto dan video adalah sebagai berikut:</p>
            </td>
          </tr>

          <!-- Detail table -->
          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
                ${rowsHtml}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 4px;">
              <p style="margin:0 0 14px;font-size:13.5px;color:${TEXT};line-height:1.75;">Kami memastikan bahwa seluruh proses dokumentasi akan tetap mematuhi seluruh protokol keselamatan kerja (K3) serta aturan standar keamanan/kerahasiaan area kerja yang berlaku di lingkungan perusahaan.</p>
              <p style="margin:0;font-size:13.5px;color:${TEXT};line-height:1.75;">Demikian permohonan izin ini kami sampaikan. Kami ucapkan terima kasih.</p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:26px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${TEAL_TINT};border:1px solid ${BORDER};border-radius:16px;">
                <tr>
                  <td style="padding:20px 20px 4px;text-align:center;font-size:12.5px;color:${MUTED};">Klik salah satu tombol di bawah untuk memproses langsung &mdash; tanpa perlu login:</td>
                </tr>
                <tr>
                  <td align="center" style="padding:14px 20px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:10px;">
                          <a href="${data.approveUrl}" style="display:inline-block;min-width:150px;text-align:center;padding:14px 28px;background:linear-gradient(135deg, #1f8a4c 0%, ${GREEN} 100%);color:#ffffff;border-radius:999px;text-decoration:none;font-weight:bold;font-size:14px;box-shadow:0 6px 14px rgba(26,110,58,0.3);">&#10003;&nbsp; Menyetujui</a>
                        </td>
                        <td>
                          <a href="${data.rejectUrl}" style="display:inline-block;min-width:150px;text-align:center;padding:14px 28px;background:linear-gradient(135deg, #d8342b 0%, ${RED} 100%);color:#ffffff;border-radius:999px;text-decoration:none;font-weight:bold;font-size:14px;box-shadow:0 6px 14px rgba(199,22,30,0.3);">&#10007;&nbsp; Tolak</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 32px 28px;">
              <p style="margin:0;font-size:11px;color:${MUTED};text-align:center;line-height:1.6;">
                <span style="display:inline-block;background:${ACCENT};color:${ACCENT_TEXT};font-weight:700;border-radius:999px;padding:2px 9px;font-size:10px;letter-spacing:0.04em;">E-SIGN</span>
                &nbsp;Setelah diproses, surat pengajuan PDF ber-QR (bukti persetujuan digital) akan otomatis tersedia untuk diunduh.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:${NAVY};padding:18px 32px;">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.7);text-align:center;">Email ini dikirim otomatis oleh <strong style="color:#ffffff;">Portal ISMS</strong> &middot; PT. Jatim Autocomp Indonesia</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return {
    subject: `Permohonan Izin Pengambilan Foto/Video — ${data.requesterName} (${data.deptOrCompany})`,
    html,
  }
}

// ─── Prosedur ISMS — Catatan Pengesahan ───

function fmtDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { timeZone: APP_TIME_ZONE, day: '2-digit', month: 'long', year: 'numeric' })
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Procedure emails have their own look — an official "document memo" on
// paper-cream, navy ink and a gold seal — so an approver can tell a
// Prosedur ISMS request apart from the Ijin Foto/Video email (dark teal
// gradient header + orange buttons) at a glance.
const PROCEDURE_KIND: DocKindLook = { key: 'procedure', label: 'Prosedur ISMS', short: 'Prosedur', noun: 'prosedur' }
const MEMO_PAPER = '#f3efe6'
const MEMO_LINE = '#e2dccd'
const MEMO_INK = '#1d2a36'
const MEMO_SEAL = '#a8741a'
const MEMO_SEAL_TINT = '#fbf3e2'

function procedureEmailFrame(opts: { kicker: string; heading: string; subheading: string; controlNo: string; revision: number | null; seal: string; sealColor?: string; preheader?: string; footerLabel?: string; tabTitle?: string; tabSub?: string }, body: string) {
  const sealColor = opts.sealColor ?? MEMO_SEAL
  return `
<!doctype html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${MEMO_PAPER};font-family:Georgia,'Times New Roman',serif;">
  ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${MEMO_PAPER};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid ${MEMO_LINE};border-left:6px solid ${NAVY};border-radius:6px;">

          <!-- Letterhead: logo left, document tab right -->
          <tr>
            <td style="padding:26px 32px 18px;border-bottom:1px dashed ${MEMO_LINE};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="cid:${LOGO_CID}" alt="YAZAKI" width="84" style="display:block;border:0;outline:none;height:auto;" />
                    <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:9.5px;color:${MUTED};letter-spacing:0.12em;text-transform:uppercase;">Information Security Management Committee</p>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="border:1px solid ${NAVY};border-radius:4px;">
                      <tr><td style="background:${NAVY};padding:4px 12px;font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:bold;color:#ffffff;letter-spacing:0.14em;text-transform:uppercase;text-align:center;">${opts.tabTitle ?? 'Dokumen Terkendali'}</td></tr>
                      <tr><td style="padding:7px 12px;font-family:'Courier New',Courier,monospace;font-size:14px;font-weight:bold;color:${MEMO_INK};text-align:center;">${escapeHtml(opts.controlNo)}<br><span style="font-size:11px;font-weight:normal;color:${MUTED};">${opts.tabSub ?? (opts.revision === null ? '' : `Rev. ${opts.revision}`)}</span></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title + seal -->
          <tr>
            <td style="padding:22px 32px 6px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:top;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;font-weight:bold;color:${NAVY_MID};letter-spacing:0.16em;text-transform:uppercase;">${opts.kicker}</p>
                    <p style="margin:6px 0 0;font-size:24px;font-weight:bold;color:${MEMO_INK};line-height:1.25;">${opts.heading}</p>
                    <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:${MUTED};">${opts.subheading}</p>
                  </td>
                  <td align="right" style="vertical-align:top;width:120px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="border:2px solid ${sealColor};border-radius:50%;width:92px;height:92px;background:${MEMO_SEAL_TINT};">
                      <tr><td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:9.5px;font-weight:bold;color:${sealColor};letter-spacing:0.08em;text-transform:uppercase;line-height:1.35;padding:6px;">${opts.seal}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${body}

          <tr>
            <td style="background:${MEMO_PAPER};border-top:1px solid ${MEMO_LINE};padding:16px 32px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:${MUTED};text-align:center;line-height:1.6;">${opts.footerLabel ?? 'Pengesahan Prosedur ISMS'} &middot; dikirim otomatis oleh <strong style="color:${MEMO_INK};">Portal ISMS</strong> &middot; PT. Jatim Autocomp Indonesia</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}


// ─── "Sheet" looks: Working Standard and Standard Requirement TMMIN ───
// Each register has its own look, so its e-mails are told apart in the inbox
// at a glance:
// - Prosedur ISMS — the cream memo with the round gold seal (above);
// - Working Standard — a "work instruction sheet": charcoal header band under
//   an amber bar, the control number on an amber plate, the three steps
//   (baca / pahami / terapkan), square tiles, amber button;
// - Standard Requirement TMMIN — a "blueprint" like its page: a frame of its
//   own (blueprintEmailFrame below), only the palette comes from here.
type SheetLook = {
  bg: string; dark: string; dark2: string; accent: string; accentDark: string; plateText: string; line: string; panel: string
  plateTitle: string
  tiles: [string, string][]
  /** Drawn with the blueprint frame instead of the sheet (Standard Requirement TMMIN). */
  blueprint?: boolean
  /** Drawn with the checklist frame (Form Review Dokumen). */
  form?: boolean
}
const SHEET_LOOKS: Record<string, SheetLook> = {
  working_standard: {
    bg: '#e9edf0', dark: '#232d36', dark2: '#2f3b46', accent: '#f5a623', accentDark: '#b97400', plateText: '#5a3a00', line: '#d6dce1', panel: '#f4f6f8',
    plateTitle: 'Working Standard No.',
    tiles: [['01', 'BACA'], ['02', 'PAHAMI'], ['03', 'TERAPKAN']],
  },
  tmmin_standard: {
    bg: '#e8ebf4', dark: '#171a3d', dark2: '#262b5e', accent: '#2cc4dc', accentDark: '#0b7285', plateText: '#063b45', line: '#d4d9e8', panel: '#f2f4fa',
    plateTitle: 'No. Dokumen',
    tiles: [],
    blueprint: true,
  },
  review_form: {
    bg: '#edf3ef', dark: '#17352a', dark2: '#21483a', accent: '#2f9e6b', accentDark: '#1d7a50', plateText: '#0f3a26', line: '#d3e3d9', panel: '#f2f8f4',
    plateTitle: 'Form No.',
    tiles: [],
    form: true,
  },
}

type DocKindLook = { key?: string; label: string; short: string; noun: string }
const sheetLook = (kind: DocKindLook): SheetLook | null => SHEET_LOOKS[kind.key ?? ''] ?? null

type FrameOptions = { kicker: string; heading: string; subheading: string; controlNo: string; revision: number | null; seal: string; sealColor?: string; preheader?: string; footerLabel?: string; tabTitle?: string; tabSub?: string }

function sheetEmailFrame(look: SheetLook, opts: FrameOptions, body: string) {
  const tagColor = opts.sealColor ?? look.accentDark
  const tile = (n: string, label: string) => `<td style="padding:0 0 0 6px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${look.dark2};border-radius:3px;padding:4px 9px;font-family:Arial,Helvetica,sans-serif;font-size:9.5px;font-weight:bold;letter-spacing:0.1em;color:#c9d2d9;white-space:nowrap;"><span style="color:${look.accent};">${n}</span>&nbsp;${label}</td></tr></table></td>`
  const preheader = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>` : ''
  const plateSub = opts.tabSub !== undefined ? opts.tabSub : opts.revision === null ? '' : `Rev. ${opts.revision}`
  return `
<!doctype html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${look.bg};font-family:Arial,Helvetica,sans-serif;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${look.bg};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid ${look.line};border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

          <!-- Accent bar -->
          <tr><td style="height:6px;line-height:6px;font-size:0;background:${look.accent};">&nbsp;</td></tr>

          <!-- Charcoal header: logo chip + control-number plate -->
          <tr>
            <td style="background:${look.dark};padding:20px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                      <td style="background:#ffffff;border-radius:6px;padding:6px 10px;"><img src="cid:${LOGO_CID}" alt="YAZAKI" width="78" style="display:block;border:0;outline:none;height:auto;" /></td>
                      <td style="padding-left:12px;font-family:Arial,Helvetica,sans-serif;font-size:9.5px;line-height:1.5;color:#9fb0bd;letter-spacing:0.12em;text-transform:uppercase;">Information Security<br>Management Committee</td>
                    </tr></table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="background:${look.accent};border-radius:6px;">
                      <tr><td style="padding:6px 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:8.5px;font-weight:bold;color:${look.plateText};letter-spacing:0.16em;text-transform:uppercase;text-align:center;">${opts.tabTitle ?? look.plateTitle}</td></tr>
                      <tr><td style="padding:2px 14px 7px;font-family:'Courier New',Courier,monospace;font-size:15px;font-weight:bold;color:${look.dark};text-align:center;">${escapeHtml(opts.controlNo)}${plateSub ? `<span style="font-family:Arial,Helvetica,sans-serif;font-size:10.5px;font-weight:bold;color:${look.plateText};"> &middot; ${plateSub}</span>` : ''}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="background:${look.dark};padding:22px 28px 18px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0;font-size:10.5px;font-weight:bold;color:${look.accent};letter-spacing:0.18em;text-transform:uppercase;">${opts.kicker}</p>
              <p style="margin:8px 0 0;font-size:25px;font-weight:bold;color:#ffffff;line-height:1.2;">${opts.heading}</p>
              <p style="margin:8px 0 0;font-size:12.5px;color:#b5c2cc;">${opts.subheading}</p>
            </td>
          </tr>

          <!-- Status tag + the register's own tiles -->
          <tr>
            <td style="background:${look.dark};padding:0 28px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#ffffff;border-left:4px solid ${tagColor};border-radius:3px;padding:6px 12px;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;font-weight:bold;color:${tagColor};letter-spacing:0.1em;text-transform:uppercase;white-space:nowrap;">${opts.seal.replace(/<br>/g, ' ')}</td></tr></table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr>${look.tiles.map(([n, label]) => tile(n, label)).join('')}</tr></table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${body}

          <tr>
            <td style="background:${look.panel};border-top:1px solid ${look.line};padding:16px 28px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:${MUTED};text-align:center;line-height:1.6;">${opts.footerLabel ?? 'Pengesahan Working Standard'} &middot; dikirim otomatis oleh <strong style="color:${look.dark};">Portal ISMS</strong> &middot; PT. Jatim Autocomp Indonesia</p>
            </td>
          </tr>
          <tr><td style="height:4px;line-height:4px;font-size:0;background:${look.dark};">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Standard Requirement TMMIN: the "blueprint" ───
// Its own frame, not the sheet's: a technical drawing like the register's
// page — square corners, an indigo title block ruled with a fine grid, corner
// brackets, monospace captions, the document's data in a ruled title-block
// table (no. / rev. / status), the details as data cards, boxed steps joined
// by arrows, and a square cyan button.
const BP_MONO = "'Courier New',Courier,monospace"
const BP_GRID = '#262b5e'

function blueprintEmailFrame(look: SheetLook, opts: FrameOptions, body: string) {
  const statusColor = opts.sealColor ?? look.accent
  const preheader = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>` : ''
  const revision = opts.tabSub !== undefined ? opts.tabSub : opts.revision === null ? '–' : `Rev. ${opts.revision}`
  const bracket = (ch: string, align: 'left' | 'right') => `<td align="${align}" style="font-family:${BP_MONO};font-size:16px;line-height:14px;color:${look.accent};">${ch}</td>`
  const cell = (label: string, value: string, width: string, extra = '') => `
    <td width="${width}" style="border:1px solid ${look.accentDark};padding:8px 12px;vertical-align:top;${extra}">
      <p style="margin:0;font-family:${BP_MONO};font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:#8fa0c8;">${label}</p>
      <p style="margin:3px 0 0;font-family:${BP_MONO};font-size:13px;font-weight:bold;color:#ffffff;">${value}</p>
    </td>`
  // "TMMIN" in the heading is picked out in the accent colour, as on the page.
  const heading = opts.heading.replace(/TMMIN/g, `<span style="color:${look.accent};">TMMIN</span>`)
  return `
<!doctype html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${look.bg};font-family:Arial,Helvetica,sans-serif;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${look.bg};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border:2px solid ${look.dark};font-family:Arial,Helvetica,sans-serif;">

          <!-- Title block: indigo, fine grid, corner brackets -->
          <tr>
            <td bgcolor="${look.dark}" style="background-color:${look.dark};background-image:linear-gradient(${BP_GRID} 1px, transparent 1px),linear-gradient(90deg, ${BP_GRID} 1px, transparent 1px);background-size:24px 24px;padding:14px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${bracket('&#9484;', 'left')}${bracket('&#9488;', 'right')}</tr></table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 14px 0;vertical-align:middle;">
                    <p style="margin:0;font-family:${BP_MONO};font-size:10.5px;letter-spacing:0.14em;text-transform:uppercase;color:${look.accent};">Standard Requirement TMMIN</p>
                  </td>
                  <td align="right" style="padding:6px 14px 0;vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#ffffff;padding:5px 9px;"><img src="cid:${LOGO_CID}" alt="YAZAKI" width="70" style="display:block;border:0;outline:none;height:auto;" /></td></tr></table>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:14px 14px 0;">
                    <p style="margin:0;font-family:${BP_MONO};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#8fa0c8;">${opts.kicker}</p>
                    <p style="margin:8px 0 0;font-size:27px;font-weight:bold;color:#ffffff;line-height:1.15;">${heading}</p>
                    <p style="margin:8px 0 0;font-size:12.5px;color:#b9c3e0;">${opts.subheading}</p>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:16px 14px 4px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                      <tr>${cell(opts.tabTitle ?? 'No. Dokumen', escapeHtml(opts.controlNo), '42%')}${cell('Revisi', revision, '18%')}${cell('Status', `<span style="color:${statusColor === look.accent ? look.accent : '#ffffff'};">&#9679;</span> ${opts.seal.replace(/<br>/g, ' ')}`, '40%', statusColor === look.accent ? '' : `background:${statusColor};`)}</tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${bracket('&#9492;', 'left')}<td align="center" style="font-family:${BP_MONO};font-size:8.5px;letter-spacing:0.14em;color:#6f7fae;">INFORMATION SECURITY MANAGEMENT COMMITTEE</td>${bracket('&#9496;', 'right')}</tr></table>
            </td>
          </tr>

          <tr><td style="height:5px;line-height:5px;font-size:0;background:${look.accent};">&nbsp;</td></tr>

          ${body}

          <tr>
            <td style="border-top:2px solid ${look.dark};padding:14px 28px;">
              <p style="margin:0;font-family:${BP_MONO};font-size:10px;color:${MUTED};text-align:center;line-height:1.7;letter-spacing:0.02em;">${opts.footerLabel ?? 'Pengesahan Standard Requirement TMMIN'} &middot; dikirim otomatis oleh <strong style="color:${look.dark};">Portal ISMS</strong> &middot; PT. Jatim Autocomp Indonesia</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// Details as data cards: the first one (the document's name) across the full
// width, the rest two per row — cyan caption, bold value.
function blueprintDetails(look: SheetLook, rows: [string, string][]) {
  const card = (label: string, value: string, colspan = 1) => `
        <td${colspan > 1 ? ` colspan="${colspan}"` : ''} width="${colspan > 1 ? '100%' : '50%'}" style="padding:4px;vertical-align:top;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${look.panel};border:1px solid ${look.line};border-left:3px solid ${look.accent};">
            <tr><td style="padding:10px 14px;">
              <p style="margin:0;font-family:${BP_MONO};font-size:9.5px;letter-spacing:0.14em;text-transform:uppercase;color:${look.accentDark};">${label}</p>
              <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${look.dark};line-height:1.4;">${value}</p>
            </td></tr>
          </table>
        </td>`
  const [first, ...rest] = rows
  const pairs: [string, string][][] = []
  for (let i = 0; i < rest.length; i += 2) pairs.push(rest.slice(i, i + 2))
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -4px;">
      ${first ? `<tr>${card(first[0], first[1], 2)}</tr>` : ''}
      ${pairs.map((pair) => `<tr>${pair.map(([label, value]) => card(label, value, pair.length === 1 ? 2 : 1)).join('')}</tr>`).join('')}
    </table>`
}

// ─── Form Review & Revisi Dokumen: the "checklist" ───
// Its own frame: a clean white sheet under a green rule, the form number on a
// stamp at the top right, and the filled-in form summarised as ticked lines —
// so an approver sees what they are signing without opening the PDF, and the
// mail looks like none of the other registers'.
const FORM_INK = '#17352a'

function formEmailFrame(look: SheetLook, opts: FrameOptions, body: string) {
  const statusColor = opts.sealColor ?? look.accentDark
  const preheader = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>` : ''
  return `
<!doctype html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${look.bg};font-family:Arial,Helvetica,sans-serif;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${look.bg};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid ${look.line};border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
          <tr><td style="height:8px;line-height:8px;font-size:0;background:${look.accentDark};">&nbsp;</td></tr>

          <!-- Logo, form code and the form-number stamp -->
          <tr>
            <td style="padding:22px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:top;">
                    <img src="cid:${LOGO_CID}" alt="YAZAKI" width="86" style="display:block;border:0;outline:none;height:auto;" />
                    <p style="margin:8px 0 0;font-size:10px;font-weight:bold;letter-spacing:0.14em;color:${look.accentDark};">ISMS-F-001-001</p>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="border:2px dashed ${look.accent};border-radius:10px;background:${look.panel};">
                      <tr><td style="padding:8px 14px;text-align:center;">
                        <p style="margin:0;font-size:9px;font-weight:bold;letter-spacing:0.16em;text-transform:uppercase;color:${look.accentDark};">${opts.tabTitle ?? look.plateTitle}</p>
                        <p style="margin:3px 0 0;font-family:'Courier New',Courier,monospace;font-size:15px;font-weight:bold;color:${FORM_INK};">${escapeHtml(opts.controlNo)}</p>
                      </td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title + status chip -->
          <tr>
            <td style="padding:18px 28px 18px;border-bottom:1px solid ${look.line};">
              <p style="margin:0;font-size:10.5px;font-weight:bold;letter-spacing:0.16em;text-transform:uppercase;color:${look.accent};">${opts.kicker}</p>
              <p style="margin:7px 0 0;font-size:24px;font-weight:bold;color:${FORM_INK};line-height:1.25;">${opts.heading}</p>
              <p style="margin:6px 0 12px;font-size:12.5px;color:${MUTED};">${opts.subheading}</p>
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="background:${statusColor};border-radius:999px;padding:6px 14px;font-size:10.5px;font-weight:bold;letter-spacing:0.1em;text-transform:uppercase;color:#ffffff;">${/^&#10003;/.test(opts.seal) ? '' : '&#10003;&nbsp; '}${opts.seal.replace(/<br>/g, ' ')}</td>
              </tr></table>
            </td>
          </tr>

          ${body}

          <tr>
            <td style="background:${look.panel};border-top:1px solid ${look.line};padding:16px 28px;">
              <p style="margin:0;font-size:10.5px;color:${MUTED};text-align:center;line-height:1.6;">${opts.footerLabel ?? 'Pengesahan Form Review Dokumen'} &middot; dikirim otomatis oleh <strong style="color:${FORM_INK};">Portal ISMS</strong> &middot; PT. Jatim Autocomp Indonesia</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export type ReviewFormSummary = {
  formNo: string
  docControlNo: string
  docTitle: string
  oldRevision: string
  reasons: string[]
  result: string
  detailRevisi: string
}

// The filled-in form as ticked lines (the e-mail's own reading of the PDF).
function reviewSummaryBlock(look: SheetLook, s: ReviewFormSummary) {
  const line = (label: string, value: string) => `
      <tr>
        <td style="padding:7px 0;width:150px;vertical-align:top;font-size:11px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};">${label}</td>
        <td style="padding:7px 0;vertical-align:top;font-size:13.5px;color:${FORM_INK};line-height:1.55;">${value}</td>
      </tr>`
  const tick = (text: string) => `<span style="display:inline-block;margin:0 6px 4px 0;padding:3px 10px 3px 8px;border-radius:999px;background:${look.panel};border:1px solid ${look.line};font-size:12.5px;"><span style="color:${look.accentDark};font-weight:bold;">&#9745;</span>&nbsp;${escapeHtml(text)}</span>`
  return `
    <tr><td style="padding:0 32px 22px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${look.line};border-left:4px solid ${look.accent};border-radius:8px;">
        <tr><td style="padding:14px 18px 8px;">
          <p style="margin:0 0 6px;font-size:10.5px;font-weight:bold;letter-spacing:0.14em;text-transform:uppercase;color:${look.accentDark};">Ringkasan form</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${line('Dokumen direview', `<strong>${escapeHtml([s.docControlNo, s.docTitle].filter(Boolean).join(' — '))}</strong>${s.oldRevision ? `<br><span style="font-size:12px;color:${MUTED};">Revisi lama: ${escapeHtml(s.oldRevision)}</span>` : ''}`)}
            ${s.reasons.length ? line('Alasan review', s.reasons.map(tick).join('')) : ''}
            ${line('Hasil review', tick(s.result))}
            ${s.detailRevisi ? line('Detail revisi', `<span style="font-style:italic;">&ldquo;${escapeHtml(s.detailRevisi)}&rdquo;</span>`) : ''}
          </table>
        </td></tr>
      </table>
    </td></tr>`
}

// The frame of a register's e-mails: the memo for Prosedur ISMS, the sheet
// for Working Standard, the blueprint for Standard Requirement TMMIN, the
// checklist for Form Review Dokumen.
function documentEmailFrame(kind: DocKindLook, opts: FrameOptions, body: string) {
  const look = sheetLook(kind)
  if (!look) return procedureEmailFrame(opts, body)
  if (look.form) return formEmailFrame(look, opts, body)
  return look.blueprint ? blueprintEmailFrame(look, opts, body) : sheetEmailFrame(look, opts, body)
}

// Ruled "form" rows, like the fields of a paper document — or, on a sheet,
// a boxed spec table with shaded label cells.
function detailTable(rows: [string, string][], look: SheetLook | null = null) {
  if (look?.blueprint) return blueprintDetails(look, rows)
  if (look) {
    return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${look.line};border-radius:6px;border-collapse:separate;">
      ${rows.map(([label, value], i) => `
      <tr>
        <td style="padding:10px 12px;background:${look.panel};${i ? `border-top:1px solid ${look.line};` : ''}border-right:1px solid ${look.line};font-family:Arial,Helvetica,sans-serif;font-size:10.5px;font-weight:bold;color:${MUTED};width:128px;vertical-align:top;letter-spacing:0.08em;text-transform:uppercase;">${label}</td>
        <td style="padding:10px 14px;${i ? `border-top:1px solid ${look.line};` : ''}font-family:Arial,Helvetica,sans-serif;font-size:13.5px;color:${look.dark};font-weight:bold;vertical-align:top;">${value}</td>
      </tr>`).join('')}
    </table>`
  }
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid ${MEMO_INK};">
      ${rows.map(([label, value]) => `
      <tr>
        <td style="padding:10px 12px 10px 0;border-bottom:1px solid ${MEMO_LINE};font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${MUTED};width:130px;vertical-align:top;letter-spacing:0.06em;text-transform:uppercase;">${label}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${MEMO_LINE};font-family:Arial,Helvetica,sans-serif;font-size:13.5px;color:${MEMO_INK};font-weight:bold;vertical-align:top;">${value}</td>
      </tr>`).join('')}
    </table>`
}

export type ProcedureChainStep = { roleTitle: string; name: string; state: 'done' | 'current' | 'waiting'; decidedAt: string | null }

// The signing chain as a timeline: a segmented progress bar, then one row per
// signer joined by a thin rail — ✓ signed (with the date), the recipient's own
// step lifted out as a highlighted card, the rest queued. Same layout for
// every register, in that register's colours.
function chainRow(chain: ProcedureChainStep[], look: SheetLook | null = null) {
  const font = 'Arial,Helvetica,sans-serif'
  const capFont = look?.blueprint ? BP_MONO : font
  const strong = look ? look.accentDark : NAVY
  const tint = look ? look.panel : '#eef3f7'
  const line = look ? look.line : MEMO_LINE
  const ink = look ? look.dark : MEMO_INK
  const shape = look?.blueprint ? '6px' : '50%'
  const total = chain.length
  const current = chain.findIndex((step) => step.state === 'current')
  const signed = chain.filter((step) => step.state === 'done').length
  const counter = current >= 0 ? `Langkah ${current + 1} dari ${total}` : `${signed} dari ${total} selesai`

  const bar = chain.map((step) => `
        <td style="padding:0 2px;"><div style="height:6px;line-height:6px;font-size:0;border-radius:3px;background:${step.state === 'done' ? GREEN : step.state === 'current' ? strong : line};">&nbsp;</div></td>`).join('')

  const pillBase = `display:inline-block;padding:5px 11px;border-radius:999px;font-family:${font};font-size:10.5px;font-weight:bold;white-space:nowrap;`
  const rows = chain.map((step, i) => {
    const isCurrent = step.state === 'current'
    const isDone = step.state === 'done'
    const badge = isDone
      ? `background:${GREEN};color:#ffffff;border:2px solid ${GREEN};`
      : isCurrent ? `background:${strong};color:#ffffff;border:2px solid ${strong};` : `background:#ffffff;color:${MUTED};border:2px dashed ${line};`
    const pill = isDone
      ? `<span style="${pillBase}background:#e6f2ea;color:${GREEN};">&#10003; Disetujui</span><p style="margin:4px 2px 0;font-family:${font};font-size:10.5px;color:${MUTED};">${fmtDate(step.decidedAt)}</p>`
      : isCurrent
        ? `<span style="${pillBase}background:${strong};color:#ffffff;letter-spacing:0.08em;text-transform:uppercase;">&#9998; Giliran Anda</span>`
        : `<span style="${pillBase}background:#ffffff;border:1px solid ${line};color:${MUTED};">Menunggu</span>`
    const card = isCurrent
      ? `background:${tint};border:1px solid ${line};border-left:4px solid ${strong};`
      : 'border:1px solid transparent;border-left:4px solid transparent;'
    // the rail runs under the badge's centre: 4px edge + 12px padding + 16px half-badge − 1px
    const rail = i < total - 1
      ? `<tr><td style="padding:0;"><div style="width:2px;height:12px;line-height:12px;font-size:0;margin-left:31px;background:${isDone ? GREEN : line};">&nbsp;</div></td></tr>`
      : ''
    return `
      <tr><td style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${card}border-radius:10px;">
          <tr>
            <td valign="middle" style="padding:10px 0 10px 12px;width:32px;">
              <div style="width:32px;height:32px;line-height:32px;border-radius:${shape};text-align:center;font-family:${font};font-size:13px;font-weight:bold;${badge}">${isDone ? '&#10003;' : i + 1}</div>
            </td>
            <td valign="middle" style="padding:10px 12px;">
              <p style="margin:0;font-family:${font};font-size:14px;font-weight:bold;color:${ink};line-height:1.3;">${escapeHtml(step.name)}</p>
              <p style="margin:2px 0 0;font-family:${capFont};font-size:11px;color:${MUTED};letter-spacing:0.04em;line-height:1.35;">${escapeHtml(step.roleTitle)}</p>
            </td>
            <td align="right" valign="middle" style="padding:10px 12px 10px 4px;">${pill}</td>
          </tr>
        </table>
      </td></tr>${rail}`
  }).join('')

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${line};border-radius:12px;">
      <tr><td style="padding:16px 18px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-family:${capFont};font-size:10.5px;font-weight:bold;color:${strong};letter-spacing:0.14em;text-transform:uppercase;">Alur Pengesahan</td>
          <td align="right" style="font-family:${capFont};font-size:11px;font-weight:bold;color:${MUTED};">${counter}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:10px 16px 14px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${bar}</tr></table></td></tr>
      <tr><td style="padding:0 10px 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
    </table>`
}

export type ProcedureApprovalEmailData = {
  approverName: string
  roleTitle: string
  controlNo: string
  title: string
  revision: number
  effDate: string
  note: string | null
  stepNumber: number
  stepTotal: number
  chain: ProcedureChainStep[]
  reviewUrl: string
  /** Which register the document belongs to (lib/document-kinds.ts); procedure when omitted. */
  kind?: DocKindLook
  /** Form Review Dokumen: what the form says, shown in the mail. */
  reviewForm?: ReviewFormSummary | null
  /** A follow-up of a request the approver hasn't decided on: which reminder, and how long it has waited. */
  reminder?: { count: number; waitingDays: number } | null
  /** Sent again after a "Minta Revisi": what was asked, by whom; round = 2 for the first re-submission. */
  resubmission?: {
    round: number
    by: string
    at: string
    general: string | null
    pins: { page: number; note: string; strike: boolean }[]
    fileChanged: boolean
  } | null
}

export function buildProcedureApprovalEmail(data: ProcedureApprovalEmailData): { subject: string; html: string } {
  const rows: [string, string][] = [
    ['Nama Dokumen', escapeHtml(data.title)],
    ['No. Kontrol', escapeHtml(data.controlNo)],
    ['Revisi', String(data.revision)],
    ['Eff Date', fmtDate(data.effDate)],
    ['Jabatan Anda', escapeHtml(data.roleTitle)],
  ]
  if (data.note) rows.push(['Note Dokumen', escapeHtml(data.note)])

  const title = escapeHtml(data.title)
  const kind = data.kind ?? PROCEDURE_KIND
  const para = `margin:0 0 14px;font-size:14.5px;color:${MEMO_INK};line-height:1.75;`
  const re = data.resubmission ?? null
  const look = sheetLook(kind)
  // The button: navy with a gold foot on the memo, the accent colour on a sheet.
  const buttonStyle = look?.form
    ? `background:${look.accentDark};color:#ffffff;border-radius:10px;border-bottom:3px solid ${re ? '#1f7a4d' : look.dark};`
    : look?.blueprint
    ? `background:${look.accent};color:${look.dark};border-bottom:4px solid ${re ? '#1f7a4d' : look.dark};letter-spacing:0.1em;`
    : look
    ? `background:${look.accent};color:${look.dark};border-radius:6px;border-bottom:3px solid ${re ? '#1f7a4d' : look.accentDark};`
    : `background:${NAVY};color:#ffffff;border-radius:4px;border-bottom:3px solid ${re ? '#1f7a4d' : MEMO_SEAL};`

  // Re-submission: a green banner first thing in the mail — which round, that
  // older links are void, and what the approver asked to be fixed.
  const resubmitBanner = re ? `
    <tr>
      <td style="padding:20px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #b9dcc8;border-left:4px solid #1f7a4d;background:#eef8f2;border-radius:4px;">
          <tr><td style="padding:14px 16px;font-family:${SANS};">
            <p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;color:#1f7a4d;">&#8635;&nbsp; Pengajuan ulang ke-${re.round} &middot; setelah revisi</p>
            <p style="margin:6px 0 0;font-size:13.5px;color:${MEMO_INK};line-height:1.6;">
              Dokumen ini ${re.fileChanged ? '<strong>sudah diperbaiki</strong>' : 'diajukan kembali'} menindaklanjuti permintaan revisi dari <strong>${escapeHtml(re.by)}</strong> (${escapeHtml(fmtStamp(re.at))}).
              <strong>Link pada email sebelumnya sudah tidak berlaku</strong> &mdash; gunakan tombol di email ini.
            </p>
            ${re.general || re.pins.length ? `
            <p style="margin:10px 0 4px;font-size:11.5px;font-weight:bold;color:${MUTED};">Yang diminta sebelumnya:</p>
            ${re.general ? `<p style="margin:0 0 4px;font-size:13px;color:${MEMO_INK};line-height:1.55;">${escapeHtml(re.general)}</p>` : ''}
            ${re.pins.slice(0, 8).map((p, i) => `<p style="margin:0 0 3px;font-size:13px;color:${MEMO_INK};line-height:1.55;"><strong style="color:#b3361f;">${i + 1}.</strong> <span style="color:${MUTED};">Hal. ${p.page + 1}${p.strike ? ' &middot; coret' : ''} &mdash;</span> ${escapeHtml(p.note)}</p>`).join('')}
            ${re.pins.length > 8 ? `<p style="margin:0;font-size:12px;color:${MUTED};">… dan ${re.pins.length - 8} catatan lainnya</p>` : ''}` : ''}
            ${re.fileChanged ? `<p style="margin:10px 0 0;font-size:12px;color:${MUTED};line-height:1.55;">Di halaman pengesahan, pilih <strong>Bandingkan sebelum &amp; sesudah revisi</strong> untuk melihat perubahannya berdampingan.</p>` : ''}
          </td></tr>
        </table>
      </td>
    </tr>` : ''

  // Wording as requested by the ISMS team; the detail rows, the signing
  // chain and the button stay, since the approval itself happens via that link.
  // Reminder: an amber note first thing in the mail — same link as before.
  const rem = data.reminder ?? null
  const reminderBanner = rem ? `
    <tr>
      <td style="padding:20px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ecd9a6;border-left:4px solid #b97400;background:#fdf7e6;border-radius:4px;">
          <tr><td style="padding:12px 16px;font-family:${SANS};">
            <p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;color:#8a5600;">&#9200;&nbsp; Pengingat ke-${rem.count}</p>
            <p style="margin:5px 0 0;font-size:13.5px;color:${MEMO_INK};line-height:1.6;">Dokumen ini sudah <strong>${rem.waitingDays} hari</strong> menunggu keputusan Bapak/Ibu. Link di email ini sama dengan email sebelumnya &mdash; mohon kesediaannya untuk mereview.</p>
          </td></tr>
        </table>
      </td>
    </tr>` : ''

  // Form Review: say what it is about in plain words — not "dokumen form review dokumen Form Review — …".
  const rf = data.reviewForm ?? null
  const reviewed = rf ? escapeHtml([rf.docControlNo, rf.docTitle].filter(Boolean).join(' — ')) : ''
  const askLine = rf
    ? `<p style="${para}">Mohon bantuan Bapak/Ibu untuk ${re ? '<strong>memeriksa kembali</strong> dan menandatangani' : 'memeriksa dan menandatangani'} <strong>Form Review &amp; Revisi Dokumen ISMS No. ${escapeHtml(rf.formNo)}</strong> untuk dokumen <strong>${reviewed}</strong>. Formulirnya telah saya lampirkan pada email ini, dan ringkasannya ada di bawah.</p>`
    : null

  const body = `${reminderBanner}${resubmitBanner}
    <tr>
      <td style="padding:20px 32px 6px;">
        <p style="margin:0 0 14px;font-size:15px;color:${MEMO_INK};line-height:1.7;">Yth. Bapak/Ibu <strong>${escapeHtml(data.approverName)}</strong>,</p>
        ${askLine ?? (re
          ? `<p style="${para}">Mohon bantuan Bapak/Ibu untuk melakukan <strong>review kembali</strong> dan approval atas dokumen ${kind.noun} <strong>${title}</strong> yang telah ${re.fileChanged ? 'diperbaiki sesuai catatan revisi dan ' : ''}saya lampirkan pada email ini.</p>`
          : `<p style="${para}">Mohon bantuan Bapak/Ibu untuk melakukan review dan approval atas dokumen ${kind.noun} <strong>${title}</strong> yang telah saya lampirkan pada email ini.</p>`)}
        <p style="${para}">Apabila terdapat hal yang perlu disesuaikan atau diperbaiki, mohon arahan lebih lanjut agar dapat segera saya tindak lanjuti.</p>
        <p style="margin:0 0 20px;font-size:14.5px;color:${MEMO_INK};line-height:1.75;">Terima kasih atas perhatian dan kerja samanya.</p>
      </td>
    </tr>
    ${rf && look ? reviewSummaryBlock(look, rf) : `<tr><td style="padding:0 32px 22px;">${detailTable(rows, look)}</td></tr>`}
    <tr><td style="padding:0 32px;">${chainRow(data.chain, look)}</td></tr>
    <tr>
      <td align="center" style="padding:26px 32px 6px;">
        <a href="${data.reviewUrl}" style="display:inline-block;min-width:240px;text-align:center;padding:15px 30px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:14px;letter-spacing:0.04em;${buttonStyle}">&#9998;&nbsp; ${data.reviewForm ? (re ? 'PERIKSA ULANG &amp; TANDA TANGANI' : 'PERIKSA &amp; TANDA TANGANI') : re ? 'REVIEW ULANG &amp; APPROVAL' : 'REVIEW &amp; APPROVAL'}</a>
        <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11.5px;color:${MUTED};">Buka dokumen, lalu pilih <strong>Setujui</strong> atau <strong>Tolak</strong> &mdash; tanpa perlu login.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 32px 24px;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:${MUTED};text-align:center;line-height:1.6;">Link ini khusus untuk Bapak/Ibu dan hanya berlaku untuk tahap ini. Mohon tidak meneruskan email ini.</p>
      </td>
    </tr>`

  return {
    subject: (rem ? `[Pengingat ke-${rem.count}] ` : '') + (rf
      ? `${re ? `[Pengajuan Ulang ke-${re.round}] ` : ''}Tanda tangan Form Review No. ${rf.formNo} — ${[rf.docControlNo, rf.docTitle].filter(Boolean).join(' ')}`
      : re
      ? `[Pengajuan Ulang ke-${re.round}] Approval ${kind.short} ${data.title} (Rev. ${data.revision}) — setelah revisi`
      : `Pengajuan Approval ${kind.short} ${data.title}`),
    html: documentEmailFrame(kind, {
      kicker: re ? `Pengajuan Ulang ke-${re.round} &middot; ${kind.label}` : `Pengesahan Dokumen &middot; ${kind.label}`,
      heading: rf ? (re ? 'Form Review — Diajukan Ulang' : 'Form Review &amp; Revisi Dokumen') : re ? `Pengajuan Ulang Approval ${kind.short}` : `Pengajuan Approval ${kind.short}`,
      footerLabel: `Pengesahan ${kind.label}`,
      subheading: `Tahap ${data.stepNumber} dari ${data.stepTotal} &middot; ${escapeHtml(data.roleTitle)}`,
      controlNo: data.controlNo,
      revision: data.revision,
      seal: re ? `Pengajuan<br>Ulang<br>ke-${re.round}` : rf ? 'Menunggu tanda tangan Anda' : 'Menunggu<br>Pengesahan<br>Anda',
      sealColor: re ? '#1f7a4d' : undefined,
      preheader: rem ? `Sudah ${rem.waitingDays} hari menunggu keputusan Anda.` : re ? `Pengajuan ulang setelah revisi — link di email sebelumnya sudah tidak berlaku.` : undefined,
    }, body),
  }
}

// Admin notification when a procedure's approval cycle ends — either every
// approver signed (Disahkan) or one asked for changes (Perlu Revisi). Built
// to be acted on from the inbox: a status banner saying who/when/what, the
// document details, the revision notes numbered with their page, the whole
// signing chain, and the concrete next steps with a direct link.
export type ProcedureResultEmailData = {
  outcome: 'approved' | 'rejected'
  controlNo: string
  title: string
  revision: number
  effDate: string | null
  docNote: string | null
  steps: { step: number; roleCode: string; roleTitle: string; name: string; status: string; decidedAt: string | null }[]
  // outcome 'rejected': the request itself
  revisionRequest?: { by: string; roleTitle: string; at: string; general: string | null; pins: { page: number; note: string; x2?: number | null }[] } | null
  // outcome 'approved': how many approvers' QR land on the document itself
  placements?: { placed: number; total: number }
  registerUrl: string
  signedPdfUrl?: string
  /** Which register the document belongs to (lib/document-kinds.ts); procedure when omitted. */
  kind?: DocKindLook
}

const STEP_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: 'Disetujui', color: '#1a6e3a', bg: '#e3f3e8' },
  rejected: { label: 'Minta revisi', color: '#b3361f', bg: '#fbe6e0' },
  pending: { label: 'Menunggu', color: '#8a6100', bg: '#fff3d6' },
  waiting: { label: 'Antri', color: '#5b6b76', bg: '#eef1f3' },
  cancelled: { label: 'Tidak diproses', color: '#5b6b76', bg: '#eef1f3' },
}

const REV_RED = '#b3361f'
const REV_TINT = '#fdf3ef'
const OK_TINT = '#eef7f1'

function fmtStamp(value: string) {
  return new Date(value).toLocaleString('id-ID', { timeZone: APP_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const SANS = 'Arial,Helvetica,sans-serif'
const sectionTitle = (text: string) =>
  `<p style="margin:0 0 10px;font-family:${SANS};font-size:10.5px;font-weight:bold;color:${NAVY_MID};letter-spacing:0.14em;text-transform:uppercase;">${text}</p>`

export function buildProcedureResultEmail(data: ProcedureResultEmailData): { subject: string; html: string } {
  const approved = data.outcome === 'approved'
  const kind = data.kind ?? PROCEDURE_KIND
  const label = approved ? 'Disahkan' : 'Perlu Revisi'
  const color = approved ? GREEN : REV_RED
  const total = data.steps.length
  const approvedCount = data.steps.filter((s) => s.status === 'approved').length
  const req = data.revisionRequest ?? null
  const noteCount = req ? (req.general ? 1 : 0) + req.pins.length : 0
  const lastDecision = data.steps.filter((s) => s.decidedAt).map((s) => s.decidedAt as string).sort().pop() ?? null
  const skipped = data.steps.filter((s) => s.status === 'cancelled' || s.status === 'waiting').length

  // 1) Status banner — the whole story in two lines.
  const banner = approved
    ? `<p style="margin:0;font-family:${SANS};font-size:16px;font-weight:bold;color:${GREEN};">&#10003;&nbsp; Disahkan oleh seluruh approver (${approvedCount}/${total})</p>
       <p style="margin:6px 0 0;font-family:${SANS};font-size:13px;color:${TEXT};line-height:1.6;">Tanda tangan terakhir ${lastDecision ? `pada <strong>${escapeHtml(fmtStamp(lastDecision))}</strong>` : ''}. Dokumen kini berstatus <strong>Disahkan</strong> di register ${kind.label}.</p>`
    : `<p style="margin:0;font-family:${SANS};font-size:16px;font-weight:bold;color:${REV_RED};">&#9888;&nbsp; Revisi diminta oleh ${escapeHtml(req?.by ?? '-')}</p>
       <p style="margin:6px 0 0;font-family:${SANS};font-size:13px;color:${TEXT};line-height:1.6;">${escapeHtml(req?.roleTitle ?? '')}${req ? ` &middot; ${escapeHtml(fmtStamp(req.at))}` : ''} &middot; <strong>${noteCount} catatan</strong>${req && req.pins.length ? ` (${req.pins.length} ditandai di halaman dokumen)` : ''}.<br>Pengesahan dihentikan${skipped ? ` &mdash; ${skipped} approver berikutnya belum dimintai persetujuan` : ''}.</p>`

  // 2) Document details.
  const detailRows: [string, string][] = [
    ['No. Kontrol', `<span style="font-family:'Courier New',Courier,monospace;font-weight:bold;">${escapeHtml(data.controlNo)}</span>`],
    ['Nama Dokumen', `<strong>${escapeHtml(data.title)}</strong>`],
    ['Revisi', `Rev. ${data.revision}`],
    ...(data.effDate ? [['Eff Date', escapeHtml(fmtDate(data.effDate))] as [string, string]] : []),
    ...(data.docNote ? [['Catatan pengajuan', escapeHtml(data.docNote)] as [string, string]] : []),
  ]
  const details = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${MEMO_LINE};border-radius:4px;border-collapse:separate;">
      ${detailRows.map(([k, v], i) => `
      <tr>
        <td style="width:150px;padding:9px 14px;font-family:${SANS};font-size:12px;color:${MUTED};background:${MEMO_PAPER};${i ? `border-top:1px solid ${MEMO_LINE};` : ''}vertical-align:top;">${k}</td>
        <td style="padding:9px 14px;font-family:${SANS};font-size:13px;color:${MEMO_INK};${i ? `border-top:1px solid ${MEMO_LINE};` : ''}line-height:1.5;">${v}</td>
      </tr>`).join('')}
    </table>`

  // 3) Revision notes, numbered with their page.
  const notes = !approved && req ? `
    <tr><td style="padding:22px 32px 0;">
      ${sectionTitle(`Catatan revisi (${noteCount})`)}
      ${req.general ? `<div style="padding:12px 14px;border-left:3px solid ${REV_RED};background:${REV_TINT};font-family:${SANS};font-size:13.5px;color:${MEMO_INK};line-height:1.65;"><span style="display:block;font-size:10.5px;font-weight:bold;color:${REV_RED};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:3px;">Catatan umum</span>${escapeHtml(req.general).replace(/\n/g, '<br>')}</div>` : ''}
      ${req.pins.length ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:${req.general ? '10px' : '0'};border:1px solid #f0d9d1;border-radius:4px;border-collapse:separate;">
        ${req.pins.map((pin, i) => `
        <tr>
          <td style="width:34px;padding:10px 0 10px 12px;vertical-align:top;${i ? 'border-top:1px solid #f0d9d1;' : ''}">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="width:22px;height:22px;border-radius:50%;background:#d6452f;font-family:${SANS};font-size:11px;font-weight:bold;color:#ffffff;">${i + 1}</td></tr></table>
          </td>
          <td style="padding:10px 14px 10px 6px;vertical-align:top;${i ? 'border-top:1px solid #f0d9d1;' : ''}">
            <span style="display:inline-block;padding:1px 7px;border-radius:3px;background:#f6e4de;font-family:${SANS};font-size:10.5px;font-weight:bold;color:${REV_RED};">Halaman ${pin.page + 1}${typeof pin.x2 === 'number' ? ' &middot; Coret' : ''}</span>
            <p style="margin:4px 0 0;font-family:${SANS};font-size:13.5px;color:${MEMO_INK};line-height:1.55;">${escapeHtml(pin.note)}</p>
          </td>
        </tr>`).join('')}
      </table>
      <p style="margin:8px 0 0;font-family:${SANS};font-size:11.5px;color:${MUTED};">Nomor di atas sama dengan penanda dan coretan merah pada halaman dokumen &mdash; buka <em>Lihat catatan di dokumen</em> di register untuk melihat letaknya.</p>` : ''}
    </td></tr>` : ''

  // 4) The whole signing chain.
  const chain = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${MEMO_LINE};border-radius:4px;border-collapse:separate;">
      <tr>
        <td style="padding:8px 12px;font-family:${SANS};font-size:10px;font-weight:bold;color:${MUTED};letter-spacing:0.1em;text-transform:uppercase;background:${MEMO_PAPER};width:28px;">#</td>
        <td style="padding:8px 12px;font-family:${SANS};font-size:10px;font-weight:bold;color:${MUTED};letter-spacing:0.1em;text-transform:uppercase;background:${MEMO_PAPER};">Approver</td>
        <td style="padding:8px 12px;font-family:${SANS};font-size:10px;font-weight:bold;color:${MUTED};letter-spacing:0.1em;text-transform:uppercase;background:${MEMO_PAPER};">Status</td>
        <td style="padding:8px 12px;font-family:${SANS};font-size:10px;font-weight:bold;color:${MUTED};letter-spacing:0.1em;text-transform:uppercase;background:${MEMO_PAPER};text-align:right;">Waktu</td>
      </tr>
      ${data.steps.map((s) => {
        const st = STEP_STATUS[s.status] ?? STEP_STATUS.waiting
        return `
      <tr>
        <td style="padding:10px 12px;border-top:1px solid ${MEMO_LINE};font-family:${SANS};font-size:12px;color:${MUTED};vertical-align:top;">${s.step}</td>
        <td style="padding:10px 12px;border-top:1px solid ${MEMO_LINE};font-family:${SANS};vertical-align:top;">
          <span style="font-size:13px;font-weight:bold;color:${MEMO_INK};">${escapeHtml(s.name)}</span>
          <span style="font-family:'Courier New',Courier,monospace;font-size:10px;color:${MUTED};">&nbsp;${escapeHtml(s.roleCode)}</span><br>
          <span style="font-size:11.5px;color:${MUTED};">${escapeHtml(s.roleTitle)}</span>
        </td>
        <td style="padding:10px 12px;border-top:1px solid ${MEMO_LINE};vertical-align:top;">
          <span style="display:inline-block;padding:3px 9px;border-radius:999px;background:${st.bg};font-family:${SANS};font-size:11px;font-weight:bold;color:${st.color};white-space:nowrap;">${st.label}</span>
        </td>
        <td style="padding:10px 12px;border-top:1px solid ${MEMO_LINE};font-family:${SANS};font-size:11.5px;color:${MUTED};text-align:right;vertical-align:top;white-space:nowrap;">${s.decidedAt ? escapeHtml(fmtStamp(s.decidedAt)) : '&ndash;'}</td>
      </tr>`
      }).join('')}
    </table>`

  // 5) Next steps.
  const stepsList = (items: string[]) => items.map((item, i) => `
      <tr>
        <td style="width:26px;vertical-align:top;padding:0 0 9px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="width:20px;height:20px;border-radius:50%;background:${NAVY};font-family:${SANS};font-size:10.5px;font-weight:bold;color:#ffffff;">${i + 1}</td></tr></table></td>
        <td style="padding:1px 0 9px 6px;font-family:${SANS};font-size:13px;color:${MEMO_INK};line-height:1.55;">${item}</td>
      </tr>`).join('')
  const placements = data.placements
  const nextSteps = approved
    ? [
        placements && placements.total > 0 && placements.placed < placements.total
          ? `<strong style="color:${REV_RED};">Periksa posisi QR:</strong> baru ${placements.placed} dari ${placements.total} approver yang QR-nya tercetak di kolom tanda tangan dokumen. Atur lewat tombol <em>Posisi QR</em> di register agar semua tanda tangan tampil.`
          : 'Semua QR tanda tangan tercetak di kolom tanda tangan dokumen beserta tanggalnya.',
        'Unduh <strong>PDF bertanda tangan</strong> untuk arsip atau distribusi &mdash; setiap QR dapat dipindai untuk memverifikasi penyetuju dan tanggalnya.',
        `Dokumen otomatis tampil sebagai <strong>Disahkan</strong> di register ${kind.label}.`,
      ]
    : [
        `Buka dokumen di register ${kind.label}, lalu klik <strong>Lihat catatan di dokumen</strong> untuk melihat letak setiap catatan.`,
        'Perbaiki dokumen sesuai catatan di atas.',
        'Klik <strong>Unggah perbaikan &amp; ajukan ulang</strong> pada dokumen dan pilih file PDF hasil perbaikan (naikkan nomor revisi bila perlu). Pengesahan otomatis dimulai ulang dari tahap 1.',
        'Approver akan melihat catatan ini di samping dokumen baru, sehingga bisa langsung memeriksa perbaikannya.',
      ]

  const button = (href: string, text: string, bg: string) =>
    `<a href="${href}" style="display:inline-block;margin:0 4px 8px;padding:12px 24px;background:${bg};color:#ffffff;border-radius:999px;text-decoration:none;font-family:${SANS};font-weight:bold;font-size:13px;">${text}</a>`
  const ghost = (href: string, text: string) =>
    `<a href="${href}" style="display:inline-block;margin:0 4px 8px;padding:11px 22px;border:1.5px solid ${NAVY};color:${NAVY};border-radius:999px;text-decoration:none;font-family:${SANS};font-weight:bold;font-size:13px;">${text}</a>`
  const buttons = approved
    ? `${data.signedPdfUrl ? button(data.signedPdfUrl, 'Unduh PDF bertanda tangan', GREEN) : ''}${ghost(data.registerUrl, 'Buka di register')}`
    : `${button(data.registerUrl, 'Lihat catatan &amp; perbaiki dokumen', REV_RED)}`

  const body = `
    <tr><td style="padding:22px 32px 0;">
      <div style="padding:14px 16px;border-radius:4px;border-left:4px solid ${color};background:${approved ? OK_TINT : REV_TINT};">${banner}</div>
    </td></tr>
    <tr><td style="padding:22px 32px 0;">${sectionTitle('Detail dokumen')}${details}</td></tr>
    ${notes}
    <tr><td style="padding:22px 32px 0;">${sectionTitle(`Status pengesahan &middot; ${approvedCount}/${total} disetujui`)}${chain}</td></tr>
    <tr><td style="padding:22px 32px 0;">${sectionTitle('Langkah selanjutnya')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${stepsList(nextSteps)}</table></td></tr>
    <tr><td align="center" style="padding:14px 32px 24px;">${buttons}</td></tr>`

  const firstNote = req ? (req.pins[0] ? `Hal. ${req.pins[0].page + 1}: ${req.pins[0].note}` : req.general ?? '') : ''
  const preheader = approved
    ? `${data.controlNo} Rev. ${data.revision} disahkan oleh ${approvedCount}/${total} approver.`
    : `${req?.by ?? 'Approver'} meminta revisi (${noteCount} catatan) — ${firstNote}`.slice(0, 160)

  return {
    subject: approved
      ? `[Disahkan] ${data.controlNo} — ${data.title} (Rev. ${data.revision}) · ${approvedCount}/${total} approver`
      : `[Perlu Revisi] ${data.controlNo} — ${data.title} (Rev. ${data.revision}) · ${noteCount} catatan dari ${req?.by ?? 'approver'}`,
    html: documentEmailFrame(kind, {
      kicker: `Notifikasi Admin &middot; Pengesahan ${kind.label}`,
      footerLabel: `Pengesahan ${kind.label}`,
      heading: approved ? 'Dokumen Disahkan' : 'Dokumen Perlu Revisi',
      subheading: escapeHtml(data.title),
      controlNo: data.controlNo,
      revision: data.revision,
      seal: approved ? '&#10003;<br>Disahkan' : 'Perlu<br>Revisi',
      sealColor: color,
      preheader,
    }, body),
  }
}


// ─── Ijin Masuk Area Special Security (ISMS-F-006-001) ───
// Same structure and wording pattern as the Visitor Ijin Foto/Video email,
// but its own "restricted area" look — hazard-stripe ribbon, maroon header
// with a SPECIAL SECURITY badge, the area shown in a locked box — so an
// approver tells the two requests apart at a glance. The two buttons open
// the approval page with the choice preselected; the approver still confirms
// there, so a mail client prefetching links can't decide.

const SA_MAROON = '#5a0f14'
const SA_MAROON_MID = '#8a151c'
const SA_RED = '#c7161e'
const SA_TINT = '#fdf2f2'
const SA_LINE = '#f0dada'
const SA_BG = '#f4eeee'

export type SpecialAreaApprovalEmailData = {
  approverName: string
  requesterName: string
  orgCompany: string
  department: string | null
  fromAt: string
  toAt: string
  area: string
  purpose: string
  idCardNo: string | null
  approveUrl: string
  rejectUrl: string
}

export function buildSpecialAreaApprovalEmail(data: SpecialAreaApprovalEmailData): { subject: string; html: string } {
  const period = `${fmtDateTime(data.fromAt)} &ndash; ${fmtDateTime(data.toAt)}`

  const row = (no: number, label: string, value: string, zebra: boolean) => `
    <tr>
      <td style="padding:12px 14px 12px 16px;background:${zebra ? SA_TINT : '#ffffff'};border-bottom:1px solid ${SA_LINE};width:30px;vertical-align:top;">
        <span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;border-radius:4px;background:${SA_MAROON};color:#ffffff;font-size:10.5px;font-weight:700;">${no}</span>
      </td>
      <td style="padding:12px 8px 12px 0;background:${zebra ? SA_TINT : '#ffffff'};border-bottom:1px solid ${SA_LINE};font-size:13px;color:${MUTED};width:170px;vertical-align:top;">${label}</td>
      <td style="padding:12px 16px 12px 0;background:${zebra ? SA_TINT : '#ffffff'};border-bottom:1px solid ${SA_LINE};font-size:13.5px;color:${TEXT};font-weight:600;vertical-align:top;">${value}</td>
    </tr>`

  const fields: [string, string][] = [
    ['Nama', escapeHtml(data.requesterName)],
    ['Organisasi / Perusahaan', escapeHtml(data.orgCompany)],
    ['Departemen', escapeHtml(data.department ?? '-')],
    ['Waktu Keluar/Masuk', period],
    ['Area Special Security', `<span style="color:${SA_RED};">${escapeHtml(data.area)}</span>`],
    ['Tujuan', escapeHtml(data.purpose)],
  ]
  if (data.idCardNo) fields.push(['ID Card No.', escapeHtml(data.idCardNo)])
  const rowsHtml = fields.map(([label, value], i) => row(i + 1, label, value, i % 2 === 1)).join('')

  const html = `
<!doctype html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${SA_BG};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SA_BG};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid ${SA_LINE};box-shadow:0 10px 30px rgba(90,15,20,0.16);">

          <!-- Hazard stripe -->
          <tr>
            <td style="background:repeating-linear-gradient(-45deg, ${SA_RED} 0 14px, #1c1c1c 14px 28px);background-color:${SA_RED};height:10px;line-height:10px;font-size:0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #2a0709 0%, ${SA_MAROON} 50%, ${SA_MAROON_MID} 100%);background-color:${SA_MAROON};padding:26px 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="display:inline-block;background:#ffffff;border-radius:6px;padding:6px 10px;line-height:0;">
                      <img src="cid:${LOGO_CID}" alt="YAZAKI" width="72" style="display:block;border:0;outline:none;height:auto;" />
                    </span>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;background:${SA_RED};border:1px solid rgba(255,255,255,0.35);border-radius:4px;padding:6px 11px;color:#ffffff;font-size:10.5px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">&#9888; Special Security Area</span>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;color:rgba(255,255,255,0.65);font-size:10.5px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Form ISMS-F-006-001 &middot; Area Terbatas</p>
              <p style="margin:6px 0 0;color:#ffffff;font-size:21px;font-weight:bold;line-height:1.3;">Permohonan Ijin Masuk Area Special Security</p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:12px;">PT. Jatim Autocomp Indonesia &middot; Menunggu persetujuan Anda</p>
            </td>
          </tr>

          <!-- Locked area highlight -->
          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SA_TINT};border:1px solid ${SA_LINE};border-top:0;border-radius:0 0 10px 10px;">
                <tr>
                  <td style="padding:14px 18px;width:44px;vertical-align:middle;">
                    <span style="display:inline-block;width:38px;height:38px;line-height:38px;text-align:center;border-radius:8px;background:${SA_RED};color:#ffffff;font-size:18px;">&#128274;</span>
                  </td>
                  <td style="padding:14px 18px 14px 0;vertical-align:middle;">
                    <p style="margin:0;font-size:10.5px;font-weight:700;color:${MUTED};letter-spacing:0.12em;text-transform:uppercase;">Area yang dimohonkan</p>
                    <p style="margin:3px 0 0;font-size:17px;font-weight:bold;color:${SA_RED};">${escapeHtml(data.area)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:26px 32px 8px;">
              <p style="margin:0 0 14px;font-size:14px;color:${TEXT};line-height:1.7;">Yth. Bapak/Ibu <strong>${escapeHtml(data.approverName)}</strong>,</p>
              <p style="margin:0 0 14px;font-size:13.5px;color:${TEXT};line-height:1.75;">Semoga Bapak/Ibu selalu dalam keadaan sehat dan sukses dalam menjalankan aktivitas.</p>
              <p style="margin:0 0 18px;font-size:13.5px;color:${TEXT};line-height:1.75;">Sehubungan dengan rencana kegiatan <strong>${escapeHtml(data.purpose)}</strong>, bersama email ini kami bermaksud untuk mengajukan permohonan izin masuk ke area special security <strong>${escapeHtml(data.area)}</strong>.</p>
              <p style="margin:0 0 10px;font-size:13.5px;color:${TEXT};line-height:1.75;">Adapun rincian pengajuan izin masuk area special security adalah sebagai berikut:</p>
            </td>
          </tr>

          <!-- Detail table -->
          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${SA_LINE};border-left:4px solid ${SA_RED};border-radius:8px;overflow:hidden;">
                ${rowsHtml}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 4px;">
              <p style="margin:0 0 14px;font-size:13.5px;color:${TEXT};line-height:1.75;">Kami memastikan bahwa selama berada di area special security akan mematuhi seluruh ketentuan keamanan informasi yang berlaku di lingkungan perusahaan, termasuk larangan mengambil foto/video, merekam suara/audio, serta membawa masuk atau membawa keluar perangkat IT tanpa izin sesuai Diagram Security Area PT. JAI.</p>
              <p style="margin:0;font-size:13.5px;color:${TEXT};line-height:1.75;">Demikian permohonan izin ini kami sampaikan. Kami ucapkan terima kasih.</p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:26px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SA_TINT};border:1px dashed ${SA_RED};border-radius:10px;">
                <tr>
                  <td style="padding:20px 20px 4px;text-align:center;font-size:12.5px;color:${MUTED};">Klik salah satu tombol di bawah untuk memproses &mdash; tanpa perlu login:</td>
                </tr>
                <tr>
                  <td align="center" style="padding:14px 20px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:10px;">
                          <a href="${data.approveUrl}" style="display:inline-block;min-width:150px;text-align:center;padding:14px 28px;background:${GREEN};color:#ffffff;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">&#10003;&nbsp; Menyetujui</a>
                        </td>
                        <td>
                          <a href="${data.rejectUrl}" style="display:inline-block;min-width:150px;text-align:center;padding:12px 26px;background:#ffffff;color:${SA_RED};border:2px solid ${SA_RED};border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;">&#10007;&nbsp; Tolak</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 32px 28px;">
              <p style="margin:0;font-size:11px;color:${MUTED};text-align:center;line-height:1.6;">
                <span style="display:inline-block;background:${SA_MAROON};color:#ffffff;font-weight:700;border-radius:4px;padding:2px 9px;font-size:10px;letter-spacing:0.04em;">E-SIGN</span>
                &nbsp;Setelah diproses, form pengajuan PDF ber-QR (bukti persetujuan digital) akan otomatis tersedia untuk diunduh.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#1f0608;padding:18px 32px;">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.7);text-align:center;">Email ini dikirim otomatis oleh <strong style="color:#ffffff;">Portal ISMS</strong> &middot; PT. Jatim Autocomp Indonesia</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return {
    subject: `Permohonan Izin Masuk Area Special Security — ${data.requesterName} (${data.orgCompany})`,
    html,
  }
}


// ─── Weekly document review reminder (lib/document-review.ts) ───

export type ReviewDigestItem = { kindLabel: string; controlNo: string; title: string; revision: number | null; effDate: string; dueDate: string; overdueDays: number }

export function buildReviewDigestEmail(data: { months: number; overdue: ReviewDigestItem[]; soon: ReviewDigestItem[]; dashboardUrl: string }): { subject: string; html: string } {
  const row = (item: ReviewDigestItem, overdue: boolean) => `
    <tr>
      <td style="padding:9px 12px;border-top:1px solid ${MEMO_LINE};font-family:${SANS};vertical-align:top;">
        <span style="font-family:'Courier New',Courier,monospace;font-size:12px;font-weight:bold;color:${MEMO_INK};">${escapeHtml(item.controlNo)}</span>
        <span style="font-size:11px;color:${MUTED};">&nbsp;${escapeHtml(item.kindLabel)}${item.revision !== null ? ` &middot; Rev. ${item.revision}` : ''}</span><br>
        <span style="font-size:13px;color:${MEMO_INK};">${escapeHtml(item.title)}</span>
      </td>
      <td style="padding:9px 12px;border-top:1px solid ${MEMO_LINE};font-family:${SANS};font-size:11.5px;color:${MUTED};white-space:nowrap;vertical-align:top;">Eff ${escapeHtml(fmtDate(item.effDate))}</td>
      <td style="padding:9px 12px;border-top:1px solid ${MEMO_LINE};font-family:${SANS};font-size:11.5px;font-weight:bold;white-space:nowrap;text-align:right;vertical-align:top;color:${overdue ? '#b3361f' : '#8a6100'};">
        ${overdue ? `Lewat ${item.overdueDays} hari` : `Jatuh tempo ${escapeHtml(fmtDate(item.dueDate))}`}
      </td>
    </tr>`
  const table = (title: string, items: ReviewDigestItem[], overdue: boolean) => items.length ? `
    <tr><td style="padding:20px 32px 0;">${sectionTitle(`${title} (${items.length})`)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${MEMO_LINE};border-radius:4px;border-collapse:separate;">${items.map((i) => row(i, overdue)).join('')}</table>
    </td></tr>` : ''
  const total = data.overdue.length + data.soon.length
  const body = `
    <tr><td style="padding:22px 32px 0;font-family:${SANS};font-size:13.5px;color:${TEXT};line-height:1.7;">
      Dokumen ISMS ditinjau ulang setiap <strong>${data.months} bulan</strong> sejak Eff Date-nya. Minggu ini ada
      <strong>${data.overdue.length} dokumen lewat jadwal review</strong> dan <strong>${data.soon.length} dokumen jatuh tempo dalam 30 hari</strong>.
      Bila isinya masih sesuai, unggah ulang dengan Eff Date baru (atau revisi bila ada perubahan) agar tercatat sudah direview.
    </td></tr>
    ${table('Lewat jadwal review', data.overdue, true)}
    ${table('Jatuh tempo 30 hari ke depan', data.soon, false)}
    <tr><td align="center" style="padding:22px 32px 26px;">
      <a href="${data.dashboardUrl}" style="display:inline-block;padding:12px 24px;background:${NAVY};color:#ffffff;border-radius:999px;text-decoration:none;font-family:${SANS};font-weight:bold;font-size:13px;">Buka Dashboard Admin</a>
    </td></tr>`
  return {
    subject: `[Review Dokumen] ${data.overdue.length} lewat jadwal, ${data.soon.length} jatuh tempo — Portal ISMS`,
    html: procedureEmailFrame({
      kicker: 'Pengingat Mingguan &middot; Review Dokumen ISMS',
      heading: 'Dokumen Perlu Direview',
      subheading: `${total} dokumen &middot; siklus review ${data.months} bulan`,
      controlNo: String(total),
      revision: null,
      tabTitle: 'Perlu Review',
      tabSub: 'dokumen',
      seal: 'Review<br>Berkala',
      preheader: `${data.overdue.length} dokumen lewat jadwal review, ${data.soon.length} jatuh tempo 30 hari ke depan.`,
    }, body),
  }
}


// ─── Ijin Foto/Video: notices to the ISM Admin and the requester ───
// Same look as the request e-mail the PIC gets (navy-to-teal header, orange
// ribbon), so everything about photo/video permits reads as one family.

function photoEmailFrame(opts: { title: string; subtitle: string; preheader: string; ribbon?: string }, body: string) {
  return `
<!doctype html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef2f4;font-family:${SANS};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f4;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(18,40,58,0.16);">
          <tr><td style="background:${opts.ribbon ?? ACCENT};height:6px;line-height:6px;font-size:0;">&nbsp;</td></tr>
          <tr>
            <td style="background:linear-gradient(135deg, ${NAVY} 0%, ${NAVY_MID} 45%, ${TEAL} 100%);background-color:${NAVY};padding:24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="vertical-align:middle;"><span style="display:inline-block;background:#ffffff;border-radius:8px;padding:6px 10px;line-height:0;"><img src="cid:${LOGO_CID}" alt="YAZAKI" width="72" style="display:block;border:0;outline:none;height:auto;" /></span></td>
                <td align="right" style="vertical-align:middle;"><span style="display:inline-block;border:1px solid rgba(255,255,255,0.35);border-radius:999px;padding:5px 12px;color:#ffffff;font-size:10.5px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Ijin Foto/Video</span></td>
              </tr></table>
              <p style="margin:16px 0 0;color:#ffffff;font-size:20px;font-weight:bold;line-height:1.3;">${opts.title}</p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.78);font-size:12px;">${opts.subtitle}</p>
            </td>
          </tr>
          ${body}
          <tr><td style="background:${NAVY};padding:18px 32px;"><p style="margin:0;font-size:11px;color:rgba(255,255,255,0.7);text-align:center;">Email ini dikirim otomatis oleh <strong style="color:#ffffff;">Portal ISMS</strong> &middot; PT. Jatim Autocomp Indonesia</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function photoDetailRows(rows: [string, string][]) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
      ${rows.map(([label, value], i) => `
      <tr>
        <td style="padding:11px 8px 11px 16px;background:${i % 2 ? '#f6f9fa' : '#ffffff'};border-bottom:1px solid ${BORDER};font-size:12.5px;color:${MUTED};width:140px;vertical-align:top;">${label}</td>
        <td style="padding:11px 16px 11px 0;background:${i % 2 ? '#f6f9fa' : '#ffffff'};border-bottom:1px solid ${BORDER};font-size:13.5px;color:${TEXT};font-weight:600;vertical-align:top;">${value}</td>
      </tr>`).join('')}
    </table>`
}

function photoButton(href: string, label: string, color = NAVY) {
  return `<a href="${href}" style="display:inline-block;padding:13px 28px;background:${color};color:#ffffff;border-radius:999px;text-decoration:none;font-weight:bold;font-size:14px;">${label}</a>`
}

export type PhotoRequestSummary = {
  requesterName: string
  nik: string | null
  deptOrCompany: string
  location: string
  objective: string
  fromAt: string
  toAt: string
  picApprove: string | null
  cameraControlNo: string | null
  photoIdNo: string | null
}

/** To the ISM Admins when an Internal request comes in — they are the ones who decide it. */
export function buildPhotoRequestAdminEmail(data: PhotoRequestSummary & { reviewUrl: string; pendingCount: number }): { subject: string; html: string } {
  const e = escapeHtml
  const body = `
    <tr><td style="padding:28px 32px 6px;">
      <p style="margin:0 0 12px;font-size:14px;color:${TEXT};line-height:1.7;">Yth. Admin ISM,</p>
      <p style="margin:0 0 18px;font-size:13.5px;color:${TEXT};line-height:1.75;">Ada <strong>pengajuan ijin pengambilan foto/video Internal</strong> baru yang menunggu keputusan Anda:</p>
    </td></tr>
    <tr><td style="padding:0 32px;">${photoDetailRows([
      ['Nama', `${e(data.requesterName)}${data.nik ? `<br><span style="font-weight:normal;color:${MUTED};font-size:12px;">NIK ${e(data.nik)}</span>` : ''}`],
      ['Dept./Seksi', e(data.deptOrCompany)],
      ['Waktu', `${fmtDateTime(data.fromAt)} &ndash;<br>${fmtDateTime(data.toAt)}`],
      ['Lokasi', e(data.location)],
      ['Tujuan', e(data.objective)],
      ['Kamera / ID', `${e(data.cameraControlNo ?? '-')} &middot; ${e(data.photoIdNo ?? '-')}`],
      ['PIC Approve', e(data.picApprove ?? '-')],
    ])}</td></tr>
    <tr><td align="center" style="padding:24px 32px 6px;">${photoButton(data.reviewUrl, '&#9654;&nbsp; Tinjau Pengajuan')}</td></tr>
    <tr><td style="padding:10px 32px 26px;"><p style="margin:0;font-size:11.5px;color:${MUTED};text-align:center;line-height:1.6;">${data.pendingCount > 1 ? `Saat ini ada <strong>${data.pendingCount} pengajuan Internal</strong> yang menunggu keputusan. ` : ''}Pemohon menerima kabar setelah Anda memutuskan (bila ia mengisi email).</p></td></tr>`
  return {
    subject: `[Perlu keputusan] Ijin Foto/Video Internal — ${data.requesterName} (${data.deptOrCompany})`,
    html: photoEmailFrame({ title: 'Pengajuan Foto/Video Baru', subtitle: 'Internal &middot; menunggu keputusan Admin ISM', preheader: `${data.requesterName} mengajukan ijin foto/video di ${data.location}.` }, body),
  }
}

export type PhotoPendingItem = { requesterName: string; deptOrCompany: string; location: string; fromAt: string; submittedAt: string; lapsed: boolean }

/** Daily nudge while Internal requests stay undecided (lib/photo-notify.ts, run by lib/jobs.ts). */
export function buildPhotoPendingDigestEmail(data: { items: PhotoPendingItem[]; reviewUrl: string }): { subject: string; html: string } {
  const e = escapeHtml
  const rows = data.items.map((item) => `
    <tr>
      <td style="padding:10px 12px;border-top:1px solid ${BORDER};vertical-align:top;">
        <span style="font-size:13.5px;font-weight:bold;color:${TEXT};">${e(item.requesterName)}</span><br>
        <span style="font-size:12px;color:${MUTED};">${e(item.deptOrCompany)} &middot; ${e(item.location)}</span>
      </td>
      <td style="padding:10px 12px;border-top:1px solid ${BORDER};vertical-align:top;text-align:right;font-size:11.5px;white-space:nowrap;color:${item.lapsed ? RED : MUTED};font-weight:${item.lapsed ? 'bold' : 'normal'};">
        ${item.lapsed ? 'Periode terlewat' : `Mulai ${fmtDate(item.fromAt)}`}<br><span style="color:${MUTED};font-weight:normal;">diajukan ${fmtDate(item.submittedAt)}</span>
      </td>
    </tr>`).join('')
  const lapsed = data.items.filter((item) => item.lapsed).length
  const body = `
    <tr><td style="padding:26px 32px 14px;font-size:13.5px;color:${TEXT};line-height:1.75;">
      Ada <strong>${data.items.length} pengajuan ijin foto/video Internal</strong> yang belum diputuskan${lapsed ? `, <strong style="color:${RED};">${lapsed} di antaranya periodenya sudah lewat</strong>` : ''}. Pemohon belum bisa memakai kamera sebelum ada keputusan.
    </td></tr>
    <tr><td style="padding:0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:12px;border-collapse:separate;">${rows}</table></td></tr>
    <tr><td align="center" style="padding:24px 32px 28px;">${photoButton(data.reviewUrl, 'Buka Permintaan Foto/Video')}</td></tr>`
  return {
    subject: `[Pengingat] ${data.items.length} pengajuan foto/video Internal menunggu keputusan`,
    html: photoEmailFrame({ title: 'Pengajuan Menunggu Keputusan', subtitle: 'Pengingat harian &middot; Admin ISM', preheader: `${data.items.length} pengajuan foto/video Internal belum diputuskan.` }, body),
  }
}

/** To the requester (when they left an e-mail address) once their request is decided. */
export function buildPhotoResultEmail(data: {
  requesterName: string
  approved: boolean
  location: string
  fromAt: string
  toAt: string
  decidedBy: string | null
  note: string | null
  referenceCode: string
  statusUrl: string
  pdfUrl: string | null
  visitor: boolean
}): { subject: string; html: string } {
  const e = escapeHtml
  const en = data.visitor
  const verdict = data.approved ? (en ? 'APPROVED' : 'DISETUJUI') : (en ? 'REJECTED' : 'DITOLAK')
  const color = data.approved ? GREEN : RED
  const rows: [string, string][] = [
    [en ? 'Period' : 'Waktu', `${fmtDateTime(data.fromAt)} &ndash;<br>${fmtDateTime(data.toAt)}`],
    [en ? 'Location' : 'Lokasi', e(data.location)],
    [en ? 'Decided by' : 'Diputuskan oleh', e(data.decidedBy ?? '-')],
  ]
  if (data.note) rows.push([en ? 'Note' : 'Catatan', `<span style="font-weight:normal;font-style:italic;">&ldquo;${e(data.note)}&rdquo;</span>`])
  rows.push([en ? 'Reference code' : 'Kode referensi', `<span style="font-family:'Courier New',Courier,monospace;">${e(data.referenceCode)}</span>`])
  const body = `
    <tr><td style="padding:28px 32px 4px;">
      <p style="margin:0 0 12px;font-size:14px;color:${TEXT};line-height:1.7;">${en ? 'Dear' : 'Yth.'} <strong>${e(data.requesterName)}</strong>,</p>
      <p style="margin:0 0 18px;font-size:13.5px;color:${TEXT};line-height:1.75;">${en
        ? `Your photo/video recording request at <strong>${e(data.location)}</strong> has been processed:`
        : `Pengajuan ijin pengambilan foto/video Anda di <strong>${e(data.location)}</strong> sudah diproses:`}</p>
    </td></tr>
    <tr><td align="center" style="padding:0 32px 18px;">
      <span style="display:inline-block;padding:10px 26px;border-radius:999px;background:${color};color:#ffffff;font-size:15px;font-weight:bold;letter-spacing:0.12em;">${data.approved ? '&#10003;' : '&#10007;'}&nbsp; ${verdict}</span>
    </td></tr>
    <tr><td style="padding:0 32px;">${photoDetailRows(rows)}</td></tr>
    <tr><td align="center" style="padding:24px 32px 4px;">
      ${data.pdfUrl ? `${photoButton(data.pdfUrl, en ? 'Download permit (PDF)' : 'Unduh surat izin (PDF)', GREEN)}&nbsp;&nbsp;` : ''}${photoButton(data.statusUrl, en ? 'View status' : 'Lihat status')}
    </td></tr>
    <tr><td style="padding:14px 32px 26px;"><p style="margin:0;font-size:11.5px;color:${MUTED};text-align:center;line-height:1.6;">${data.approved
      ? (en ? 'Please follow the security rules of the area while recording.' : 'Mohon tetap mematuhi aturan keamanan area selama pengambilan foto/video.')
      : (en ? 'You may submit a new request after addressing the note above.' : 'Anda dapat mengajukan ulang setelah menyesuaikan catatan di atas.')}</p></td></tr>`
  return {
    subject: en
      ? `Photo/video request ${data.approved ? 'approved' : 'rejected'} — ${data.location}`
      : `Ijin foto/video ${data.approved ? 'DISETUJUI' : 'DITOLAK'} — ${data.location}`,
    html: photoEmailFrame({
      title: en ? 'Your Request Has Been Processed' : 'Hasil Pengajuan Foto/Video',
      subtitle: en ? `Reference ${e(data.referenceCode)}` : `Kode referensi ${e(data.referenceCode)}`,
      preheader: en ? `Your request was ${data.approved ? 'approved' : 'rejected'}.` : `Pengajuan Anda ${data.approved ? 'disetujui' : 'ditolak'}.`,
      ribbon: color,
    }, body),
  }
}
