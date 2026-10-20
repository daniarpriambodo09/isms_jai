// app/persetujuan-saya/page.tsx
'use client'

// "Persetujuan Saya": the approval requests sent to the logged-in account's
// e-mail address — to decide now, still queued, and the last ones decided.
// Being logged in replaces the 6-digit code of the e-mail; the e-mail links
// keep working for whoever is not logged in.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, CheckCircle2, ClipboardCheck, ClipboardPaste, Clock, Copy, ExternalLink, FileText, Gauge, History, Hourglass, KeyRound, Loader2, LogIn, LogOut, PenLine, QrCode, RotateCcw, Sparkles, XCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ChangePasswordModal } from '@/components/change-password-modal'
import { MyApprovalHistory } from '@/components/approvals/MyApprovalHistory'
import { ApproverReviewModal } from '@/components/approvals/ApproverReviewModal'
import { copyText, readClipboardText } from '@/lib/clipboard'

type Item = {
  stepId: number; token: string | null; status: 'pending' | 'waiting' | 'approved' | 'rejected'
  roleCode: string; roleTitle: string; signsReview: boolean
  documentId: number; controlNo: string; title: string; revision: number; kindLabel: string
  sentAt: string | null; decidedAt: string | null; waitingFor: string | null; qrPlaced?: boolean
  code?: string | null; codeLocked?: boolean
}
type Data = { email: string | null; pending: Item[]; queued: Item[]; recent: Item[] }

const when = (value: string | null) => (value ? new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const waitedDays = (value: string | null) => (value ? Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000) : 0)

function What({ item }: { item: Item }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${item.signsReview ? 'bg-emerald-500/10 text-emerald-700' : 'bg-primary/10 text-primary'}`}>{item.signsReview ? 'Form Review' : 'Dokumen'}</span>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">{item.kindLabel}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{item.controlNo} · Rev. {item.revision}</span>
        {item.status === 'approved' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            <Check className="size-3 text-emerald-700" strokeWidth={3} /> Disetujui
          </span>
        )}
      </div>
      <p className="mt-1.5 break-words text-[15px] font-semibold leading-snug text-foreground">{item.signsReview ? `Form Review — ${item.title}` : item.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Sebagai {item.roleTitle}</p>
    </div>
  )
}

export default function PersetujuanSayaPage() {
  const { sessionUser, isLoading, logout } = useAuth()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Item | null>(null)
  const [reviewModal, setReviewModal] = useState<{ token: string; action?: 'approve' | 'reject' | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [approvalCode, setApprovalCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [passwordOpen, setPasswordOpen] = useState(false)
  // the full, searchable history instead of the last few decisions
  const [showHistory, setShowHistory] = useState(false)
  const [decided, setDecided] = useState(0)

  const setCodeFromText = (value: string) => {
    setApprovalCode(value.replace(/\D/g, '').slice(0, 6))
    setCodeError(null)
  }

  const openApprovalModal = (item: Item, action?: 'approve' | 'reject' | null) => {
    if (item.token) {
      setReviewModal({ token: item.token, action: action ?? null })
      return
    }
    setNotice(null)
    setConfirm(item)
    setCodeError(null)
    setCopiedCode(false)
    setApprovalCode(item.code ? item.code.trim() : '')
  }

  const copyCode = async (code: string) => {
    const ok = await copyText(code)
    if (ok) {
      setCopiedCode(true)
      window.setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const pasteApprovalCode = async () => {
    const text = await readClipboardText()
    if (text) {
      const digits = text.replace(/\D/g, '').slice(0, 6)
      if (digits) {
        setCodeFromText(digits)
        return
      }
    }
    setCodeError('Clipboard tidak dapat dibaca otomatis. Silakan tekan Ctrl+V di kolom input.')
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api/my-approvals`, { cache: 'no-store', credentials: 'include' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message)
      setData(body)
      setError(null)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal memuat daftar persetujuan.')
    }
  }, [])

  useEffect(() => { if (sessionUser) load(); else setData(null) }, [sessionUser, load])
  // Someone else may have signed in the meantime (the next request then arrives here).
  useEffect(() => {
    if (!sessionUser) return
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load() }, 30_000)
    window.addEventListener('focus', load)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', load) }
  }, [sessionUser, load])

  // If opened with ?stepId=..., automatically open the approval modal for that step
  useEffect(() => {
    if (!data?.pending?.length) return
    const params = new URLSearchParams(window.location.search)
    const targetStep = params.get('stepId')
    if (targetStep) {
      const item = data.pending.find((p) => String(p.stepId) === targetStep)
      if (item) {
        openApprovalModal(item, 'approve')
      }
    }
  }, [data])

  const approve = async () => {
    if (!confirm?.token) return false
    setBusy(true)
    setNotice(null)
    setCodeError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/prosedur-isms/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: confirm.token, action: 'approve', code: approvalCode }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        if (body?.codeError) setCodeError(body.message ?? 'Kode persetujuan salah.')
        else setNotice({ ok: false, text: body?.message ?? 'Gagal memproses.' })
        return false
      }
      setNotice({ ok: res.ok, text: body?.message ?? (res.ok ? 'Persetujuan tersimpan.' : 'Gagal memproses.') })
      setConfirm(null)
      setApprovalCode('')
      setDecided((n) => n + 1)
      await load()
      return true
    } catch {
      setNotice({ ok: false, text: 'Tidak dapat menghubungi server.' })
      return false
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="size-7 animate-spin" /></div>

  if (!sessionUser) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary"><ClipboardCheck className="size-7" /></span>
        <h2 className="mt-5 font-display text-2xl font-semibold text-foreground">Persetujuan Saya</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Masuk dengan akun approver Anda untuk melihat semua dokumen dan Form Review yang menunggu persetujuan Anda. Persetujuan dokumen kini langsung tanpa perlu kode angka/PIN.
        </p>
        <button type="button" onClick={() => window.dispatchEvent(new Event('open-admin-login'))} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
          <LogIn className="size-4" /> Masuk
        </button>
        <p className="mt-4 text-xs text-muted-foreground">Belum punya akun? Minta Admin ISM membuatkannya. Link dan kode di email tetap bisa dipakai tanpa login.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8">
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
              <ClipboardCheck className="size-3.5" /> Persetujuan Saya
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {data ? (data.pending.length ? `${data.pending.length} menunggu persetujuan Anda` : 'Tidak ada yang menunggu Anda') : 'Memuat…'}
            </h1>
            <p className="mt-3 text-sm leading-6 text-primary-foreground/75">
              Masuk sebagai <strong className="text-primary-foreground">{sessionUser.username}</strong>{data?.email ? <> · permintaan untuk <strong className="text-primary-foreground">{data.email}</strong></> : null}. Anda dapat langsung memeriksa dan menyetujui dokumen secara elektronik.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => load()} className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/20 px-3.5 py-2 text-xs font-semibold transition hover:bg-primary-foreground/10"><RotateCcw className="size-3.5" />Muat ulang</button>
            <button type="button" onClick={() => setPasswordOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/20 px-3.5 py-2 text-xs font-semibold transition hover:bg-primary-foreground/10"><KeyRound className="size-3.5" />Ganti password</button>
            <button type="button" onClick={() => logout()} className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/20 px-3.5 py-2 text-xs font-semibold transition hover:bg-primary-foreground/10"><LogOut className="size-3.5" /> Log Out</button>
          </div>
        </div>
      </header>

      {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${notice.ok ? 'border-emerald-300/60 bg-emerald-50 text-emerald-800' : 'border-destructive/20 bg-destructive/10 text-destructive'}`}>{notice.text}</p>}
      {data && !data.email && (
        <p className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Akun ini belum punya alamat email, jadi tidak ada permintaan yang bisa dicocokkan. Minta Admin ISM mengisi email akun ini (Kelola Admin) — sama dengan email approver Anda.
        </p>
      )}

      {!data && !error && <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>}

      {data && (
        <>
          <section aria-label="Menunggu persetujuan Anda" className="rounded-3xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <Clock className="size-4 text-amber-600" />
              <p className="portal-eyebrow">Menunggu persetujuan Anda</p>
              <span className="ml-auto rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">{data.pending.length}</span>
            </div>
            {data.pending.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-muted-foreground">Tidak ada dokumen yang sedang menunggu Anda.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.pending.map((item) => {
                  const days = waitedDays(item.sentAt)
                  return (
                    <li key={item.stepId} data-testid="my-pending" className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 lg:flex-row lg:items-center lg:justify-between">
                      <div
                        className={`min-w-0 ${item.token ? 'cursor-pointer hover:opacity-90' : ''}`}
                        onClick={() => {
                          if (item.token) setReviewModal({ token: item.token, action: null })
                        }}
                        title={item.token ? 'Klik untuk membuka dokumen dan proses persetujuan' : undefined}
                      >
                        <What item={item} />
                        <p className="mt-1 text-xs text-muted-foreground">Diminta {when(item.sentAt)}{days >= 1 ? <span className="font-semibold text-amber-700"> · sudah {days} hari</span> : null}</p>
                      </div>
                      <div className="flex flex-shrink-0 flex-wrap gap-2">
                        {item.token ? (
                          <button
                            type="button"
                            onClick={() => setReviewModal({ token: item.token!, action: null })}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
                          >
                            <FileText className="size-4" />Buka
                          </button>
                        ) : (
                          <Link href={`/pengesahan?stepId=${item.stepId}`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary">
                            <FileText className="size-4" />Buka
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => openApprovalModal(item, 'approve')}
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 shadow-sm"
                        >
                          <CheckCircle2 className="size-4" />Setujui
                        </button>
                        {item.token ? (
                          <button
                            type="button"
                            onClick={() => setReviewModal({ token: item.token!, action: 'reject' })}
                            title="Buka dokumen untuk meminta revisi"
                            className="inline-flex items-center gap-1.5 rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                          >
                            <PenLine className="size-4" />Minta Revisi
                          </button>
                        ) : (
                          <Link href={`/pengesahan?stepId=${item.stepId}`} title="Buka dokumennya untuk menandai bagian yang perlu diperbaiki" className="inline-flex items-center gap-1.5 rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50">
                            <PenLine className="size-4" />Minta Revisi
                          </Link>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {data.queued.length > 0 && (
            <section aria-label="Belum giliran Anda" className="rounded-3xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                <Hourglass className="size-4 text-muted-foreground" />
                <p className="portal-eyebrow">Belum giliran Anda</p>
                <span className="ml-auto rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">{data.queued.length}</span>
              </div>
              <ul className="divide-y divide-border">
                {data.queued.map((item) => (
                  <li key={item.stepId} className="px-5 py-4">
                    <What item={item} />
                    <p className="mt-1 text-xs text-muted-foreground">{item.waitingFor ? <>Menunggu <strong className="text-foreground">{item.waitingFor}</strong> lebih dulu.</> : 'Menunggu approver sebelum Anda.'} Akan pindah ke atas saat tiba giliran Anda.</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showHistory && (
            <>
              <button type="button" onClick={() => setShowHistory(false)} className="self-start rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary">← Tampilkan ringkas</button>
              <MyApprovalHistory refreshKey={decided} />
            </>
          )}
          {!showHistory && data.recent.length > 0 && (
            <section aria-label="Terakhir Anda putuskan" className="rounded-3xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                <CheckCircle2 className="size-4 text-muted-foreground" />
                <p className="portal-eyebrow">Terakhir Anda putuskan</p>
                <button type="button" onClick={() => setShowHistory(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary">
                  <History className="size-3.5" />Riwayat lengkap &amp; cari
                </button>
              </div>
              <ul className="divide-y divide-border">
                {data.recent.map((item) => (
                  <li key={item.stepId} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div
                      className={`min-w-0 ${item.token ? 'cursor-pointer hover:opacity-90' : ''}`}
                      onClick={() => {
                        if (item.token) setReviewModal({ token: item.token, action: null })
                      }}
                    >
                      <What item={item} />
                      {item.status === 'approved' && item.qrPlaced === false && (
                        <p className="mt-1.5 inline-flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs leading-5 text-amber-800" data-testid="qr-pending">
                          <QrCode className="mt-0.5 size-3.5 flex-none" />
                          <span>Persetujuan Anda sudah tercatat. QR tanda tangan Anda <strong>belum ditempatkan oleh Admin ISM</strong> — sampai itu dilakukan, dokumen masih tampil tanpa QR.</span>
                        </p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3 text-xs">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${item.status === 'approved' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-700'}`}>
                        {item.status === 'approved' ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}{item.status === 'approved' ? 'Disetujui' : 'Minta revisi'}
                      </span>
                      <span className="text-muted-foreground">{when(item.decidedAt)}</span>
                      {item.token ? (
                        <button
                          type="button"
                          onClick={() => setReviewModal({ token: item.token!, action: null })}
                          className="inline-flex items-center gap-1 font-semibold text-[color:var(--p-600)] hover:underline"
                        >
                          Lihat <ExternalLink className="size-3" />
                        </button>
                      ) : (
                        <a href={`${API_BASE_PATH}/api/prosedur-isms/${item.documentId}/pdf?token=${item.token ?? ''}${item.signsReview ? '&part=review' : ''}`} target="_blank" rel="noopener noreferrer" title={item.status === 'approved' && item.qrPlaced === false ? 'QR Anda belum ditempatkan — dokumen masih tampil tanpa QR' : undefined} className="inline-flex items-center gap-1 font-semibold text-[color:var(--p-600)] hover:underline">Lihat <ExternalLink className="size-3" /></a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.signsReview ? 'Setujui Form Review ini?' : 'Setujui dokumen ini?'}
        message={confirm ? `${confirm.controlNo} — ${confirm.title}. Anda menyetujui sebagai ${confirm.roleTitle}. Tanda tangan elektronik Anda (QR) akan tercatat dan tidak bisa dibatalkan.` : ''}
        confirmLabel="Ya, setujui"
        danger={false}
        pending={busy}
        confirmDisabled={busy}
        onConfirm={approve}
        onCancel={() => { setConfirm(null); setApprovalCode(''); setCodeError(null); setCopiedCode(false) }}
      >
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-50/5 p-4 text-xs leading-relaxed text-foreground">
          <p className="font-semibold text-emerald-800 dark:text-emerald-400">
            Persetujuan Langsung (Tanpa Kode PIN / Angka)
          </p>
          <p className="mt-1 text-muted-foreground">
            Tanda tangan elektronik digital (QR E-Sign) resmi Anda akan langsung disahkan pada dokumen ini selaku <strong className="text-foreground">{confirm?.roleTitle}</strong>.
          </p>
        </div>
      </ConfirmDialog>
      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} />}
      {reviewModal && (
        <ApproverReviewModal
          token={reviewModal.token}
          initialAction={reviewModal.action}
          onClose={() => setReviewModal(null)}
          onDecided={() => {
            setDecided((n) => n + 1)
            load()
          }}
        />
      )}
    </div>
  )
}
