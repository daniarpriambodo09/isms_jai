'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Laptop,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Filter,
  Eye,
  Check,
  X,
  Download,
  Copy,
  RefreshCw,
  AlertTriangle,
  User,
  Building,
  Calendar,
  FileText,
  ShieldCheck,
  RotateCcw,
  Users,
  FileSignature,
  ExternalLink,
  PencilLine,
  Loader2,
  Send,
  Save,
  Link2,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import type { ItEquipmentRequest } from '@/lib/it-equipment-shared'
import { IT_FORM_DEFINITIONS, type ItFormSubmission } from '@/lib/it-form-shared'
import { downloadExcel } from '@/lib/excel-export'
import { GuestLinksAdminPanel } from '@/components/it/GuestLinksAdminPanel'
import { NetworkPassModal, type NetworkPassData } from '@/components/it/NetworkPassCard'

export default function KelolaIzinAlatItPage() {
  const { isLoggedIn, adminUser, logout } = useAuth()
  const role = adminUser?.role
  const username = adminUser?.username || ''
  const [mainSection, setMainSection] = useState<'guest_links' | 'equipment' | 'it_forms'>('guest_links')
  const [adminSlipData, setAdminSlipData] = useState<NetworkPassData | null>(null)
  const [deletingEqId, setDeletingEqId] = useState<number | null>(null)
  const [deletingSubId, setDeletingSubId] = useState<number | null>(null)
  const [requests, setRequests] = useState<ItEquipmentRequest[]>([])
  const [itSubmissions, setItSubmissions] = useState<ItFormSubmission[]>([])
  const [loadingItSubmissions, setLoadingItSubmissions] = useState(false)
  const [selectedItSub, setSelectedItSub] = useState<ItFormSubmission | null>(null)
  const [itSignLoading, setItSignLoading] = useState(false)
  const [itSignNote, setItSignNote] = useState('')
  const [itSignerName, setItSignerName] = useState('')
  const [itIpMode, setItIpMode] = useState<'dhcp' | 'static'>('dhcp')
  const [itAssignedIp, setItAssignedIp] = useState('')
  const [itStaticSubnet, setItStaticSubnet] = useState('255.255.255.0')
  const [itStaticGateway, setItStaticGateway] = useState('')
  const [itDnsPriority, setItDnsPriority] = useState('')
  const [itDnsSecondary, setItDnsSecondary] = useState('')
  const [itSavingIpConfig, setItSavingIpConfig] = useState(false)
  const [itSaveIpSuccess, setItSaveIpSuccess] = useState<string | null>(null)
  const [itResendingId, setItResendingId] = useState<number | null>(null)
  const [itResendNotice, setItResendNotice] = useState<string | null>(null)

  useEffect(() => {
    if (selectedItSub) {
      const fd = selectedItSub.form_data || {}
      setItIpMode(fd.ip_mode === 'static' ? 'static' : 'dhcp')
      setItAssignedIp(fd.assigned_ip || fd.static_ip || fd.ip_address || '')
      setItStaticSubnet(fd.static_subnet || '255.255.255.0')
      setItStaticGateway(fd.static_gateway || '')
      setItDnsPriority(fd.dns_priority || '')
      setItDnsSecondary(fd.dns_secondary || '')
      setItSignNote('')
      setItSaveIpSuccess(null)
    }
  }, [selectedItSub])

  const handleResendItEmail = async (sub: ItFormSubmission) => {
    setItResendingId(sub.id)
    setItResendNotice(null)
    try {
      const res = await fetch(`/api/it-form-submissions/${sub.id}/resend`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim ulang email.')
      setItResendNotice(`Email persetujuan formulir ${sub.request_no} berhasil dikirim ulang ke approver step ${sub.current_step}.`)
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim ulang email.')
    } finally {
      setItResendingId(null)
    }
  }
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'returned' | 'rejected'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const [itSearchQuery, setItSearchQuery] = useState('')
  const [itFormFilter, setItFormFilter] = useState('all')
  const [itStatusFilter, setItStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')

  // Selected for review modal
  const [selectedReq, setSelectedReq] = useState<ItEquipmentRequest | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  // Approve state
  const [approverName, setApproverName] = useState('')
  const [approverTitle, setApproverTitle] = useState('Manager Departemen / IAA')
  const [approvalNotes, setApprovalNotes] = useState('')

  // Reject state
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  // Return check state
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [checkItems, setCheckItems] = useState(true)
  const [checkConfidential, setCheckConfidential] = useState(true)
  const [returnNotes, setReturnNotes] = useState('')

  const [copiedId, setCopiedId] = useState<number | null>(null)

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/it-equipment-requests')
      const data = await res.json()
      if (res.ok && data.requests) {
        setRequests(data.requests)
      }
    } catch (err) {
      console.error('Failed to load IT requests:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchItSubmissions = async () => {
    setLoadingItSubmissions(true)
    try {
      const res = await fetch('/api/it-form-submissions')
      const data = await res.json()
      if (res.ok && data.submissions) {
        setItSubmissions(data.submissions)
      }
    } catch (err) {
      console.error('Failed to load IT submissions:', err)
    } finally {
      setLoadingItSubmissions(false)
    }
  }

  const handleSaveIpConfig = async () => {
    if (!selectedItSub) return
    setItSavingIpConfig(true)
    setItSaveIpSuccess(null)
    try {
      const updates: Record<string, any> = {
        ip_mode: itIpMode,
        assigned_ip: itAssignedIp.trim(),
        static_ip: itAssignedIp.trim(),
        ip_address: itAssignedIp.trim(),
        static_subnet: itIpMode === 'static' ? (itStaticSubnet.trim() || '255.255.255.0') : undefined,
        static_gateway: itIpMode === 'static' ? itStaticGateway.trim() : undefined,
        dns_priority: itIpMode === 'static' ? itDnsPriority.trim() : undefined,
        dns_secondary: itIpMode === 'static' ? itDnsSecondary.trim() : undefined,
      }
      const res = await fetch(`/api/it-form-submissions/${selectedItSub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_data: updates, assigned_ip: itAssignedIp.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan konfigurasi IP')
      if (data.submission) {
        setSelectedItSub(data.submission)
      }
      await fetchItSubmissions()
      setItSaveIpSuccess('Konfigurasi IP berhasil diperbarui & tersinkronisasi ke PDF!')
      setTimeout(() => setItSaveIpSuccess(null), 4000)
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan konfigurasi IP')
    } finally {
      setItSavingIpConfig(false)
    }
  }

  const handleSignItSub = async (stepNum: number, decision: 'approve' | 'reject') => {
    if (!selectedItSub) return
    setItSignLoading(true)
    try {
      const payload: Record<string, any> = {
        step_number: stepNum,
        decision,
        approver_name: itSignerName || username || 'IT Admin',
        signature_note: itSignNote || null,
      }

      if (selectedItSub.form_code === 'ISMS-F-03-00-003' && stepNum === 2 && decision === 'approve') {
        payload.assigned_ip = itAssignedIp.trim() || undefined
        payload.form_data_updates = {
          ip_mode: itIpMode,
          assigned_ip: itAssignedIp.trim(),
          static_ip: itAssignedIp.trim(),
          ip_address: itAssignedIp.trim(),
          static_subnet: itIpMode === 'static' ? (itStaticSubnet.trim() || '255.255.255.0') : undefined,
          static_gateway: itIpMode === 'static' ? itStaticGateway.trim() : undefined,
          dns_priority: itIpMode === 'static' ? itDnsPriority.trim() : undefined,
          dns_secondary: itIpMode === 'static' ? itDnsSecondary.trim() : undefined,
        }
      }

      const res = await fetch(`/api/it-form-submissions/${selectedItSub.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memproses tanda tangan')
      await fetchItSubmissions()
      if (data.submission) {
        setSelectedItSub(data.submission)
      }
      setItSignNote('')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setItSignLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
    fetchItSubmissions()
  }, [])

  useEffect(() => {
    if (username) {
      setItSignerName(username)
    }
  }, [username])

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (activeTab === 'pending') {
        if (r.status !== 'pending' && r.status !== 'approved_manager') return false
      } else if (activeTab !== 'all' && r.status !== activeTab) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchNo = r.request_no.toLowerCase().includes(q)
        const matchName = r.applicant_name.toLowerCase().includes(q)
        const matchCompany = r.company_name.toLowerCase().includes(q)
        const matchDept = r.department.toLowerCase().includes(q)
        return matchNo || matchName || matchCompany || matchDept
      }
      return true
    })
  }, [requests, activeTab, searchQuery])

  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === 'pending' || r.status === 'approved_manager').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      returned: requests.filter((r) => r.status === 'returned').length,
      rejected: requests.filter((r) => r.status === 'rejected').length,
    }
  }, [requests])

  const itStats = useMemo(() => {
    return {
      total: itSubmissions.length,
      pending: itSubmissions.filter((s) => s.status === 'pending').length,
      approved: itSubmissions.filter((s) => s.status === 'approved').length,
      rejected: itSubmissions.filter((s) => s.status === 'rejected').length,
    }
  }, [itSubmissions])

  const filteredItSubmissions = useMemo(() => {
    return itSubmissions.filter((s) => {
      if (itFormFilter !== 'all' && s.form_code !== itFormFilter) return false
      if (itStatusFilter !== 'all' && s.status !== itStatusFilter) return false
      if (!itSearchQuery.trim()) return true
      const q = itSearchQuery.toLowerCase()
      return (
        s.request_no.toLowerCase().includes(q) ||
        s.applicant_name.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q) ||
        s.form_name.toLowerCase().includes(q)
      )
    })
  }, [itSubmissions, itFormFilter, itStatusFilter, itSearchQuery])

  const handleApprove = async (stageOverride?: 'manager' | 'it') => {
    if (!selectedReq) return
    setActionLoading(true)
    setActionError('')
    const isStep1Manager =
      stageOverride === 'manager' || (!stageOverride && selectedReq.status === 'pending')
    try {
      const res = await fetch(`/api/it-equipment-requests/${selectedReq.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isStep1Manager ? 'approve_manager' : 'approve_it',
          stage: isStep1Manager ? 'manager' : 'it',
          approver_name:
            approverName ||
            (isStep1Manager ? 'IAA / Manager Departemen' : username || 'System Security Admin (IT)'),
          approver_title:
            approverTitle ||
            (isStep1Manager ? 'Manager Departemen / IAA' : 'System Security Administrator (IT)'),
          notes: approvalNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menyetujui pengajuan')

      setActionSuccess(
        isStep1Manager
          ? 'Tahap 1: Berhasil disetujui oleh IAA / Manager Departemen! Silakan lanjutkan Tahap 2 (Verifikasi IT).'
          : 'Tahap 2: Pengajuan telah diverifikasi & disetujui oleh IT (System Security Administrator)!'
      )
      setSelectedReq(data.request)
      if (isStep1Manager) {
        setApproverName(username || 'System Security Admin (IT)')
        setApproverTitle('System Security Administrator (IT)')
        setApprovalNotes('')
      }
      fetchRequests()
    } catch (err: any) {
      setActionError(err.message || 'Terjadi kesalahan')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedReq || !rejectionReason.trim()) {
      setActionError('Alasan penolakan wajib diisi.')
      return
    }
    setActionLoading(true)
    setActionError('')
    try {
      const res = await fetch(`/api/it-equipment-requests/${selectedReq.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          rejection_reason: rejectionReason,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal menolak pengajuan')

      setActionSuccess('Pengajuan telah ditolak.')
      setSelectedReq(data.request)
      setShowRejectForm(false)
      fetchRequests()
    } catch (err: any) {
      setActionError(err.message || 'Terjadi kesalahan')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReturnCheck = async () => {
    if (!selectedReq) return
    setActionLoading(true)
    setActionError('')
    try {
      const res = await fetch(`/api/it-equipment-requests/${selectedReq.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          return_check_items: checkItems,
          return_check_confidential: checkConfidential,
          returned_notes: returnNotes,
          inspector_name: username,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mencatat pengembalian')

      setActionSuccess('Pengecekan pengembalian berhasil dicatat.')
      setSelectedReq(data.request)
      setShowReturnModal(false)
      fetchRequests()
    } catch (err: any) {
      setActionError(err.message || 'Terjadi kesalahan')
    } finally {
      setActionLoading(false)
    }
  }

  const copyGuestLink = (req: ItEquipmentRequest) => {
    const url = `${window.location.origin}${API_BASE_PATH}/ijin-masuk-alat-it?token=${req.token}`
    navigator.clipboard.writeText(url)
    setCopiedId(req.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const handleDeleteEquipmentRequest = async (req: ItEquipmentRequest) => {
    const ok = window.confirm(
      `Hapus data pengajuan Izin Alat IT "${req.request_no}" atas nama ${req.applicant_name}?`
    )
    if (!ok) return
    setDeletingEqId(req.id)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-equipment-requests/${req.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Gagal menghapus data pengajuan')
      }
      setRequests((prev) => prev.filter((item) => item.id !== req.id))
      if (selectedReq?.id === req.id) setSelectedReq(null)
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus data pengajuan')
    } finally {
      setDeletingEqId(null)
    }
  }

  const handleDeleteItSubmission = async (sub: ItFormSubmission) => {
    const ok = window.confirm(
      `Hapus data permohonan Formulir IT "${sub.request_no}" (${sub.form_code}) atas nama ${sub.applicant_name}?`
    )
    if (!ok) return
    setDeletingSubId(sub.id)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-form-submissions/${sub.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Gagal menghapus permohonan formulir IT')
      }
      setItSubmissions((prev) => prev.filter((item) => item.id !== sub.id))
      if (selectedItSub?.id === sub.id) setSelectedItSub(null)
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus permohonan formulir IT')
    } finally {
      setDeletingSubId(null)
    }
  }

  const handleExportEquipmentExcel = () => {
    if (!filteredRequests.length) return
    const filename = `rekap-izin-alat-it-masuk-keluar-${new Date().toISOString().slice(0, 10)}`
    const headers = [
      'No',
      'No. Pengajuan',
      'Jenis Izin',
      'Tanggal Pengajuan',
      'Nama Pemohon / Tamu',
      'Perusahaan / Instansi',
      'Departemen Pembawa Device',
      'Seksi / Bagian',
      'Lokasi Tujuan',
      'Tujuan Membawa Alat',
      'Tanggal Masuk / Keluar',
      'Rencana Tanggal Kembali',
      'Jumlah Alat',
      'Rincian Alat IT',
      'No. HP / WA Tamu',
      'Email Pemohon',
      'Status Permohonan',
      'Disetujui Oleh',
      'Jabatan Approver',
      'Waktu Disetujui',
      'Catatan Approval',
      'Waktu Pengembalian',
      'Pemeriksa Pengembalian',
      'Catatan Pengembalian',
      'Alasan Penolakan',
    ]

    const rows = filteredRequests.map((req, idx) => {
      const itemsDetail = (req.items || [])
        .map(
          (it, i) =>
            `${i + 1}. [${it.equipment_type || '-'}] ${it.brand || ''} ${it.model || ''} (SN: ${it.serial_no || '-'}, ID: ${it.id_no || '-'})`.trim()
        )
        .join('; ')

      const statusLabel =
        req.status === 'approved'
          ? 'Disetujui (Aktif)'
          : req.status === 'returned'
          ? 'Dikembalikan'
          : req.status === 'rejected'
          ? 'Ditolak'
          : 'Menunggu ACC'

      return [
        idx + 1,
        req.request_no,
        req.form_type === 'out' ? 'Membawa Keluar (ISMS-F-03-00-002)' : 'Membawa Masuk (ISMS-F-03-00-001)',
        req.request_date,
        req.applicant_name,
        req.company_name,
        req.department,
        req.section || '-',
        req.location,
        req.purpose,
        req.date_in,
        req.date_out_plan,
        req.items?.length || 0,
        itemsDetail || '-',
        req.applicant_phone || '-',
        req.applicant_email || '-',
        statusLabel,
        req.approved_by || '-',
        req.approved_title || '-',
        req.approved_at ? new Date(req.approved_at).toLocaleString('id-ID') : '-',
        req.approval_notes || '-',
        req.returned_at ? new Date(req.returned_at).toLocaleString('id-ID') : '-',
        req.returned_checked_by || '-',
        req.returned_notes || '-',
        req.rejection_reason || '-',
      ]
    })

    downloadExcel(filename, headers, rows, 'Izin Alat IT')
  }

  const handleExportItFormsExcel = () => {
    if (!filteredItSubmissions.length) return
    const filename = `rekap-formulir-layanan-it-esign-${new Date().toISOString().slice(0, 10)}`
    const headers = [
      'No',
      'No. Pengajuan',
      'Kode Formulir',
      'Nama Formulir',
      'Tanggal Pengajuan',
      'Nama Pemohon',
      'NIK / No. Karyawan',
      'Perusahaan / Organisasi',
      'Departemen',
      'Seksi / Bagian',
      'Jabatan',
      'Status Karyawan',
      'Status Permohonan',
      'Progress E-Sign',
      'Tahap Approval Saat Ini',
      'Catatan Pemohon',
      'Log Persetujuan (Approver & Status)',
    ]

    const rows = filteredItSubmissions.map((sub, idx) => {
      const approvedCount = (sub.signatures || []).filter((s) => s.status === 'approved').length
      const totalSteps = sub.total_steps || (sub.signatures || []).length
      const sigDetails = (sub.signatures || [])
        .map(
          (s) =>
            `Step ${s.step_number}: ${s.approver_name || s.role_title} (${s.status}${
              s.signed_at ? ` - ${new Date(s.signed_at).toLocaleDateString('id-ID')}` : ''
            })`
        )
        .join('; ')

      const statusLabel =
        sub.status === 'approved'
          ? 'Disetujui Lengkap'
          : sub.status === 'rejected'
          ? 'Ditolak / Revisi'
          : `Menunggu ACC (Step ${sub.current_step})`

      return [
        idx + 1,
        sub.request_no,
        sub.form_code,
        sub.form_name,
        sub.request_date,
        sub.applicant_name,
        sub.applicant_nik || '-',
        sub.company_name || '-',
        sub.department,
        (sub.form_data?.section as string) || '-',
        sub.applicant_position || '-',
        sub.employee_status || '-',
        statusLabel,
        `${approvedCount}/${totalSteps} Step`,
        sub.status === 'approved' ? 'Selesai' : `Step ${sub.current_step}`,
        sub.notes || '-',
        sigDetails || '-',
      ]
    })

    downloadExcel(filename, headers, rows, 'Formulir IT E-Sign')
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-white/5 backdrop-blur-md p-6 sm:p-8 shadow-lg">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-primary" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Laptop className="size-6" />
            </div>
            <div>
              <p className="portal-eyebrow">IT Division & Security</p>
              <h1 className="font-display text-2xl font-semibold text-foreground">
                Kelola Izin & Formulir Divisi IT
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                ISMS-F-03-00-001/002 (Izin Alat) & ISMS-F-010-001/003/006/007/03-00-003 (E-Sign) · PT. JAI
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/kelola-approver-it"
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-600/30 bg-blue-50/60 dark:bg-blue-950/30 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-100 transition shadow-2xs"
            >
              <Users className="size-3.5" /> Pengaturan Approver IT
            </Link>
            <Link
              href="/form-it-esign"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/30 bg-emerald-50/60 dark:bg-emerald-950/30 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition shadow-2xs"
            >
              <FileSignature className="size-3.5" /> Form E-Sign IT
            </Link>
            <Link
              href="/ijin-masuk-alat-it"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition"
            >
              <Laptop className="size-3.5" /> Buka Form Publik Tamu
            </Link>
            <button
              type="button"
              onClick={mainSection === 'equipment' ? handleExportEquipmentExcel : handleExportItFormsExcel}
              disabled={mainSection === 'equipment' ? filteredRequests.length === 0 : filteredItSubmissions.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white transition shadow-xs disabled:opacity-50 disabled:pointer-events-none"
              title={`Export data ${mainSection === 'equipment' ? 'Izin Barang Masuk/Keluar' : 'Formulir IT E-Sign'} ke Excel (.xlsx)`}
            >
              <Download className="size-3.5" />
              <span>Export Excel {mainSection === 'equipment' ? `Barang (${filteredRequests.length})` : `Form IT (${filteredItSubmissions.length})`}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                fetchRequests()
                fetchItSubmissions()
              }}
              disabled={loading || loadingItSubmissions}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition"
            >
              <RefreshCw className={`size-3.5 ${loading || loadingItSubmissions ? 'animate-spin' : ''}`} /> Muat Ulang
            </button>
          </div>
        </div>

        {/* Section Switcher Tabs */}
        <div className="flex flex-wrap border-b border-border mt-6">
          <button
            type="button"
            onClick={() => setMainSection('guest_links')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              mainSection === 'guest_links'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Link2 className="size-4" /> Generate Link Tamu &amp; Network (2 Form)
          </button>
          <button
            type="button"
            onClick={() => setMainSection('equipment')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              mainSection === 'equipment'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Laptop className="size-4" /> Izin Masuk/Keluar Alat Tamu ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setMainSection('it_forms')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              mainSection === 'it_forms'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileSignature className="size-4" /> Formulir E-Sign Divisi IT ({itSubmissions.length})
          </button>
        </div>

        {/* Metric KPI Cards for Equipment */}
        {mainSection === 'equipment' && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 bg-white/5 backdrop-blur-sm p-3 rounded-xl shadow-md">
            <div
              onClick={() => setActiveTab('all')}
              className={`p-3.5 rounded-xl border cursor-pointer transition ${
                activeTab === 'all'
                  ? 'bg-primary/10 border-primary/30 ring-2 ring-primary/20'
                  : 'bg-card border-border hover:bg-secondary/30'
              }`}
            >
              <div className="text-[11px] font-semibold text-muted-foreground">Total Pengajuan</div>
              <div className="text-2xl font-bold text-foreground mt-1">{stats.total}</div>
            </div>

            <div
              onClick={() => setActiveTab('pending')}
              className={`p-3.5 rounded-xl border cursor-pointer transition ${
                activeTab === 'pending'
                  ? 'bg-[#fff3d6] border-[#fde2a6] ring-2 ring-amber-500/20'
                  : 'bg-card border-border hover:bg-secondary/30'
              }`}
            >
              <div className="text-[11px] font-semibold text-[#8a6100] flex items-center gap-1">
                <Clock className="size-3" /> Menunggu ACC
              </div>
              <div className="text-2xl font-bold text-[#8a6100] mt-1">{stats.pending}</div>
            </div>

            <div
              onClick={() => setActiveTab('approved')}
              className={`p-3.5 rounded-xl border cursor-pointer transition ${
                activeTab === 'approved'
                  ? 'bg-[#dff5e6] border-[#a3e3b7] ring-2 ring-emerald-500/20'
                  : 'bg-card border-border hover:bg-secondary/30'
              }`}
            >
              <div className="text-[11px] font-semibold text-[#1a6e3a] flex items-center gap-1">
                <CheckCircle2 className="size-3" /> Di-ACC (Aktif)
              </div>
              <div className="text-2xl font-bold text-[#1a6e3a] mt-1">{stats.approved}</div>
            </div>

            <div
              onClick={() => setActiveTab('returned')}
              className={`p-3.5 rounded-xl border cursor-pointer transition ${
                activeTab === 'returned'
                  ? 'bg-primary/15 border-primary/30 ring-2 ring-primary/20'
                  : 'bg-card border-border hover:bg-secondary/30'
              }`}
            >
              <div className="text-[11px] font-semibold text-primary flex items-center gap-1">
                <RotateCcw className="size-3" /> Dikembalikan
              </div>
              <div className="text-2xl font-bold text-primary mt-1">{stats.returned}</div>
            </div>

            <div
              onClick={() => setActiveTab('rejected')}
              className={`p-3.5 rounded-xl border cursor-pointer transition ${
                activeTab === 'rejected'
                  ? 'bg-[#fdecec] border-[#f5b8b5] ring-2 ring-red-500/20'
                  : 'bg-card border-border hover:bg-secondary/30'
              }`}
            >
              <div className="text-[11px] font-semibold text-[#b3413a] flex items-center gap-1">
                <XCircle className="size-3" /> Ditolak
              </div>
              <div className="text-2xl font-bold text-[#b3413a] mt-1">{stats.rejected}</div>
            </div>
          </div>
        )}

        {/* Metric KPI Cards for IT E-Sign */}
        {mainSection === 'it_forms' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 bg-white/5 backdrop-blur-sm p-3 rounded-xl shadow-md">
            <div
              onClick={() => setItStatusFilter('all')}
              className={`p-3.5 rounded-xl border cursor-pointer transition ${
                itStatusFilter === 'all'
                  ? 'bg-primary/10 border-primary/30 ring-2 ring-primary/20'
                  : 'bg-card border-border hover:bg-secondary/30'
              }`}
            >
              <div className="text-[11px] font-semibold text-muted-foreground">Total Form IT</div>
              <div className="text-2xl font-bold text-foreground mt-1">{itStats.total}</div>
            </div>

            <div
              onClick={() => setItStatusFilter('pending')}
              className={`p-3.5 rounded-xl border cursor-pointer transition ${
                itStatusFilter === 'pending'
                  ? 'bg-[#fff3d6] border-[#fde2a6] ring-2 ring-amber-500/20'
                  : 'bg-card border-border hover:bg-secondary/30'
              }`}
            >
              <div className="text-[11px] font-semibold text-[#8a6100] flex items-center gap-1">
                <Clock className="size-3" /> Menunggu Approval
              </div>
              <div className="text-2xl font-bold text-[#8a6100] mt-1">{itStats.pending}</div>
            </div>

            <div
              onClick={() => setItStatusFilter('approved')}
              className={`p-3.5 rounded-xl border cursor-pointer transition ${
                itStatusFilter === 'approved'
                  ? 'bg-[#dff5e6] border-[#a3e3b7] ring-2 ring-emerald-500/20'
                  : 'bg-card border-border hover:bg-secondary/30'
              }`}
            >
              <div className="text-[11px] font-semibold text-[#1a6e3a] flex items-center gap-1">
                <CheckCircle2 className="size-3" /> Disetujui Lengkap
              </div>
              <div className="text-2xl font-bold text-[#1a6e3a] mt-1">{itStats.approved}</div>
            </div>

            <div
              onClick={() => setItStatusFilter('rejected')}
              className={`p-3.5 rounded-xl border cursor-pointer transition ${
                itStatusFilter === 'rejected'
                  ? 'bg-[#fdecec] border-[#f5b8b5] ring-2 ring-red-500/20'
                  : 'bg-card border-border hover:bg-secondary/30'
              }`}
            >
              <div className="text-[11px] font-semibold text-[#b3413a] flex items-center gap-1">
                <XCircle className="size-3" /> Ditolak / Revisi
              </div>
              <div className="text-2xl font-bold text-[#b3413a] mt-1">{itStats.rejected}</div>
            </div>
          </div>
        )}
      </section>

      {/* Main Content Area */}
      {mainSection === 'guest_links' ? (
        <GuestLinksAdminPanel
          defaultApproverName={username || 'Admin IT'}
          onDataChanged={() => {
            fetchRequests()
            fetchItSubmissions()
          }}
        />
      ) : mainSection === 'equipment' ? (
        <div className="space-y-4">
        {/* Controls: Search & Tabs */}
        <div className="bg-card p-4 rounded-2xl border border-border shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari No. Registrasi, Nama Tamu, Perusahaan, Departemen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 border border-input rounded-xl bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 overflow-x-auto text-xs font-semibold text-muted-foreground">
              {(['all', 'pending', 'approved', 'returned', 'rejected'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-xl capitalize whitespace-nowrap transition ${
                    activeTab === tab
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'hover:bg-secondary text-foreground'
                  }`}
                >
                  {tab === 'all'
                    ? 'Semua'
                    : tab === 'pending'
                    ? 'Menunggu ACC'
                    : tab === 'approved'
                    ? 'Disetujui'
                    : tab === 'returned'
                    ? 'Dikembalikan'
                    : 'Ditolak'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleExportEquipmentExcel}
              disabled={filteredRequests.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap ml-auto"
              title="Export data izin barang masuk/keluar ke Excel (.xlsx)"
            >
              <Download className="size-3.5" />
              <span>Export Excel ({filteredRequests.length})</span>
            </button>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-border text-muted-foreground uppercase tracking-wider text-[10px]" style={{ backgroundClip: 'padding-box' }}>
                <tr>
                  <th className="py-3 px-4">No. Pengajuan</th>
                  <th className="py-3 px-4">Tamu & Perusahaan</th>
                  <th className="py-3 px-4">Departemen & Area</th>
                  <th className="py-3 px-4">Jadwal Masuk</th>
                  <th className="py-3 px-4">Daftar Alat</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                      Memuat daftar pengajuan izin alat...
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      Tidak ada data pengajuan yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => {
                    const isPending = req.status === 'pending'
                    const isApprovedManager = req.status === 'approved_manager'
                    const isApproved = req.status === 'approved'
                    const isReturned = req.status === 'returned'
                    const isRejected = req.status === 'rejected'

                    return (
                      <tr key={req.id} className="hover:bg-secondary/30 transition">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-foreground block">
                            {req.request_no}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {req.form_type === 'out' ? 'ISMS-F-03-00-002 (Keluar)' : 'ISMS-F-03-00-001 (Masuk)'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{req.applicant_name}</div>
                          <div className="text-muted-foreground text-[11px] flex items-center gap-1 mt-0.5">
                            <Building className="size-3 text-muted-foreground" />
                            {req.applicant_nik ? `NIK: ${req.applicant_nik}` : req.company_name}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-foreground font-medium">{req.department}</div>
                          <div className="text-muted-foreground text-[11px]">{req.location}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-foreground font-medium">{req.date_in}</div>
                          <div className="text-muted-foreground text-[10px]">s/d {req.date_out_plan}</div>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {req.items.map((it, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary text-foreground rounded text-[10px] font-medium"
                              >
                                <Laptop className="size-2.5 text-primary" />
                                {it.equipment_type} ({it.brand || '-'})
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#fff3d6] text-[#8a6100] text-[11px] font-semibold">
                              <Clock className="size-3" /> 1. Menunggu IAA / Mgr Dept
                            </span>
                          )}
                          {isApprovedManager && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-700 text-[11px] font-semibold">
                              <Clock className="size-3" /> 2. ACC Mgr/IAA · Tunggu Check IT
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#dff5e6] text-[#1a6e3a] text-[11px] font-semibold">
                              <CheckCircle2 className="size-3" />{' '}
                              {req.form_type === 'out'
                                ? 'Izin Aktif · Sedang Dibawa Keluar (Belum Closed)'
                                : 'Di-ACC Lengkap (Masuk)'}
                            </span>
                          )}
                          {isReturned && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-semibold">
                              <CheckCircle2 className="size-3" /> Selesai (Closed / Sudah Kembali)
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#fdecec] text-[#b3413a] text-[11px] font-semibold">
                              <XCircle className="size-3" /> Ditolak
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedReq(req)
                                setActionError('')
                                setActionSuccess('')
                                setShowRejectForm(false)
                                setShowReturnModal(false)
                                if (req.status === 'pending') {
                                  setApproverName('TEGUH SUNJOYO')
                                  setApproverTitle('Information Assets Administrator (IAA)')
                                } else {
                                  setApproverName(username || 'System Security Admin (IT)')
                                  setApproverTitle('System Security Administrator (IT)')
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary hover:opacity-90 text-primary-foreground font-medium text-xs transition"
                            >
                              <Eye className="size-3.5" /> Review / ACC
                            </button>

                            <button
                              type="button"
                              onClick={() => copyGuestLink(req)}
                              title="Salin Link Status Tamu"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                            >
                              {copiedId === req.id ? (
                                <Check className="size-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </button>

                            <a
                              href={`/api/it-equipment-requests/${req.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              title="Unduh Form PDF"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                            >
                              <Download className="size-3.5" />
                            </a>

                            <button
                              type="button"
                              disabled={deletingEqId === req.id}
                              onClick={() => handleDeleteEquipmentRequest(req)}
                              title="Hapus Pengajuan Izin Alat IT"
                              className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-card px-2 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 transition"
                            >
                              <Trash2 className="size-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ) : (
        /* IT Form E-Sign Submissions Table */
        <div className="space-y-4">
          {/* Controls: Search & Status Filter */}
          <div className="bg-card p-4 rounded-2xl border border-border shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari No. Pengajuan, Nama Pemohon, Departemen, Jenis Form..."
                value={itSearchQuery}
                onChange={(e) => setItSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 border border-input rounded-xl bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 overflow-x-auto text-xs font-semibold text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setItStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition ${
                    itStatusFilter === 'all'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'hover:bg-secondary text-foreground'
                  }`}
                >
                  Semua ({itStats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setItStatusFilter('pending')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition ${
                    itStatusFilter === 'pending'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'hover:bg-secondary text-foreground'
                  }`}
                >
                  Menunggu ACC ({itStats.pending})
                </button>
                <button
                  type="button"
                  onClick={() => setItStatusFilter('approved')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition ${
                    itStatusFilter === 'approved'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'hover:bg-secondary text-foreground'
                  }`}
                >
                  Disetujui ({itStats.approved})
                </button>
                <button
                  type="button"
                  onClick={() => setItStatusFilter('rejected')}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition ${
                    itStatusFilter === 'rejected'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'hover:bg-secondary text-foreground'
                  }`}
                >
                  Ditolak ({itStats.rejected})
                </button>
              </div>

              <button
                type="button"
                onClick={handleExportItFormsExcel}
                disabled={filteredItSubmissions.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap ml-auto"
                title="Export data formulir E-Sign IT ke Excel (.xlsx)"
              >
                <Download className="size-3.5" />
                <span>Export Excel ({filteredItSubmissions.length})</span>
              </button>
            </div>
          </div>

          {/* Form Code Filter Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1">
            <button
              type="button"
              onClick={() => setItFormFilter('all')}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition ${
                itFormFilter === 'all'
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'bg-card text-muted-foreground border border-border hover:bg-secondary'
              }`}
            >
              Semua Formulir
            </button>
            {IT_FORM_DEFINITIONS.map((def) => (
              <button
                key={def.code}
                type="button"
                onClick={() => setItFormFilter(def.code)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap ${
                  itFormFilter === def.code
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'bg-card text-muted-foreground border border-border hover:bg-secondary'
                }`}
              >
                {def.code} · {def.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {itResendNotice && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 shadow-sm">
              <span>{itResendNotice}</span>
              <button type="button" onClick={() => setItResendNotice(null)} className="text-emerald-700 hover:text-emerald-900">
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* IT Submissions Table */}
          <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 border-b border-border text-muted-foreground uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">No. Pengajuan</th>
                    <th className="py-3 px-4">Formulir</th>
                    <th className="py-3 px-4">Pemohon & Dept</th>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Progress E-Sign</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingItSubmissions ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground">
                        <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                        Memuat data formulir E-Sign IT...
                      </td>
                    </tr>
                  ) : filteredItSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground">
                        <FileSignature className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                        Belum ada pengajuan formulir IT yang sesuai.
                      </td>
                    </tr>
                  ) : (
                    filteredItSubmissions.map((sub) => {
                      const approvedCount = (sub.signatures || []).filter((s) => s.status === 'approved').length
                      const totalSteps = sub.total_steps || (sub.signatures || []).length
                      return (
                        <tr key={sub.id} className="hover:bg-secondary/30 transition">
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-foreground block">
                              {sub.request_no}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {sub.form_code}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-foreground">
                            {sub.form_name}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-foreground">{sub.applicant_name}</div>
                            <div className="text-[11px] text-muted-foreground">{sub.department}</div>
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground">
                            {sub.request_date}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-secondary rounded-full h-2 overflow-hidden border border-border">
                                <div
                                  className="bg-emerald-600 h-full rounded-full transition-all"
                                  style={{
                                    width: `${totalSteps > 0 ? (approvedCount / totalSteps) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[11px] font-bold text-foreground">
                                {approvedCount}/{totalSteps}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {sub.status === 'approved'
                                ? 'Selesai disetujui'
                                : sub.status === 'rejected'
                                ? 'Ditolak / Revisi'
                                : `Step ${sub.current_step}: Menunggu tanda tangan`}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                sub.status === 'approved'
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : sub.status === 'rejected'
                                  ? 'bg-red-500/10 text-red-600'
                                  : 'bg-amber-500/10 text-amber-700'
                              }`}
                            >
                              {sub.status === 'approved' && 'Disetujui'}
                              {sub.status === 'rejected' && 'Ditolak'}
                              {sub.status === 'pending' && 'Menunggu'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {sub.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => handleResendItEmail(sub)}
                                  disabled={itResendingId === sub.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 text-xs font-semibold transition disabled:opacity-50"
                                  title="Kirim ulang notifikasi email ke approver"
                                >
                                  {itResendingId === sub.id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <Send className="size-3" />
                                  )}
                                  <span>Kirim Ulang</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedItSub(sub)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600/20 text-xs font-semibold transition"
                              >
                                <Eye className="size-3" /> Review & Sign
                              </button>
                              <a
                                href={`/api/it-form-submissions/${sub.id}/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
                                title="Unduh PDF Resmi"
                              >
                                <Download className="size-3.5" />
                              </a>
                              <Link
                                href={`/form-it-esign?token=${sub.token}`}
                                target="_blank"
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition"
                                title="Buka Form"
                              >
                                <ExternalLink className="size-3.5" />
                              </Link>
                              <button
                                type="button"
                                disabled={deletingSubId === sub.id}
                                onClick={() => handleDeleteItSubmission(sub)}
                                title="Hapus Permohonan Formulir IT"
                                className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-card px-2 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 transition"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Review & ACC Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 text-white rounded-xl">
                  <Laptop className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Detail Pengajuan Izin Alat IT
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500">
                    {selectedReq.request_no} ({selectedReq.form_type === 'out' ? 'ISMS-F-03-00-002' : 'ISMS-F-03-00-001'})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReq(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" /> {actionError}
                </div>
              )}

              {actionSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0" /> {actionSuccess}
                </div>
              )}

              {/* Status Header */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Status Dokumen (Alur: 1. IAA / Manager Departemen &rarr; 2. Check IT)
                  </span>
                  <div className="font-bold text-slate-800 text-sm">
                    {selectedReq.status === 'pending' && 'Tahap 1: Menunggu Persetujuan IAA / Manager Departemen'}
                    {selectedReq.status === 'approved_manager' && 'Tahap 2: Disetujui IAA / Mgr Dept · Menunggu Verifikasi IT (SSA)'}
                    {selectedReq.status === 'approved' &&
                      (selectedReq.form_type === 'out'
                        ? 'Izin Aktif · Perangkat Sedang Dibawa Keluar (Belum Closed)'
                        : 'Disetujui Lengkap (IAA / Manager Departemen & Verifikasi IT)')}
                    {selectedReq.status === 'returned' &&
                      (selectedReq.form_type === 'out'
                        ? 'Closed / Selesai · Perangkat Selesai Dikembalikan & Ditandatangani Lengkap'
                        : 'Selesai (Closed) · Telah Dikembalikan & Diperiksa')}
                    {selectedReq.status === 'rejected' && 'Ditolak'}
                  </div>
                </div>

                {selectedReq.approval_code && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Kode ACC
                    </span>
                    <span className="font-mono font-bold text-emerald-700 text-xs">
                      {selectedReq.approval_code}
                    </span>
                  </div>
                )}
              </div>

              {/* Visitor / Employee & Trip Info */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px]">
                    {selectedReq.form_type === 'out' ? 'Nama Karyawan PT. JAI' : 'Nama Tamu / Affiliate'}
                  </span>
                  <span className="font-semibold text-slate-800">{selectedReq.applicant_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">
                    {selectedReq.form_type === 'out' ? 'NIK / Perusahaan' : 'Perusahaan / Affiliate'}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {selectedReq.applicant_nik
                      ? `${selectedReq.applicant_nik} (${selectedReq.company_name})`
                      : selectedReq.company_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">
                    {selectedReq.form_type === 'out'
                      ? 'Departemen / Seksi Karyawan'
                      : 'Departemen / Seksi JAI Yang Dikunjungi'}
                  </span>
                  <span className="font-medium text-slate-700">
                    {selectedReq.department}
                    {selectedReq.section ? ` - Seksi: ${selectedReq.section}` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">
                    {selectedReq.form_type === 'out' ? 'Lokasi / Tujuan (Di Luar JAI)' : 'Lokasi / Ruangan di PT. JAI'}
                  </span>
                  <span className="font-medium text-slate-700">{selectedReq.location}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">
                    {selectedReq.form_type === 'out' ? 'Tanggal Keluar dari JAI' : 'Tanggal Masuk ke JAI'}
                  </span>
                  <span className="font-medium text-slate-700">{selectedReq.date_in}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">
                    {selectedReq.form_type === 'out' ? 'Rencana Kembali ke JAI' : 'Rencana Keluar dari JAI'}
                  </span>
                  <span className="font-medium text-slate-700">{selectedReq.date_out_plan}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px]">
                    {selectedReq.form_type === 'out' ? 'Tujuan Membawa Keluar Alat' : 'Tujuan Membawa Masuk Alat'}
                  </span>
                  <span className="font-medium text-slate-700">{selectedReq.purpose}</span>
                </div>
                {selectedReq.applicant_phone && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      {selectedReq.form_type === 'out' ? 'No. Telepon / WA Karyawan' : 'No. Telepon / WA'}
                    </span>
                    <span className="font-mono text-slate-700">{selectedReq.applicant_phone}</span>
                  </div>
                )}
              </div>

              {/* Equipment Items */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Laptop className="size-3.5 text-blue-600" /> Daftar Perangkat / Alat Elektronik:
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
                  {selectedReq.items.map((it, idx) => (
                    <div key={idx} className="p-3 bg-white flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{it.equipment_type}</div>
                        <div className="text-slate-600 mt-0.5">
                          Merk: <span className="font-medium">{it.brand || '-'}</span> | Model:{' '}
                          <span className="font-medium">{it.model || '-'}</span>
                        </div>
                        <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                          Serial No: {it.serial_no || '-'} {it.id_no ? `| ID Tag: ${it.id_no}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ringkasan Tahap 1 jika sudah disetujui oleh IAA / Manager Departemen */}
              {(selectedReq.status === 'approved_manager' ||
                selectedReq.status === 'approved' ||
                selectedReq.status === 'returned') && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    Tahap 1 Selesai: Disetujui oleh IAA / Manager Departemen ({selectedReq.approved_by || 'Manager Dept / IAA'})
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    Jabatan: {selectedReq.approved_title || 'Manager Departemen / IAA'}{' '}
                    {selectedReq.approved_at ? `· Waktu: ${new Date(selectedReq.approved_at).toLocaleString('id-ID')}` : ''}
                  </div>
                </div>
              )}

              {/* Ringkasan Tahap 2 jika sudah diverifikasi oleh IT */}
              {(selectedReq.status === 'approved' || selectedReq.status === 'returned') && (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-1 text-blue-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-blue-600" />
                    Tahap 2 Selesai: Diverifikasi oleh IT ({selectedReq.it_checked_by || 'System Security Admin (IT)'})
                  </div>
                  <div className="text-[11px] text-blue-800">
                    Jabatan: {selectedReq.it_checked_title || 'System Security Administrator (IT)'}{' '}
                    {selectedReq.it_checked_at ? `· Waktu: ${new Date(selectedReq.it_checked_at).toLocaleString('id-ID')}` : ''}
                  </div>
                </div>
              )}

              {/* Action Form: Sequential Approval (Tahap 1 IAA/Manager Dept -> Tahap 2 IT) */}
              {(selectedReq.status === 'pending' || selectedReq.status === 'approved_manager') && !showRejectForm && (
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                  <h4 className="font-bold text-blue-900 flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-blue-600" />{' '}
                    {selectedReq.status === 'pending'
                      ? 'Tahap 1: Persetujuan IAA / Manager Departemen (Wajib Terlebih Dahulu)'
                      : 'Tahap 2: Verifikasi / Check oleh Divisi IT (System Security Administrator)'}
                  </h4>
                  {selectedReq.status === 'pending' && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                      Alur Berurutan: Tahap 2 (Verifikasi IT) masih terkunci dan baru dapat dilakukan setelah Tahap 1 (IAA / Manager Departemen) disetujui.
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-slate-700">
                          {selectedReq.status === 'pending'
                            ? 'Nama IAA / Manager Departemen'
                            : 'Nama Petugas IT (SSA)'}
                        </label>
                        <span className="text-[10px] text-slate-500">Pilih cepat:</span>
                      </div>
                      <input
                        type="text"
                        value={approverName}
                        onChange={(e) => setApproverName(e.target.value)}
                        placeholder={
                          selectedReq.status === 'pending'
                            ? 'Contoh: TEGUH SUNJOYO atau Manager Terkait'
                            : 'Nama PIC Petugas IT / SSA'
                        }
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(selectedReq.status === 'pending'
                          ? [
                              'TEGUH SUNJOYO',
                              selectedReq.department ? `Manager ${selectedReq.department}` : 'Manager Departemen',
                            ]
                          : [username || 'IT Section / SSA', 'System Security Admin (IT)']
                        ).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setApproverName(preset)
                              if (selectedReq.status === 'pending') {
                                setApproverTitle(
                                  preset === 'TEGUH SUNJOYO'
                                    ? 'Information Assets Administrator (IAA)'
                                    : 'Manager Departemen'
                                )
                              }
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 transition cursor-pointer"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-slate-700">
                          Jabatan Approver
                        </label>
                        <span className="text-[10px] text-slate-500">Preset:</span>
                      </div>
                      <input
                        type="text"
                        value={approverTitle}
                        onChange={(e) => setApproverTitle(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(selectedReq.status === 'pending'
                          ? [
                              'Information Assets Administrator (IAA)',
                              'Manager Departemen',
                            ]
                          : ['System Security Administrator (IT)', 'IT Section / PIC Record']
                        ).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setApproverTitle(preset)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 transition cursor-pointer"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Catatan Persetujuan (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Diizinkan menggunakan stand-alone tanpa sambungan LAN internal."
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Reject Form */}
              {showRejectForm && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
                  <h4 className="font-bold text-red-900 flex items-center gap-1.5">
                    <XCircle className="size-4 text-red-600" /> Penolakan Pengajuan
                  </h4>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Alasan Penolakan <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Tulis alasan mengapa pengajuan ditolak..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-red-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleReject}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                    >
                      {actionLoading ? 'Menyimpan...' : 'Konfirmasi Tolak'}
                    </button>
                  </div>
                </div>
              )}

              {/* Return Check Modal / Form */}
              {showReturnModal && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                  <h4 className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <RotateCcw className="size-4 text-emerald-600" />{' '}
                    {selectedReq.form_type === 'out'
                      ? 'Pengecekan Pengembalian & Closing Form Bawa Keluar (ISMS-F-03-00-002)'
                      : 'Pengecheckan Sebelum Tamu Kembali (Selesai Kunjungan)'}
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    {selectedReq.form_type === 'out'
                      ? 'Perangkat telah kembali ke PT. JAI. Berdasarkan ketentuan Form ISMS-F-03-00-002 [KEMBALI], pastikan verifikasi berikut telah dilakukan sebelum form di-close:'
                      : 'Berdasarkan ketentuan form ISMS-F-03-00-001, pastikan verifikasi berikut telah dilakukan:'}
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checkItems}
                        onChange={(e) => setCheckItems(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-medium text-emerald-950">
                        {selectedReq.form_type === 'out'
                          ? 'Tidak disambungkan ke network, komputer atau server di tempat tujuan.'
                          : 'PC, flashdisk, camera, dll. sama dengan yang diajukan.'}
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checkConfidential}
                        onChange={(e) => setCheckConfidential(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-medium text-emerald-950">
                        {selectedReq.form_type === 'out'
                          ? 'Tidak mengimport data atau USB memory orang lain / Telah dicheck virus.'
                          : 'Tidak membawa pulang informasi rahasia tidak terkait.'}
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Catatan Pengecekan (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder={
                        selectedReq.form_type === 'out'
                          ? 'Contoh: Perangkat kembali utuh, diverifikasi bebas virus, dan record disimpan.'
                          : 'Contoh: Perangkat telah diperiksa lengkap di pos security.'
                      }
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-emerald-300 rounded-lg bg-white"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setShowReturnModal(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleReturnCheck}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                    >
                      {actionLoading
                        ? 'Menyimpan...'
                        : selectedReq.form_type === 'out'
                        ? 'Konfirmasi Pengembalian Selesai (Close Form 002)'
                        : 'Simpan Pengecekan Kembali'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/it-equipment-requests/${selectedReq.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  <Download className="size-3.5" /> Unduh Dokumen PDF
                </a>

                {selectedReq.status === 'approved' && selectedReq.form_type === 'in' && (
                  <button
                    type="button"
                    onClick={() => {
                      const origin = typeof window !== 'undefined' ? window.location.origin : ''
                      setAdminSlipData({
                        recipientName: selectedReq.applicant_name,
                        companyOrDept: `${selectedReq.company_name} · ${selectedReq.department}`,
                        requestNoOrCode: selectedReq.request_no,
                        ssid: selectedReq.network_ssid || 'JAI-CORP-GUEST',
                        networkUsername: selectedReq.network_username,
                        networkPassword: selectedReq.network_password,
                        ipMode: selectedReq.ip_mode || 'static',
                        assignedIp:
                          selectedReq.assigned_ip ||
                          `192.168.50.${(selectedReq.id % 150) + 50}`,
                        subnetMask: selectedReq.subnet_mask || '255.255.255.0',
                        gateway: selectedReq.gateway || '192.168.50.1',
                        dnsPrimary: selectedReq.dns_primary || '192.168.1.10',
                        dnsSecondary: selectedReq.dns_secondary || '8.8.8.8',
                        validFrom: selectedReq.date_in,
                        validUntil: selectedReq.date_out_plan,
                        approvedBy:
                          selectedReq.it_checked_by ||
                          selectedReq.approved_by ||
                          'System Security Admin (IT)',
                        approvedAt: selectedReq.it_checked_at || selectedReq.approved_at,
                        directLink: `${origin}/ijin-masuk-alat-it?token=${selectedReq.token}`,
                      })
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
                    title="Lihat Slip Parameter Jaringan & Salin WA"
                  >
                    <Send className="size-3.5" /> Slip Jaringan &amp; WA
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedReq.status === 'pending' && !showRejectForm && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(true)}
                      className="px-3.5 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold transition"
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleApprove('manager')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold transition shadow-sm"
                    >
                      <CheckCircle2 className="size-4" />
                      {actionLoading ? 'Memproses...' : '1. Setujui Tahap 1 (IAA / Manager Departemen)'}
                    </button>
                  </>
                )}

                {selectedReq.status === 'approved_manager' && !showRejectForm && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(true)}
                      className="px-3.5 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold transition"
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleApprove('it')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold transition shadow-sm"
                    >
                      <ShieldCheck className="size-4" />
                      {actionLoading ? 'Memproses...' : '2. Setujui Tahap 2 (Verifikasi / Check IT)'}
                    </button>
                  </>
                )}

                {selectedReq.status === 'approved' && !showReturnModal && (
                  <button
                    type="button"
                    onClick={() => setShowReturnModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition shadow-sm"
                  >
                    <RotateCcw className="size-4" />{' '}
                    {selectedReq.form_type === 'out'
                      ? 'Konfirmasi Kembali & Closing Form (002)'
                      : 'Pengecekan Pengembalian (Selesai)'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedReq(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IT Form E-Sign Review Modal */}
      {selectedItSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card rounded-2xl shadow-xl border border-border max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-secondary/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-600 text-white rounded-xl">
                  <FileSignature className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">
                    Review Formulir E-Sign IT
                  </h3>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    {selectedItSub.request_no} · {selectedItSub.form_code}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItSub(null)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Form & Applicant Summary */}
              <div className="rounded-xl border border-border bg-secondary/20 p-4">
                <div className="text-xs font-bold text-foreground mb-2">
                  {selectedItSub.form_name}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block">Nama Pemohon:</span>
                    <span className="font-semibold text-foreground">{selectedItSub.applicant_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Departemen:</span>
                    <span className="font-semibold text-foreground">{selectedItSub.department}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Tanggal:</span>
                    <span className="font-semibold text-foreground">{selectedItSub.request_date}</span>
                  </div>
                  {selectedItSub.applicant_nik && (
                    <div>
                      <span className="text-muted-foreground block">NIK:</span>
                      <span className="font-semibold text-foreground">{selectedItSub.applicant_nik}</span>
                    </div>
                  )}
                  {selectedItSub.applicant_position && (
                    <div>
                      <span className="text-muted-foreground block">Jabatan:</span>
                      <span className="font-semibold text-foreground">{selectedItSub.applicant_position}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground block">Status:</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedItSub.status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : selectedItSub.status === 'rejected'
                        ? 'bg-red-500/10 text-red-600'
                        : 'bg-amber-500/10 text-amber-700'
                    }`}>
                      {selectedItSub.status === 'approved' ? 'Disetujui Lengkap' : selectedItSub.status === 'rejected' ? 'Ditolak / Revisi' : 'Menunggu Approval'}
                    </span>
                  </div>
                </div>

                {selectedItSub.form_code === 'ISMS-F-03-00-003' && (
                  <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <span className="text-muted-foreground block">MAC Address Perangkat:</span>
                      <span className="font-mono font-bold text-foreground">
                        {selectedItSub.form_data?.mac_address || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">OS &amp; Anti-Virus:</span>
                      <span className="font-medium text-foreground">
                        {selectedItSub.form_data?.os_info || '-'} · {selectedItSub.form_data?.antivirus_name || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Metode IP:</span>
                      <span className={`font-semibold ${selectedItSub.form_data?.ip_mode === 'static' ? 'text-blue-600' : 'text-emerald-600'}`}>
                        {selectedItSub.form_data?.ip_mode === 'static' ? 'STATIC IP (Manual / Darurat)' : 'DHCP (Automatic)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Alokasi IP Address:</span>
                      <span className="font-mono font-bold text-foreground">
                        {selectedItSub.form_data?.assigned_ip || selectedItSub.form_data?.static_ip || (selectedItSub.current_step >= 2 ? 'Menunggu IT Check' : 'Menunggu IAA')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Dedicated IT Network IP Configuration Panel (ISMS-F-03-00-003) */}
              {selectedItSub.form_code === 'ISMS-F-03-00-003' && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-blue-500/20 pb-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="size-4 text-blue-600" />
                        <span>Pengaturan Alamat IP (IT Network Management)</span>
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Normal menggunakan DHCP. Ganti ke <strong>STATIC IP</strong> jika darurat (misal saat PIC Network berhalangan / konfigurasi manual).
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-card border border-border text-foreground font-semibold">
                        MAC: {selectedItSub.form_data?.mac_address || '-'}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Mode: DHCP vs STATIC IP */}
                  <div>
                    <label className="text-[11px] font-bold text-foreground block mb-1.5">
                      Pilih Metode Alokasi IP:
                    </label>
                    <div className="grid grid-cols-2 gap-2.5 max-w-sm">
                      <button
                        type="button"
                        onClick={() => setItIpMode('dhcp')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                          itIpMode === 'dhcp'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-card border border-border text-muted-foreground hover:bg-secondary'
                        }`}
                      >
                        {itIpMode === 'dhcp' && <Check className="size-3.5" />}
                        <span>DHCP (Automatic)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setItIpMode('static')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                          itIpMode === 'static'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-card border border-border text-muted-foreground hover:bg-secondary'
                        }`}
                      >
                        {itIpMode === 'static' && <Check className="size-3.5" />}
                        <span>STATIC IP (Darurat / Manual)</span>
                      </button>
                    </div>
                  </div>

                  {/* Input fields based on mode */}
                  {itIpMode === 'dhcp' ? (
                    <div>
                      <label className="text-[11px] font-bold text-foreground block mb-1">
                        Alokasi IP Address IT (DHCP Reservation)
                      </label>
                      <input
                        type="text"
                        value={itAssignedIp}
                        onChange={(e) => setItAssignedIp(e.target.value)}
                        placeholder="Contoh: 192.168.10.150"
                        className="h-8 w-full max-w-md rounded-lg border border-input bg-card px-2.5 text-xs font-mono font-semibold text-foreground outline-none focus:border-ring focus:ring-2"
                      />
                      <p className="text-[10.5px] text-muted-foreground mt-1">
                        *IP yang dialokasikan Tim IT untuk MAC Address perangkat tamu.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[11px] font-bold text-foreground block mb-1">
                            IP Address (Manual) <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="text"
                            value={itAssignedIp}
                            onChange={(e) => setItAssignedIp(e.target.value)}
                            placeholder="192.168.1.xxx"
                            className="h-8 w-full rounded-lg border border-input bg-card px-2.5 text-xs font-mono font-semibold text-foreground outline-none focus:border-ring focus:ring-2"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-foreground block mb-1">
                            Subnet Mask <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="text"
                            value={itStaticSubnet}
                            onChange={(e) => setItStaticSubnet(e.target.value)}
                            placeholder="255.255.255.0"
                            className="h-8 w-full rounded-lg border border-input bg-card px-2.5 text-xs font-mono font-semibold text-foreground outline-none focus:border-ring focus:ring-2"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-foreground block mb-1">
                            Gateway Address <span className="text-destructive">*</span>
                          </label>
                          <input
                            type="text"
                            value={itStaticGateway}
                            onChange={(e) => setItStaticGateway(e.target.value)}
                            placeholder="192.168.1.1"
                            className="h-8 w-full rounded-lg border border-input bg-card px-2.5 text-xs font-mono font-semibold text-foreground outline-none focus:border-ring focus:ring-2"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[11px] font-medium text-foreground block mb-1">
                            DNS Priority (Opsional)
                          </label>
                          <input
                            type="text"
                            value={itDnsPriority}
                            onChange={(e) => setItDnsPriority(e.target.value)}
                            placeholder="192.168.1.1 atau 8.8.8.8"
                            className="h-8 w-full rounded-lg border border-input bg-card px-2.5 text-xs font-mono text-foreground outline-none focus:border-ring focus:ring-2"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-foreground block mb-1">
                            DNS Secondary (Opsional)
                          </label>
                          <input
                            type="text"
                            value={itDnsSecondary}
                            onChange={(e) => setItDnsSecondary(e.target.value)}
                            placeholder="8.8.4.4"
                            className="h-8 w-full rounded-lg border border-input bg-card px-2.5 text-xs font-mono text-foreground outline-none focus:border-ring focus:ring-2"
                          />
                        </div>
                      </div>

                      <p className="text-[10.5px] text-amber-800 dark:text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                        *Mode STATIC IP ini otomatis mencentang kotak STATIC pada form PDF dan mencetak seluruh parameter IP, Subnet, dan Gateway pada lembar dokumen resmi.
                      </p>
                    </div>
                  )}

                  {/* Save button - accessible anytime, including when already approved! */}
                  <div className="pt-2 border-t border-blue-500/20 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveIpConfig}
                        disabled={itSavingIpConfig}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition shadow-xs cursor-pointer"
                      >
                        {itSavingIpConfig ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                        <span>{itSavingIpConfig ? 'Menyimpan...' : 'Simpan / Perbarui Konfigurasi IP'}</span>
                      </button>
                      {itSaveIpSuccess && (
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
                          <Check className="size-3.5" /> {itSaveIpSuccess}
                        </span>
                      )}
                    </div>

                    <a
                      href={`/api/it-form-submissions/${selectedItSub.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="size-3" /> Preview Dokumen PDF
                    </a>
                  </div>
                </div>
              )}

              {/* Approval Steps & Actions */}
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                  Alur Persetujuan & Tanda Tangan Digital (E-Sign)
                </h4>
                <div className="space-y-2.5">
                  {(selectedItSub.signatures || []).map((sig) => {
                    const isPendingCurrent = sig.status === 'pending'
                    return (
                      <div
                        key={sig.id || sig.step_number}
                        className={`rounded-xl border p-3.5 transition ${
                          sig.status === 'approved'
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : sig.status === 'rejected'
                            ? 'border-red-500/30 bg-red-500/5'
                            : isPendingCurrent
                            ? 'border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20'
                            : 'border-border bg-card'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Step {sig.step_number}: {sig.slot_label}
                            </span>
                            <div className="font-semibold text-foreground text-xs mt-0.5">
                              {sig.approver_name}
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {sig.role_title}
                            </span>
                          </div>
                          <div>
                            {sig.status === 'approved' && (
                              <div className="text-right">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                                  <Check className="size-3" /> Disetujui
                                </span>
                                {sig.verification_code && (
                                  <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                    {sig.verification_code}
                                  </div>
                                )}
                              </div>
                            )}
                            {sig.status === 'rejected' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-600/10 px-2 py-0.5 text-[10px] font-bold text-red-600">
                                <X className="size-3" /> Ditolak
                              </span>
                            )}
                            {sig.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-600/10 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                <Clock className="size-3" /> Menunggu Tanda Tangan
                              </span>
                            )}
                            {sig.status === 'waiting' && (
                              <span className="text-[10px] text-muted-foreground">
                                Antrean berikutnya
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Display allocated IP address if this step is IT Check and already approved */}
                        {selectedItSub.form_code === 'ISMS-F-03-00-003' && sig.step_number === 2 && (selectedItSub.form_data?.assigned_ip || selectedItSub.form_data?.static_ip) && (
                          <div className="mt-2.5 pt-2 border-t border-border/50 text-[11px] flex items-center justify-between">
                            <span className="text-muted-foreground">IP Address Dialokasikan:</span>
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              {selectedItSub.form_data?.assigned_ip || selectedItSub.form_data?.static_ip}
                            </span>
                          </div>
                        )}

                        {/* If pending and user is admin, allow sign here */}
                        {isPendingCurrent && (
                          <div className="mt-3 border-t border-border/60 pt-3">
                            {/* If ISMS-F-03-00-003 and Step 2 (IT Check), show IP Address allocation input */}
                            {selectedItSub.form_code === 'ISMS-F-03-00-003' && sig.step_number === 2 && (
                              <div className="mb-2.5 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-900 dark:text-blue-200">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 font-bold">
                                  <span>Konfigurasi IP yang Akan Diterapkan:</span>
                                  <span className="font-mono text-xs">
                                    {itIpMode === 'static' ? 'STATIC IP' : 'DHCP'} · {itAssignedIp || '(Alamat IP belum diisi)'}
                                    {itIpMode === 'static' && itStaticSubnet ? ` (Mask: ${itStaticSubnet})` : ''}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  *Konfigurasi ini disinkronkan dari panel Pengaturan Alamat IP di atas. Anda dapat mengubah ke DHCP atau Static IP manual kapan saja.
                                </p>
                              </div>
                            )}

                            <div className="mb-2">
                              <input
                                type="text"
                                value={itSignNote}
                                onChange={(e) => setItSignNote(e.target.value)}
                                placeholder="Catatan persetujuan / revisi (opsional)..."
                                className="h-8 w-full rounded-lg border border-input bg-card px-2.5 text-xs outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSignItSub(sig.step_number, 'approve')}
                                disabled={itSignLoading}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {itSignLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" strokeWidth={3} />}
                                {itSignLoading ? 'Memproses...' : 'Setujui & E-Sign'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSignItSub(sig.step_number, 'reject')}
                                disabled={itSignLoading}
                                className="inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-[#c2412c]/60 px-4 py-2.5 text-xs font-bold text-[#a83522] transition hover:bg-[#fdf0ec] disabled:opacity-50"
                              >
                                {itSignLoading ? <Loader2 className="size-3.5 animate-spin" /> : <PencilLine className="size-3.5" />}
                                Minta Revisi
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-secondary/30 border-t border-border flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/it-form-submissions/${selectedItSub.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border hover:bg-secondary text-foreground text-xs font-semibold transition"
                >
                  <Download className="size-3.5" /> Unduh Dokumen PDF
                </a>
                <Link
                  href={`/form-it-esign?token=${selectedItSub.token}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600/20 text-xs font-semibold transition"
                >
                  <ExternalLink className="size-3.5" /> Buka di Portal E-Sign
                </Link>
                {(selectedItSub.form_code === 'ISMS-F-03-00-003' || itAssignedIp) && (
                  <button
                    type="button"
                    onClick={() => {
                      const origin = typeof window !== 'undefined' ? window.location.origin : ''
                      setAdminSlipData({
                        recipientName: selectedItSub.applicant_name,
                        companyOrDept: `${selectedItSub.company_name} · ${selectedItSub.department}`,
                        requestNoOrCode: selectedItSub.request_no,
                        ssid: 'JAI-CORP-GUEST',
                        networkUsername: selectedItSub.applicant_name.toLowerCase().replace(/\s+/g, '.'),
                        ipMode: itIpMode,
                        assignedIp: itAssignedIp || '192.168.50.101',
                        subnetMask: itStaticSubnet || '255.255.255.0',
                        gateway: itStaticGateway || '192.168.50.1',
                        dnsPrimary: itDnsPriority || '192.168.1.10',
                        dnsSecondary: itDnsSecondary || '8.8.8.8',
                        validFrom: selectedItSub.request_date,
                        validUntil: selectedItSub.request_date,
                        approvedBy: username || 'System Security Admin (IT)',
                        directLink: `${origin}/form-it-esign?token=${selectedItSub.token}`,
                      })
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
                    title="Lihat Slip Parameter Jaringan & Salin WA"
                  >
                    <Send className="size-3.5" /> Slip Jaringan &amp; WA
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedItSub(null)}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Network Pass Slip & WhatsApp Modal */}
      <NetworkPassModal
        open={!!adminSlipData}
        onClose={() => setAdminSlipData(null)}
        data={adminSlipData}
      />
    </div>
  )
}
