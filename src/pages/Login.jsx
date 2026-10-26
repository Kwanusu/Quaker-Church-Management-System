import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import FlashToast from '../components/FlashToast'
import GoogleButton from '../components/GoogleButton'
import Logo from '../components/Logo'
import { useToast } from '../components/toastContext'
import { PLATFORM } from '../config'
import { TENANT_SLUG } from '../tenant'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [error, setError] = useState('')
  const [unconfirmed, setUnconfirmed] = useState('') // email of an account still waiting for confirmation
  const [busy, setBusy] = useState(false)

  // Default destination: where they came from, else their (first) church, else the directory.
  const destination = (u) => {
    const from = location.state?.from
    if (from && !['/login', '/register'].includes(from)) return from
    if (TENANT_SLUG) return '/' // a church's own site: its home page
    return u?.memberships?.length ? `/c/${u.memberships[0].church}` : '/'
  }

  if (user) return <Navigate to={destination(user)} replace />

  async function onSubmit(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setBusy(true)
    setError('')
    setUnconfirmed('')
    try {
      const u = await login(form.get('username').trim(), form.get('password'))
      navigate(destination(u), { replace: true })
    } catch (err) {
      if (err.data?.code === 'email_not_verified') setUnconfirmed(err.data.email)
      setError(err.status === 401 ? 'That username/email and password don’t match our records.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    try {
      toast.success((await api('/api/v1/auth/verify-email/resend-public/', { method: 'POST', body: { email: unconfirmed }, auth: false })).detail)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <section className="section login">
      <div className="container">
        <div className="card card--gold login__card">
          <header className="login__head">
            <Logo size={64} alt={`${PLATFORM.name} logo`} />
            <div>
              <h1>Sign in</h1>
              <p className="muted">Members, clerks and attenders of every {PLATFORM.name} meeting.</p>
            </div>
          </header>
          <FlashToast flash={location.state?.notice} />
          <FlashToast kind="error" text={error} flash={error} />
          {unconfirmed && (
            <p className="muted">
              Didn’t get the email? <button type="button" className="link-btn" onClick={resend}>Send a new confirmation link</button>
            </p>
          )}
          <form className="form" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="username">Username or email</label>
              <input id="username" name="username" autoComplete="username" required autoFocus />
              <span className="error-msg">Please enter your username or email.</span>
            </div>
            <div className="field">
              <span className="field__label-row">
                <label htmlFor="password">Password</label>
                <Link to="/forgot-password" className="field__aside">Forgot password?</Link>
              </span>
              <input id="password" name="password" type="password" autoComplete="current-password" required />
              <span className="error-msg">Please enter your password.</span>
            </div>
            <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <GoogleButton text="signin_with" onSignedIn={(d) => navigate(destination(d.user), { replace: true })} />
          <p className="muted login__help">
            New here? <Link to="/register" state={location.state}>Create an account</Link>. You don’t need one to visit a church’s page.
          </p>
        </div>
      </div>
    </section>
  )
}
