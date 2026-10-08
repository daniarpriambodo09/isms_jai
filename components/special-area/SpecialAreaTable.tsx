'use client'

// List of special-area requests — shared by the Lobby kiosk panel and the
// ISMS admin page. Kiosk roles pick the PIC Pendamping, fill in the ID Card
// No. and resend the approval email; deleting is ISM Admin only (canDelete).

import { useState } from 'react'
import { Check, FileSignature, Loader2, Pencil, ScanLine, Send, Trash2, X } from 'lucide-react'
import { EscortPicker, useEscortList } from '@/components/escort-picker'
import { cardsChanged } from '@/components/kiosk/kiosk-shared'
import { API_BASE_PATH } from '@/lib/config'
import type { Escort, SpecialAreaRequest } from '@/lib/special-area-shared'

const BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Menunggu', cls: 'bg-[#fff3d6] text-[#8a6100]' },
  approved: { label: 'Disetujui', cls: 'bg-[#dff5e6] text-[#1a6e3a]' },
  rejected: { label: 'Ditolak', cls: 'bg-[#fdecec] text-[#b3413a]' },
}

function fmt(value: string) {
  return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ID Card No.: typed, or scanned — "Scan" empties the field and waits for the
// barcode scanner, which types the number and presses Enter (= save).
function IdCardCell({ req, onChanged }: { req: SpecialAreaRequest; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [value, setValue] = useState(req.id_card_no ?? '')
  const [saving, setSaving] = useState(false)
  const close = () => { setEditing(false); setScanning(false) }
  const save = async () => {
    // A scan that read nothing saves nothing (the old number stays).
    if (scanning && !value.trim()) { close(); return }
    setSaving(true)
    await fetch(`${API_BASE_PATH}/api/special-area-requests/${req.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setIdCard', idCardNo: value }) }).catch(() => {})
    setSaving(false)
    close()
    onChanged()
    cardsChanged()
  }
  const startScan = () => { setValue(''); setScanning(true); setEditing(true) }
  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus placeholder={scanning ? 'Scan kartu…' : ''} aria-label={scanning ? 'Scan ID Card No.' : 'ID Card No.'} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } if (e.key === 'Escape') close() }} className={`h-8 w-28 rounded-lg border bg-card px-2 font-mono text-xs outline-none ${scanning ? 'border-emerald-500 ring-2 ring-emerald-500/25' : 'border-input focus:border-ring'}`} />
        <button type="button" onClick={save} disabled={saving} aria-label="Simpan" className="grid size-7 place-items-center rounded-md text-emerald-700 hover:bg-emerald-600/10">{saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}</button>
        <button type="button" onClick={close} aria-label="Batal" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary"><X className="size-3.5" /></button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => { setValue(req.id_card_no ?? ''); setEditing(true) }} className="group inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-xs text-foreground" title="Isi / ubah ID Card No.">
        {req.id_card_no || <span className="font-sans text-muted-foreground">— isi</span>}
        <Pencil className="size-3 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      </button>
      <button type="button" onClick={startScan} aria-label={`Scan ID Card untuk ${req.requester_name}`} title="Scan barcode kartu dengan alat scanner" className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border px-1.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground">
        <ScanLine className="size-3.5" /> Scan
      </button>
    </div>
  )
}

// PIC Pendamping: Lobby / Pos Security pick who accompanies the guest (components/escort-picker.tsx).
function EscortCell({ req, escorts, onChanged }: { req: SpecialAreaRequest; escorts: Escort[]; onChanged: () => void }) {
  return (
    <EscortPicker
      current={req.escort_name ? { name: req.escort_name, dept: req.escort_dept } : null}
      setBy={req.escort_set_by}
      escorts={escorts}
      closed={req.status === 'rejected'}
      // An approved permit still in force without an escort needs one before the guest goes in.
      urgent={req.status === 'approved' && Date.parse(req.to_at) > Date.now()}
      onSave={async (choice) => {
        const res = await fetch(`${API_BASE_PATH}/api/special-area-requests/${req.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setEscort', ...choice }) }).catch(() => null)
        if (res?.ok) onChanged()
        return !!res?.ok
      }}
    />
  )
}

export function SpecialAreaTable({ requests, loading, canDelete, onChanged, onDelete }: {
  requests: SpecialAreaRequest[]
  loading: boolean
  canDelete?: boolean
  onChanged: () => void
  onDelete?: (req: SpecialAreaRequest) => void
}) {
  const [resending, setResending] = useState<number | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const escorts = useEscortList()

  const resend = async (req: SpecialAreaRequest) => {
    setResending(req.id)
    setNotice(null)
    const res = await fetch(`${API_BASE_PATH}/api/special-area-requests/${req.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resend' }) }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    setNotice({ ok: !!res?.ok, text: data.message ?? (res?.ok ? 'Email dikirim ulang.' : 'Gagal mengirim ulang.') })
    setResending(null)
    onChanged()
  }

  return (
    <div className="flex flex-col gap-3">
      {notice && <p className={`rounded-lg border px-3 py-2 text-xs ${notice.ok ? 'border-emerald-600/25 bg-emerald-600/10 text-emerald-800' : 'border-destructive/20 bg-destructive/10 text-destructive'}`}>{notice.text}</p>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="admin-table w-full min-w-[920px] text-sm">
          <thead className="bg-secondary/55">
            <tr>{['Nama / Perusahaan', 'Area', 'Waktu Masuk – Keluar', 'PIC Pendamping', 'ID Card No.', 'Status', 'Aksi'].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto size-6 animate-spin" /></td></tr>}
            {!loading && requests.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">Belum ada pengajuan.</td></tr>}
            {!loading && requests.map((r) => {
              const badge = BADGE[r.status]
              return (
                <tr key={r.id} className="align-top">
                  <td data-cell="title" className="px-4 py-3"><p className="font-medium text-foreground">{r.requester_name}</p><p className="text-xs text-muted-foreground">{r.org_company}{r.department ? ` · ${r.department}` : ''}</p><p className="mt-0.5 max-w-[240px] text-xs text-muted-foreground">Tujuan: {r.purpose}</p><p className="mt-1 text-[11px] text-muted-foreground/80">Diajukan {fmt(r.submitted_at)}{r.submitted_by ? ` · ${r.submitted_by}` : ''}</p></td>
                  <td data-label="Area" className="px-4 py-3"><span className="inline-flex whitespace-nowrap rounded-md bg-red-600/10 px-2 py-0.5 text-xs font-semibold text-red-700">{r.area}</span></td>
                  <td data-label="Masuk – Keluar" className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{fmt(r.from_at)}<br />{fmt(r.to_at)}</td>
                  <td data-label="PIC Pendamping" className="px-4 py-3"><EscortCell req={r} escorts={escorts} onChanged={onChanged} /></td>
                  <td data-label="ID Card No." className="px-4 py-3"><IdCardCell req={r} onChanged={onChanged} /></td>
                  <td data-label="Status" className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                    {r.decided_at && <span className="mt-1 block text-[11px] text-muted-foreground">{r.approver_name} · {fmt(r.decided_at)}</span>}
                    {r.status === 'pending' && r.approver_name && <span className="mt-1 block text-[11px] text-muted-foreground">Menunggu {r.approver_name}</span>}
                    {r.status === 'pending' && r.email_error && <span className="mt-1 block max-w-[220px] text-[11px] text-destructive">{r.email_error}</span>}
                    {r.status === 'rejected' && r.decision_note && <span className="mt-1 block max-w-[220px] text-[11px] text-destructive">Alasan: {r.decision_note}</span>}
                  </td>
                  <td data-cell="actions" className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {r.status !== 'pending' && (
                        <a href={`${API_BASE_PATH}/api/special-area-requests/${r.id}/pdf`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold text-foreground hover:bg-secondary">
                          <FileSignature className="size-3.5" /> PDF
                        </a>
                      )}
                      {r.status === 'pending' && (
                        <button type="button" onClick={() => resend(r)} disabled={resending === r.id} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50">
                          {resending === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Kirim ulang
                        </button>
                      )}
                      {canDelete && onDelete && (
                        <button type="button" onClick={() => onDelete(r)} aria-label={`Hapus pengajuan ${r.requester_name}`} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
