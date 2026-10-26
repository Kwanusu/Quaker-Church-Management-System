import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import FlashToast from '../components/FlashToast'
import Logo from '../components/Logo'
import { Loading } from '../components/States'
import { PLATFORM } from '../config'
import ResendButton from '../components/ResendButton'
import { useToast } from '../components/toastContext'

function AuthCard({ title, children, lead }) {
  return (
    <section className="section login">
      <div className="container">
        <div className="card card--gold login__card">
          <div className="login__brand"><Logo variant="full" size={96} alt={`${PLATFORM.name} logo`} /></div>
          <h1>{title}</h1>
          {lead && <p className="muted">{lead}</p>}
          {children}
        </div>
      </div>
    </section>
  )
}

const flat = (data) => Object.values(data || {}).flat().join(' ')

export function PasswordRules() {
  return (
    <span className="hint">At least 8 characters; not a common password or only numbers; not too like your name.</span>
  )
}

/* ------------------------------------------------------------ Forgot password */
export function ForgotPassword() {
  const [sent, setSent] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await api('/api/v1/auth/password/reset/', { method: 'POST', body: { email: new FormData(e.currentTarget).get('email').trim() }, auth: false })
      setSent(r.detail)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard title="Forgot your password?" lead="Enter the email on your account and we’ll send you a link to choose a new one.">
      {sent ? (
        <>
          <FlashToast text={sent} />
          <p>We’ve sent the reset link to your inbox.</p>
          <p className="muted">The link works for 2 hours. Check your spam folder if it doesn’t arrive in a few minutes.</p>
          <Link to="/login" className="btn btn--outline">Back to sign in</Link>
        </>
      ) : (
        <form className="form" onSubmit={onSubmit}>
          <FlashToast kind="error" text={error} flash={error} />
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required autoFocus />
            <span className="error-msg">Please enter a valid email address.</span>
          </div>
          <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
          <p className="muted login__help"><Link to="/login">Back to sign in</Link></p>
        </form>
      )}
    </AuthCard>
  )
}

/* ------------------------------------------------------------ Reset password (from email) */
export function ResetPassword() {
  const { uid, token } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    if (f.get('new_password') !== f.get('confirm')) { setError('The two passwords don’t match.'); return }
    setBusy(true)
    setError('')
    try {
      await api('/api/v1/auth/password/reset/confirm/', {
        method: 'POST', auth: false, body: { uid, token, new_password: f.get('new_password') },
      })
      navigate('/login', { replace: true, state: { notice: 'Your password has been changed. Please sign in.' } })
    } catch (err) {
      setError(err.data?.new_password ? flat(err.data.new_password) : err.message)
      setBusy(false)
    }
  }

  return (
    <AuthCard title="Choose a new password">
      <form className="form" onSubmit={onSubmit}>
        <FlashToast kind="error" text={error} flash={error} />
        {/expired|invalid|used/i.test(error) && <p><Link to="/forgot-password">Get a new link</Link></p>}
        <div className="field">
          <label htmlFor="new_password">New password</label>
          <PasswordRules />
          <input id="new_password" name="new_password" type="password" autoComplete="new-password" required minLength={8} autoFocus />
          <span className="error-msg">Use at least 8 characters.</span>
        </div>
        <div className="field">
          <label htmlFor="confirm">Type it again</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </div>
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
      </form>
    </AuthCard>
  )
}

/* ------------------------------------------------------------ Confirm email (from email) */
export function VerifyEmail() {
  const { token } = useParams()
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [failed, setFailed] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // StrictMode runs effects twice in development; confirm once
    ran.current = true
    api('/api/v1/auth/verify-email/', { method: 'POST', body: { token }, auth: false })
      .then(async (r) => {
        if (user) await refreshUser().catch(() => {})
        // Confirmed: back to the landing page, where they sign in.
        toast.success(user ? r.detail : `${r.detail} You can sign in now.`, { duration: 8000 })
        navigate('/', { replace: true })
      })
      .catch((err) => { setFailed(err.message); toast.error(err.message) })
  }, [token, user, refreshUser, navigate, toast])

  return (
    <AuthCard title="Confirm your email">
      {!failed && <Loading label="Confirming…" />}
      {failed && (
        <>
          <p>{failed}</p>
          {user ? <ResendButton /> : <ResendByEmail />}
        </>
      )}
    </AuthCard>
  )
}

/** For people who can't sign in yet: ask for a new confirmation link by email address. */
function ResendByEmail() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const email = new FormData(e.currentTarget).get('email').trim()
      toast.success((await api('/api/v1/auth/verify-email/resend-public/', { method: 'POST', body: { email }, auth: false })).detail)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="resend-email">Email on your account</label>
        <input id="resend-email" name="email" type="email" autoComplete="email" required />
      </div>
      <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send a new confirmation link'}</button>
    </form>
  )
}

/* ------------------------------------------------------------ One-click unsubscribe */
export function Unsubscribe() {
  const { token } = useParams()
  const [info, setInfo] = useState(null)
  const [done, setDone] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api(`/api/v1/auth/unsubscribe/${token}/`, { auth: false }).then(setInfo).catch((e) => setError(e.message))
  }, [token])

  async function confirm() {
    try { setDone((await api(`/api/v1/auth/unsubscribe/${token}/`, { method: 'POST', auth: false })).detail) } catch (e) { setError(e.message) }
  }

  return (
    <AuthCard title="Email preferences">
      <FlashToast kind="error" text={error} />
      {!error && !info && <Loading />}
      {info && !done && (
        <>
          <p>Stop sending <strong>{info.label}</strong> to {info.email}?</p>
          <button type="button" className="btn" onClick={confirm}>Unsubscribe</button>
        </>
      )}
      {done && (
        <>
          <FlashToast text={done} />
          <p className="muted">You can turn it back on any time from <Link to="/account">your account</Link>.</p>
        </>
      )}
    </AuthCard>
  )
}
