// app/kelola-smtp/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff, Key, Loader2, Mail, PhoneCall, Save, Server, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { AdminGate } from '@/components/admin-gate'

type Encryption = 'none' | 'tls' | 'ssl'

type SmtpSettings = {
  host: string | null
  port: number | null
  encryption: Encryption
  username: string | null
  password: string | null
  senderEmail: string | null
  appUrl: string | null
  updatedAt: string | null
}

const inputClass = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const labelClass = 'text-sm font-semibold text-foreground'
const hintClass = 'text-xs text-muted-foreground'

function formatDate(value: string) {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function SectionCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-start gap-3 border-b border-border bg-secondary/30 px-5 py-4">
        <span className="grid size-9 flex-shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <div>
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export default function KelolaSmtpPage() {
  const { isLoggedIn, isLoading, adminUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [host, setHost] = useState('')
  const [port, setPort] = useState('587')
  const [encryption, setEncryption] = useState<Encryption>('none')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [senderEmail, setSenderEmail] = useState('')
  const [appUrl, setAppUrl] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!isLoggedIn || adminUser?.role !== 'ism_admin') { setLoading(false); return }
    fetch(`${API_BASE_PATH}/api/smtp-settings`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { settings: null }))
      .then((data: { settings: SmtpSettings | null }) => {
        const s = data.settings
        if (s) {
          setHost(s.host ?? '')
          setPort(s.port ? String(s.port) : '587')
          setEncryption(s.encryption)
          setUsername(s.username ?? '')
          setPassword(s.password ?? '')
          setSenderEmail(s.senderEmail ?? '')
          setAppUrl(s.appUrl ?? '')
          setUpdatedAt(s.updatedAt)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isLoggedIn, adminUser])

  const currentPayload = () => ({
    host: host.trim(),
    port: Number(port),
    encryption,
    username: username.trim() || null,
    password: password || null,
    senderEmail: senderEmail.trim(),
    appUrl: appUrl.trim(),
  })

  const save = async () => {
    setSaving(true)
    setSaveMessage(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/smtp-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentPayload()),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Gagal menyimpan konfigurasi.')
      setUpdatedAt(data.settings?.updatedAt ?? new Date().toISOString())
      setSaveMessage({ ok: true, text: 'Konfigurasi SMTP berhasil disimpan.' })
    } catch (e) {
      setSaveMessage({ ok: false, text: e instanceof Error ? e.message : 'Terjadi kesalahan.' })
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestMessage(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/smtp-settings/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentPayload()),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Koneksi SMTP gagal.')
      setTestMessage({ ok: true, text: data.message ?? 'Koneksi SMTP berhasil.' })
    } catch (e) {
      setTestMessage({ ok: false, text: e instanceof Error ? e.message : 'Terjadi kesalahan.' })
    } finally {
      setTesting(false)
    }
  }

  if (!isLoading && !isLoggedIn) return <AdminGate />
  if (!isLoading && adminUser && adminUser.role !== 'ism_admin') {
    return <AdminGate title="Akses terbatas" message="Halaman ini hanya untuk akun ISM Admin." />
  }
  if (loading) {
    return <div className="rounded-3xl border border-border bg-card p-12 text-center text-sm text-muted-foreground shadow-sm">Memuat pengaturan SMTP...</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Pengaturan SMTP</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">Kelola konfigurasi server email untuk pengiriman notifikasi persetujuan Ijin Foto/Video dan fitur lain di Portal ISMS.</p>
        </div>
        {updatedAt && (
          <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            Tersimpan: {formatDate(updatedAt)}
          </span>
        )}
      </div>

      <SectionCard icon={<Server className="size-4" />} title="Konfigurasi Server SMTP" description="Alamat dan port SMTP server">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>SMTP Host <span className="text-destructive">*</span></span>
            <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.gmail.com" className={inputClass} />
            <span className={hintClass}>Contoh: 10.62.231.17 atau mail.domain.com</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>SMTP Port <span className="text-destructive">*</span></span>
            <input value={port} onChange={(e) => setPort(e.target.value)} placeholder="587" inputMode="numeric" className={inputClass} />
            <span className={hintClass}>Port umum: 25 (plain), 587 (TLS), 465 (SSL)</span>
          </label>
        </div>
      </SectionCard>

      <SectionCard icon={<ShieldCheck className="size-4" />} title="Enkripsi" description="Pilih satu metode atau kosongkan untuk SMTP tanpa enkripsi">
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition hover:bg-secondary/40">
            <input
              type="checkbox"
              checked={encryption === 'tls'}
              onChange={() => setEncryption((current) => (current === 'tls' ? 'none' : 'tls'))}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">Gunakan TLS (STARTTLS)</span>
              <span className="block text-xs text-muted-foreground">Enkripsi upgrade setelah koneksi terbuka. Umum dipakai di port 587.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition hover:bg-secondary/40">
            <input
              type="checkbox"
              checked={encryption === 'ssl'}
              onChange={() => setEncryption((current) => (current === 'ssl' ? 'none' : 'ssl'))}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">Gunakan SSL</span>
              <span className="block text-xs text-muted-foreground">Koneksi terenkripsi penuh sejak awal. Umum dipakai di port 465.</span>
            </span>
          </label>
        </div>
      </SectionCard>

      <SectionCard icon={<Key className="size-4" />} title="Autentikasi" description="Kosongkan jika SMTP server tidak memerlukan login">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Username SMTP</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="nama@gmail.com" className={inputClass} />
            <span className={hintClass}>Opsional — kosongkan jika tanpa autentikasi</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Password SMTP</span>
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? 'text' : 'password'}
                placeholder="App Password"
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <span className={hintClass}>Opsional — kosongkan jika tanpa autentikasi</span>
          </label>
        </div>
      </SectionCard>

      <SectionCard icon={<Mail className="size-4" />} title="Email & Aplikasi" description="Alamat pengirim dan URL aplikasi">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Email Pengirim <span className="text-destructive">*</span></span>
            <input value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="noreply@jatimautocomp.com" className={inputClass} />
            <span className={hintClass}>Alamat email yang tertera di header &quot;From&quot;</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>App URL <span className="text-destructive">*</span></span>
            <input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="http://192.168.1.39:3009" className={inputClass} />
            <span className={hintClass}>Sertakan http:// dan port aplikasi (bukan cuma IP-nya) — kalau port tidak disertakan, link di email default ke port 80 dan bisa nabrak server lain (mis. XAMPP) yang jalan di port itu.</span>
          </label>
        </div>
      </SectionCard>

      {saveMessage && (
        <p className={`rounded-lg px-4 py-3 text-sm ${saveMessage.ok ? 'border border-primary/20 bg-primary/10 text-primary' : 'border border-destructive/20 bg-destructive/10 text-destructive'}`}>
          {saveMessage.text}
        </p>
      )}
      {testMessage && (
        <p className={`rounded-lg px-4 py-3 text-sm ${testMessage.ok ? 'border border-primary/20 bg-primary/10 text-primary' : 'border border-destructive/20 bg-destructive/10 text-destructive'}`}>
          {testMessage.text}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={testConnection}
          disabled={testing || !host || !port}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testing ? <Loader2 className="size-4 animate-spin" /> : <PhoneCall className="size-4" />}
          Test SMTP
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !host || !port || !senderEmail || !appUrl}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Simpan Konfigurasi
        </button>
      </div>
    </div>
  )
}
