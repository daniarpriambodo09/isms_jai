'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home } from 'lucide-react'
import { AuthSplitLogin } from '@/components/auth-shell'
import type { AdminUser } from '@/context/AuthContext'

export default function LoginPage() {
  const router = useRouter()
  const usernameRef = useRef<HTMLInputElement>(null)

  const handleSuccess = (user: AdminUser) => {
    const destination = {
      ism_admin: '/dashboard-admin',
      lobby: '/admin-lobby',
      security: '/admin-pos-security',
      approver: '/persetujuan-saya',
      it: '/kelola-izin-alat-it',
    }[user.role]
    router.push(destination)
  }

  return (
    <main className="min-h-screen bg-[#090f17]">
      <AuthSplitLogin
        eyebrow="Portal Otorisasi Resmi"
        title={
          <>
            Selamat Datang <span className="text-blue-400">Kembali</span>
          </>
        }
        subtitle="Masuk untuk mengakses instrumen kendali ISMS ISO/IEC 27001, persetujuan dokumen berjenjang, dan tata kelola aset informasi."
        successSubtitle="Mengalihkan ke dashboard operasional…"
        onSuccess={handleSuccess}
        accessSelector
        onBack={() => router.push('/')}
        usernameRef={usernameRef}
        topRight={
          <Link
            href="/"
            aria-label="Kembali ke Beranda"
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90 shadow-md backdrop-blur-md transition hover:bg-white/20 hover:text-white active:scale-95 cursor-pointer"
          >
            <Home className="size-3.5 text-blue-300" />
            <span>Beranda Portal</span>
          </Link>
        }
      />
    </main>
  )
}
