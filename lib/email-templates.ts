// lib/email-templates.ts
//
// HTML email templates. Built as nested tables with inline styles only —
// no <style> blocks, flexbox, or grid — because that's what actually
// renders consistently across Gmail, Outlook, and mobile mail clients;
// anything fancier tends to silently degrade in one of them.

import 'server-only'

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
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })
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
