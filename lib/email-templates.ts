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
const MEMO_PAPER = '#f3efe6'
const MEMO_LINE = '#e2dccd'
const MEMO_INK = '#1d2a36'
const MEMO_SEAL = '#a8741a'
const MEMO_SEAL_TINT = '#fbf3e2'

function procedureEmailFrame(opts: { kicker: string; heading: string; subheading: string; controlNo: string; revision: number | null; seal: string; sealColor?: string; preheader?: string; tabTitle?: string; tabSub?: string }, body: string) {
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
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:${MUTED};text-align:center;line-height:1.6;">Pengesahan Prosedur ISMS &middot; dikirim otomatis oleh <strong style="color:${MEMO_INK};">Portal ISMS</strong> &middot; PT. Jatim Autocomp Indonesia</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// Ruled "form" rows, like the fields of a paper document.
function detailTable(rows: [string, string][]) {
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

// The signing chain drawn as a row of stamps: ✓ signed, current (you), queued.
function chainRow(chain: ProcedureChainStep[]) {
  const width = Math.floor(100 / Math.max(chain.length, 1))
  const cells = chain.map((step, i) => {
    const circle =
      step.state === 'done'
        ? `background:${GREEN};color:#ffffff;border:2px solid ${GREEN};`
        : step.state === 'current'
          ? `background:${NAVY};color:#ffffff;border:2px solid ${NAVY};`
          : `background:#ffffff;color:${MUTED};border:2px dashed ${MEMO_LINE};`
    const mark = step.state === 'done' ? '&#10003;' : String(i + 1)
    const status =
      step.state === 'done'
        ? `<span style="color:${GREEN};">Disetujui ${fmtDate(step.decidedAt)}</span>`
        : step.state === 'current'
          ? `<span style="color:${NAVY};font-weight:bold;">&#9679; Giliran Anda</span>`
          : `<span style="color:${MUTED};">Menunggu</span>`
    return `
      <td align="center" valign="top" width="${width}%" style="padding:0 4px;">
        <div style="width:34px;height:34px;line-height:34px;border-radius:50%;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-align:center;${circle}">${mark}</div>
        <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:${MEMO_INK};line-height:1.3;">${escapeHtml(step.name)}</p>
        <p style="margin:2px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:${MUTED};line-height:1.35;">${escapeHtml(step.roleTitle)}</p>
        <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;line-height:1.35;">${status}</p>
      </td>`
  }).join('')
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${MEMO_PAPER};border:1px solid ${MEMO_LINE};border-radius:6px;">
      <tr><td style="padding:14px 16px 4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;color:${MUTED};letter-spacing:0.14em;text-transform:uppercase;">Alur Pengesahan</td></tr>
      <tr><td style="padding:10px 8px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table></td></tr>
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
  const para = `margin:0 0 14px;font-size:14.5px;color:${MEMO_INK};line-height:1.75;`

  // Wording as requested by the ISMS team; the detail rows, the signing
  // chain and the button stay, since the approval itself happens via that link.
  const body = `
    <tr>
      <td style="padding:20px 32px 6px;">
        <p style="margin:0 0 14px;font-size:15px;color:${MEMO_INK};line-height:1.7;">Yth. Bapak/Ibu <strong>${escapeHtml(data.approverName)}</strong>,</p>
        <p style="${para}">Mohon bantuan Bapak/Ibu untuk melakukan review dan approval atas dokumen prosedur <strong>${title}</strong> yang telah saya lampirkan pada email ini.</p>
        <p style="${para}">Apabila terdapat hal yang perlu disesuaikan atau diperbaiki, mohon arahan lebih lanjut agar dapat segera saya tindak lanjuti.</p>
        <p style="margin:0 0 20px;font-size:14.5px;color:${MEMO_INK};line-height:1.75;">Terima kasih atas perhatian dan kerja samanya.</p>
      </td>
    </tr>
    <tr><td style="padding:0 32px 22px;">${detailTable(rows)}</td></tr>
    <tr><td style="padding:0 32px;">${chainRow(data.chain)}</td></tr>
    <tr>
      <td align="center" style="padding:26px 32px 6px;">
        <a href="${data.reviewUrl}" style="display:inline-block;min-width:240px;text-align:center;padding:15px 30px;background:${NAVY};color:#ffffff;border-radius:4px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:14px;letter-spacing:0.04em;border-bottom:3px solid ${MEMO_SEAL};">&#9998;&nbsp; REVIEW &amp; APPROVAL</a>
        <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11.5px;color:${MUTED};">Buka dokumen, lalu pilih <strong>Setujui</strong> atau <strong>Tolak</strong> &mdash; tanpa perlu login.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 32px 24px;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:${MUTED};text-align:center;line-height:1.6;">Link ini khusus untuk Bapak/Ibu dan hanya berlaku untuk tahap ini. Mohon tidak meneruskan email ini.</p>
      </td>
    </tr>`

  return {
    subject: `Pengajuan Approval Prosedur ${data.title}`,
    html: procedureEmailFrame({
      kicker: 'Pengesahan Dokumen &middot; Prosedur ISMS',
      heading: 'Pengajuan Approval Prosedur',
      subheading: `Tahap ${data.stepNumber} dari ${data.stepTotal} &middot; ${escapeHtml(data.roleTitle)}`,
      controlNo: data.controlNo,
      revision: data.revision,
      seal: 'Menunggu<br>Pengesahan<br>Anda',
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
  revisionRequest?: { by: string; roleTitle: string; at: string; general: string | null; pins: { page: number; note: string }[] } | null
  // outcome 'approved': how many approvers' QR land on the document itself
  placements?: { placed: number; total: number }
  registerUrl: string
  signedPdfUrl?: string
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
       <p style="margin:6px 0 0;font-family:${SANS};font-size:13px;color:${TEXT};line-height:1.6;">Tanda tangan terakhir ${lastDecision ? `pada <strong>${escapeHtml(fmtStamp(lastDecision))}</strong>` : ''}. Dokumen kini berstatus <strong>Disahkan</strong> di register Prosedur ISMS.</p>`
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
            <span style="display:inline-block;padding:1px 7px;border-radius:3px;background:#f6e4de;font-family:${SANS};font-size:10.5px;font-weight:bold;color:${REV_RED};">Halaman ${pin.page + 1}</span>
            <p style="margin:4px 0 0;font-family:${SANS};font-size:13.5px;color:${MEMO_INK};line-height:1.55;">${escapeHtml(pin.note)}</p>
          </td>
        </tr>`).join('')}
      </table>
      <p style="margin:8px 0 0;font-family:${SANS};font-size:11.5px;color:${MUTED};">Nomor di atas sama dengan penanda merah pada halaman dokumen &mdash; buka <em>Lihat catatan di dokumen</em> di register untuk melihat letaknya.</p>` : ''}
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
        'Dokumen otomatis tampil sebagai <strong>Disahkan</strong> di register Prosedur ISMS.',
      ]
    : [
        'Buka dokumen di register Prosedur ISMS, lalu klik <strong>Lihat catatan di dokumen</strong> untuk melihat letak setiap catatan.',
        'Perbaiki dokumen sesuai catatan di atas.',
        'Klik <strong>Edit</strong> pada dokumen dan unggah file perbaikan (naikkan nomor revisi bila perlu). Pengesahan otomatis dimulai ulang dari tahap 1.',
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
    html: procedureEmailFrame({
      kicker: 'Notifikasi Admin &middot; Pengesahan Prosedur ISMS',
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
