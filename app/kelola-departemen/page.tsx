'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Check, ChevronRight, Layers, Pencil, Plus, Search, Settings, X, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'

type Section = { id: number; department_id: number; name: string; slug: string }
type Department = { id: number; name: string; slug: string; sections: Section[] }

const inputClass = 'h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10'
const iconButtonClass = 'grid size-9 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30'

export default function KelolaDepartemenPage() {
  const { isLoggedIn, isLoading } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null)
  const [deptDraft, setDeptDraft] = useState('')
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null)
  const [sectionDraft, setSectionDraft] = useState('')
  const [addingSectionFor, setAddingSectionFor] = useState<number | null>(null)
  const [newSectionName, setNewSectionName] = useState('')

  const loadDepartments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' })
      const data = await res.json()
      setDepartments(data.departments ?? [])
    } catch { setDepartments([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadDepartments() }, [loadDepartments])

  const saveDepartmentName = async (id: number) => {
    if (!deptDraft.trim()) return
    await fetch(`${API_BASE_PATH}/api/departments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: deptDraft.trim() }) })
    setEditingDeptId(null); loadDepartments()
  }
  const saveSectionName = async (id: number) => {
    if (!sectionDraft.trim()) return
    await fetch(`${API_BASE_PATH}/api/sections/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: sectionDraft.trim() }) })
    setEditingSectionId(null); loadDepartments()
  }
  const addSection = async (departmentId: number) => {
    if (!newSectionName.trim()) return
    await fetch(`${API_BASE_PATH}/api/departments/${departmentId}/sections`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newSectionName.trim() }) })
    setAddingSectionFor(null); setNewSectionName(''); loadDepartments()
  }

  const totalSections = useMemo(() => departments.reduce((sum, dept) => sum + dept.sections.length, 0), [departments])
  const withoutSection = useMemo(() => departments.filter((dept) => dept.sections.length === 0).length, [departments])
  const filteredDepartments = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return departments
    return departments.filter((dept) => dept.name.toLowerCase().includes(value) || dept.sections.some((section) => section.name.toLowerCase().includes(value)))
  }, [departments, query])

  if (!isLoading && !isLoggedIn) return <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm"><p className="text-sm text-slate-500">Halaman ini khusus untuk admin yang sudah login.</p></section>

  return (
    <div className="flex flex-col gap-7">
      <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-8">
        <div className="absolute right-8 top-0 hidden h-full w-1/3 border-l border-white/10 bg-[linear-gradient(135deg,transparent_25%,rgba(45,212,191,0.12)_25%,transparent_60%)] sm:block" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-200"><Settings className="size-3.5" /> Admin workspace</div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Kelola struktur organisasi</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Atur departemen dan section agar navigasi dokumen ISMS tetap rapi, konsisten, dan mudah ditemukan seluruh pengguna.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300"><span className="size-2 rounded-full bg-teal-300" /> Data tersinkronisasi</div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {([['Total departemen', departments.length, Building2, 'text-teal-700 bg-teal-50'], ['Total section', totalSections, Layers, 'text-sky-700 bg-sky-50'], ['Perlu dilengkapi', withoutSection, Settings, 'text-amber-700 bg-amber-50']] as [string, number, LucideIcon, string][]).map(([label, value, Icon, tone]) => (
          <div key={label as string} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`grid size-11 place-items-center rounded-2xl ${tone}`}><Icon className="size-5" /></div><div><div className="text-2xl font-semibold tracking-tight text-slate-900">{value as number}</div><div className="text-xs font-medium text-slate-500">{label as string}</div></div></div>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-slate-900">Direktori departemen</h2><p className="mt-1 text-sm text-slate-500">Pilih departemen untuk mengelola section di dalamnya.</p></div><div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari departemen atau section" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10" />{query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Bersihkan pencarian"><X className="size-4" /></button>}</div></div>

      {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">Memuat struktur departemen...</div> : filteredDepartments.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-sm text-slate-500">Tidak ada departemen yang cocok dengan pencarian.</div> : <div className="grid gap-5 lg:grid-cols-2">{filteredDepartments.map((dept) => <div key={dept.id} className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5">
        <div className="flex items-start gap-4 border-b border-slate-100 bg-slate-50/70 p-5"><div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-slate-900 text-teal-300 shadow-sm"><Building2 className="size-5" /></div>{editingDeptId === dept.id ? <div className="flex flex-1 items-center gap-2"><input value={deptDraft} onChange={(event) => setDeptDraft(event.target.value)} autoFocus className={inputClass} /><button onClick={() => saveDepartmentName(dept.id)} className={`${iconButtonClass} text-teal-700`} aria-label="Simpan"><Check className="size-4" /></button><button onClick={() => setEditingDeptId(null)} className={iconButtonClass} aria-label="Batal"><X className="size-4" /></button></div> : <><div className="min-w-0 flex-1"><h3 className="truncate text-base font-semibold text-slate-900">{dept.name}</h3><div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200"><Layers className="size-3.5 text-teal-700" /> {dept.sections.length} section</div></div><button onClick={() => { setEditingDeptId(dept.id); setDeptDraft(dept.name) }} className={iconButtonClass} aria-label={`Edit ${dept.name}`}><Pencil className="size-4" /></button></>}</div>
        <div className="flex flex-1 flex-col divide-y divide-slate-100 p-2">{dept.sections.map((section) => <div key={section.id} className="group/row flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition hover:bg-teal-50/60">{editingSectionId === section.id ? <div className="flex flex-1 items-center gap-2"><input value={sectionDraft} onChange={(event) => setSectionDraft(event.target.value)} autoFocus className={inputClass} /><button onClick={() => saveSectionName(section.id)} className={`${iconButtonClass} text-teal-700`} aria-label="Simpan"><Check className="size-4" /></button><button onClick={() => setEditingSectionId(null)} className={iconButtonClass} aria-label="Batal"><X className="size-4" /></button></div> : <><div className="flex min-w-0 items-center gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400"><ChevronRight className="size-3.5" /></span><span className="truncate text-sm font-medium text-slate-700">{section.name}</span></div><button onClick={() => { setEditingSectionId(section.id); setSectionDraft(section.name) }} className={`${iconButtonClass} size-8 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100`} aria-label={`Edit ${section.name}`}><Pencil className="size-3.5" /></button></>}</div>)}{dept.sections.length === 0 && <div className="px-3 py-7 text-center text-sm text-slate-400">Belum ada section di departemen ini.</div>}{addingSectionFor === dept.id && <div className="flex items-center gap-2 px-3 py-2"><input value={newSectionName} onChange={(event) => setNewSectionName(event.target.value)} placeholder="Nama section baru" autoFocus className={inputClass} /><button onClick={() => addSection(dept.id)} className={`${iconButtonClass} text-teal-700`} aria-label="Simpan section"><Check className="size-4" /></button><button onClick={() => setAddingSectionFor(null)} className={iconButtonClass} aria-label="Batal"><X className="size-4" /></button></div>}</div>
        {addingSectionFor !== dept.id && <button onClick={() => { setAddingSectionFor(dept.id); setNewSectionName('') }} className="flex items-center justify-center gap-2 border-t border-slate-100 px-5 py-3.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"><Plus className="size-4" /> Tambah section</button>}
      </div>)}</div>}
    </div>
  )
}
