'use client'

// ISM Admin card: who approves special-area requests. Either follow a position
// from Approver Pengesahan, or set name / title / email by hand.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Mail, Pencil, UserCheck, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'

type Setting = { mode: 'role'; roleCode: string } | { mode: 'custom'; name: string; title: string; email: string | null }
type Role = { code: string; title: string; person_name: string; email: string | null }
type Data = { setting: Setting; approver: { name: string | null; title: string | null; email: string | null; source: string }; roles: Role[]; updatedAt: string | null; updatedBy: string | null }

const input = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'

export function SpecialAreaApproverCard({ onChanged }: { onChanged?: () => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [editing, setEditing] = useState(false)
  const [mode, setMode] = useState<'role' | 'custom'>('role')
  const [roleCode, setRoleCode] = useState('IAA')
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`${API_BASE_PATH}/api/special-area-requests/approver`, { cache: 'no-store' }).catch(() => null)
    if (res?.ok) setData(await res.json())
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = () => {
    if (!data) return
    const s = data.setting
    setMode(s.mode)
    if (s.mode === 'role') { setRoleCode(s.roleCode); setName(''); setTitle(''); setEmail('') }
    else { setName(s.name); setTitle(s.title); setEmail(s.email ?? '') }
    setMessage(null)
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/special-area-requests/approver`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'role' ? { mode, roleCode } : { mode, name, title, email }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.message ?? 'Gagal menyimpan.')
      setData(body)
      setEditing(false)
      setMessage({ ok: true, text: body.message })
      onChanged?.()
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Gagal menyimpan.' })
    } finally {
      setSaving(false)
    }
  }

  const selectedRole = data?.roles.find((r) => r.code === roleCode)

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <span className="grid size-10 flex-none place-items-center rounded-xl bg-red-600/10 text-red-700"><UserCheck className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-mono-label text-[10px] text-muted-foreground">Approver Izin Area Special</p>
          {data ? (
            <>
              <p className="mt-0.5 text-base font-semibold text-foreground">{data.approver.name ?? <span className="text-destructive">Belum diatur</span>}{data.approver.title && <span className="font-normal text-muted-foreground"> · {data.approver.title}</span>}</p>
              <p className={`flex flex-wrap items-center gap-x-3 text-xs ${data.approver.email ? 'text-muted-foreground' : 'text-destructive'}`}>
                <span className="inline-flex items-center gap-1"><Mail className="size-3.5" />{data.approver.email ?? 'Email belum diisi — email persetujuan tidak bisa dikirim'}</span>
                <span className="text-muted-foreground">Sumber: {data.approver.source}</span>
              </p>
            </>
          ) : <Loader2 className="mt-1 size-4 animate-spin text-muted-foreground" />}
        </div>
        {!editing && <button type="button" onClick={startEdit} disabled={!data} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"><Pencil className="size-3.5" /> Ganti approver</button>}
      </div>

      {message && !editing && <p className={`mx-5 mb-4 rounded-xl border px-3 py-2 text-xs ${message.ok ? 'border-emerald-600/25 bg-emerald-600/10 text-emerald-800' : 'border-destructive/20 bg-destructive/10 text-destructive'}`}>{message.text}</p>}

      {editing && data && (
        <div className="flex flex-col gap-4 border-t border-border bg-secondary/20 px-5 py-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${mode === 'role' ? 'border-primary bg-primary/[0.04]' : 'border-border bg-card'}`}>
              <input type="radio" checked={mode === 'role'} onChange={() => setMode('role')} className="mt-1 accent-[color:var(--p-700)]" />
              <span><span className="block text-sm font-semibold text-foreground">Ikuti jabatan</span><span className="text-xs text-muted-foreground">Ambil dari <Link href="/kelola-pengesahan" className="underline">Approver Pengesahan</Link> — otomatis ikut kalau orangnya diganti di sana.</span></span>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${mode === 'custom' ? 'border-primary bg-primary/[0.04]' : 'border-border bg-card'}`}>
              <input type="radio" checked={mode === 'custom'} onChange={() => setMode('custom')} className="mt-1 accent-[color:var(--p-700)]" />
              <span><span className="block text-sm font-semibold text-foreground">Atur manual</span><span className="text-xs text-muted-foreground">Isi nama, jabatan, dan email approver khusus untuk izin area special.</span></span>
            </label>
          </div>

          {mode === 'role' ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Jabatan</span>
              <select value={roleCode} onChange={(e) => setRoleCode(e.target.value)} className={input}>
                {data.roles.map((r) => <option key={r.code} value={r.code}>{r.title} — {r.person_name} ({r.code})</option>)}
              </select>
              {selectedRole && !selectedRole.email && <span className="text-xs text-destructive">Email {selectedRole.person_name} belum diisi di Approver Pengesahan.</span>}
            </label>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Nama</span><input value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
              <label className="flex flex-col gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Jabatan (tercetak di form)</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Information Assets Administrator" className={input} /></label>
              <label className="flex flex-col gap-1.5"><span className="text-xs font-semibold text-muted-foreground">Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@jai.co.id" className={input} /></label>
            </div>
          )}

          <p className="text-xs text-muted-foreground">Pengajuan yang masih <strong>menunggu</strong> akan otomatis dikirim ulang ke approver baru (link lama tidak berlaku). Pengajuan yang sudah diputuskan tetap tercatat atas nama approver saat itu.</p>
          {message && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">{message.text}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving && <Loader2 className="size-4 animate-spin" />} Simpan</button>
            <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"><X className="size-4" /> Batal</button>
          </div>
        </div>
      )}
    </section>
  )
}
