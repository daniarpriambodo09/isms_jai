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

export type AdminUser = {
  id: number
  username: string
  email: string | null
}

type LoginResult = { success: true } | { success: false; message: string }

type AuthContextValue = {
  isLoggedIn: boolean
  adminUser: AdminUser | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<LoginResult>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
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

  const login = useCallback(async (username: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch('/api/auth/login', {
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
    await fetch('/api/auth/logout', { method: 'POST' })
    setAdminUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoggedIn: adminUser !== null,
      adminUser,
      isLoading,
      login,
      logout,
      checkAuth,
    }),
    [adminUser, isLoading, login, logout, checkAuth]
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