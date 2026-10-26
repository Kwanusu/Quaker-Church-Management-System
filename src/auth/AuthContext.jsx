import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, setAuthLostHandler, tokens } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Only "loading" when there is a stored session to restore.
  const [loading, setLoading] = useState(() => Boolean(tokens.access || tokens.refresh))

  useEffect(() => {
    setAuthLostHandler(() => setUser(null))
    if (!tokens.access && !tokens.refresh) return
    const ctrl = new AbortController()
    api('/api/v1/auth/me/', { signal: ctrl.signal })
      .then((me) => { setUser(me); setLoading(false) })
      .catch((err) => {
        // A cancelled check (e.g. React StrictMode's double effect) must not end "loading":
        // that briefly looked like "signed out" and bounced people to the sign-in page.
        if (err.name === 'AbortError') return
        if (err.status === 401) tokens.clear() // only a rejected session is forgotten, not a network blip
        setUser(null)
        setLoading(false)
      })
    return () => ctrl.abort()
  }, [])

  const login = useCallback(async (username, password) => {
    const data = await api('/api/v1/auth/login/', { method: 'POST', body: { username, password }, auth: false })
    tokens.save(data)
    setUser(data.user)
    return data.user
  }, [])

  /** Creates the account and emails a confirmation link. No session: they sign in once the email is confirmed. */
  const register = useCallback(
    (details) => api('/api/v1/auth/register/', { method: 'POST', body: details, auth: false }),
    [],
  )

  /** Sign in/up with a Google ID token from Google Identity Services. */
  const googleLogin = useCallback(async (credential) => {
    const data = await api('/api/v1/auth/google/', { method: 'POST', body: { credential }, auth: false })
    tokens.save(data)
    setUser(data.user)
    return data
  }, [])

  /** After a password change the server signs out other devices and returns fresh tokens for this one. */
  const adoptSession = useCallback((data) => {
    tokens.save(data)
    if (data.user) setUser(data.user)
  }, [])

  /** Re-read memberships (after joining or registering a church). */
  const refreshUser = useCallback(async () => {
    const me = await api('/api/v1/auth/me/')
    setUser(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    const refresh = tokens.refresh
    tokens.clear()
    setUser(null)
    if (refresh) {
      try { await api('/api/v1/auth/logout/', { method: 'POST', body: { refresh }, auth: false }) } catch { /* already logged out locally */ }
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, googleLogin, adoptSession, refreshUser, setUser, logout }),
    [user, loading, login, register, googleLogin, adoptSession, refreshUser, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
