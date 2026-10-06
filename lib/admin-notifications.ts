// lib/admin-notifications.ts
//
// Everything the ISM Admin bell shows, in one place, split in two:
// - "Perlu tindakan": live states that need someone to decide or fix
//   something — they disappear on their own once handled (a pending request
//   is decided, a failed e-mail is re-sent, an e-mail address is filled in…).
// - "Info": things that happened and only need to be seen — documents that
//   were approved, photos that were taken, decisions an approver made by
//   e-mail, … — each one dismissible ("OK"), or all at once.
// Every event is also written to admin_notifications (migration 0014), which
// is the "Riwayat Notifikasi" page; events that already show live in the bell
// are written as seen, so they are history only and never count twice.

import 'server-only'
import { query } from '@/lib/db'
import { isDeliverableEmail } from '@/lib/email-address'
import { docKindInfo, type DocKind } from '@/lib/document-kinds'
import { listReviewItems } from '@/lib/document-review'
import { listPendingSteps, listProcedureNotices, dismissProcedureNotice, REMINDER_MAX } from '@/lib/procedure-approval'

export type NoticeCategory = 'photo' | 'special' | 'esign' | 'guest' | 'review'
export type NoticeTone = 'red' | 'amber' | 'green' | 'blue' | 'neutral'
export type DismissRef = { type: 'procedure' | 'taken' | 'log'; id: number }

export type BellItem = {
  key: string
  group: 'action' | 'info'
  category: NoticeCategory
  tone: NoticeTone
  /** Small caption above the title, e.g. "Izin foto/video · Internal". */
  label: string
  title: string
  detail?: string | null
  /** A quoted line (a reviewer's note, the e-mail error, …). */
  note?: string | null
  href: string
  at: string
  dismiss?: DismissRef
}

export const CATEGORY_LABEL: Record<NoticeCategory, string> = {
  photo: 'Izin Foto/Video',
  special: 'Izin Area Special',
  esign: 'Pengesahan Dokumen',
  guest: 'Pendaftaran Tamu',
  review: 'Review Dokumen',
}

// ─── the event log ───

/**
 * Writes an event to the log. `historyOnly` = it is already shown live in the
 * bell (as an action item or its own notice), so it is stored as seen and only
 * appears on the history page. Never throws — a notification must not break
 * the action that caused it.
 */
export async function recordNotification(event: {
  kind: string
  category: NoticeCategory
  title: string
  body?: string | null
  href?: string | null
  historyOnly?: boolean
}) {
  try {
    await query(
      `INSERT INTO admin_notifications (kind, category, title, body, href, seen_at)
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::boolean THEN now() ELSE NULL END)`,
      [event.kind, event.category, event.title.slice(0, 255), event.body ?? null, event.href ?? null, event.historyOnly === true]
    )
  } catch (error) {
    console.error('[admin-notifications/record]', (error as Error).message)
  }
}

export type HistoryEntry = { id: number; kind: string; category: NoticeCategory; title: string; body: string | null; href: string | null; createdAt: string; seenAt: string | null }

export const HISTORY_DAYS = 90

export async function listHistory(options: { category?: NoticeCategory | null; days?: number } = {}): Promise<HistoryEntry[]> {
  const days = options.days ?? HISTORY_DAYS
  const values: unknown[] = [days]
  let where = `created_at > now() - make_interval(days => $1)`
  if (options.category) { values.push(options.category); where += ` AND category = $${values.length}` }
  const rows = (await query<{ id: number; kind: string; category: NoticeCategory; title: string; body: string | null; href: string | null; created_at: string; seen_at: string | null }>(
    `SELECT id, kind, category, title, body, href, created_at, seen_at FROM admin_notifications WHERE ${where} ORDER BY created_at DESC LIMIT 500`,
    values
  )).rows
  return rows.map((r) => ({ id: r.id, kind: r.kind, category: r.category, title: r.title, body: r.body, href: r.href, createdAt: r.created_at, seenAt: r.seen_at }))
}

// ─── the bell ───

const HOUR = 3_600_000
const hoursSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / HOUR)
const waited = (iso: string) => {
  const h = hoursSince(iso)
  return h < 24 ? `${Math.max(h, 1)} jam` : `${Math.floor(h / 24)} hari`
}
const fmtPeriod = (from: string, to: string) => {
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
  return `${new Date(from).toLocaleString('id-ID', opts)} – ${new Date(to).toLocaleString('id-ID', opts)}`
}
// A request the approver hasn't touched for this long shows up as needing a nudge.
const STALE_HOURS = 24

async function safe<T>(label: string, task: () => Promise<T>, fallback: T): Promise<T> {
  try { return await task() } catch (error) { console.error(`[admin-notifications/${label}]`, (error as Error).message); return fallback }
}

async function photoItems(): Promise<BellItem[]> {
  const rows = (await query<{ id: number; request_type: 'internal' | 'visitor'; requester_name: string; dept_or_company: string; location: string; from_at: string; to_at: string; submitted_at: string; pic_name: string | null; pic_email: string | null }>(
    `SELECT r.id, r.request_type, r.requester_name, r.dept_or_company, r.location, r.from_at, r.to_at, r.submitted_at, pic.name AS pic_name, pic.email AS pic_email
     FROM photo_video_requests r LEFT JOIN pic_approvers pic ON pic.id = r.pic_approve_id
     WHERE r.status = 'pending' ORDER BY r.submitted_at DESC`
  )).rows
  const items: BellItem[] = []
  for (const r of rows) {
    const lapsed = new Date(r.to_at).getTime() < Date.now()
    if (r.request_type === 'internal') {
      items.push({
        key: `photo-${r.id}`, group: 'action', category: 'photo', tone: lapsed ? 'red' : 'amber',
        label: `Izin foto/video · Internal${lapsed ? ' · periode terlewat' : ''}`,
        title: r.requester_name, detail: `${r.dept_or_company} · ${r.location}`, note: `Menunggu keputusan Anda · ${fmtPeriod(r.from_at, r.to_at)}`,
        href: '/kelola-permintaan-foto-video?status=pending&type=internal', at: r.submitted_at,
      })
      continue
    }
    // Visitor: the PIC decides by e-mail — only worth the admin's attention when it stalls.
    const noEmail = !r.pic_email || !isDeliverableEmail(r.pic_email)
    if (!noEmail && !lapsed && hoursSince(r.submitted_at) < STALE_HOURS) continue
    items.push({
      key: `photo-${r.id}`, group: 'action', category: 'photo', tone: noEmail || lapsed ? 'red' : 'amber',
      label: noEmail ? 'Izin foto/video · Visitor · PIC tanpa email' : `Izin foto/video · Visitor · ${lapsed ? 'periode terlewat' : 'PIC belum memutuskan'}`,
      title: r.requester_name, detail: `${r.dept_or_company} · ${r.location}`,
      note: noEmail
        ? `PIC Approve ${r.pic_name ?? '-'} belum punya email — putuskan dari portal, atau isi emailnya di Kelola PIC Approve.`
        : `PIC ${r.pic_name ?? '-'} belum memutuskan sejak ${waited(r.submitted_at)} lalu — Anda bisa memutuskannya dari portal.`,
      href: '/kelola-permintaan-foto-video?status=pending&type=visitor', at: r.submitted_at,
    })
  }
  return items
}

async function specialAreaItems(): Promise<BellItem[]> {
  const rows = (await query<{ id: number; requester_name: string; org_company: string; area: string; submitted_at: string; approver_name: string | null; email_error: string | null; to_at: string }>(
    `SELECT id, requester_name, org_company, area, submitted_at, approver_name, email_error, to_at
     FROM special_area_requests WHERE status = 'pending' ORDER BY submitted_at DESC`
  )).rows
  return rows
    .filter((r) => r.email_error || hoursSince(r.submitted_at) >= STALE_HOURS || new Date(r.to_at).getTime() < Date.now())
    .map((r) => ({
      key: `special-${r.id}`, group: 'action' as const, category: 'special' as const, tone: (r.email_error ? 'red' : 'amber') as NoticeTone,
      label: r.email_error ? 'Izin Area Special · Email ke approver gagal' : 'Izin Area Special · Approver belum memutuskan',
      title: r.requester_name, detail: `${r.org_company} · ${r.area}`,
      note: r.email_error ?? `${r.approver_name ?? 'Approver'} belum memutuskan sejak ${waited(r.submitted_at)} lalu.`,
      href: '/kelola-izin-area-special', at: r.submitted_at,
    }))
}

async function esignItems(): Promise<BellItem[]> {
  const items: BellItem[] = []
  for (const s of await listPendingSteps()) {
    const kind = docKindInfo(s.kind as DocKind)
    const href = `${kind.path}?q=${encodeURIComponent(s.control_no)}`
    if (s.email_error) {
      items.push({
        key: `esign-mail-${s.id}`, group: 'action', category: 'esign', tone: 'red',
        label: `${kind.short} · Email ke approver gagal`, title: `${s.control_no} · ${s.title}`,
        detail: `${s.role_title} — ${s.approver_name ?? '-'}`, note: s.email_error, href, at: s.token_issued_at ?? new Date().toISOString(),
      })
    } else if (s.reminder_count >= REMINDER_MAX) {
      items.push({
        key: `esign-stuck-${s.id}`, group: 'action', category: 'esign', tone: 'amber',
        label: `${kind.short} · Approver belum tanda tangan`, title: `${s.control_no} · ${s.title}`,
        detail: `${s.role_title} — ${s.approver_name ?? '-'}`,
        note: `Sudah diingatkan ${s.reminder_count}× lewat email tanpa tanggapan — hubungi langsung, atau kirim ulang link dari menu Kelola.`,
        href, at: s.reminded_at ?? s.notified_at ?? new Date().toISOString(),
      })
    }
  }

  // Positions ticked by default whose e-mail is missing: a document using them can't be submitted.
  const roles = (await query<{ code: string; kind: DocKind; title: string; email: string | null }>(
    'SELECT code, kind, title, email FROM procedure_approver_roles WHERE is_default = true ORDER BY kind, sort_order'
  )).rows.filter((r) => !r.email || !isDeliverableEmail(r.email))
  if (roles.length) {
    const firstKind = roles[0].kind
    items.push({
      key: `esign-roles-${roles.map((r) => r.code).join('.')}`, group: 'action', category: 'esign', tone: 'amber',
      label: 'Approver Pengesahan · Email belum diisi', title: `${roles.length} jabatan approver belum punya email`,
      detail: roles.slice(0, 4).map((r) => `${docKindInfo(r.kind).short}: ${r.title}`).join(' · ') + (roles.length > 4 ? ` · +${roles.length - 4} lagi` : ''),
      note: 'Dokumen yang memakai jabatan ini tidak bisa diajukan untuk pengesahan.',
      href: `/kelola-pengesahan?kind=${firstKind}`, at: new Date().toISOString(),
    })
  }
  return items
}

async function documentNoticeItems(): Promise<BellItem[]> {
  return (await listProcedureNotices()).map((n): BellItem => {
    const kind = docKindInfo(n.docKind)
    const href = `${kind.path}?q=${encodeURIComponent(n.controlNo)}`
    if (n.kind === 'revision') {
      return {
        key: `doc-rev-${n.documentId}`, group: 'action', category: 'esign', tone: 'red',
        label: `${kind.short} · Perlu revisi`, title: `${n.controlNo} · ${n.title}`,
        detail: `${n.by ?? '-'} · ${n.noteCount} catatan${n.pinCount ? `, ${n.pinCount} ditandai di dokumen` : ''}`,
        note: n.firstNote ?? null, href, at: n.at, dismiss: { type: 'procedure', id: n.documentId },
      }
    }
    const missingQr = (n.placed ?? 0) < (n.total ?? 0)
    return {
      key: `doc-ok-${n.documentId}`, group: 'info', category: 'esign', tone: missingQr ? 'amber' : 'green',
      label: `${kind.short} · Disahkan`, title: `${n.controlNo} · ${n.title}`,
      detail: `Rev. ${n.revision} · disetujui ${n.total}/${n.total} approver${missingQr ? '' : ' · QR lengkap di dokumen'}`,
      note: missingQr ? `QR baru tercetak ${n.placed}/${n.total} — atur Posisi QR` : null,
      href, at: n.at, dismiss: { type: 'procedure', id: n.documentId },
    }
  })
}

async function guestItems(): Promise<BellItem[]> {
  const rows = (await query<{ id: number; full_name: string; company_remark: string; registered_at: string }>(
    `SELECT id, full_name, company_remark, registered_at FROM vendor_registrations WHERE stage = 'pending_approval' ORDER BY registered_at DESC`
  )).rows
  return rows.map((r) => ({
    key: `guest-${r.id}`, group: 'action' as const, category: 'guest' as const, tone: 'blue' as NoticeTone,
    label: 'Pendaftaran tamu · Menunggu approval Security', title: r.full_name, detail: r.company_remark,
    href: '/admin-pos-security', at: r.registered_at,
  }))
}

async function takenItems(): Promise<BellItem[]> {
  const rows = (await query<{ id: number; requester_name: string; location: string; taken_at: string; pic_name: string | null }>(
    `SELECT r.id, r.requester_name, r.location, r.taken_at, pic.name AS pic_name
     FROM photo_video_requests r LEFT JOIN pic_approvers pic ON pic.id = r.pic_approve_id
     WHERE r.taken_at IS NOT NULL AND r.taken_ack_at IS NULL ORDER BY r.taken_at DESC`
  )).rows
  return rows.map((r) => ({
    key: `taken-${r.id}`, group: 'info' as const, category: 'photo' as const, tone: 'neutral' as NoticeTone,
    label: 'Foto/video sudah diambil', title: r.requester_name, detail: `${r.location}${r.pic_name ? ` · PIC: ${r.pic_name}` : ''}`,
    href: '/kelola-permintaan-foto-video', at: r.taken_at, dismiss: { type: 'taken', id: r.id },
  }))
}

async function reviewItems(): Promise<BellItem[]> {
  const { overdue, soon } = await listReviewItems()
  const items: BellItem[] = []
  if (overdue.length) items.push({
    key: `review-overdue-${overdue.length}`, group: 'action', category: 'review', tone: 'amber',
    label: 'Review dokumen berkala', title: `${overdue.length} dokumen lewat jatuh tempo review`,
    detail: overdue.slice(0, 3).map((d) => d.controlNo).join(', ') + (overdue.length > 3 ? `, +${overdue.length - 3}` : ''),
    href: '/dashboard-admin', at: new Date().toISOString(),
  })
  if (soon.length) items.push({
    key: `review-soon-${soon.length}`, group: 'info', category: 'review', tone: 'neutral',
    label: 'Review dokumen berkala', title: `${soon.length} dokumen jatuh tempo ≤ 30 hari`,
    detail: soon.slice(0, 3).map((d) => d.controlNo).join(', ') + (soon.length > 3 ? `, +${soon.length - 3}` : ''),
    href: '/dashboard-admin', at: new Date().toISOString(),
  })
  return items
}

const LOG_TONE: Record<string, NoticeTone> = { approved: 'green', rejected: 'red', new: 'blue' }

async function logItems(): Promise<BellItem[]> {
  const rows = (await query<{ id: number; kind: string; category: NoticeCategory; title: string; body: string | null; href: string | null; created_at: string }>(
    `SELECT id, kind, category, title, body, href, created_at FROM admin_notifications
     WHERE seen_at IS NULL AND created_at > now() - interval '30 days' ORDER BY created_at DESC LIMIT 50`
  )).rows
  return rows.map((r) => {
    const suffix = r.kind.split('_').pop() ?? ''
    return {
      key: `log-${r.id}`, group: 'info' as const, category: r.category, tone: LOG_TONE[suffix] ?? 'neutral',
      label: CATEGORY_LABEL[r.category] ?? 'Info', title: r.title, detail: r.body,
      href: r.href ?? '/notifikasi', at: r.created_at, dismiss: { type: 'log' as const, id: r.id },
    }
  })
}

const byNewest = (a: BellItem, b: BellItem) => new Date(b.at).getTime() - new Date(a.at).getTime()

export async function getBell(): Promise<{ action: BellItem[]; info: BellItem[] }> {
  const parts = await Promise.all([
    safe('photo', photoItems, []),
    safe('special', specialAreaItems, []),
    safe('esign', esignItems, []),
    safe('documents', documentNoticeItems, []),
    safe('guests', guestItems, []),
    safe('taken', takenItems, []),
    safe('review', reviewItems, []),
    safe('log', logItems, []),
  ])
  const all = parts.flat()
  return { action: all.filter((i) => i.group === 'action').sort(byNewest), info: all.filter((i) => i.group === 'info').sort(byNewest) }
}

/** "OK" on one Info item. */
export async function dismiss(ref: DismissRef) {
  if (ref.type === 'procedure') await dismissProcedureNotice(ref.id)
  else if (ref.type === 'taken') await query('UPDATE photo_video_requests SET taken_ack_at = now() WHERE id = $1 AND taken_ack_at IS NULL', [ref.id])
  else await query('UPDATE admin_notifications SET seen_at = now() WHERE id = $1 AND seen_at IS NULL', [ref.id])
}

/** "Tandai semua sudah dilihat": every Info item (things needing action stay until handled). */
export async function dismissAll() {
  const { info } = await getBell()
  const refs = info.map((item) => item.dismiss).filter((ref): ref is DismissRef => !!ref)
  for (const ref of refs) await dismiss(ref)
  await query('UPDATE admin_notifications SET seen_at = now() WHERE seen_at IS NULL')
  return refs.length
}
