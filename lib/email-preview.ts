// lib/email-preview.ts
//
// Sample renderings of every e-mail the portal sends, for the "Pratinjau
// Email" page in Admin Settings — built by the very same template functions
// as the real ones, from made-up data, so what is shown is what goes out.
// Nothing is sent and nothing is read from the database.

import 'server-only'
import { API_BASE_PATH } from '@/lib/config'
import { DOC_KIND_INFO, type DocKind } from '@/lib/document-kinds'
import {
  LOGO_CID,
  buildProcedureApprovalEmail,
  buildProcedureResultEmail,
  buildReviewDigestEmail,
  buildPhotoPendingDigestEmail,
  buildPhotoRequestAdminEmail,
  buildPhotoResultEmail,
  buildSpecialAreaApprovalEmail,
  buildVisitorApprovalEmail,
  type ProcedureChainStep,
} from '@/lib/email-templates'

export type EmailPreviewItem = { id: string; group: string; label: string; to: string }

const KIND_SAMPLE: Record<DocKind, { controlNo: string; title: string; roles: [string, string, string] }> = {
  procedure: { controlNo: 'P14-001', title: 'Prosedur Pengendalian Dokumen', roles: ['System Security Administrator', 'Information Assets Administrator', 'Penanggung Jawab Umum'] },
  working_standard: { controlNo: 'ISMS-OS-010-001', title: 'Standard Mengganti Password pada Windows 11', roles: ['Prepared', 'Checked', 'Approved 1'] },
  review_form: { controlNo: '002/ISMS/10/2026', title: 'Form Review — ISMS-B-005 ISMS Division Profile', roles: ['Prepared', 'Checked (SSA)', 'Approval (IAA)'] },
  tmmin_standard: { controlNo: 'TMMIN-SR-001', title: 'Standard Requirement Keamanan Informasi TMMIN', roles: ['Prepared', 'Checked', 'Approved'] },
}
const PEOPLE = ['Isra Ramadhan', 'Naufal Aqil', 'Teguh Sunjoyo']

const DOC_VARIANTS = [
  ['request', 'Pengajuan approval', 'Approver'],
  ['resubmit', 'Pengajuan ulang setelah revisi', 'Approver'],
  ['reminder', 'Pengingat', 'Approver'],
  ['approved', 'Notifikasi: dokumen disahkan', 'Admin ISM'],
  ['revision', 'Notifikasi: perlu revisi', 'Admin ISM'],
] as const

export const EMAIL_PREVIEWS: EmailPreviewItem[] = [
  ...(Object.keys(DOC_KIND_INFO) as DocKind[]).flatMap((kind) =>
    DOC_VARIANTS.map(([variant, label, to]) => ({ id: `${kind}:${variant}`, group: DOC_KIND_INFO[kind].label, label, to }))),
  { id: 'photo:request', group: 'Izin Foto/Video', label: 'Permintaan persetujuan (Visitor)', to: 'PIC Approver' },
  { id: 'photo:admin', group: 'Izin Foto/Video', label: 'Pengajuan Internal baru', to: 'Admin ISM' },
  { id: 'photo:digest', group: 'Izin Foto/Video', label: 'Pengingat harian: pengajuan belum diputuskan', to: 'Admin ISM' },
  { id: 'photo:result', group: 'Izin Foto/Video', label: 'Hasil keputusan (disetujui)', to: 'Pemohon' },
  { id: 'photo:result-rejected', group: 'Izin Foto/Video', label: 'Hasil keputusan (ditolak)', to: 'Pemohon' },
  { id: 'special:request', group: 'Izin Area Special', label: 'Permintaan persetujuan', to: 'Approver' },
  { id: 'review:digest', group: 'Review Dokumen', label: 'Pengingat mingguan review dokumen', to: 'Admin ISM' },
]

function documentEmail(kind: DocKind, variant: string, base: string) {
  const info = DOC_KIND_INFO[kind]
  const sample = KIND_SAMPLE[kind]
  const now = Date.now()
  const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString()
  const chain: ProcedureChainStep[] = sample.roles.map((roleTitle, i) => ({
    roleTitle, name: PEOPLE[i], state: i === 0 ? 'done' : i === 1 ? 'current' : 'waiting', decidedAt: i === 0 ? iso(1) : null,
  }))
  const request = { by: PEOPLE[1], roleTitle: sample.roles[1], at: iso(2), general: 'Mohon sesuaikan nama PIC dengan struktur organisasi terbaru.' }

  if (variant === 'approved' || variant === 'revision') {
    const rejected = variant === 'revision'
    return buildProcedureResultEmail({
      outcome: rejected ? 'rejected' : 'approved',
      controlNo: sample.controlNo, title: sample.title, revision: 2, effDate: iso(0).slice(0, 10), docNote: null,
      steps: sample.roles.map((roleTitle, i) => ({
        step: i + 1, roleCode: `R${i + 1}`, roleTitle, name: PEOPLE[i],
        status: !rejected ? 'approved' : i === 0 ? 'approved' : i === 1 ? 'rejected' : 'cancelled',
        decidedAt: rejected && i === 2 ? null : iso(2 - i),
      })),
      revisionRequest: rejected ? { ...request, pins: [{ page: 0, note: 'Ganti dengan: 12 digit', x2: 0.5 }, { page: 1, note: 'Tambahkan nomor revisi di sini' }] } : null,
      placements: rejected ? undefined : { placed: 3, total: 3 },
      registerUrl: `${base}${info.path}?q=${encodeURIComponent(sample.controlNo)}`,
      kind: info,
    })
  }
  return buildProcedureApprovalEmail({
    approverName: PEOPLE[1], roleTitle: sample.roles[1], controlNo: sample.controlNo, title: sample.title,
    revision: 2, effDate: iso(0).slice(0, 10), note: null, stepNumber: 2, stepTotal: 3, chain,
    reviewUrl: `${base}/pengesahan?token=contoh`,
    kind: info,
    resubmission: variant === 'resubmit'
      ? { round: 2, by: request.by, at: request.at, general: request.general, pins: [{ page: 0, note: 'Ganti dengan: 12 digit', strike: true }, { page: 1, note: 'Tambahkan nomor revisi di sini', strike: false }], fileChanged: true }
      : null,
    reminder: variant === 'reminder' ? { count: 1, waitingDays: 3 } : null,
    reviewForm: kind === 'review_form'
      ? { formNo: sample.controlNo, docControlNo: 'ISMS-B-005', docTitle: 'ISMS Division Profile or Company Profile', oldRevision: 'Revisi 6', reasons: ['Review berkala Oktober 2026', 'Perubahan standards: ISO/IEC 27001:2022'], result: 'Tidak relevan dan perlu revisi', detailRevisi: 'Penyesuaian struktur organisasi dan alur persetujuan dokumen melalui Portal ISMS.' }
      : null,
  })
}

/** The sample e-mail `id` (null when unknown). `origin` = how the admin reaches the portal, for the links. */
export function renderEmailPreview(id: string, origin: string): { subject: string; html: string } | null {
  if (!EMAIL_PREVIEWS.some((item) => item.id === id)) return null
  const base = `${origin}${API_BASE_PATH}`
  const [group, variant] = id.split(':')
  const now = Date.now()
  const at = (hours: number) => new Date(now + hours * 3_600_000).toISOString()

  let mail: { subject: string; html: string }
  if (group === 'photo' && variant === 'admin') {
    mail = buildPhotoRequestAdminEmail({
      requesterName: 'Naufal Aqil', nik: '12345', deptOrCompany: 'PGA - GAGS', location: 'Genba A', objective: 'Dokumentasi kegiatan 5S',
      fromAt: at(2), toAt: at(4), picApprove: 'Teguh Sunjoyo', cameraControlNo: 'CAM-PGA-01', photoIdNo: 'PH-07',
      reviewUrl: `${base}/kelola-permintaan-foto-video?status=pending&type=internal`, pendingCount: 2,
    })
  } else if (group === 'photo' && variant === 'digest') {
    mail = buildPhotoPendingDigestEmail({
      items: [
        { requesterName: 'Naufal Aqil', deptOrCompany: 'PGA - GAGS', location: 'Genba A', fromAt: at(-30), submittedAt: at(-50), lapsed: true },
        { requesterName: 'Isra Ramadhan', deptOrCompany: 'PGA - IT', location: 'Server Room', fromAt: at(20), submittedAt: at(-6), lapsed: false },
      ],
      reviewUrl: `${base}/kelola-permintaan-foto-video?status=pending&type=internal`,
    })
  } else if (group === 'photo' && variant.startsWith('result')) {
    const rejected = variant === 'result-rejected'
    mail = buildPhotoResultEmail({
      requesterName: rejected ? 'Fadil' : 'Naufal Aqil', approved: !rejected, location: 'Genba A', fromAt: at(2), toAt: at(4),
      decidedBy: 'admin_ism', note: rejected ? 'Area sedang audit pelanggan, ajukan ulang minggu depan.' : null,
      referenceCode: '42-A1B2C3D4E5', statusUrl: `${base}/ijin-foto-video?type=internal&ref=42-A1B2C3D4E5`,
      // Only Internal requesters can leave an address, so the mail is always the Indonesian one.
      pdfUrl: null, visitor: false,
    })
  } else if (group === 'photo') {
    mail = buildVisitorApprovalEmail({
      approverName: 'Teguh Sunjoyo', requesterName: 'Fadil', deptOrCompany: 'PEMI', dept: 'PGA', fromAt: at(1), toAt: at(2),
      location: 'Genba A', objective: 'Dokumentasi laporan', picJai: 'Naufal Aqil',
      approveUrl: `${base}/verifikasi/contoh?action=approve`, rejectUrl: `${base}/verifikasi/contoh?action=reject`,
    })
  } else if (group === 'special') {
    mail = buildSpecialAreaApprovalEmail({
      approverName: 'Teguh Sunjoyo', requesterName: 'Fadil', orgCompany: 'PT. Contoh Vendor', department: 'Maintenance', fromAt: at(1), toAt: at(4),
      area: 'Server Room', purpose: 'Pemeliharaan rutin perangkat jaringan', idCardNo: '3578************',
      approveUrl: `${base}/persetujuan-area-special?token=contoh&action=approve`, rejectUrl: `${base}/persetujuan-area-special?token=contoh&action=reject`,
    })
  } else if (group === 'review') {
    const item = (kindLabel: string, controlNo: string, title: string, days: number) => ({
      kindLabel, controlNo, title, revision: 2,
      effDate: new Date(now - 365 * 86_400_000).toISOString().slice(0, 10),
      dueDate: new Date(now + days * 86_400_000).toISOString().slice(0, 10),
      overdueDays: days < 0 ? -days : 0, daysLeft: days,
      href: `${base}/prosedur-isms?q=${encodeURIComponent(controlNo)}`,
    })
    mail = buildReviewDigestEmail({
      months: 12,
      overdue: [item('Prosedur ISMS', 'P14-001', 'Prosedur Pengendalian Dokumen', -12)] as never,
      soon: [item('Working Standard', 'ISMS-OS-010-001', 'Standard Mengganti Password pada Windows 11', 9)] as never,
      dashboardUrl: `${base}/dashboard-admin`,
    })
  } else {
    mail = documentEmail(group as DocKind, variant, base)
  }
  // The logo travels as an attachment (cid:) in a real e-mail; here it is the portal's own file.
  return { subject: mail.subject, html: mail.html.split(`cid:${LOGO_CID}`).join(`${API_BASE_PATH}/images/yazaki-logo.jpg`) }
}
