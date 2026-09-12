// components/change-password-modal.tsx
'use client'

import { useState, type FormEvent } from 'react'
import { Check, KeyRound, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'

const inputClass = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const labelClass = 'mb-1.5 block text-xs font-semibold text-muted-foreground'

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEscapeClose(true, onClose)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (newPassword.length < 6) { setError('Password baru minimal 6 karakter.'); return }
    if (newPassword !== confirmPassword) { setError('Konfirmasi password tidak cocok.'); return }

    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/auth/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.message ?? 'Gagal mengubah password.'); return }
      setSuccess(true)
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-label="Ganti Password" className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-primary px-5 py-4 text-primary-foreground">
          <h2 className="flex items-center gap-2 text-sm font-bold"><KeyRound className="size-4" />Ganti Password</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-7 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground">
            <X className="size-4" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-emerald-500/10 text-emerald-600"><Check className="size-5" /></span>
            <p className="text-sm font-semibold text-foreground">Password berhasil diubah</p>
            <button type="button" onClick={onClose} className="mt-1 w-full rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">Tutup</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-5">
            <label>
              <span className={labelClass}>Password saat ini</span>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoFocus className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Password baru</span>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="Minimal 6 karakter" className={inputClass} />
            </label>
            <label>
              <span className={labelClass}>Konfirmasi password baru</span>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inputClass} />
            </label>

            {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border bg-card py-2 text-sm font-medium text-foreground transition hover:bg-secondary">Batal</button>
              <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Menyimpan...' : 'Ubah Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
