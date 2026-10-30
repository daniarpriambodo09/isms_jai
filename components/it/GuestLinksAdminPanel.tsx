'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Link2,
  Plus,
  Minus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
  KeyRound,
  Server,
  Download,
  RefreshCw,
  Search,
  Sparkles,
  ShieldCheck,
  UserPlus,
  X,
  Wifi,
  Laptop,
  Network,
  Send,
} from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { copyText } from '@/lib/clipboard'
import { downloadExcel } from '@/lib/excel-export'
import {
  buildSuggestedNetworkConfig,
  type ItGuestAccessLink,
} from '@/lib/it-guest-link-shared'
import { GuestLinkGeneratorModal } from '@/components/it/GuestLinkGeneratorModal'
import { NetworkPassModal, type NetworkPassData } from '@/components/it/NetworkPassCard'

interface GuestLinksAdminPanelProps {
  defaultApproverName?: string
  onDataChanged?: () => void
}

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

const inputClass =
  'h-10 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15'
const labelClass = 'mb-1 block text-xs font-semibold text-foreground'

export function GuestLinksAdminPanel({
  defaultApproverName = 'Admin IT',
  onDataChanged,
}: GuestLinksAdminPanelProps) {
  const [links, setLinks] = useState<ItGuestAccessLink[]>([])
  const [period, setPeriod] = useState<{ year: number; month: number; next_seq: number }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    next_seq: 1,
  })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Modal Generate Link
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [generatorWalkIn, setGeneratorWalkIn] = useState(false)
  const [generatorCount, setGeneratorCount] = useState<number>(1)

  // Modal Approve & Berikan Username + IP Jaringan Internal
  const [activeApproveLink, setActiveApproveLink] = useState<ItGuestAccessLink | null>(null)
  const [approveAction, setApproveAction] = useState<'approve' | 'reject'>('approve')
  const [approverName, setApproverName] = useState(defaultApproverName)
  const [networkUsername, setNetworkUsername] = useState('')
  const [networkPassword, setNetworkPassword] = useState('')
  const [networkSsid, setNetworkSsid] = useState('JAI-CORP-GUEST')
  const [ipMode, setIpMode] = useState<'dhcp' | 'static'>('dhcp')
  const [assignedIp, setAssignedIp] = useState('')
  const [subnetMask, setSubnetMask] = useState('255.255.255.0')
  const [gateway, setGateway] = useState('192.168.50.1')
  const [dnsPrimary, setDnsPrimary] = useState('192.168.1.10')
  const [dnsSecondary, setDnsSecondary] = useState('8.8.8.8')
  const [approvalNotes, setApprovalNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [processingApprove, setProcessingApprove] = useState(false)
  const [processingForm1Id, setProcessingForm1Id] = useState<number | null>(null)
  const [processingIaaId, setProcessingIaaId] = useState<number | null>(null)
  const [approveError, setApproveError] = useState('')

  // Delete loading state
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Network Pass Modal state (Slip Parameter Jaringan & WhatsApp)
  const [selectedSlipData, setSelectedSlipData] = useState<NetworkPassData | null>(null)

  const openNetworkSlipModal = (item: ItGuestAccessLink) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    setSelectedSlipData({
      recipientName: item.guest_name,
      companyOrDept: item.company_name || item.department,
      requestNoOrCode: item.link_code,
      ssid: item.network_ssid || 'JAI-CORP-GUEST',
      networkUsername: item.network_username,
      networkPassword: item.network_password,
      ipMode: item.ip_mode,
      assignedIp: item.assigned_ip || '',
      subnetMask: item.subnet_mask || '255.255.255.0',
      gateway: item.gateway || '192.168.50.1',
      dnsPrimary: item.dns_primary || '192.168.1.10',
      dnsSecondary: item.dns_secondary || '8.8.8.8',
      validFrom: item.visit_date,
      validUntil: item.visit_end_date,
      approvedBy: item.approved_by || 'System Security Admin (IT)',
      approvedAt: item.approved_at,
      directLink: `${origin}/tamu-it/${item.link_code}`,
    })
  }

  const fetchGuestLinks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (searchQuery.trim()) params.set('q', searchQuery.trim())
      const res = await fetch(`${API_BASE_PATH}/api/it-guest-links?${params.toString()}`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setLinks(data.links || [])
        if (data.period) setPeriod(data.period)
      }
    } catch (err) {
      console.error('Error loading guest links:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchQuery])

  useEffect(() => {
    fetchGuestLinks()
  }, [fetchGuestLinks])

  const buildGuestUrl = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}${API_BASE_PATH}/tamu-it/${encodeURIComponent(code)}`
  }

  const handleCopy = async (key: string, val: string) => {
    const ok = await copyText(val)
    if (ok) {
      setCopiedId(key)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const openApprovalModal = (item: ItGuestAccessLink, mode: 'approve' | 'reject' = 'approve') => {
    const suggested = buildSuggestedNetworkConfig(item)
    setActiveApproveLink(item)
    setApproveAction(mode)
    setApproverName(defaultApproverName || 'System Security Admin (IT)')
    setNetworkUsername(item.network_username || suggested.network_username)
    setNetworkPassword(item.network_password || suggested.network_password)
    setNetworkSsid(item.network_ssid || suggested.network_ssid)
    setIpMode(item.ip_mode || 'dhcp')
    setAssignedIp(item.assigned_ip || suggested.assigned_ip)
    setSubnetMask(item.subnet_mask || suggested.subnet_mask)
    setGateway(item.gateway || suggested.gateway)
    setDnsPrimary(item.dns_primary || suggested.dns_primary)
    setDnsSecondary(item.dns_secondary || suggested.dns_secondary)
    setApprovalNotes(item.approval_notes || '')
    setRejectionReason(item.rejection_reason || '')
    setApproveError('')
  }

  const handleQuickApproveForm1Manager = async (item: ItGuestAccessLink) => {
    setProcessingForm1Id(item.id)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-guest-links/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_form_1_manager',
          approver_name: 'IAA / Manager Departemen',
          approval_notes:
            'Tahap 1A Form 1 (IAA / Manager Departemen) Disetujui. Menunggu Tahap 1B (Check IT / SSA).',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Gagal menyetujui Tahap 1A (IAA / Manager Departemen)')
        return
      }
      await fetchGuestLinks()
      if (onDataChanged) onDataChanged()
    } catch (err) {
      console.error('Approve Form 1 Manager error:', err)
    } finally {
      setProcessingForm1Id(null)
    }
  }

  const handleQuickApproveForm1 = async (item: ItGuestAccessLink) => {
    setProcessingForm1Id(item.id)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-guest-links/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_form_1',
          approver_name: defaultApproverName || 'System Security Admin (IT)',
          approval_notes:
            'Tahap 1B Form 1 (Verifikasi IT / SSA) Disetujui. Tamu dapat melanjutkan ke Form 2 (Network).',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Gagal menyetujui Tahap 1B (Check IT / SSA)')
        return
      }
      await fetchGuestLinks()
      if (onDataChanged) onDataChanged()
    } catch (err) {
      console.error('Approve Form 1 error:', err)
    } finally {
      setProcessingForm1Id(null)
    }
  }

  const handleQuickApproveIaa = async (item: ItGuestAccessLink) => {
    setProcessingIaaId(item.id)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-guest-links/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_iaa',
          approver_name: 'TEGUH SUNJOYO',
          approval_notes: 'Approved by Information Assets Administrator (IAA)',
        }),
      })
      if (res.ok) {
        await fetchGuestLinks()
        if (onDataChanged) onDataChanged()
      }
    } catch (err) {
      console.error('Approve IAA error:', err)
    } finally {
      setProcessingIaaId(null)
    }
  }

  const handleAutoRecommendCredentials = () => {
    if (!activeApproveLink) return
    const suggested = buildSuggestedNetworkConfig(activeApproveLink)
    setNetworkUsername(suggested.network_username)
    setNetworkPassword(suggested.network_password)
    setNetworkSsid(suggested.network_ssid)
    setAssignedIp(suggested.assigned_ip)
    setSubnetMask(suggested.subnet_mask)
    setGateway(suggested.gateway)
    setDnsPrimary(suggested.dns_primary)
    setDnsSecondary(suggested.dns_secondary)
  }

  const handleConfirmApproveOrReject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeApproveLink) return
    setApproveError('')
    setProcessingApprove(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-guest-links/${activeApproveLink.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: approveAction,
          approver_name: approverName,
          network_username: networkUsername,
          network_password: networkPassword,
          network_ssid: networkSsid,
          ip_mode: ipMode,
          assigned_ip: assignedIp,
          subnet_mask: subnetMask,
          gateway,
          dns_primary: dnsPrimary,
          dns_secondary: dnsSecondary,
          approval_notes: approvalNotes,
          rejection_reason: rejectionReason,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses persetujuan link tamu')
      }
      setActiveApproveLink(null)
      await fetchGuestLinks()
      if (onDataChanged) onDataChanged()
    } catch (err: any) {
      setApproveError(err.message || 'Gagal menyimpan persetujuan')
    } finally {
      setProcessingApprove(false)
    }
  }

  const handleDeleteLink = async (item: ItGuestAccessLink) => {
    const confirmed = window.confirm(
      `Hapus data Link Tamu "${item.guest_name}" (${item.link_code}) beserta dokumen terkait?`
    )
    if (!confirmed) return

    setDeletingId(item.id)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-guest-links/${item.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setLinks((prev) => prev.filter((x) => x.id !== item.id))
        if (onDataChanged) onDataChanged()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Gagal menghapus link tamu')
      }
    } catch (err) {
      console.error('Delete guest link error:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const availableYears = React.useMemo(() => {
    const years = new Set<number>()
    years.add(new Date().getFullYear())
    links.forEach((l) => {
      if (l.seq_year) years.add(l.seq_year)
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [links])

  const filteredLinks = React.useMemo(() => {
    return links.filter((item) => {
      if (selectedYear !== 'all' && item.seq_year !== Number(selectedYear)) return false
      if (selectedMonth !== 'all' && item.seq_month !== Number(selectedMonth)) return false
      return true
    })
  }, [links, selectedYear, selectedMonth])

  const countWaitingGuest = filteredLinks.filter((l) => l.status === 'link_created').length
  const countWaitingApproval = filteredLinks.filter((l) => l.status === 'submitted').length
  const countApproved = filteredLinks.filter((l) => l.status === 'approved').length

  const handleExportGuestLinksExcel = () => {
    if (filteredLinks.length === 0) return
    const monthLabel = selectedMonth !== 'all' ? `_${MONTH_NAMES[Number(selectedMonth) - 1]}` : ''
    const yearLabel = selectedYear !== 'all' ? `_${selectedYear}` : ''
    const filename = `Rekap_Link_Tamu_IT_PT_JAI${yearLabel}${monthLabel}_${new Date().toISOString().slice(0, 10)}`

    const headers = [
      'No',
      'No. Urut Bulanan',
      'Kode Link Unik',
      'Nama Tamu',
      'Perusahaan / Instansi',
      'Departemen Dituju',
      'Tanggal Kunjungan',
      'Tgl Rencana Kembali',
      'Tipe Tamu',
      'Status Akses',
      'Status Form 1 (Alat IT)',
      'No. Dokumen Form 1',
      'Status Form 2 (Network)',
      'No. Dokumen Form 2',
      'SSID Wi-Fi',
      'IP Address Resmi',
      'Mode IP',
      'Subnet Mask',
      'Default Gateway',
      'DNS Primary',
      'DNS Secondary',
      'Username Login',
      'Password Login',
      'MAC Address Perangkat',
      'Disetujui Oleh',
      'Waktu Approval',
      'Catatan Approval / Penolakan',
      'Link Portal Tamu',
    ]

    const rows = filteredLinks.map((item, idx) => {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const guestUrl = `${origin}${API_BASE_PATH}/tamu-it/${item.link_code}`
      const statusLabel =
        item.status === 'approved'
          ? 'DISETUJUI (AKTIF)'
          : item.status === 'submitted'
          ? 'MENUNGGU APPROVAL IT'
          : item.status === 'rejected'
          ? 'DITOLAK'
          : 'MENUNGGU DIISI TAMU'

      const form1Doc = item.equipment_request?.request_no || '-'
      const form1Status = item.equipment_request?.status || (item.equipment_request_id ? 'terisi' : 'belum diisi')
      const form2Doc = item.network_submission?.request_no || '-'
      const form2Status = item.network_submission?.status || (item.network_submission_id ? 'terisi' : 'belum diisi')
      const macAddress = (item.network_submission?.form_data as any)?.mac_address || '-'

      return [
        idx + 1,
        `#${String(item.seq_no).padStart(3, '0')}`,
        item.link_code,
        item.guest_name,
        item.company_name || '-',
        item.department || '-',
        item.visit_date || '-',
        item.visit_end_date || '-',
        item.is_walk_in ? 'Walk-in (Dadakan)' : 'Terjadwal',
        statusLabel,
        form1Status,
        form1Doc,
        form2Status,
        form2Doc,
        item.network_ssid || 'JAI-CORP-GUEST',
        item.assigned_ip || '-',
        item.ip_mode || 'dhcp',
        item.subnet_mask || '255.255.255.0',
        item.gateway || '192.168.50.1',
        item.dns_primary || '192.168.1.10',
        item.dns_secondary || '8.8.8.8',
        item.network_username || '-',
        item.network_password || '-',
        macAddress,
        item.approved_by || '-',
        item.approved_at || '-',
        item.approval_notes || item.rejection_reason || '-',
        guestUrl,
      ]
    })

    downloadExcel(filename, headers, rows, 'Rekap Link Tamu IT')
  }

  return (
    <div className="space-y-5">
      {/* Banner & Tombol Generate Link Tamu */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                GENERATOR LINK TAMU TERPADU (2-IN-1)
              </span>
              <span className="rounded-lg border border-border bg-muted/40 px-2.5 py-1 font-mono text-xs font-semibold text-foreground">
                Periode Aktif: Tahun {period.year} • Bulan {String(period.month).padStart(2, '0')} • Urutan Berikutnya #{String(period.next_seq).padStart(3, '0')}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-bold text-foreground">
              Manajemen Link Khusus Guest (Form Izin Masuk Alat IT + Form Network Internal)
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Setiap tamu mendapatkan link unik terpisah berformat{' '}
              <code className="font-mono font-bold text-foreground">NAMA-TAHUN-BULAN-NO_URUT</code> (berganti tiap tahun &amp; reset ke{' '}
              <code className="font-mono font-bold text-foreground">001</code> setiap bulan). Setelah tamu mengisi 2 form, Admin IT dapat meng-approve dan mengalokasikan{' '}
              <strong>Username Jaringan, Password, SSID, IP Address, Subnet, Gateway, &amp; DNS</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 p-1.5 pl-3">
              <label htmlFor="admin-guest-link-count" className="text-xs font-bold text-foreground whitespace-nowrap">
                Jumlah Link:
              </label>
              <div className="inline-flex items-center rounded-lg border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setGeneratorCount((c) => Math.max(1, c - 1))}
                  aria-label="Kurangi jumlah link"
                  className="px-2 py-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <input
                  id="admin-guest-link-count"
                  type="number"
                  min={1}
                  max={50}
                  value={generatorCount}
                  onChange={(e) =>
                    setGeneratorCount(Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)))
                  }
                  className="w-11 bg-transparent text-center font-mono text-xs font-bold text-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={() => setGeneratorCount((c) => Math.min(50, c + 1))}
                  aria-label="Tambah jumlah link"
                  className="px-2 py-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setGeneratorWalkIn(false)
                  setGeneratorOpen(true)
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 cursor-pointer"
              >
                <Link2 className="h-4 w-4" aria-hidden="true" />
                Generate {generatorCount} Link Tamu
              </button>
            </div>
          </div>
        </div>

        {/* Ringkasan Statistik */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-muted/20 p-3.5">
            <p className="text-[11px] font-semibold text-muted-foreground">Total Link Tamu (Terfilter)</p>
            <p className="mt-1 text-xl font-bold text-foreground">{filteredLinks.length}</p>
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5">
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              Belum Diisi Tamu
            </p>
            <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300">
              {countWaitingGuest}
            </p>
          </div>
          <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-3.5">
            <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
              Siap Di-Approve Admin IT
            </p>
            <p className="mt-1 text-xl font-bold text-blue-700 dark:text-blue-300">
              {countWaitingApproval}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5">
            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              Disetujui (Username &amp; IP Aktif)
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {countApproved}
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'Semua Link' },
              { id: 'submitted', label: 'Menunggu Approval IT' },
              { id: 'link_created', label: 'Menunggu Diisi Tamu' },
              { id: 'approved', label: 'Disetujui (Aktif)' },
              { id: 'rejected', label: 'Ditolak' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Export to Excel Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportGuestLinksExcel}
              disabled={filteredLinks.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white transition shadow-xs disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              title="Ekspor rekap link tamu & jaringan ke file Excel (.xlsx)"
            >
              <Download className="size-3.5" />
              <span>Ekspor Rekap Excel ({filteredLinks.length})</span>
            </button>
          </div>
        </div>

        {/* Second Row: Month/Year Dropdown & Search & Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Filter Periode:</span>
            {/* Year Selector */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-semibold text-foreground outline-none focus:border-ring cursor-pointer"
            >
              <option value="all">Semua Tahun</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Tahun {yr}
                </option>
              ))}
            </select>

            {/* Month Selector */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 rounded-xl border border-input bg-card px-3 text-xs font-semibold text-foreground outline-none focus:border-ring cursor-pointer"
            >
              <option value="all">Semua Bulan</option>
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  Bulan {String(idx + 1).padStart(2, '0')} - {name}
                </option>
              ))}
            </select>

            {(selectedYear !== 'all' || selectedMonth !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedYear('all')
                  setSelectedMonth('all')
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline ml-1 cursor-pointer"
              >
                Reset Periode
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, kode link, IP..."
                className="h-9 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-xs text-foreground outline-none focus:border-ring"
              />
            </div>
            <button
              type="button"
              onClick={fetchGuestLinks}
              aria-label="Muat ulang daftar link tamu"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Tabel Daftar Link Tamu */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3.5">Urutan &amp; Tahun</th>
                <th className="px-4 py-3.5">Nama Tamu &amp; Link Unik</th>
                <th className="px-4 py-3.5">Status 2 Form (Alat IT &amp; Network)</th>
                <th className="px-4 py-3.5">Username &amp; IP Jaringan Internal</th>
                <th className="px-4 py-3.5 text-right whitespace-nowrap min-w-[280px]">Aksi Admin IT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Memuat daftar link akses tamu...
                  </td>
                </tr>
              ) : filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Tidak ada link tamu yang cocok dengan filter atau belum ada link yang dibuat.
                  </td>
                </tr>
              ) : (
                filteredLinks.map((item) => {
                  const fullUrl = buildGuestUrl(item.link_code)
                  return (
                    <tr key={item.id} className="hover:bg-muted/20 transition">
                      {/* Kolom 1: Nomor Urut Bulanan & Tahun */}
                      <td className="px-4 py-3.5 align-top whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold text-primary">
                          #{String(item.seq_no).padStart(3, '0')}
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          Thn {item.seq_year} • Bln {String(item.seq_month).padStart(2, '0')}
                        </p>
                        {item.is_walk_in && (
                          <span className="mt-1 inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            Tamu Dadakan
                          </span>
                        )}
                      </td>

                      {/* Kolom 2: Nama Tamu & Kode Link */}
                      <td className="px-4 py-3.5 align-top">
                        <p className="text-sm font-bold text-foreground">{item.guest_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.company_name || 'Perusahaan belum diisi'}{' '}
                          {item.department ? `• Tujuan: ${item.department}` : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <code className="rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] font-bold text-foreground">
                            {item.link_code}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopy(`link-${item.id}`, fullUrl)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
                          >
                            {copiedId === `link-${item.id}` ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                                Disalin
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" aria-hidden="true" />
                                Salin Link
                              </>
                            )}
                          </button>
                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold text-primary hover:bg-muted"
                          >
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            Buka
                          </a>
                        </div>
                      </td>

                      {/* Kolom 3: Status Bertahap (Form 1 -> Form 2 IT Check -> IAA Approval) */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="space-y-1.5">
                          {item.status === 'rejected' ? (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-bold text-destructive">
                              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                              Ditolak
                            </span>
                          ) : !item.equipment_request ? (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              Tahap 1: Menunggu Tamu Isi Form 1 (Alat IT)
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {/* Status Tahap 1A & 1B: Form 1 (Izin Alat IT 001 Masuk / 002 Keluar: IAA/Manager Dept -> IT) */}
                              {item.equipment_request.status === 'approved_manager' ||
                              item.equipment_request.status === 'approved' ||
                              item.equipment_request.status === 'returned' ? (
                                <span className="inline-flex w-fit items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                  1A. Form Alat ({item.equipment_request.form_type === 'out' ? '002 Keluar' : '001 Masuk'}) — IAA / Mgr Dept: Approved ({item.equipment_request.approved_by || 'IAA / Mgr'})
                                </span>
                              ) : (
                                <span className="inline-flex w-fit items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                  1A. Form Alat ({item.equipment_request.form_type === 'out' ? '002 Keluar' : '001 Masuk'}): Menunggu Approve IAA / Mgr Dept
                                </span>
                              )}

                              {item.equipment_request.status === 'approved' ||
                              item.equipment_request.status === 'returned' ? (
                                <span className="inline-flex w-fit items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                  1B. Form Alat — Check IT (SSA): Approved ({item.equipment_request.it_checked_by || 'IT'})
                                </span>
                              ) : (
                                <span className="inline-flex w-fit items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                  <Clock className="h-3 w-3" aria-hidden="true" />
                                  1B. Form Alat — Check IT (SSA):{' '}
                                  {item.equipment_request.status === 'approved_manager'
                                    ? 'Menunggu Verifikasi IT'
                                    : 'Terkunci (Tunggu IAA / Mgr Dept)'}
                                </span>
                              )}

                              {/* Status Tahap 2A: Form 2 Network (IT Section Check) */}
                              {item.equipment_request.status === 'approved' && !item.network_submission && (
                                <span className="inline-flex w-fit items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                  <Clock className="h-3 w-3" aria-hidden="true" />
                                  2. Form Network (003): Menunggu Tamu Mengisi Form 2
                                </span>
                              )}

                              {item.network_submission &&
                                (() => {
                                  const itSig = item.network_submission?.signatures?.find(
                                    (s) =>
                                      s.slot_label.toUpperCase().includes('CHECK') ||
                                      s.slot_label.toUpperCase().includes('CEK') ||
                                      s.role_title.toUpperCase().includes('IT SECTION') ||
                                      s.role_title.toUpperCase().includes('SECURITY')
                                  )
                                  const iaaSig = item.network_submission?.signatures?.find(
                                    (s) =>
                                      s.id !== itSig?.id &&
                                      (s.slot_label.toUpperCase().includes('APPROV') ||
                                        s.role_title.toUpperCase().includes('IAA') ||
                                        s.role_title.toUpperCase().includes('INFORMATION') ||
                                        s.approver_name.toUpperCase().includes('TEGUH'))
                                  )
                                  const isItChecked = itSig?.status === 'approved' || item.status === 'approved'
                                  return (
                                    <>
                                      {isItChecked ? (
                                        <span className="inline-flex w-fit items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                          2. IT Section Check: Approved ({itSig?.approver_name || item.approved_by || 'IT'})
                                        </span>
                                      ) : (
                                        <span className="inline-flex w-fit items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                                          <Clock className="h-3 w-3" aria-hidden="true" />
                                          2. IT Section Check: Menunggu Approve &amp; IP
                                        </span>
                                      )}

                                      {iaaSig &&
                                        (iaaSig.status === 'approved' ? (
                                          <span className="inline-flex w-fit items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                                            3. Approval IAA ({iaaSig.approver_name}): Approved
                                          </span>
                                        ) : (
                                          <span className="inline-flex w-fit items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                            <Clock className="h-3 w-3" aria-hidden="true" />
                                            3. Approval IAA (TEGUH SUNJOYO):{' '}
                                            {isItChecked ? 'Menunggu Approval IAA' : 'Terkunci (Tunggu IT Check)'}
                                          </span>
                                        ))}
                                    </>
                                  )
                                })()}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {item.equipment_request && (
                              <a
                                href={`${API_BASE_PATH}/api/it-equipment-requests/${item.equipment_request.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-muted"
                              >
                                <Download className="h-3 w-3 text-primary" aria-hidden="true" />
                                PDF {item.equipment_request.form_type === 'out' ? 'Keluar (002)' : 'Masuk (001)'}
                              </a>
                            )}
                            {item.network_submission && (
                              <a
                                href={`${API_BASE_PATH}/api/it-form-submissions/${item.network_submission.id}/pdf?token=${encodeURIComponent(item.network_submission.token)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-muted"
                              >
                                <Download className="h-3 w-3 text-primary" aria-hidden="true" />
                                PDF Network (003)
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Kolom 4: Username & IP Jaringan Internal */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="space-y-1 font-mono text-[11px]">
                          <div>
                            <span className="text-muted-foreground">User: </span>
                            <strong className="text-primary">{item.network_username || '-'}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pass: </span>
                            <strong className="text-foreground">{item.network_password || '-'}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">IP: </span>
                            <strong className="text-emerald-600 dark:text-emerald-400">
                              {item.assigned_ip || '-'}
                            </strong>{' '}
                            <span className="text-[10px] text-muted-foreground">
                              ({item.network_ssid || 'JAI-CORP-GUEST'})
                            </span>
                          </div>
                          {item.assigned_ip && (
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => openNetworkSlipModal(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition shadow-xs"
                                title="Lihat Slip Parameter Jaringan & Kirim WhatsApp"
                              >
                                <Send className="size-3" /> Slip Jaringan &amp; WA
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Kolom 5: Tombol Aksi Bertahap (Tahap 1 -> Tahap 2A -> Tahap 2B) */}
                      <td className="px-4 py-3.5 align-top text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {/* TAHAP 1A: Persetujuan IAA / Manager Departemen pada Form 1 (Masuk/Keluar) terlebih dahulu! */}
                          {item.equipment_request && item.equipment_request.status === 'pending' && (
                            <button
                              type="button"
                              disabled={processingForm1Id === item.id}
                              onClick={() => handleQuickApproveForm1Manager(item)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 transition cursor-pointer"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              {processingForm1Id === item.id
                                ? 'Menyetujui...'
                                : '1A. ACC Mgr (Form 1)'}
                            </button>
                          )}

                          {/* TAHAP 1B: Verifikasi IT (SSA) pada Form 1 — HANYA aktif setelah Tahap 1A (IAA / Manager Dept) selesai! */}
                          {item.equipment_request && item.equipment_request.status === 'approved_manager' && (
                            <button
                              type="button"
                              disabled={processingForm1Id === item.id}
                              onClick={() => handleQuickApproveForm1(item)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition cursor-pointer"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              {processingForm1Id === item.id
                                ? 'Memverifikasi...'
                                : '1B. ACC IT (Form 1)'}
                            </button>
                          )}

                          {/* TAHAP 2A: Terbuka langsung jika Tamu sudah mengisi Form 2 */}
                          {item.network_submission && (
                            <button
                              type="button"
                              onClick={() => openApprovalModal(item, 'approve')}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
                            >
                              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                              {item.status === 'approved'
                                ? 'Ubah Username / IP'
                                : 'Approve Network & Beri IP'}
                            </button>
                          )}

                          {/* TAHAP 2B: Hanya aktif JIKA Tahap 2A (IT Section Check) sudah Approved */}
                          {item.status === 'approved' &&
                            item.network_submission?.signatures?.some(
                              (s) =>
                                (s.slot_label.toUpperCase().includes('APPROV') ||
                                  s.role_title.toUpperCase().includes('IAA') ||
                                  s.approver_name.toUpperCase().includes('TEGUH')) &&
                                s.status !== 'approved'
                            ) && (
                              <button
                                type="button"
                                disabled={processingIaaId === item.id}
                                onClick={() => handleQuickApproveIaa(item)}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 transition cursor-pointer"
                              >
                                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                {processingIaaId === item.id ? '...' : '3. ACC IAA'}
                              </button>
                            )}

                          {item.status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => openApprovalModal(item, 'reject')}
                              className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20 transition cursor-pointer"
                            >
                              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                              Tolak
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => handleDeleteLink(item)}
                            title="Hapus Link Tamu"
                            className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-card px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 transition cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Hapus
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

      {/* Modal Generate Link Tamu */}
      <GuestLinkGeneratorModal
        open={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        defaultWalkIn={generatorWalkIn}
        initialCount={generatorCount}
        onGenerated={() => {
          setStatusFilter('all')
          setSearchQuery('')
          fetchGuestLinks()
          if (onDataChanged) onDataChanged()
        }}
      />

      {/* Modal Approve & Alokasi Username + IP Jaringan Internal */}
      {activeApproveLink && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-guest-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <div>
                <h3 id="approve-guest-modal-title" className="text-base font-bold text-foreground">
                  {approveAction === 'approve'
                    ? 'Approve & Berikan Username / IP Jaringan Internal'
                    : 'Tolak Permohonan Link Tamu'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Tamu: <strong>{activeApproveLink.guest_name}</strong> ({activeApproveLink.link_code})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveApproveLink(null)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleConfirmApproveOrReject} className="p-6 space-y-4">
              {approveError && (
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive"
                >
                  {approveError}
                </div>
              )}

              <div>
                <label htmlFor="it-approver-name" className={labelClass}>
                  Nama Admin IT yang Memverifikasi <span className="text-destructive">*</span>
                </label>
                <input
                  id="it-approver-name"
                  type="text"
                  required
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  className={inputClass}
                />
              </div>

              {approveAction === 'reject' ? (
                <div>
                  <label htmlFor="it-reject-reason" className={labelClass}>
                    Alasan Penolakan <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    id="it-reject-reason"
                    rows={3}
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Masukkan alasan penolakan..."
                    className="w-full rounded-xl border border-input bg-card p-3 text-sm text-foreground outline-none focus:border-ring"
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/5 p-3">
                    <span className="text-xs font-semibold text-foreground">
                      Kredensial untuk menyambung ke internet &amp; jaringan internal PT. JAI
                    </span>
                    <button
                      type="button"
                      onClick={handleAutoRecommendCredentials}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
                    >
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      Auto-Generate Rekomendasi
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="net-username" className={labelClass}>
                        Username Jaringan Internal <span className="text-destructive">*</span>
                      </label>
                      <input
                        id="net-username"
                        type="text"
                        required
                        value={networkUsername}
                        onChange={(e) => setNetworkUsername(e.target.value)}
                        placeholder="guest.budi.202610.001"
                        className={`${inputClass} font-mono`}
                      />
                    </div>

                    <div>
                      <label htmlFor="net-password" className={labelClass}>
                        Password / Kode Akses Jaringan <span className="text-destructive">*</span>
                      </label>
                      <input
                        id="net-password"
                        type="text"
                        required
                        value={networkPassword}
                        onChange={(e) => setNetworkPassword(e.target.value)}
                        placeholder="JAI-2026-001"
                        className={`${inputClass} font-mono`}
                      />
                    </div>

                    <div>
                      <label htmlFor="net-ssid" className={labelClass}>
                        SSID Wi-Fi / Nama VLAN Jaringan
                      </label>
                      <input
                        id="net-ssid"
                        type="text"
                        value={networkSsid}
                        onChange={(e) => setNetworkSsid(e.target.value)}
                        placeholder="JAI-CORP-GUEST"
                        className={`${inputClass} font-mono`}
                      />
                    </div>

                    <div>
                      <span className={labelClass}>Metode Alokasi IP</span>
                      <div className="grid grid-cols-2 gap-2">
                        {(['dhcp', 'static'] as const).map((m) => (
                          <label
                            key={m}
                            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                              ipMode === m
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-card text-foreground'
                            }`}
                          >
                            <input
                              type="radio"
                              name="ip_mode"
                              checked={ipMode === m}
                              onChange={() => setIpMode(m)}
                              className="h-3.5 w-3.5 accent-primary"
                            />
                            <span>{m === 'dhcp' ? 'DHCP / Reserved' : 'Static IP'}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="net-ip" className={labelClass}>
                        IP Address yang Diberikan <span className="text-destructive">*</span>
                      </label>
                      <input
                        id="net-ip"
                        type="text"
                        required
                        value={assignedIp}
                        onChange={(e) => setAssignedIp(e.target.value)}
                        placeholder="192.168.50.50"
                        className={`${inputClass} font-mono`}
                      />
                    </div>

                    <div>
                      <label htmlFor="net-subnet" className={labelClass}>
                        Subnet Mask
                      </label>
                      <input
                        id="net-subnet"
                        type="text"
                        value={subnetMask}
                        onChange={(e) => setSubnetMask(e.target.value)}
                        placeholder="255.255.255.0"
                        className={`${inputClass} font-mono`}
                      />
                    </div>

                    <div>
                      <label htmlFor="net-gateway" className={labelClass}>
                        Default Gateway
                      </label>
                      <input
                        id="net-gateway"
                        type="text"
                        value={gateway}
                        onChange={(e) => setGateway(e.target.value)}
                        placeholder="192.168.50.1"
                        className={`${inputClass} font-mono`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="net-dns1" className={labelClass}>
                          DNS Primary
                        </label>
                        <input
                          id="net-dns1"
                          type="text"
                          value={dnsPrimary}
                          onChange={(e) => setDnsPrimary(e.target.value)}
                          placeholder="192.168.1.10"
                          className={`${inputClass} font-mono`}
                        />
                      </div>
                      <div>
                        <label htmlFor="net-dns2" className={labelClass}>
                          DNS Secondary
                        </label>
                        <input
                          id="net-dns2"
                          type="text"
                          value={dnsSecondary}
                          onChange={(e) => setDnsSecondary(e.target.value)}
                          placeholder="8.8.8.8"
                          className={`${inputClass} font-mono`}
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="net-notes" className={labelClass}>
                        Catatan Tambahan Admin IT (Opsional)
                      </label>
                      <input
                        id="net-notes"
                        type="text"
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        placeholder="Contoh: Berlaku selama kunjungan di Ruang Meeting Lt. 2"
                        className={inputClass}
                      />
                    </div>

                    <div className="sm:col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                      <p className="font-bold text-foreground">
                        Alur Persetujuan Bertahap (Sequential E-Sign):
                      </p>
                      <p className="mt-0.5 text-[11px]">
                        Persetujuan ini hanya akan menandatangani kolom <strong>IT SECTION CHECK</strong> pada PDF{' '}
                        <code className="font-mono font-bold">ISMS-F-03-00-003</code>. Kolom{' '}
                        <strong>APPROVAL (TEGUH SUNJOYO / IAA)</strong> baru dapat ditandatangani pada tahap berikutnya setelah <em>IT Section Check</em> ini disetujui.
                      </p>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setActiveApproveLink(null)}
                  className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={processingApprove}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold shadow-sm disabled:opacity-50 ${
                    approveAction === 'approve'
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  }`}
                >
                  {processingApprove
                    ? 'Memproses...'
                    : approveAction === 'approve'
                    ? 'Approve & Kirim Username + IP ke Link Tamu'
                    : 'Konfirmasi Tolak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Network Pass Slip & WhatsApp Modal */}
      <NetworkPassModal
        open={!!selectedSlipData}
        onClose={() => setSelectedSlipData(null)}
        data={selectedSlipData}
      />
    </div>
  )
}
