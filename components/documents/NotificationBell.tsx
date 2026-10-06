'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, BellRing, CalendarClock, Camera, Check, CheckCheck, FileSignature, History, ShieldAlert, UserPlus, Volume2, VolumeX, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'

// Mirrors BellItem in lib/admin-notifications.ts (server-only).
type Category = 'photo' | 'special' | 'esign' | 'guest' | 'review'
type Tone = 'red' | 'amber' | 'green' | 'blue' | 'neutral'
type DismissRef = { type: 'procedure' | 'taken' | 'log'; id: number }
type BellItem = {
  key: string
  group: 'action' | 'info'
  category: Category
  tone: Tone
  label: string
  title: string
  detail?: string | null
  note?: string | null
  href: string
  at: string
  dismiss?: DismissRef
}

const POLL_MS = 30000
const SOUND_KEY = 'isms-bell-sound'
const TOAST_MS = 9000

const CATEGORY_ICON: Record<Category, typeof Bell> = {
  photo: Camera,
  special: ShieldAlert,
  esign: FileSignature,
  guest: UserPlus,
  review: CalendarClock,
}
const TONE_CLASS: Record<Tone, string> = {
  red: 'bg-[#fbe6e0] text-[#b3361f]',
  amber: 'bg-amber-100 text-amber-800',
  green: 'bg-emerald-100 text-emerald-700',
  blue: 'bg-primary/15 text-primary',
  neutral: 'bg-secondary text-[color:var(--p-600)]',
}
const TONE_TEXT: Record<Tone, string> = {
  red: 'text-[#b3361f]',
  amber: 'text-amber-700',
  green: 'text-emerald-700',
  blue: 'text-primary',
  neutral: 'text-[color:var(--p-600)]',
}

function formatRelative(value: string) {
  const diffMin = Math.floor((Date.now() - new Date(value).getTime()) / 60000)
  if (diffMin < 1) return 'Baru saja'
  if (diffMin < 60) return `${diffMin} menit lalu`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} jam lalu`
  return `${Math.floor(diffHour / 24)} hari lalu`
}

function readSound() {
  try { return localStorage.getItem(SOUND_KEY) !== 'off' } catch { return true }
}

// A short two-note chime, made on the fly (no audio file to load). Browsers
// only allow sound after the user has interacted with the page — if not, it
// just stays silent.
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[[880, 0], [1320, 0.14]].forEach(([freq, start]) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.32)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + 0.35)
    })
    setTimeout(() => { void ctx.close() }, 800)
  } catch { /* no sound — fine */ }
}

function ItemRow({ item, onDismiss, onNavigate }: { item: BellItem; onDismiss: (item: BellItem) => void; onNavigate: () => void }) {
  const Icon = CATEGORY_ICON[item.category] ?? Bell
  return (
    <div className="flex items-start gap-3 border-b border-border/60 px-4 py-3 text-sm last:border-0">
      <span className={`mt-0.5 grid size-8 flex-none place-items-center rounded-full ${TONE_CLASS[item.tone]}`}>
        <Icon className="size-4" />
      </span>
      <Link href={item.href} onClick={onNavigate} className="nav-drop-item -m-1 min-w-0 flex-1 rounded-md p-1">
        <span className={`block text-[10px] font-bold uppercase tracking-wide ${TONE_TEXT[item.tone]}`}>{item.label}</span>
        <span className="block truncate font-medium text-foreground" title={item.title}>{item.title}</span>
        {item.detail && <span className="block truncate text-xs text-muted-foreground" title={item.detail}>{item.detail}</span>}
        {item.note && <span className="mt-0.5 line-clamp-2 block text-xs text-foreground/80">{item.note}</span>}
        <span className="mt-0.5 block text-[10px] text-muted-foreground/70">{formatRelative(item.at)}</span>
      </Link>
      {item.dismiss && (
        <button
          type="button"
          onClick={() => onDismiss(item)}
          aria-label={`Tandai sudah dilihat: ${item.title}`}
          title="Sudah dilihat — sembunyikan"
          className="mt-0.5 flex flex-none items-center gap-1 rounded-full border border-emerald-600/30 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          <Check className="size-3.5" /> OK
        </button>
      )}
    </div>
  )
}

export function NotificationBell() {
  const [action, setAction] = useState<BellItem[]>([])
  const [info, setInfo] = useState<BellItem[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sound, setSound] = useState(true)
  const [toasts, setToasts] = useState<BellItem[]>([])
  const [mounted, setMounted] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  // Keys seen in the previous poll — anything not in it is new (null = first load: nothing is "new").
  const knownRef = useRef<Set<string> | null>(null)
  const pathname = usePathname()

  useEscapeClose(open, () => setOpen(false))
  useEffect(() => { setMounted(true); setSound(readSound()) }, [])

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
      const res = await fetch(`${API_BASE_PATH}/api/admin/notifications`, { cache: 'no-store', credentials: 'include' })
      if (!res.ok) return
      const data = (await res.json()) as { action?: BellItem[]; info?: BellItem[] }
      const nextAction = data.action ?? []
      const nextInfo = data.info ?? []
      const all = [...nextAction, ...nextInfo]
      const known = knownRef.current
      if (known) {
        const fresh = all.filter((item) => !known.has(item.key))
        if (fresh.length) {
          setToasts((prev) => [...fresh.slice(0, 3), ...prev].slice(0, 3))
          if (readSound()) chime()
        }
      }
      knownRef.current = new Set(all.map((item) => item.key))
      setAction(nextAction)
      setInfo(nextInfo)
    } catch {
      /* keep what is shown; the next poll tries again */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, POLL_MS)
    // Come back to the tab → refresh right away instead of waiting for the next poll.
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  // Toasts fade out by themselves.
  useEffect(() => {
    if (!toasts.length) return
    const timer = setTimeout(() => setToasts((prev) => prev.slice(0, -1)), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toasts])

  const count = action.length + info.length

  // "(3) Portal ISMS" in the browser tab, so it shows even on another tab.
  // Re-applied after each navigation (the page sets its own title).
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(/^\(\d+\+?\)\s*/, '')
      document.title = count > 0 ? `(${count > 99 ? '99+' : count}) ${base}` : base
    }
    apply()
    const timer = setTimeout(apply, 400)
    return () => clearTimeout(timer)
  }, [count, pathname])
  useEffect(() => () => { document.title = document.title.replace(/^\(\d+\+?\)\s*/, '') }, [])

  const dismissOne = async (item: BellItem) => {
    if (!item.dismiss) return
    setAction((prev) => prev.filter((i) => i.key !== item.key))
    setInfo((prev) => prev.filter((i) => i.key !== item.key))
    try {
      await fetch(`${API_BASE_PATH}/api/admin/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismiss: item.dismiss }),
      })
    } catch { /* it comes back on the next poll, so the user can retry */ }
  }

  const dismissAllInfo = async () => {
    setInfo((prev) => prev.filter((i) => !i.dismiss))
    try {
      await fetch(`${API_BASE_PATH}/api/admin/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
    } catch { /* next poll restores the true state */ }
    load()
  }

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off') } catch { /* per-browser preference only */ }
    if (next) chime()
  }

  const close = () => setOpen(false)
  const BellIcon = action.length ? BellRing : Bell

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `Notifikasi: ${action.length} perlu tindakan, ${info.length} info` : 'Notifikasi'}
        className="relative grid size-10 place-items-center rounded-full text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
      >
        <BellIcon className="size-[18px]" />
        {count > 0 && (
          <span className={`absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold text-white ${action.length ? 'bg-[#d8342b]' : 'bg-accent'}`}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifikasi"
          className="absolute right-0 top-[calc(100%+10px)] z-20 w-[25rem] overflow-hidden rounded-2xl text-popover-foreground max-[640px]:fixed max-[640px]:inset-x-3 max-[640px]:top-[84px] max-[640px]:w-auto"
          style={{
            animation: 'dropdown-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both',
            background: 'linear-gradient(160deg, rgba(255,255,255,0.97) 0%, color-mix(in oklch, var(--p-surface2) 98%, transparent) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 20px 45px color-mix(in oklch, var(--p-950) 25%, transparent), 0 0 0 1px color-mix(in oklch, var(--p-550) 12%, transparent), inset 0 1px 0 rgba(255,255,255,0.85)',
          }}
        >
          <div className="nav-dropdown-bar h-[2.5px] w-full" />
          <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
            <div>
              <p className="portal-eyebrow">Notifikasi</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {count > 0 ? `${action.length} perlu tindakan · ${info.length} info` : 'Tidak ada yang menunggu'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {info.some((i) => i.dismiss) && (
                <button type="button" onClick={dismissAllInfo} title="Tandai semua info sudah dilihat" className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[10.5px] font-semibold text-foreground transition hover:bg-secondary">
                  <CheckCheck className="size-3.5" /> Tandai semua dilihat
                </button>
              )}
              <button type="button" onClick={toggleSound} aria-label={sound ? 'Matikan bunyi notifikasi' : 'Nyalakan bunyi notifikasi'} title={sound ? 'Bunyi: nyala' : 'Bunyi: mati'} className="grid size-7 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground">
                {sound ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
              </button>
            </div>
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {loading && <p className="px-4 py-6 text-center text-xs text-muted-foreground">Memuat...</p>}
            {!loading && count === 0 && (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto mb-2 size-7 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">Semua beres — belum ada notifikasi baru.</p>
              </div>
            )}
            {action.length > 0 && (
              <>
                <p className="sticky top-0 z-[1] flex items-center gap-2 border-b border-border/60 bg-[#fdf3ef] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#b3361f]">
                  Perlu tindakan <span className="rounded-full bg-[#b3361f] px-1.5 text-[9px] text-white">{action.length}</span>
                </p>
                {action.map((item) => <ItemRow key={item.key} item={item} onDismiss={dismissOne} onNavigate={close} />)}
              </>
            )}
            {info.length > 0 && (
              <>
                <p className="sticky top-0 z-[1] flex items-center gap-2 border-b border-border/60 bg-secondary px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Info <span className="rounded-full bg-muted-foreground/70 px-1.5 text-[9px] text-white">{info.length}</span>
                </p>
                {info.map((item) => <ItemRow key={item.key} item={item} onDismiss={dismissOne} onNavigate={close} />)}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 divide-x divide-border/60 border-t border-border/60">
            <Link href="/notifikasi" onClick={close} className="nav-drop-item flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-primary">
              <History className="size-3.5" /> Riwayat notifikasi
            </Link>
            <Link href="/dashboard-admin" onClick={close} className="nav-drop-item block px-3 py-2.5 text-center text-xs font-semibold text-primary">
              Dashboard Admin
            </Link>
          </div>
        </div>
      )}

      {/* New notifications pop up in the corner (portal: the navbar's backdrop-filter would trap position:fixed). */}
      {mounted && toasts.length > 0 && createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
          {toasts.map((item) => {
            const Icon = CATEGORY_ICON[item.category] ?? Bell
            return (
              <div key={item.key} className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-xl" style={{ animation: 'dropdown-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both' }}>
                <span className={`mt-0.5 grid size-8 flex-none place-items-center rounded-full ${TONE_CLASS[item.tone]}`}><Icon className="size-4" /></span>
                <Link href={item.href} onClick={() => setToasts((prev) => prev.filter((t) => t.key !== item.key))} className="min-w-0 flex-1">
                  <span className={`block text-[10px] font-bold uppercase tracking-wide ${TONE_TEXT[item.tone]}`}>{item.group === 'action' ? 'Perlu tindakan · ' : ''}{item.label}</span>
                  <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>
                  {item.detail && <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>}
                </Link>
                <button type="button" onClick={() => setToasts((prev) => prev.filter((t) => t.key !== item.key))} aria-label="Tutup" className="grid size-6 flex-none place-items-center rounded-full text-muted-foreground transition hover:bg-secondary">
                  <X className="size-3.5" />
                </button>
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
