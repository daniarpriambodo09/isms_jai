// components/login-modal.tsx
'use client'

import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const result = await login(username, password)

    setSubmitting(false)

    if (result.success) {
      setUsername('')
      setPassword('')
      onClose()
    } else {
      setError(result.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(14,34,53,0.5)] p-4">
      <div className="w-full max-w-[380px] rounded-2xl bg-white p-6 shadow-[0_20px_50px_rgba(14,34,53,0.25)]">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-[#7290a5]">
              ADMIN ACCESS
            </div>
            <h2 className="text-[18px] font-bold text-[#20354a]">Login Admin</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 place-items-center rounded-full text-[#8798a8] hover:bg-[#f0f4f7]"
          >
            <X className="w-[18px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-[6px]">
            <span className="text-[12px] font-medium text-[#3c5369]">Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoFocus
              autoComplete="username"
              placeholder="admin"
              className="h-10 rounded-[7px] border border-[#dce6ed] bg-[#fbfcfd] px-3 text-[13px] text-[#20354a] outline-none focus:border-[#278e84]"
            />
          </label>

          <label className="flex flex-col gap-[6px]">
            <span className="text-[12px] font-medium text-[#3c5369]">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-10 rounded-[7px] border border-[#dce6ed] bg-[#fbfcfd] px-3 text-[13px] text-[#20354a] outline-none focus:border-[#278e84]"
            />
          </label>

          {error && (
            <p className="rounded-[6px] bg-[#fdecec] px-3 py-2 text-[12px] text-[#b3413a]">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 inline-flex h-10 items-center justify-center rounded-[7px] bg-[#20354a] text-[13px] font-medium text-white hover:bg-[#284360] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}