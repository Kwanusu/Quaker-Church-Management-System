import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import FlashToast from './FlashToast'

// Fetched once per page load: is Google sign-in switched on, and with which client ID?
let providersPromise
const getProviders = () => {
  providersPromise ??= api('/api/v1/auth/providers/', { auth: false }).catch(() => ({}))
  return providersPromise
}

let scriptPromise
const loadGoogleScript = () => {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = resolve
    s.onerror = () => { scriptPromise = null; reject(new Error('Could not load Google sign-in.')) }
    document.head.appendChild(s)
  })
  return scriptPromise
}

/**
 * "Continue with Google". Renders nothing unless the backend has GOOGLE_CLIENT_ID set.
 * onSignedIn(data) receives { user, created }.
 */
export default function GoogleButton({ onSignedIn, text = 'continue_with' }) {
  const { googleLogin } = useAuth()
  const ref = useRef(null)
  const [clientId, setClientId] = useState(null)
  const [error, setError] = useState('')
  // Latest callback without re-rendering Google's button whenever the parent re-renders.
  const onSignedInRef = useRef(onSignedIn)
  useEffect(() => { onSignedInRef.current = onSignedIn })

  useEffect(() => {
    let alive = true
    getProviders().then((p) => { if (alive) setClientId(p?.google_client_id || null) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!clientId) return
    let alive = true
    loadGoogleScript().then(() => {
      if (!alive || !ref.current) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          setError('')
          try { onSignedInRef.current?.(await googleLogin(credential)) } catch (err) { setError(err.message) }
        },
        ux_mode: 'popup',
      })
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline', size: 'large', shape: 'pill', text, width: ref.current.offsetWidth || 320,
      })
    }).catch((err) => alive && setError(err.message))
    return () => { alive = false }
  }, [clientId, googleLogin, text])

  if (!clientId) return null
  return (
    <div className="social">
      <div className="social__divider"><span>or</span></div>
      <div ref={ref} className="social__google" />
      <FlashToast kind="error" text={error} />
    </div>
  )
}
