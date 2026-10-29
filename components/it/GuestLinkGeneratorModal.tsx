'use client'

import React, { useState, useEffect } from 'react'
import {
  Link2,
  Plus,
  Minus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  X,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { DEFAULT_DEPARTMENTS } from '@/lib/it-equipment-shared'
import {
  formatGuestLinkCode,
  type ItGuestAccessLink,
} from '@/lib/it-guest-link-shared'

interface GuestLinkGeneratorModalProps {
  open: boolean
  onClose: () => void
  defaultWalkIn?: boolean
  initialCount?: number
  onGenerated?: (links: ItGuestAccessLink[]) => void
}

const inputClass =
  'h-10 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-ring focus:ring-4 focus:ring-ring/15'
const labelClass = 'mb-1 block text-xs font-semibold text-foreground'

export function GuestLinkGeneratorModal({
  open,
  onClose,
  defaultWalkIn = false,
  initialCount = 1,
  onGenerated,
}: GuestLinkGeneratorModalProps) {
  const [linkCount, setLinkCount] = useState<number>(initialCount)
  const [guestNames, setGuestNames] = useState<string[]>([''])
  const [companyName, setCompanyName] = useState('')
  const [department, setDepartment] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [isWalkIn, setIsWalkIn] = useState(defaultWalkIn)
  const [periodInfo, setPeriodInfo] = useState<{
    year: number
    month: number
    next_seq: number
  }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    next_seq: 1,
  })

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [generatedLinks, setGeneratedLinks] = useState<ItGuestAccessLink[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    setIsWalkIn(defaultWalkIn)
  }, [defaultWalkIn])

  useEffect(() => {
    const safeCount = Math.min(Math.max(Number(initialCount) || 1, 1), 50)
    setLinkCount(safeCount)
    setGuestNames((prev) => {
      const next = [...prev]
      while (next.length < safeCount) next.push('')
      return next.slice(0, safeCount)
    })
  }, [initialCount, open])

  useEffect(() => {
    if (!open) return
    const todayStr = new Date().toISOString().slice(0, 10)
    if (!visitDate) setVisitDate(todayStr)

    fetch(`${API_BASE_PATH}/api/it-guest-links?limit=1`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.period) {
          setPeriodInfo(data.period)
        }
      })
      .catch(() => {})
  }, [open, visitDate])

  if (!open) return null

  const updateLinkCount = (newCount: number) => {
    const clamped = Math.min(Math.max(newCount || 1, 1), 50)
    setLinkCount(clamped)
    setGuestNames((prev) => {
      const next = [...prev]
      while (next.length < clamped) next.push('')
      return next.slice(0, clamped)
    })
  }

  const handleRemovePersonRow = (idx: number) => {
    if (guestNames.length <= 1) return
    const next = guestNames.filter((_, i) => i !== idx)
    setGuestNames(next)
    setLinkCount(next.length)
  }

  const handleNameChange = (idx: number, val: string) => {
    setGuestNames((prev) => prev.map((n, i) => (i === idx ? val : n)))
  }

  const buildFullUrl = (linkCode: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}${API_BASE_PATH}/tamu-it/${encodeURIComponent(linkCode)}`
  }

  const handleCopyUrl = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(key)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleCopyAllUrls = () => {
    const allText = generatedLinks
      .map(
        (lnk, idx) =>
          `${idx + 1}. ${lnk.guest_name} (${lnk.link_code}): ${buildFullUrl(lnk.link_code)}`
      )
      .join('\n')
    navigator.clipboard.writeText(allText)
    setCopiedId('all')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    const preparedNames = Array.from({ length: linkCount }, (_, i) => {
      const n = (guestNames[i] || '').trim()
      return n || 'GUEST'
    })

    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/it-guest-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: linkCount,
          guest_names: preparedNames,
          company_name: companyName,
          department,
          visit_date: visitDate,
          visit_end_date: visitDate,
          is_walk_in: isWalkIn,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal men-generate link tamu')
      }

      const created: ItGuestAccessLink[] = data.links || []
      setGeneratedLinks(created)
      setPeriodInfo((prev) => ({
        ...prev,
        next_seq: prev.next_seq + created.length,
      }))
      if (onGenerated) {
        onGenerated(created)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat membuat link')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetNew = () => {
    setGeneratedLinks([])
    setLinkCount(1)
    setGuestNames([''])
    setErrorMsg('')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-link-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card shadow-xl">
        {/* Header Modal */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Link2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="guest-link-modal-title" className="text-base font-bold text-foreground">
                Generate Link Khusus Tamu (2 Form: Izin Alat IT + Network)
              </h2>
              <p className="text-xs text-muted-foreground">
                Atur jumlah link yang ingin dibuat • Setiap orang mendapat link unik berbeda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Info Penomoran Otomatis */}
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
              <span>
                Format Kode Link:{' '}
                <strong>
                  NAMA-TAMU-{periodInfo.year}-{String(periodInfo.month).padStart(2, '0')}-NO_URUT
                </strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 font-mono">
              <span className="rounded-md bg-card px-2 py-0.5 font-bold text-foreground border border-border">
                Tahun: {periodInfo.year}
              </span>
              <span className="rounded-md bg-card px-2 py-0.5 font-bold text-foreground border border-border">
                Bulan: {String(periodInfo.month).padStart(2, '0')}
              </span>
              <span className="rounded-md bg-primary px-2 py-0.5 font-bold text-primary-foreground">
                Urutan Bulan Ini Mulai: #{String(periodInfo.next_seq).padStart(3, '0')}
              </span>
            </div>
          </div>

          {generatedLinks.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Berhasil men-generate {generatedLinks.length} Link Unik Terpisah!
                </p>
                {generatedLinks.length > 1 && (
                  <button
                    type="button"
                    onClick={handleCopyAllUrls}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    {copiedId === 'all' ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Semua Link Disalin!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        Salin Semua ({generatedLinks.length} Link)
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {generatedLinks.map((lnk, idx) => {
                  const fullUrl = buildFullUrl(lnk.link_code)
                  return (
                    <div
                      key={lnk.id}
                      className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
                              Link {idx + 1} • #{String(lnk.seq_no).padStart(3, '0')} / {String(lnk.seq_month).padStart(2, '0')}-{lnk.seq_year}
                            </span>
                            <span className="text-sm font-bold text-foreground">
                              {lnk.guest_name}
                            </span>
                          </div>
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                            Kode: <strong className="text-foreground">{lnk.link_code}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyUrl(String(lnk.id), fullUrl)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                          >
                            {copiedId === String(lnk.id) ? (
                              <>
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                Link Disalin
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                Salin Link
                              </>
                            )}
                          </button>
                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            Buka Form
                          </a>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border bg-card px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">
                        {fullUrl}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={handleResetNew}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  Generate Link Lagi
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                >
                  Selesai
                </button>
              </div>
            </div>
          ) : (
            <form
              method="POST"
              action={`${API_BASE_PATH}/api/it-guest-links`}
              onSubmit={handleGenerate}
              className="space-y-4"
            >
              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive"
                >
                  {errorMsg}
                </div>
              )}

              {/* Pengaturan Jumlah Link yang Mau Di-Generate */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <label htmlFor="link-count-input" className="block text-xs font-bold text-foreground">
                      Mau Generate Berapa Link? (1 Link per Orang)
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Setiap link memiliki nomor urut berbeda (tidak jadi satu).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateLinkCount(linkCount - 1)}
                      disabled={linkCount <= 1}
                      aria-label="Kurangi jumlah link"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <input
                      id="link-count-input"
                      name="link_count"
                      type="number"
                      min={1}
                      max={50}
                      value={linkCount}
                      onChange={(e) => updateLinkCount( parseInt(e.target.value, 10) || 1 )}
                      className="h-9 w-18 rounded-xl border border-input bg-card text-center font-mono text-sm font-bold text-foreground outline-none focus:border-ring"
                    />
                    <button
                      type="button"
                      onClick={() => updateLinkCount(linkCount + 1)}
                      disabled={linkCount >= 50}
                      aria-label="Tambah jumlah link"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Tombol Cepat Pilih Jumlah Link */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-medium text-muted-foreground mr-1">
                    Pilih Cepat:
                  </span>
                  {[1, 2, 3, 5, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => updateLinkCount(num)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                        linkCount === num
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {num} Link
                    </button>
                  ))}
                </div>
              </div>

              {/* Daftar Slot Link sesuai Jumlah yang Dipilih */}
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                <div className="flex items-center justify-between">
                  <span className={labelClass}>
                    Nama Tamu untuk Masing-Masing Link (Opsional, bisa diisi tamu saat buka link)
                  </span>
                </div>

                {guestNames.map((name, idx) => {
                  const previewSeq = periodInfo.next_seq + idx
                  const previewCode = formatGuestLinkCode(
                    name.trim() || 'GUEST',
                    periodInfo.year,
                    previewSeq,
                    periodInfo.month
                  )
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-border bg-muted/15 p-3 space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
                          #{String(previewSeq).padStart(3, '0')}
                        </span>
                        <input
                          id={`guest-person-${idx}`}
                          name={`guest_name_${idx}`}
                          type="text"
                          autoComplete="name"
                          enterKeyHint="next"
                          value={name}
                          onChange={(e) => handleNameChange(idx, e.target.value)}
                          placeholder={`Nama Tamu Link ke-${idx + 1} (kosongkan jika tamu dadakan)`}
                          className={inputClass}
                        />
                        {guestNames.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePersonRow(idx)}
                            aria-label={`Hapus slot link ke-${idx + 1}`}
                            className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      <p className="pl-14 font-mono text-[11px] text-muted-foreground">
                        Kode Link #{idx + 1}:{' '}
                        <strong className="text-foreground">{previewCode}</strong>
                      </p>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="gen-company" className={labelClass}>
                    Perusahaan / Instansi (Opsional)
                  </label>
                  <input
                    id="gen-company"
                    name="company_name"
                    type="text"
                    autoComplete="organization"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="PT. Vendor / Tamu"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="gen-dept" className={labelClass}>
                    Departemen Tujuan (Opsional)
                  </label>
                  <select
                    id="gen-dept"
                    name="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">-- Bisa Diisi Tamu --</option>
                    {DEFAULT_DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="gen-date" className={labelClass}>
                    Tanggal Kunjungan
                  </label>
                  <input
                    id="gen-date"
                    name="visit_date"
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  {submitting
                    ? 'Membuat Link...'
                    : `Generate ${linkCount} Link Unik Tamu`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
