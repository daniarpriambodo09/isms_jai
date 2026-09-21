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
  approveUrl: string
  rejectUrl: string
}

function fmtDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })
}

const NAVY = '#12283a'
const NAVY_SOFT = '#1a3a52'
const TEAL = '#278e84'
const RED = '#c7161e'
const GREEN = '#1a6e3a'
const TEXT = '#22303c'
const MUTED = '#5b6b76'
const BORDER = '#e2e8ec'

export function buildVisitorApprovalEmail(data: VisitorApprovalEmailData): { subject: string; html: string } {
  const period = `${fmtDateTime(data.fromAt)} &ndash; ${fmtDateTime(data.toAt)}`

  const row = (no: number, label: string, value: string, zebra: boolean) => `
    <tr>
      <td style="padding:11px 16px;background:${zebra ? '#f6f9fa' : '#ffffff'};border-bottom:1px solid ${BORDER};font-size:13px;color:${MUTED};width:34px;vertical-align:top;">${no}.</td>
      <td style="padding:11px 8px 11px 0;background:${zebra ? '#f6f9fa' : '#ffffff'};border-bottom:1px solid ${BORDER};font-size:13px;color:${MUTED};width:150px;vertical-align:top;white-space:nowrap;">${label}</td>
      <td style="padding:11px 16px 11px 0;background:${zebra ? '#f6f9fa' : '#ffffff'};border-bottom:1px solid ${BORDER};font-size:13.5px;color:${TEXT};font-weight:600;vertical-align:top;">${value}</td>
    </tr>`

  const rowsHtml = [
    row(1, 'Nama', data.requesterName, false),
    row(2, 'Company / Organization', data.deptOrCompany, true),
    row(3, 'Departement', data.dept ?? '-', false),
    row(4, 'Waktu', period, true),
    row(5, 'Lokasi', data.location, false),
    row(6, 'Tujuan', data.objective, true),
    row(7, 'PIC JAI', data.approverName, false),
  ].join('')

  const html = `
<!doctype html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef2f4;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f4;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(18,40,58,0.12);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, ${NAVY} 0%, ${NAVY_SOFT} 45%, ${TEAL} 100%);background-color:${NAVY};padding:26px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="display:inline-block;background:#ffffff;color:${RED};font-weight:bold;font-size:15px;letter-spacing:0.02em;padding:5px 10px;border-radius:6px;">YAZAKI</span>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;opacity:0.85;">Portal ISMS</span>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;color:#ffffff;font-size:19px;font-weight:bold;line-height:1.3;">Permohonan Ijin Pengambilan Foto/Video</p>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:12px;">PT. Jatim Autocomp Indonesia &middot; Menunggu persetujuan Anda</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 14px;font-size:14px;color:${TEXT};line-height:1.7;">Yth. Bapak/Ibu <strong>${data.approverName}</strong>,</p>
              <p style="margin:0 0 14px;font-size:13.5px;color:${TEXT};line-height:1.75;">Semoga Bapak/Ibu selalu dalam keadaan sehat dan sukses dalam menjalankan aktivitas.</p>
              <p style="margin:0 0 18px;font-size:13.5px;color:${TEXT};line-height:1.75;">Sehubungan dengan rencana pelaksanaan kegiatan <strong>${data.objective}</strong>, bersama email ini kami bermaksud untuk mengajukan permohonan izin pengambilan foto dan dokumentasi video di area <strong>${data.location}</strong>.</p>
              <p style="margin:0 0 10px;font-size:13.5px;color:${TEXT};line-height:1.75;">Adapun rincian pelaksanaan pengambilan foto dan video adalah sebagai berikut:</p>
            </td>
          </tr>

          <!-- Detail table -->
          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
                ${rowsHtml}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 4px;">
              <p style="margin:0 0 14px;font-size:13.5px;color:${TEXT};line-height:1.75;">Kami memastikan bahwa seluruh proses dokumentasi akan tetap mematuhi seluruh protokol keselamatan kerja (K3) serta aturan standar keamanan/kerahasiaan area kerja yang berlaku di lingkungan perusahaan.</p>
              <p style="margin:0;font-size:13.5px;color:${TEXT};line-height:1.75;">Demikian permohonan izin ini kami sampaikan. Atas perhatian dan arahan Bapak/Ibu <strong>${data.approverName}</strong>, kami ucapkan terima kasih.</p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:26px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:12.5px;color:${MUTED};padding-bottom:12px;">Klik salah satu tombol di bawah untuk memproses langsung &mdash; tanpa perlu login:</td>
                </tr>
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:10px;">
                          <a href="${data.approveUrl}" style="display:inline-block;min-width:150px;text-align:center;padding:13px 26px;background:${GREEN};color:#ffffff;border-radius:999px;text-decoration:none;font-weight:bold;font-size:14px;">&#10003;&nbsp; Setujui</a>
                        </td>
                        <td>
                          <a href="${data.rejectUrl}" style="display:inline-block;min-width:150px;text-align:center;padding:13px 26px;background:${RED};color:#ffffff;border-radius:999px;text-decoration:none;font-weight:bold;font-size:14px;">&#10007;&nbsp; Tolak</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:8px 32px 28px;">
              <p style="margin:0;font-size:11px;color:${MUTED};text-align:center;line-height:1.6;">Setelah diproses, sertifikat PDF ber-QR (bukti persetujuan digital) akan otomatis tersedia untuk diunduh.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f6f9fa;padding:18px 32px;border-top:1px solid ${BORDER};">
              <p style="margin:0;font-size:11px;color:${MUTED};text-align:center;">Email ini dikirim otomatis oleh <strong>Portal ISMS</strong> &middot; PT. Jatim Autocomp Indonesia</p>
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
