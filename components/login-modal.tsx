// components/login-modal.tsx
//
// Admin login — a full-screen split sign-in (components/auth-shell.tsx,
// shared with the Lobby/Security kiosk login) that fades in over the portal.
'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useRouter } from 'next/navigation'
import { AuthSplitLogin } from '@/components/auth-shell'
import type { AdminUser } from '@/context/AuthContext'

export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const finish = (user: AdminUser) => {
    onClose()
    const destination = {
      ism_admin: '/dashboard-admin',
      lobby: '/admin-lobby',
      security: '/admin-pos-security',
      approver: '/persetujuan-saya',
      it: '/kelola-izin-alat-it',
    }[user.role]
    router.push(destination)
  }
  // An Approver account has one page: take it there after signing in. (Read
  // through a ref — the login screen calls this from a timer it set before
  // the session arrived.)

  useEscapeClose(open, onClose)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const timer = setTimeout(() => usernameRef.current?.focus(), 120)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => setMounted(false), 300)
    return () => clearTimeout(timer)
  }, [open])

  if (!open && !mounted) return null
  const isVisible = open && mounted

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Login Admin"
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ transition: 'opacity 280ms cubic-bezier(0.4, 0, 0.2, 1)', opacity: isVisible ? 1 : 0 }}
    >
      <div className="min-h-full lg:h-full">
        <AuthSplitLogin
          eyebrow="Admin Portal"
          title={<>Selamat datang <span className="font-serif-accent text-[color:var(--p-600)]">kembali</span>.</>}
          subtitle="Masuk untuk mengelola Portal ISMS — atau, dengan akun approver, untuk menyetujui dokumen di Persetujuan Saya."
          successSubtitle="Mengalihkan ke Portal ISMS…"
          onSuccess={finish}
          accessSelector
          onBack={onClose}
          usernameRef={usernameRef}
          topRight={(
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="grid size-10 place-items-center rounded-full border border-border bg-card/80 text-muted-foreground shadow-sm transition hover:text-foreground"
            >
              <X className="size-[18px]" />
            </button>
          )}
        />
      </div>
    </div>
  )
}
