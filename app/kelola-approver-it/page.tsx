// app/kelola-approver-it/page.tsx
'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  FileSignature,
  Users,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  RotateCcw,
  ShieldCheck,
  Mail,
  ArrowRight,
  ExternalLink,
  Laptop,
  Network,
  UserCheck,
  AlertCircle,
  HelpCircle,
  Settings2,
  ShieldAlert,
  Filter,
  Building,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { AdminGate } from '@/components/admin-gate'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { API_BASE_PATH } from '@/lib/config'
import { IT_FORM_DEFINITIONS, type ItFormApprover } from '@/lib/it-form-shared'

const inputClass =
  'h-10 w-full min-w-0 rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const labelClass = 'text-xs font-semibold text-foreground mb-1 block'

export default function KelolaApproverItPage() {
  const { isLoggedIn, adminUser } = useAuth()
  const [approvers, setApprovers] = useState<ItFormApprover[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFormCode, setSelectedFormCode] = useState<string>('ISMS-F-010-006')

  // Modal Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingApprover, setEditingApprover] = useState<ItFormApprover | null>(null)

  // Form Fields for Add/Edit
  const [formCode, setFormCode] = useState('ISMS-F-010-006')
  const [slotNumber, setSlotNumber] = useState(1)
  const [slotLabel, setSlotLabel] = useState('CHECK')
  const [roleTitle, setRoleTitle] = useState('')
  const [personName, setPersonName] = useState('')
  const [salutation, setSalutation] = useState('Bapak')
  const [initials, setInitials] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [availableDepts, setAvailableDepts] = useState<string[]>([])
  const [customDeptMode, setCustomDeptMode] = useState(false)
  const [filterDept, setFilterDept] = useState<string>('all')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/departments`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.departments)) {
          setAvailableDepts(data.departments.map((d: any) => d.name))
        }
      })
      .catch((err) => console.error('Failed to load departments:', err))
  }, [])

  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Delete Confirm
  const [pendingDelete, setPendingDelete] = useState<ItFormApprover | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Reset Confirm
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  const loadApprovers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-form-approvers`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data.approvers) {
        setApprovers(data.approvers)
      }
    } catch (err) {
      console.error('Failed to load IT approvers:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadApprovers()
  }, [loadApprovers])

  const currentFormDef = useMemo(() => {
    return IT_FORM_DEFINITIONS.find((d) => d.code === selectedFormCode) || IT_FORM_DEFINITIONS[0]
  }, [selectedFormCode])

  const filteredApprovers = useMemo(() => {
    return approvers
      .filter((a) => a.form_code === selectedFormCode)
      .filter((a) => {
        if (filterDept === 'all') return true
        if (filterDept === 'general') return !a.department || a.department === 'Departemen Pemohon'
        return a.department === filterDept
      })
      .sort((a, b) => (a.sort_order || a.slot_number) - (b.sort_order || b.slot_number))
  }, [approvers, selectedFormCode, filterDept])

  const openAddModal = () => {
    setEditingApprover(null)
    setFormCode(selectedFormCode)
    const nextSlot = filteredApprovers.length + 1
    setSlotNumber(nextSlot)
    setSlotLabel(nextSlot === 1 ? 'CHECK' : nextSlot === 2 ? 'MENGETAHUI' : 'MENYETUJUI')
    setRoleTitle('')
    setPersonName('')
    setSalutation('Bapak')
    setInitials('')
    setEmail('')
    setCustomDeptMode(false)
    setDepartment(selectedFormCode === 'ISMS-F-02-00-002' ? 'Information Assets Administrator' : 'IT Section')
    setIsActive(true)
    setModalError('')
    setIsModalOpen(true)
  }

  const openEditModal = (item: ItFormApprover) => {
    setEditingApprover(item)
    setFormCode(item.form_code)
    setSlotNumber(item.slot_number)
    setSlotLabel(item.slot_label)
    setRoleTitle(item.role_title)
    setPersonName(item.person_name)
    setSalutation(item.salutation || 'Bapak')
    setInitials(item.initials || '')
    setEmail(item.email || '')
    const deptVal = item.department || ''
    setDepartment(deptVal)
    const isStandard =
      !deptVal ||
      ['Departemen Pemohon', 'IT Section', 'Information Assets Administrator'].includes(deptVal) ||
      availableDepts.includes(deptVal)
    setCustomDeptMode(!isStandard && Boolean(deptVal))
    setIsActive(item.is_active)
    setModalError('')
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roleTitle.trim() || !personName.trim()) {
      setModalError('Jabatan Approver dan Nama Pejabat wajib diisi.')
      return
    }

    setSaving(true)
    setModalError('')
    try {
      if (editingApprover) {
        // Update
        const res = await fetch(`${API_BASE_PATH}/api/it-form-approvers/${editingApprover.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slot_number: slotNumber,
            slot_label: slotLabel.trim().toUpperCase(),
            role_title: roleTitle.trim(),
            person_name: personName.trim(),
            salutation,
            initials: initials.trim().toUpperCase(),
            email: email.trim() || null,
            department: department.trim() || null,
            is_active: isActive,
            sort_order: slotNumber,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan perubahan.')
        setSuccessMsg(`Berhasil memperbarui data pejabat: ${personName}`)
      } else {
        // Add
        const res = await fetch(`${API_BASE_PATH}/api/it-form-approvers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            form_code: formCode,
            slot_number: slotNumber,
            slot_label: slotLabel.trim().toUpperCase(),
            role_title: roleTitle.trim(),
            person_name: personName.trim(),
            salutation,
            initials: initials.trim().toUpperCase(),
            email: email.trim() || null,
            department: department.trim() || null,
            is_active: isActive,
            sort_order: slotNumber,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal menambahkan approver baru.')
        setSuccessMsg(`Berhasil menambahkan approver baru: ${personName}`)
      }

      setIsModalOpen(false)
      await loadApprovers()
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err: any) {
      setModalError(err.message || 'Terjadi kesalahan sistem.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-form-approvers/${pendingDelete.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Gagal menghapus approver.')
      setSuccessMsg(`Approver ${pendingDelete.person_name} berhasil dihapus.`)
      setPendingDelete(null)
      await loadApprovers()
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleResetDefaults = async () => {
    setResetting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-form-approvers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_defaults', form_code: selectedFormCode }),
      })
      if (!res.ok) throw new Error('Gagal mereset ke default.')
      setConfirmResetOpen(false)
      setSuccessMsg('Berhasil mengembalikan daftar approver ke format standar resmi Yazaki.')
      await loadApprovers()
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setResetting(false)
    }
  }

  if (!isLoggedIn) {
    return <AdminGate title="Akses Khusus Admin IT" message="Silakan masuk sebagai Admin IT atau ISM Admin untuk mengelola approver formulir IT." />
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16 pt-4">
        {/* Header Hero */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-600/10 text-blue-600">
              <FileSignature className="size-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Pengaturan Approver Form Digital &amp; E-Sign
                </h1>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  IT &amp; Security Admin
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Atur pejabat penandatangan digital (E-Sign) untuk formulir Layanan IT dan Global &amp; Special Security Area (Fingerprint).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/kelola-izin-alat-it"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/50 px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary"
            >
              <Laptop className="size-4 text-blue-600" />
              Kelola Permohonan IT
            </Link>
            <Link
              href={selectedFormCode === 'ISMS-F-02-00-002' ? '/registrasi-fingerprint' : `/form-it-esign?form=${selectedFormCode}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-95"
            >
              <ExternalLink className="size-4" />
              Buka Form {selectedFormCode === 'ISMS-F-02-00-002' ? 'Fingerprint' : 'IT'}
            </Link>
          </div>
        </div>

        {/* Success Alert Banner */}
        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-800">
            <Check className="size-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tabs for Forms grouped into IT Service & Global Security */}
        <div className="space-y-4">
          {/* Section 1: IT Service Forms */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Laptop className="size-3.5 text-blue-600" />
                Formulir Layanan IT (E-Sign)
              </span>
              <span className="text-[11px] text-muted-foreground">5 Formulir Aktif</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {IT_FORM_DEFINITIONS.filter((d) => d.code !== 'ISMS-F-02-00-002').map((def) => {
                const isSelected = selectedFormCode === def.code
                const count = approvers.filter((a) => a.form_code === def.code).length
                return (
                  <button
                    key={def.code}
                    type="button"
                    onClick={() => {
                      setSelectedFormCode(def.code)
                      setFilterDept('all')
                    }}
                    className={`flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-left transition ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm dark:bg-blue-950/20 ring-2 ring-blue-500/20'
                        : 'border-border bg-card hover:bg-secondary/30'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-600">{def.code}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {count} Approver
                      </span>
                    </div>
                    <div className="line-clamp-1 text-xs font-semibold text-foreground">{def.name}</div>
                    <div className="line-clamp-1 text-[11px] text-muted-foreground">{def.category}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section 2: Global Special Security Area (Fingerprint) */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                <ShieldAlert className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                Global &amp; Special Security Area (Bukan Layanan IT)
              </span>
              <span className="rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 text-[10px] font-bold">
                Pengesahan IAA Teguh Sunjoyo
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {IT_FORM_DEFINITIONS.filter((d) => d.code === 'ISMS-F-02-00-002').map((def) => {
                const isSelected = selectedFormCode === def.code
                const count = approvers.filter((a) => a.form_code === def.code).length
                return (
                  <button
                    key={def.code}
                    type="button"
                    onClick={() => {
                      setSelectedFormCode(def.code)
                      setFilterDept('all')
                    }}
                    className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? 'border-indigo-600 bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-indigo-500/5 shadow-sm ring-2 ring-indigo-500/30'
                        : 'border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-mono text-xs font-extrabold text-indigo-600 dark:text-indigo-400">{def.code}</span>
                      <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:text-indigo-300">
                        {count} Approver (IAA)
                      </span>
                    </div>
                    <div className="line-clamp-1 text-xs font-bold text-foreground">{def.name}</div>
                    <div className="line-clamp-1 text-[11px] text-indigo-700 dark:text-indigo-300">
                      Otorisasi Akses Fisik Special Security Area (Server Room &amp; Arsip)
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Selected Form Details & Approver Management */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
          {/* Fingerprint Special Notice */}
          {selectedFormCode === 'ISMS-F-02-00-002' && (
            <div className="flex items-start gap-3 rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/5 p-4 text-xs text-indigo-950 dark:text-indigo-200 shadow-2xs">
              <ShieldAlert className="size-5 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-xs uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                    Ranah Khusus: Global Security Area (Bukan Layanan IT)
                  </span>
                  <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:text-indigo-300 border border-indigo-500/30">
                    Pengesahan Langsung IAA Teguh Sunjoyo
                  </span>
                </div>
                <p className="leading-relaxed text-foreground/90">
                  Formulir pendaftaran / perubahan akses sidik jari (fingerprint) ini khusus untuk pintu masuk fisik Special Security Area (Server Room &amp; Ruang Arsip), <strong>bukan ranah permohonan perangkat/jaringan IT</strong>. Otorisasi disahkan langsung oleh <strong>Information Assets Administrator (IAA) Bapak Teguh Sunjoyo</strong> sesuai kebijakan ISMS ISO/IEC 27001.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-sm font-bold ${selectedFormCode === 'ISMS-F-02-00-002' ? 'text-indigo-600 dark:text-indigo-400' : 'text-blue-600'}`}>
                  {currentFormDef.code}
                </span>
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600">
                  {currentFormDef.badge}
                </span>
              </div>
              <h2 className="text-base font-bold text-foreground">{currentFormDef.name}</h2>
              <p className="text-xs text-muted-foreground">{currentFormDef.jpName}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                title="Kembalikan nama dan jabatan ke format template standar dokumen PDF resmi"
              >
                <RotateCcw className="size-3.5" />
                Reset Standar
              </button>
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Plus className="size-4" />
                Tambah Approver / Slot
              </button>
            </div>
          </div>

          {/* Department Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3 text-xs border border-border/60">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground shrink-0" />
              <span className="font-bold text-foreground">Filter Departemen:</span>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="h-8 rounded-lg border border-input bg-card px-2.5 text-xs font-semibold text-foreground outline-none transition focus:border-blue-500 shadow-2xs"
              >
                <option value="all">
                  Semua Departemen ({approvers.filter((a) => a.form_code === selectedFormCode).length} Approver)
                </option>
                <option value="general">Umum / Departemen Pemohon</option>
                <optgroup label="─── Master Departemen Menu ISMS ───">
                  {availableDepts.map((d) => (
                    <option key={d} value={d}>
                      Departemen {d}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            {filterDept !== 'all' && (
              <button
                type="button"
                onClick={() => setFilterDept('all')}
                className="text-[11px] font-bold text-blue-600 hover:underline"
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* Visual Approval Chain Flow */}
          <div className="my-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Alur Pengesahan Digital (E-Sign Sequence)
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {filteredApprovers.map((a, idx) => (
                <div
                  key={a.id}
                  className={`relative flex flex-col justify-between rounded-xl border p-4 transition ${
                    a.is_active
                      ? 'border-border bg-card shadow-xs'
                      : 'border-dashed border-border bg-secondary/20 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-600/10 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-600">
                      STEP {idx + 1} &bull; {a.slot_label}
                    </span>
                    <span
                      className={`size-2.5 rounded-full ${
                        a.is_active ? 'bg-emerald-500' : 'bg-muted-foreground'
                      }`}
                      title={a.is_active ? 'Aktif' : 'Nonaktif'}
                    />
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-bold text-foreground">{a.person_name}</p>
                    <p className="line-clamp-2 text-[11px] text-muted-foreground">{a.role_title}</p>
                    {a.email && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-blue-600 font-mono">
                        <Mail className="size-3" />
                        <span className="truncate">{a.email}</span>
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                    <span className="text-[10px] text-muted-foreground">
                      Dept: {a.department || '-'}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditModal(a)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                    >
                      <Pencil className="size-3" />
                      Ganti Orang
                    </button>
                  </div>
                </div>
              ))}
              {filteredApprovers.length === 0 && (
                <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                  Belum ada approver yang didaftarkan untuk formulir ini. Klik &quot;Tambah Approver&quot; atau &quot;Reset Standar&quot;.
                </div>
              )}
            </div>
          </div>

          {/* Detailed Table View */}
          <div className="mt-6 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Slot / Urutan</th>
                  <th className="px-4 py-3 font-semibold">Label Slot</th>
                  <th className="px-4 py-3 font-semibold">Unit Kerja / Jabatan</th>
                  <th className="px-4 py-3 font-semibold">Nama Pejabat (Approver)</th>
                  <th className="px-4 py-3 font-semibold">Email Notifikasi</th>
                  <th className="px-4 py-3 font-semibold">Departemen</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredApprovers.map((item) => (
                  <tr key={item.id} className="transition hover:bg-secondary/20">
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">
                      #{item.slot_number}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] font-bold text-foreground">
                        {item.slot_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{item.role_title}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">
                        {item.salutation ? `${item.salutation} ` : ''}
                        {item.person_name}
                      </div>
                      {item.initials && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Inisial: {item.initials}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {item.email || <span className="text-muted-foreground/50">-</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.department || '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          item.is_active
                            ? 'bg-emerald-500/10 text-emerald-700'
                            : 'bg-zinc-500/10 text-zinc-600'
                        }`}
                      >
                        {item.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="grid size-7 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30"
                          title="Ganti nama orang / edit data"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(item)}
                          className="grid size-7 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                          title="Hapus approver"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add / Edit Approver Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-xl bg-blue-600/10 text-blue-600">
                    <Pencil className="size-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {editingApprover ? 'Ganti Orang / Edit Approver' : 'Tambah Approver Form IT'}
                    </h3>
                    <p className="text-xs text-muted-foreground">{currentFormDef.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="grid size-8 place-items-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="mt-4 space-y-4">
                {modalError && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Urutan / Slot #</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={slotNumber}
                      onChange={(e) => setSlotNumber(Number(e.target.value))}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Label Kotak Slot</label>
                    <input
                      type="text"
                      value={slotLabel}
                      onChange={(e) => setSlotLabel(e.target.value)}
                      placeholder="e.g. CHECK, MENGETAHUI, MENYETUJUI, APPROVAL"
                      className={`${inputClass} uppercase font-mono`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Jabatan / Unit Kerja (Role Title)</label>
                  <input
                    type="text"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="e.g. IT SPV / System Security Administrator"
                    className={inputClass}
                    required
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Gelar/posisi yang dicetak di bagian bawah kotak tanda tangan digital pada PDF.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Sapaan</label>
                    <select
                      value={salutation}
                      onChange={(e) => setSalutation(e.target.value)}
                      className={inputClass}
                    >
                      <option value="Bapak">Bapak</option>
                      <option value="Ibu">Ibu</option>
                      <option value="">Tanpa Sapaan</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Nama Lengkap Pejabat (Approver)</label>
                    <input
                      type="text"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      placeholder="Nama lengkap pejabat yang bertanda tangan"
                      className={inputClass}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Inisial (Singkatan Nama)</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={initials}
                      onChange={(e) => setInitials(e.target.value.toUpperCase())}
                      placeholder="misal: SSA, IAA, MGR"
                      className={`${inputClass} font-mono uppercase`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelClass}>Departemen (Master ISMS)</label>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Sync Master
                      </span>
                    </div>
                    <select
                      value={
                        customDeptMode
                          ? '__custom__'
                          : !department
                          ? ''
                          : department === 'Departemen Pemohon'
                          ? 'Departemen Pemohon'
                          : department === 'IT Section'
                          ? 'IT Section'
                          : department === 'Information Assets Administrator'
                          ? 'Information Assets Administrator'
                          : availableDepts.includes(department)
                          ? department
                          : '__custom__'
                      }
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '__custom__') {
                          setCustomDeptMode(true)
                        } else {
                          setCustomDeptMode(false)
                          setDepartment(val)
                        }
                      }}
                      className={inputClass}
                    >
                      <option value="">Semua Departemen (Umum / Global)</option>
                      <option value="Departemen Pemohon">Departemen Pemohon (Dynamic / Sesuai Pemohon)</option>
                      <option value="IT Section">IT Section</option>
                      <option value="Information Assets Administrator">Information Assets Administrator (IAA)</option>
                      <optgroup label="─── Master Departemen Menu ISMS ───">
                        {availableDepts.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </optgroup>
                      <option value="__custom__">Lainnya / Ketik Manual...</option>
                    </select>

                    {customDeptMode && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          placeholder="Ketik nama departemen spesifik..."
                          className={inputClass}
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Email Notifikasi Persetujuan</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama.pejabat@jai.co.id"
                    className={inputClass}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Link verifikasi & approval E-Sign akan dapat diakses oleh pemilik email ini.
                  </p>
                </div>

                <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="size-4 rounded accent-blue-600"
                  />
                  <span>Status Aktif (Tampil dalam alur pengesahan form)</span>
                </label>

                <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Menyimpan...' : 'Simpan Data Approver'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={Boolean(pendingDelete)}
          title="Hapus Approver Ini?"
          message={`Apakah Anda yakin ingin menghapus "${pendingDelete?.person_name}" (${pendingDelete?.role_title}) dari alur tanda tangan form ini?`}
          confirmLabel={deleting ? 'Menghapus...' : 'Ya, Hapus'}
          danger={true}
          pending={deleting}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />

        {/* Reset Confirmation */}
        <ConfirmDialog
          open={confirmResetOpen}
          title="Kembalikan ke Default Template Resmi?"
          message="Aksi ini akan mereset seluruh susunan approver form ini kembali ke format standar PDF Yazaki (nama default dan slot awal)."
          confirmLabel={resetting ? 'Mereset...' : 'Ya, Reset ke Standar'}
          danger={false}
          pending={resetting}
          onConfirm={handleResetDefaults}
          onCancel={() => setConfirmResetOpen(false)}
        />
      </div>
  )
}
