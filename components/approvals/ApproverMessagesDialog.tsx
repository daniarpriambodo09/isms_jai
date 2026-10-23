// components/approvals/ApproverMessagesDialog.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Copy, ExternalLink, FileText, Loader2, Mail, MessageSquare, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { copyText } from '@/lib/clipboard'

type Message = {
  stepId: number
  controlNo: string
  title: string
  roleTitle: string
  sentAt: string | null
  code: string | null
  locked: boolean
  category?: 'procedure' | 'it_form' | 'special_area' | 'photo_video'
  actionUrl?: string
  applicantName?: string | null
  department?: string | null
}

export function ApproverMessagesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<number | null>(null)
  useEscapeClose(open, onClose)

  useEffect(() => {
    if (!open) return
    setLoading(true); setError(null)
    fetch(`${API_BASE_PATH}/api/my-approvals/messages`, { cache: 'no-store', credentials: 'include' })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message)
        setEmail(data.email ?? null)
        setMessages(data.messages ?? [])
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Gagal memuat pesan.'))
      .finally(() => setLoading(false))
  }, [open])

  const copy = async (message: Message) => {
    if (!message.code || message.locked) return
    const ok = await copyText(message.code)
    if (ok) {
      setCopied(message.stepId)
      window.setTimeout(() => setCopied((id) => id === message.stepId ? null : id), 2000)
    }
  }

  const goToApprove = (message: Message) => {
    onClose()
    if (message.category && message.category !== 'procedure' && message.actionUrl) {
      router.push(message.actionUrl)
      return
    }
    if (typeof window !== 'undefined' && window.location.pathname.includes('/persetujuan-saya')) {
      const url = new URL(window.location.href)
      url.searchParams.set('stepId', String(message.stepId))
      window.location.href = url.toString()
    } else {
      router.push(`/persetujuan-saya?stepId=${message.stepId}`)
    }
  }

  const getCategoryBadge = (cat?: string) => {
    switch (cat) {
      case 'it_form':
        return <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">Form Layanan IT</span>
      case 'special_area':
        return <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:text-indigo-300">Izin Area Special</span>
      case 'photo_video':
        return <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[10px] font-bold text-purple-800 dark:text-purple-300">Izin Foto / Video</span>
      default:
        return <span className="rounded-full bg-primary/10 border border-primary/25 px-2 py-0.5 text-[10px] font-bold text-primary">Dokumen Prosedur ISMS</span>
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Pesan persetujuan" onClick={(event) => event.stopPropagation()} className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-primary px-5 py-4 text-primary-foreground">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="size-5" />
            <div>
              <h2 className="text-base font-bold">Pesan &amp; Notifikasi Persetujuan</h2>
              <p className="text-[11px] text-primary-foreground/75">Sinkron dengan akun email approver resmi Anda</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-8 place-items-center rounded-full text-primary-foreground/70 hover:bg-primary-foreground/15 hover:text-primary-foreground"><X className="size-4" /></button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto p-5">
          {email && <p className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="size-3.5" />Pemberitahuan aktif untuk <strong className="text-foreground">{email}</strong></p>}
          {loading ? <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
            : error ? <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>
              : messages.length === 0 ? <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Tidak ada dokumen atau formulir yang menunggu persetujuan Anda saat ini.</p>
                : <ul className="space-y-3">{messages.map((message) => (
                  <li key={message.stepId} className="rounded-xl border border-border bg-secondary/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                      <p className="font-mono text-[11px] font-semibold text-primary">{message.controlNo}</p>
                      {getCategoryBadge(message.category)}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{message.title}</p>
                    {message.applicantName && (
                      <p className="text-xs text-foreground/80 mt-0.5">Pemohon: <span className="font-medium text-foreground">{message.applicantName}</span> {message.department ? `(${message.department})` : ''}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">Sebagai {message.roleTitle}</p>
                    {message.locked ? (
                      <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">Kode terkunci setelah terlalu banyak percobaan. Minta Admin ISMS mengirim ulang email.</p>
                    ) : message.code ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border/80 bg-card p-2.5">
                        <button
                          type="button"
                          onClick={() => copy(message)}
                          className="group flex items-center gap-2 rounded-md px-2 py-1 text-left transition hover:bg-secondary/60"
                          title="Klik untuk menyalin kode"
                        >
                          <span className="font-mono text-xl font-bold tracking-[0.22em] text-foreground select-all">{message.code}</span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
                            {copied === message.stepId ? (
                              <>
                                <Check className="size-3 text-emerald-600" />
                                <span>Tersalin</span>
                              </>
                            ) : (
                              'Salin'
                            )}
                          </span>
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => copy(message)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                          >
                            {copied === message.stepId ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                            {copied === message.stepId ? 'Tersalin' : 'Salin'}
                          </button>
                          <button
                            type="button"
                            onClick={() => goToApprove(message)}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                          >
                            Setujui <ArrowRight className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-card p-2.5">
                        <span className="text-xs text-muted-foreground">Pengesahan online resmi langsung dari portal:</span>
                        <button
                          type="button"
                          onClick={() => goToApprove(message)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          <span>Buka &amp; Setujui</span>
                          <ArrowRight className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}</ul>}
        </div>
      </div>
    </div>
  )
}

