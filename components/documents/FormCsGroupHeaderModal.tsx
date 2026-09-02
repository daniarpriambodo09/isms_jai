'use client'

import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import type { FormCsGroupHeader } from '@/components/documents/FormCsSpreadsheetTable'

const inputClass = 'h-9 rounded-[7px] border border-[#dce6ed] bg-[#fbfcfd] px-3 text-[13px] text-[#20354a] outline-none focus:border-[#278e84]'

export function FormCsGroupHeaderModal({
  open,
  onClose,
  onSaved,
  category,
  groupHeaders,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  category: 'form-aplikasi' | 'kontrol-cs'
  groupHeaders: FormCsGroupHeader[]
}) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [label, setLabel] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) { setEditingId(null); setLabel(''); setSortOrder(groupHeaders.length); setError(null) }
  }, [open, groupHeaders.length])

  if (!open) return null

  const startEdit = (header: FormCsGroupHeader) => { setEditingId(header.id); setLabel(header.label); setSortOrder(header.sort_order) }
  const startAdd = () => { setEditingId(null); setLabel(''); setSortOrder(groupHeaders.length) }

  const save = async () => {
    if (!label.trim()) { setError('Label wajib diisi.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/form-cs/${category}/group-headers`, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, label: label.trim(), sortOrder }),
      })
      if (!response.ok) { const data = await response.json().catch(() => null); setError(data?.message ?? 'Gagal menyimpan.'); return }
      startAdd()
      onSaved()
    } catch { setError('Tidak dapat menghubungi server.') } finally { setSubmitting(false) }
  }

  const remove = async (id: number) => {
    if (!confirm('Hapus baris grup ini?')) return
    try {
      const response = await fetch(`${API_BASE_PATH}/api/form-cs/${category}/group-headers?id=${id}`, { method: 'DELETE' })
      if (!response.ok) { const data = await response.json().catch(() => null); setError(data?.message ?? 'Gagal menghapus.'); return }
      onSaved()
    } catch { setError('Tidak dapat menghubungi server.') }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(14,34,53,0.5)] p-4">
      <div className="w-full max-w-[480px] rounded-2xl bg-white p-6 shadow-[0_20px_50px_rgba(14,34,53,0.25)]">
        <div className="mb-5 flex items-start justify-between">
          <h2 className="text-[18px] font-bold text-[#20354a]">Kelola Baris Grup</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid h-8 w-8 place-items-center rounded-full text-[#8798a8] hover:bg-[#f0f4f7]"><X className="w-[18px]" /></button>
        </div>

        <div className="mb-4 flex flex-col gap-2">
          {groupHeaders.length === 0 && <p className="text-[12px] text-[#8798a8]">Belum ada baris grup.</p>}
          {groupHeaders.map((header) => (
            <div key={header.id} className="flex items-center justify-between gap-2 rounded-[7px] border border-[#e4edf2] px-3 py-2">
              <span className="truncate text-[12px] font-medium text-[#20354a]">{header.label}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => startEdit(header)} aria-label={`Edit ${header.label}`} className="grid size-7 place-items-center rounded text-[#7290a5] hover:bg-[#e4edf2]"><Pencil className="size-3.5" /></button>
                <button type="button" onClick={() => remove(header.id)} aria-label={`Hapus ${header.label}`} className="grid size-7 place-items-center rounded text-[#7290a5] hover:bg-[#fdecec] hover:text-[#b3413a]"><Trash2 className="size-3.5" /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-[#e4edf2] pt-4">
          <label className="flex flex-col gap-[6px]">
            <span className="text-[12px] font-medium text-[#3c5369]">Label</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Contoh: GENERAL SECURITY AREA ENTRANCE RECORD" className={inputClass} />
          </label>
          <label className="flex flex-col gap-[6px]">
            <span className="text-[12px] font-medium text-[#3c5369]">Urutan</span>
            <input type="number" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} className={inputClass} />
          </label>
          {error && <p className="rounded-[6px] bg-[#fdecec] px-3 py-2 text-[12px] text-[#b3413a]">{error}</p>}
          <div className="flex gap-2">
            {editingId && <button type="button" onClick={startAdd} className="flex-1 rounded-[7px] border border-[#dce6ed] py-2 text-[12px] font-medium text-[#3c5369] hover:bg-[#f5f8fa]">Batal Edit</button>}
            <button type="button" onClick={save} disabled={submitting} className="flex flex-1 items-center justify-center gap-1.5 rounded-[7px] bg-[#20354a] py-2 text-[12px] font-medium text-white hover:bg-[#284360] disabled:cursor-not-allowed disabled:opacity-60">
              {editingId ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
              {editingId ? 'Simpan Perubahan' : 'Tambah Baris Grup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
