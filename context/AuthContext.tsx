// context/AuthContext.tsx
'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { API_BASE_PATH } from '@/lib/config'

// 'approver': only "Persetujuan Saya" — never an admin (see sessionUser below).
export type AdminRole = 'ism_admin' | 'lobby' | 'security' | 'approver'

export type AdminUser = {
  id: number
  username: string
  email: string | null
  role: AdminRole
}

type LoginResult = { success: true } | { success: false; message: string }

type AuthContextValue = {
  /** An admin is logged in (ISM Admin, Lobby or Security) — false for an Approver account. */
  isLoggedIn: boolean
  /** The logged-in admin; null for an Approver account, so every admin screen treats it as a guest. */
  adminUser: AdminUser | null
  /** Whoever is logged in, an Approver account included ("Persetujuan Saya", the navbar's logout). */
  sessionUser: AdminUser | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<LoginResult>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionUser, setAdminUser] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const adminUser = sessionUser && sessionUser.role !== 'approver' ? sessionUser : null

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api/auth/me`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setAdminUser(data.admin)
      } else {
        setAdminUser(null)
      }
    } catch {
      setAdminUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Proactively detect an expired/revoked session (JWT past its 8h maxAge,
  // or an admin account deleted while logged in) instead of waiting for the
  // next full page load — every admin-only view reads `adminUser` from this
  // context, so clearing it here reactively drops the user back to the
  // login gate (AdminGate / KioskLoginForm) app-wide without extra plumbing.
  useEffect(() => {
    if (!sessionUser) return
    const interval = setInterval(checkAuth, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [sessionUser, checkAuth])

  const login = useCallback(async (username: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setAdminUser(data.admin)
        return { success: true }
      }
      return { success: false, message: data.message ?? 'Login gagal.' }
    } catch {
      return { success: false, message: 'Tidak dapat menghubungi server.' }
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch(`${API_BASE_PATH}/api/auth/logout`, { method: 'POST' })
    setAdminUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoggedIn: adminUser !== null,
      adminUser,
      sessionUser,
      isLoading,
      login,
      logout,
      checkAuth,
    }),
    [adminUser, sessionUser, isLoading, login, logout, checkAuth]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return ctx
}