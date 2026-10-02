'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Bell, CalendarClock, Camera, Check, FileCheck2, PencilLine, UserPlus } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { docKindInfo } from '@/lib/document-kinds'
import { useEscapeClose } from '@/hooks/useEscapeClose'

type PendingRequest = {
  id: number
  request_type: 'internal' | 'visitor'
  requester_name: string
  dept_or_company: string
  location: string
  submitted_at: string
}

type PendingRegistration = {
  id: number
  full_name: string
  company_remark: string
  registered_at: string
}

type TakenRequest = {
  id: number
  requester_name: string
  location: string
  from_at: string
  pic_approve_name: string | null
}

// Procedure approvals that need the ISM Admin (see /api/prosedur-isms/notifications).
type ProcedureNotice = {
  kind: 'revision' | 'approved'
  docKind?: string
  documentId: number
  controlNo: string
  title: string
  revision: number
  at: string
  by?: string | null
  roleTitle?: string
  noteCount?: number
  pinCount?: number
  firstNote?: string | null
  placed?: number
  total?: number
}

// ISM Admin only (see /api/admin/alerts): documents due for periodic review.
type ReviewAlert = { overdue: number; soon: number }

const POLL_MS = 30000

function formatRelative(value: string) {
  const diffMin = Math.floor((Date.now() - new Date(value).getTime()) / 60000)
  if (diffMin < 1) return 'Baru saja'
  if (diffMin < 60) return `${diffMin} menit lalu`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} jam lalu`
  return `${Math.floor(diffHour / 24)} hari lalu`
}

export function NotificationBell() {
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([])
  const [awaitingAck, setAwaitingAck] = useState<TakenRequest[]>([])
  const [notices, setNotices] = useState<ProcedureNotice[]>([])
  const [review, setReview] = useState<ReviewAlert>({ overdue: 0, soon: 0 })
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)

  useEscapeClose(open, () => setOpen(false))

  // Close on a click outside. Not a full-screen overlay: inside the scrolled
  // navbar (backdrop-filter) a position:fixed overlay is trapped in the bar.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const load = useCallback(async () => {
    try {
      const [reqRes, regRes, ackRes, noticeRes, alertRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api/photo-video-requests?status=pending`, { cache: 'no-store', credentials: 'include' }),
        fetch(`${API_BASE_PATH}/api/vendor-registrations?stage=pending_approval`, { cache: 'no-store', credentials: 'include' }),
        fetch(`${API_BASE_PATH}/api/photo-video-requests?awaitingAck=1`, { cache: 'no-store', credentials: 'include' }),
        fetch(`${API_BASE_PATH}/api/prosedur-isms/notifications`, { cache: 'no-store', credentials: 'include' }),
        fetch(`${API_BASE_PATH}/api/admin/alerts`, { cache: 'no-store', credentials: 'include' }),
      ])
      const reqData = reqRes.ok ? await reqRes.json() : { requests: [] }
      const regData = regRes.ok ? await regRes.json() : { registrations: [] }
      const ackData = ackRes.ok ? await ackRes.json() : { requests: [] }
      const noticeData = noticeRes.ok ? await noticeRes.json() : { notices: [] }
      const alertData = alertRes.ok ? await alertRes.json() : { review: { overdue: 0, soon: 0 } }
      setRequests(reqData.requests ?? [])
      setRegistrations(regData.registrations ?? [])
      setAwaitingAck(ackData.requests ?? [])
      setNotices(noticeData.notices ?? [])
      setReview(alertData.review ?? { overdue: 0, soon: 0 })
    } catch {
      setRequests([])
      setRegistrations([])
      setAwaitingAck([])
      setNotices([])
      setReview({ overdue: 0, soon: 0 })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, POLL_MS)
    return () => clearInterval(interval)
  }, [load])

  const dismissTaken = async (id: number) => {
    try {
      await fetch(`${API_BASE_PATH}/api/photo-video-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss-taken' }),
      })
      setAwaitingAck((prev) => prev.filter((r) => r.id !== id))
    } catch { /* no-op — leave it in the list so the user can retry */ }
  }

  const dismissNotice = async (documentId: number) => {
    try {
      await fetch(`${API_BASE_PATH}/api/prosedur-isms/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })
      setNotices((prev) => prev.filter((n) => n.documentId !== documentId))
    } catch { /* keep it so the user can retry */ }
  }

  const hasReview = review.overdue > 0 || review.soon > 0
  const count = requests.length + registrations.length + awaitingAck.length + notices.length + (hasReview ? 1 : 0)

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `Notifikasi, ${count} pengajuan menunggu` : 'Notifikasi'}
        className="relative grid size-10 place-items-center rounded-full text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
      >
        <Bell className="size-[18px]" />
        {count > 0 && (
          <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-accent text-[9px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            role="menu"
            aria-label="Notifications"
            className="absolute right-0 top-[calc(100%+10px)] z-20 w-[22rem] overflow-hidden rounded-2xl text-popover-foreground max-[640px]:fixed max-[640px]:inset-x-3 max-[640px]:top-[84px] max-[640px]:w-auto"
            style={{
              animation: 'dropdown-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both',
              background: 'linear-gradient(160deg, rgba(255,255,255,0.97) 0%, color-mix(in oklch, var(--p-surface2) 98%, transparent) 100%)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 20px 45px color-mix(in oklch, var(--p-950) 25%, transparent), 0 0 0 1px color-mix(in oklch, var(--p-550) 12%, transparent), inset 0 1px 0 rgba(255,255,255,0.85)',
            }}
          >
            <div className="nav-dropdown-bar h-[2.5px] w-full" />
            <div className="border-b border-border/60 px-4 py-3">
              <p className="portal-eyebrow">Notifications</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {count > 0 ? `${count} item menunggu perhatian` : 'Tidak ada yang menunggu'}
              </p>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading && <p className="px-4 py-6 text-center text-xs text-muted-foreground">Memuat...</p>}
              {!loading && count === 0 && (
                <div className="px-4 py-8 text-center">
                  <Camera className="mx-auto mb-2 size-7 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Belum ada notifikasi baru.</p>
                </div>
              )}
              {hasReview && (
                <Link
                  href="/dashboard-admin"
                  onClick={() => setOpen(false)}
                  className="nav-drop-item flex items-start gap-3 border-b border-border/60 px-4 py-3 text-sm last:border-0"
                >
                  <span className={`mt-0.5 grid size-8 flex-none place-items-center rounded-full ${review.overdue ? 'bg-amber-100 text-amber-800' : 'bg-secondary text-[color:var(--p-600)]'}`}>
                    <CalendarClock className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-amber-700">Review dokumen berkala</span>
                    <span className="block font-medium text-foreground">
                      {review.overdue ? `${review.overdue} dokumen lewat jatuh tempo review` : `${review.soon} dokumen jatuh tempo ≤ 30 hari`}
                    </span>
                    {review.overdue > 0 && review.soon > 0 && <span className="block text-xs text-muted-foreground">+ {review.soon} jatuh tempo ≤ 30 hari</span>}
                  </span>
                </Link>
              )}
              {notices.map((notice) => {
                const revision = notice.kind === 'revision'
                const missingQr = !revision && (notice.placed ?? 0) < (notice.total ?? 0)
                return (
                  <div key={`proc-${notice.kind}-${notice.documentId}`} className="flex items-start gap-3 border-b border-border/60 px-4 py-3 text-sm last:border-0">
                    <span className={`mt-0.5 grid size-8 flex-none place-items-center rounded-full ${revision ? 'bg-[#fbe6e0] text-[#b3361f]' : 'bg-emerald-100 text-emerald-700'}`}>
                      {revision ? <PencilLine className="size-4" /> : <FileCheck2 className="size-4" />}
                    </span>
                    <Link
                      href={`${docKindInfo(notice.docKind).path}?q=${encodeURIComponent(notice.controlNo)}`}
                      onClick={() => setOpen(false)}
                      className="min-w-0 flex-1"
                    >
                      <span className={`block text-[10px] font-bold uppercase tracking-wide ${revision ? 'text-[#b3361f]' : 'text-emerald-700'}`}>
                        {`${docKindInfo(notice.docKind).short} ${revision ? 'perlu revisi' : 'disahkan'}`}
                      </span>
                      <span className="block truncate font-medium text-foreground" title={notice.title}>{notice.controlNo} &middot; {notice.title}</span>
                      {revision ? (
                        <>
                          <span className="block text-xs text-muted-foreground">
                            {notice.by ?? '-'} &middot; {notice.noteCount} catatan{notice.pinCount ? `, ${notice.pinCount} ditandai di dokumen` : ''}
                          </span>
                          {notice.firstNote && <span className="mt-0.5 line-clamp-2 block text-xs text-foreground/80">&ldquo;{notice.firstNote}&rdquo;</span>}
                        </>
                      ) : (
                        <>
                          <span className="block text-xs text-muted-foreground">
                            Rev. {notice.revision} &middot; disetujui {notice.total}/{notice.total} approver{missingQr ? '' : ' · QR lengkap di dokumen'}
                          </span>
                          {missingQr && (
                            <span className="mt-0.5 flex items-start gap-1 text-xs text-amber-700">
                              <AlertTriangle className="mt-px size-3 flex-none" />
                              QR baru tercetak {notice.placed}/{notice.total} — atur Posisi QR
                            </span>
                          )}
                        </>
                      )}
                      <span className="mt-0.5 block text-[10px] text-muted-foreground/70">{formatRelative(notice.at)}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => dismissNotice(notice.documentId)}
                      aria-label={`Tandai sudah dilihat: ${notice.controlNo}`}
                      title="Sudah dilihat — sembunyikan"
                      className="mt-0.5 flex flex-none items-center gap-1 rounded-full border border-emerald-600/30 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <Check className="size-3.5" /> OK
                    </button>
                  </div>
                )
              })}
              {awaitingAck.map((req) => (
                <div key={`ack-${req.id}`} className="flex items-start gap-3 border-b border-border/60 px-4 py-3 text-sm last:border-0">
                  <span className="mt-0.5 grid size-8 flex-none place-items-center rounded-full bg-accent/15 text-accent-foreground">
                    <Camera className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{req.requester_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      Foto/video sudah diambil &middot; {req.location}{req.pic_approve_name && <> &middot; PIC: {req.pic_approve_name}</>}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground/70">{formatRelative(req.from_at)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => dismissTaken(req.id)}
                    aria-label={`Tandai sudah dilihat: ${req.requester_name}`}
                    title="Sudah dilihat — tandai selesai"
                    className="mt-0.5 flex flex-none items-center gap-1 rounded-full border border-emerald-600/30 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <Check className="size-3.5" /> OK
                  </button>
                </div>
              ))}
              {requests.map((req) => (
                <Link
                  key={`req-${req.id}`}
                  href="/kelola-permintaan-foto-video?status=pending"
                  onClick={() => setOpen(false)}
                  className="nav-drop-item flex items-start gap-3 border-b border-border/60 px-4 py-3 text-sm last:border-0"
                >
                  <span className="mt-0.5 grid size-8 flex-none place-items-center rounded-full bg-accent/15 text-accent-foreground">
                    <Camera className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{req.requester_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      Izin Foto/Video &middot; {req.request_type === 'internal' ? 'Internal' : 'Visitor'} &middot; {req.location}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground/70">{formatRelative(req.submitted_at)}</span>
                  </span>
                </Link>
              ))}
              {registrations.map((reg) => (
                <Link
                  key={`reg-${reg.id}`}
                  href="/admin-pos-security"
                  onClick={() => setOpen(false)}
                  className="nav-drop-item flex items-start gap-3 border-b border-border/60 px-4 py-3 text-sm last:border-0"
                >
                  <span className="mt-0.5 grid size-8 flex-none place-items-center rounded-full bg-primary/15 text-primary">
                    <UserPlus className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{reg.full_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      Pendaftaran Tamu &middot; Menunggu Approval Security &middot; {reg.company_remark}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground/70">{formatRelative(reg.registered_at)}</span>
                  </span>
                </Link>
              ))}
            </div>

            {count > 0 && (
              <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60">
                <Link
                  href="/prosedur-isms"
                  onClick={() => setOpen(false)}
                  className="nav-drop-item block px-3 py-2.5 text-center text-xs font-semibold text-primary"
                >
                  Prosedur
                </Link>
                <Link
                  href="/kelola-permintaan-foto-video?status=pending"
                  onClick={() => setOpen(false)}
                  className="nav-drop-item block px-3 py-2.5 text-center text-xs font-semibold text-primary"
                >
                  Foto/Video
                </Link>
                <Link
                  href="/admin-pos-security"
                  onClick={() => setOpen(false)}
                  className="nav-drop-item block px-3 py-2.5 text-center text-xs font-semibold text-primary"
                >
                  Pendaftaran Tamu
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
