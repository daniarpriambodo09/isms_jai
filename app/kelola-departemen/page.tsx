// app/kelola-departemen/page.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Check, ChevronRight, Layers, Pencil, Plus, Settings, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'

type Section = { id: number; department_id: number; name: string; slug: string }
type Department = { id: number; name: string; slug: string; sections: Section[] }

export default function KelolaDepartemenPage() {
  const { isLoggedIn, isLoading } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

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
    } catch {
      setDepartments([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDepartments()
  }, [loadDepartments])

  const saveDepartmentName = async (id: number) => {
    if (!deptDraft.trim()) return
    await fetch(`${API_BASE_PATH}/api/departments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: deptDraft.trim() }),
    })
    setEditingDeptId(null)
    loadDepartments()
  }

  const saveSectionName = async (id: number) => {
    if (!sectionDraft.trim()) return
    await fetch(`${API_BASE_PATH}/api/sections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: sectionDraft.trim() }),
    })
    setEditingSectionId(null)
    loadDepartments()
  }

  const addSection = async (departmentId: number) => {
    if (!newSectionName.trim()) return
    await fetch(`${API_BASE_PATH}/api/departments/${departmentId}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSectionName.trim() }),
    })
    setAddingSectionFor(null)
    setNewSectionName('')
    loadDepartments()
  }

  const totalSections = useMemo(
    () => departments.reduce((sum, dept) => sum + dept.sections.length, 0),
    [departments]
  )
  const withoutSection = useMemo(
    () => departments.filter((dept) => dept.sections.length === 0).length,
    [departments]
  )

  const inputClass =
    'h-9 flex-1 rounded-[7px] border border-[#dce6ed] bg-white px-3 text-[13px] text-[#20354a] outline-none ring-0 transition-colors focus:border-[#278e84] focus:ring-2 focus:ring-[#278e84]/[0.15]'
  const confirmBtn =
    'grid h-9 w-9 flex-none place-items-center rounded-[7px] text-[#278e84] hover:bg-[#e1f4f0]'
  const cancelBtn =
    'grid h-9 w-9 flex-none place-items-center rounded-[7px] text-[#8798a8] hover:bg-[#eef1f4]'

  if (!isLoading && !isLoggedIn) {
    return (
      <section className="rounded-2xl border border-[#e6ecf3] bg-white p-[27px] text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <p className="text-[13px] text-[#75889c]">Halaman ini khusus untuk admin yang sudah login.</p>
      </section>
    )
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-[9px] flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-[#7290a5]">
            <Settings className="h-[12px] w-[12px]" /> ADMIN
          </div>
          <h2 className="text-[22px] text-[#20354a] tracking-[-0.025em]">Kelola Departemen</h2>
          <p className="mt-[7px] max-w-[520px] text-[13px] leading-[1.5] text-[#75889c]">
            Edit nama departemen/section, atau tambahkan section untuk departemen yang belum memilikinya.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="rounded-2xl border border-[#e6ecf3] bg-white px-4 py-3 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <div className="text-[20px] font-bold leading-none text-[#20354a]">{departments.length}</div>
            <div className="mt-[5px] text-[10px] uppercase tracking-[0.08em] text-[#8599a8]">Departemen</div>
          </div>
          <div className="rounded-2xl border border-[#e6ecf3] bg-white px-4 py-3 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <div className="text-[20px] font-bold leading-none text-[#20354a]">{totalSections}</div>
            <div className="mt-[5px] text-[10px] uppercase tracking-[0.08em] text-[#8599a8]">Section</div>
          </div>
          <div className="rounded-2xl border border-[#e6ecf3] bg-white px-4 py-3 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <div className="text-[20px] font-bold leading-none text-[#b17625]">{withoutSection}</div>
            <div className="mt-[5px] text-[10px] uppercase tracking-[0.08em] text-[#8599a8]">Tanpa Section</div>
          </div>
        </div>
      </div>

      {loading && (
        <p className="rounded-[12px] border border-[#e6ecf3] bg-white p-6 text-center text-[12px] text-[#8599a8] shadow-[0_4px_14px_rgba(30,49,71,0.05)]">
          Memuat data...
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
        {departments.map((dept) => (
          <div
            key={dept.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-[#e6ecf3] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
          >
            {/* Department header */}
            <div className="flex items-center gap-3 border-b border-[#eef1f4] px-4 py-[14px]">
              <div className="grid h-9 w-9 flex-none place-items-center rounded-[9px] bg-[#e6f1f8] text-[#3178a4]">
                <Building2 className="h-[17px] w-[17px]" />
              </div>

              {editingDeptId === dept.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    value={deptDraft}
                    onChange={(event) => setDeptDraft(event.target.value)}
                    autoFocus
                    className={inputClass}
                  />
                  <button onClick={() => saveDepartmentName(dept.id)} className={confirmBtn} aria-label="Simpan">
                    <Check className="w-4" />
                  </button>
                  <button onClick={() => setEditingDeptId(null)} className={cancelBtn} aria-label="Batal">
                    <X className="w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-[#20354a]">{dept.name}</div>
                    <div className="mt-[2px] flex items-center gap-1 text-[10px] font-medium text-[#8599a8]">
                      <Layers className="h-[11px] w-[11px]" />
                      {dept.sections.length > 0 ? `${dept.sections.length} section` : 'Belum ada section'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditingDeptId(dept.id)
                      setDeptDraft(dept.name)
                    }}
                    aria-label={`Edit ${dept.name}`}
                    className="grid h-8 w-8 flex-none place-items-center rounded-[7px] text-[#8798a8] hover:bg-[#f0f4f7] hover:text-[#3c5369] [&>svg]:w-[14px]"
                  >
                    <Pencil />
                  </button>
                </>
              )}
            </div>

            {/* Sections list */}
            <div className="flex-1 divide-y divide-[#f0f3f6]">
              {dept.sections.map((section) => (
                <div
                  key={section.id}
                  className="group flex items-center justify-between gap-3 px-4 py-[10px] hover:bg-[#fafbfc]"
                >
                  {editingSectionId === section.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        value={sectionDraft}
                        onChange={(event) => setSectionDraft(event.target.value)}
                        autoFocus
                        className={inputClass}
                      />
                      <button onClick={() => saveSectionName(section.id)} className={confirmBtn} aria-label="Simpan">
                        <Check className="w-4" />
                      </button>
                      <button onClick={() => setEditingSectionId(null)} className={cancelBtn} aria-label="Batal">
                        <X className="w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-[10px]">
                        <ChevronRight className="h-[13px] w-[13px] text-[#c3cfd9]" />
                        <span className="text-[13px] text-[#3c5369]">{section.name}</span>
                      </div>
                      <button
                        onClick={() => {
                          setEditingSectionId(section.id)
                          setSectionDraft(section.name)
                        }}
                        aria-label={`Edit ${section.name}`}
                        className="grid h-7 w-7 flex-none place-items-center rounded-[6px] text-[#a7b4bf] opacity-0 transition-opacity hover:bg-[#eef1f4] hover:text-[#3c5369] group-hover:opacity-100 [&>svg]:w-[13px]"
                      >
                        <Pencil />
                      </button>
                    </>
                  )}
                </div>
              ))}

              {addingSectionFor === dept.id && (
                <div className="flex items-center gap-2 px-4 py-[10px]">
                  <input
                    value={newSectionName}
                    onChange={(event) => setNewSectionName(event.target.value)}
                    placeholder="Nama section baru"
                    autoFocus
                    className={inputClass}
                  />
                  <button onClick={() => addSection(dept.id)} className={confirmBtn} aria-label="Simpan section">
                    <Check className="w-4" />
                  </button>
                  <button onClick={() => setAddingSectionFor(null)} className={cancelBtn} aria-label="Batal">
                    <X className="w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Add-section affordance for departments with none yet */}
            {dept.sections.length === 0 && addingSectionFor !== dept.id && (
              <button
                onClick={() => {
                  setAddingSectionFor(dept.id)
                  setNewSectionName('')
                }}
                className="flex items-center justify-center gap-[6px] border-t border-dashed border-[#d7e6e4] px-4 py-[11px] text-[12px] font-medium text-[#278e84] hover:bg-[#f2faf8] [&>svg]:w-[14px]"
              >
                <Plus /> Tambah Section
              </button>
            )}

            {dept.sections.length > 0 && addingSectionFor !== dept.id && (
              <button
                onClick={() => {
                  setAddingSectionFor(dept.id)
                  setNewSectionName('')
                }}
                className="flex items-center justify-center gap-[6px] border-t border-[#f0f3f6] px-4 py-[10px] text-[11px] font-medium text-[#8599a8] hover:bg-[#fafbfc] hover:text-[#278e84] [&>svg]:w-[13px]"
              >
                <Plus /> Tambah section lain
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  )
}