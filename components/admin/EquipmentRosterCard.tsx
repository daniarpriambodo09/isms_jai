// components/admin/EquipmentRosterCard.tsx
//
// Generic "code + optional department" roster manager — used for both
// Kontrol No. Kamera and No. ID Photography on /kelola-kamera, since both
// are the exact same shape (camera_equipment / photo_id_equipment) and UI.

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { ConfirmDialog } from '@/components/confirm-dialog'

type Section = { id: number; department_id: number; name: string; slug: string }
type Department = { id: number; name: string; sections: Section[] }
type Item = {
  id: number
  code: string
  department_id: number | null
  department_name: string | null
  section_id: number | null
  section_name: string | null
}

const inputClass = 'h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const iconButtonClass = 'grid size-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30'
const ALL_DEPARTMENTS_GROUP = 'Semua Departemen'
const ALL_SECTIONS_OPTION = 'Semua Section'

export function EquipmentRosterCard({
  title,
  addLabel,
  codeLabel,
  placeholder,
  apiPath,
  listKey,
  departments,
}: {
  title: string
  addLabel: string
  codeLabel: string
  placeholder: string
  apiPath: string
  listKey: string
  departments: Department[]
}) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  const [addingOpen, setAddingOpen] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newDeptId, setNewDeptId] = useState('')
  const [newSectionId, setNewSectionId] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editDeptId, setEditDeptId] = useState('')
  const [editSectionId, setEditSectionId] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const sectionsFor = useCallback(
    (deptId: string) => departments.find((d) => String(d.id) === deptId)?.sections ?? [],
    [departments]
  )

  const [pendingDelete, setPendingDelete] = useState<Item | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [listError, setListError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}${apiPath}`, { cache: 'no-store' })
      const data = await res.json()
      setItems(data[listKey] ?? [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [apiPath, listKey])

  useEffect(() => { load() }, [load])

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const item of items) {
      const key = item.department_name ?? ALL_DEPARTMENTS_GROUP
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    const entries = Array.from(map.entries())
    entries.sort(([a], [b]) => (a === ALL_DEPARTMENTS_GROUP ? -1 : b === ALL_DEPARTMENTS_GROUP ? 1 : a.localeCompare(b)))
    return entries
  }, [items])

  const submitAdd = async () => {
    if (!newCode.trim()) return
    setAdding(true)
    setAddError('')
    try {
      const res = await fetch(`${API_BASE_PATH}${apiPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newCode.trim(), departmentId: newDeptId || null, sectionId: newSectionId || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Gagal menambahkan.')
      setNewCode(''); setNewDeptId(''); setNewSectionId(''); setAddingOpen(false)
      await load()
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setAdding(false)
    }
  }

  const startEdit = (item: Item) => {
    setEditingId(item.id)
    setEditCode(item.code)
    setEditDeptId(item.department_id ? String(item.department_id) : '')
    setEditSectionId(item.section_id ? String(item.section_id) : '')
    setEditError('')
  }

  const submitEdit = async (id: number) => {
    if (!editCode.trim()) return
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`${API_BASE_PATH}${apiPath}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: editCode.trim(), departmentId: editDeptId || null, sectionId: editSectionId || null }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message ?? 'Gagal menyimpan perubahan.')
      setEditingId(null)
      await load()
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setEditSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    setListError('')
    try {
      const res = await fetch(`${API_BASE_PATH}${apiPath}/${pendingDelete.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setListError(data?.message ?? 'Gagal menghapus.')
        return
      }
      await load()
    } catch {
      setListError('Tidak dapat menghubungi server.')
    } finally {
      setDeleting(false)
      setPendingDelete(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <button
          type="button"
          onClick={() => { setAddingOpen(true); setNewCode(''); setNewDeptId(''); setNewSectionId(''); setAddError('') }}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5"
        >
          <Plus className="size-4" /> {addLabel}
        </button>
      </div>

      {listError && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{listError}</p>}

      {addingOpen && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tambah {codeLabel.toLowerCase()} baru</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder={placeholder} autoFocus className={inputClass} />
            <select value={newDeptId} onChange={(e) => { setNewDeptId(e.target.value); setNewSectionId('') }} className={inputClass}>
              <option value="">{ALL_DEPARTMENTS_GROUP}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={newSectionId} onChange={(e) => setNewSectionId(e.target.value)} disabled={!newDeptId} className={`${inputClass} disabled:opacity-50`}>
              <option value="">{ALL_SECTIONS_OPTION}</option>
              {sectionsFor(newDeptId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="flex items-center gap-1.5">
              <button onClick={submitAdd} disabled={adding || !newCode.trim()} className={`${iconButtonClass} text-primary disabled:opacity-50`} aria-label="Simpan"><Check className="size-4" /></button>
              <button onClick={() => setAddingOpen(false)} className={iconButtonClass} aria-label="Batal"><X className="size-4" /></button>
            </div>
          </div>
          {addError && <p className="mt-2 text-xs text-destructive">{addError}</p>}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">Memuat daftar {codeLabel.toLowerCase()}...</div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-secondary/40 p-10 text-center text-sm text-muted-foreground">Belum ada {codeLabel.toLowerCase()}.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([deptName, groupItems]) => (
            <div key={deptName} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-secondary/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {deptName} <span className="ml-1 font-normal normal-case text-muted-foreground/70">({groupItems.length})</span>
              </div>
              <div className="flex flex-col divide-y divide-border">
                {groupItems.map((item) => (
                  <div key={item.id} className="group/row flex items-center justify-between gap-3 px-4 py-3">
                    {editingId === item.id ? (
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input value={editCode} onChange={(e) => setEditCode(e.target.value)} autoFocus className={inputClass} />
                          <select value={editDeptId} onChange={(e) => { setEditDeptId(e.target.value); setEditSectionId('') }} className={inputClass}>
                            <option value="">{ALL_DEPARTMENTS_GROUP}</option>
                            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                          <select value={editSectionId} onChange={(e) => setEditSectionId(e.target.value)} disabled={!editDeptId} className={`${inputClass} disabled:opacity-50`}>
                            <option value="">{ALL_SECTIONS_OPTION}</option>
                            {sectionsFor(editDeptId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => submitEdit(item.id)} disabled={editSaving || !editCode.trim()} className={`${iconButtonClass} text-primary disabled:opacity-50`} aria-label="Simpan"><Check className="size-4" /></button>
                            <button onClick={() => setEditingId(null)} className={iconButtonClass} aria-label="Batal"><X className="size-4" /></button>
                          </div>
                        </div>
                        {editError && <p className="text-xs text-destructive">{editError}</p>}
                      </div>
                    ) : (
                      <>
                        <span className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                          {item.code}
                          {item.section_name && (
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{item.section_name}</span>
                          )}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100">
                          <button onClick={() => startEdit(item)} className={`${iconButtonClass} size-8`} aria-label={`Edit ${item.code}`}><Pencil className="size-3.5" /></button>
                          <button onClick={() => setPendingDelete(item)} className={`${iconButtonClass} size-8 hover:bg-destructive/10 hover:text-destructive`} aria-label={`Hapus ${item.code}`} title={`Hapus ${codeLabel.toLowerCase()}`}><Trash2 className="size-3.5" /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Hapus ${codeLabel.toLowerCase()}?`}
        message={`Kode "${pendingDelete?.code}" akan dihapus dari daftar. Pengajuan yang sudah mencatat kode ini tetap tersimpan (riwayatnya tidak berubah).`}
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
