// app/kelola-departemen/page.tsx

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Check, ChevronRight, Layers, Pencil, Plus, Search, Settings, X, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { AdminGate } from '@/components/admin-gate'

type Section = { id: number; department_id: number; name: string; slug: string }
type Department = { id: number; name: string; slug: string; sections: Section[] }

const inputClass = 'h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const iconButtonClass = 'grid size-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30'

// Monogram + accent tone for a department, derived from its own name — so
// each row in the directory reads as a distinct entry rather than a
// repeated generic icon. Cycles through the app's own theme tokens.
const monogramTones = [
  'bg-primary/10 text-primary',
  'bg-accent/20 text-accent-foreground',
  'bg-secondary text-secondary-foreground',
  'bg-muted text-muted-foreground',
]
function monogramFor(name: string) {
  return name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '—'
}

export default function KelolaDepartemenPage() {
  const { isLoggedIn, isLoading } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null)
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
  const selectedDepartment = filteredDepartments.find((dept) => dept.id === selectedDeptId) ?? filteredDepartments[0] ?? null

  if (!isLoading && !isLoggedIn) return <AdminGate />

  return (
    <div className="flex flex-col gap-7">
      <header className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8">
        <div className="absolute right-8 top-0 hidden h-full w-1/3 border-l border-primary-foreground/10 bg-[linear-gradient(135deg,transparent_25%,rgba(255,255,255,0.08)_25%,transparent_60%)] sm:block" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground"><Settings className="size-3.5" /> Admin workspace</div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Kelola struktur organisasi</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">Atur departemen dan section agar navigasi dokumen ISMS tetap rapi, konsisten, dan mudah ditemukan seluruh pengguna.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-primary-foreground/75"><span className="size-2 rounded-full bg-accent" /> Data tersinkronisasi</div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {([['Total departemen', departments.length, Building2, 'bg-primary/10 text-primary'], ['Total section', totalSections, Layers, 'bg-accent/20 text-accent-foreground'], ['Perlu dilengkapi', withoutSection, Settings, 'bg-secondary text-secondary-foreground']] as [string, number, LucideIcon, string][]).map(([label, value, Icon, tone]) => (
          <div key={label as string} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"><div className={`grid size-11 place-items-center rounded-2xl ${tone}`}><Icon className="size-5" /></div><div><div className="text-2xl font-semibold tracking-tight text-foreground">{value as number}</div><div className="text-xs font-medium text-muted-foreground">{label as string}</div></div></div>
        ))}
      </div>

      <div>
        <p className="portal-eyebrow">Direktori departemen</p>
        <p className="mt-1 text-sm text-muted-foreground">Pilih departemen di sebelah kiri untuk mengelola section di dalamnya.</p>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-border bg-card p-12 text-center text-sm text-muted-foreground shadow-sm">Memuat struktur departemen...</div>
      ) : departments.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-secondary/40 p-12 text-center text-sm text-muted-foreground">Belum ada departemen.</div>
      ) : (
        <div className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-sm lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Left rail: searchable department index */}
          <div className="flex flex-col border-b border-border lg:border-b-0 lg:border-r">
            <div className="border-b border-border p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari departemen atau section"
                  className="h-10 w-full rounded-xl border border-input bg-secondary/40 pl-9 pr-8 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:bg-card focus:ring-4 focus:ring-ring/15"
                />
                {query && <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Bersihkan pencarian"><X className="size-4" /></button>}
              </div>
            </div>
            <div className="flex-1 divide-y divide-border overflow-y-auto lg:max-h-[560px]">
              {filteredDepartments.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted-foreground">Tidak ada yang cocok.</div>}
              {filteredDepartments.map((dept, index) => {
                const isSelected = selectedDepartment?.id === dept.id
                const tone = monogramTones[index % monogramTones.length]
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => setSelectedDeptId(dept.id)}
                    className={`flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition ${isSelected ? 'border-l-primary bg-primary/5' : 'border-l-transparent hover:bg-secondary/50'}`}
                  >
                    <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold ${tone}`}>{monogramFor(dept.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${isSelected ? 'text-foreground' : 'text-foreground/80'}`}>{dept.name}</span>
                      <span className="block text-xs text-muted-foreground">{dept.sections.length} section</span>
                    </span>
                    <ChevronRight className={`size-4 shrink-0 transition ${isSelected ? 'text-primary' : 'text-muted-foreground/50'}`} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right panel: selected department's sections */}
          <div className="flex flex-col">
            {!selectedDepartment ? (
              <div className="flex flex-1 items-center justify-center p-12 text-center text-sm text-muted-foreground">Pilih departemen untuk melihat section-nya.</div>
            ) : (
              <>
                <div className="flex items-start gap-4 border-b border-border bg-secondary/30 p-5">
                  <span className={`grid size-12 shrink-0 place-items-center rounded-2xl text-sm font-bold ${monogramTones[filteredDepartments.findIndex((d) => d.id === selectedDepartment.id) % monogramTones.length]}`}>
                    {monogramFor(selectedDepartment.name)}
                  </span>
                  {editingDeptId === selectedDepartment.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input value={deptDraft} onChange={(event) => setDeptDraft(event.target.value)} autoFocus className={inputClass} />
                      <button onClick={() => saveDepartmentName(selectedDepartment.id)} className={`${iconButtonClass} text-primary`} aria-label="Simpan"><Check className="size-4" /></button>
                      <button onClick={() => setEditingDeptId(null)} className={iconButtonClass} aria-label="Batal"><X className="size-4" /></button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-semibold text-foreground">{selectedDepartment.name}</h3>
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border"><Layers className="size-3.5 text-primary" /> {selectedDepartment.sections.length} section</div>
                      </div>
                      <button onClick={() => { setEditingDeptId(selectedDepartment.id); setDeptDraft(selectedDepartment.name) }} className={iconButtonClass} aria-label={`Edit ${selectedDepartment.name}`}><Pencil className="size-4" /></button>
                    </>
                  )}
                </div>

                <div className="flex flex-1 flex-col divide-y divide-border p-2">
                  {selectedDepartment.sections.map((section) => (
                    <div key={section.id} className="group/row flex items-center justify-between gap-3 rounded-xl px-3 py-3.5 transition hover:bg-primary/5">
                      {editingSectionId === section.id ? (
                        <div className="flex flex-1 items-center gap-2">
                          <input value={sectionDraft} onChange={(event) => setSectionDraft(event.target.value)} autoFocus className={inputClass} />
                          <button onClick={() => saveSectionName(section.id)} className={`${iconButtonClass} text-primary`} aria-label="Simpan"><Check className="size-4" /></button>
                          <button onClick={() => setEditingSectionId(null)} className={iconButtonClass} aria-label="Batal"><X className="size-4" /></button>
                        </div>
                      ) : (
                        <>
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground"><ChevronRight className="size-3.5" /></span>
                            <span className="truncate text-sm font-medium text-foreground/85">{section.name}</span>
                          </div>
                          <button onClick={() => { setEditingSectionId(section.id); setSectionDraft(section.name) }} className={`${iconButtonClass} size-8 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100`} aria-label={`Edit ${section.name}`}><Pencil className="size-3.5" /></button>
                        </>
                      )}
                    </div>
                  ))}
                  {selectedDepartment.sections.length === 0 && <div className="px-3 py-10 text-center text-sm text-muted-foreground">Belum ada section di departemen ini.</div>}
                  {addingSectionFor === selectedDepartment.id && (
                    <div className="flex items-center gap-2 px-3 py-2">
                      <input value={newSectionName} onChange={(event) => setNewSectionName(event.target.value)} placeholder="Nama section baru" autoFocus className={inputClass} />
                      <button onClick={() => addSection(selectedDepartment.id)} className={`${iconButtonClass} text-primary`} aria-label="Simpan section"><Check className="size-4" /></button>
                      <button onClick={() => setAddingSectionFor(null)} className={iconButtonClass} aria-label="Batal"><X className="size-4" /></button>
                    </div>
                  )}
                </div>

                {addingSectionFor !== selectedDepartment.id && (
                  <button onClick={() => { setAddingSectionFor(selectedDepartment.id); setNewSectionName('') }} className="flex items-center justify-center gap-2 border-t border-border px-5 py-3.5 text-xs font-semibold text-primary transition hover:bg-primary/5">
                    <Plus className="size-4" /> Tambah section
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}