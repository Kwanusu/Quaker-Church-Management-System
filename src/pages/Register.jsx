import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import FlashToast from '../components/FlashToast'
import GoogleButton from '../components/GoogleButton'
import Logo from '../components/Logo'
import { useToast } from '../components/toastContext'
import { PLATFORM } from '../config'

export default function Register() {
  const { user, register, refreshUser } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const location = useLocation()
  const from = location.state?.from || '/'
  const joinSlug = location.state?.join
  const joinName = location.state?.joinName
  // From a church's invitation email: /register?email=… (they'll be linked to the church once confirmed)
  const invitedEmail = new URLSearchParams(location.search).get('email') || ''
  const [errors, setErrors] = useState(null)
  const [busy, setBusy] = useState(false)

  if (user && !busy) return <Navigate to={from} replace />

  async function onSubmit(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setErrors(null)
    try {
      const created = await register({
        first_name: f.get('first_name').trim(), last_name: f.get('last_name').trim(),
        email: f.get('email').trim(), password: f.get('password'),
      })
      // No session yet: the email must be confirmed first. Back to the landing page with a toast.
      toast.success(`${created.detail} Open it to activate your account, then sign in.`, { duration: 9000 })
      navigate('/', { replace: true })
    } catch (err) {
      setErrors(err.data && typeof err.data === 'object' ? err.data : { detail: err.message })
      setBusy(false)
    }
  }

  const fieldError = (name) => errors?.[name] && <span className="field-error" role="alert">{[].concat(errors[name]).join(' ')}</span>

  return (
    <section className="section login">
      <div className="container">
        <div className="card card--gold login__card login__card--wide">
          <header className="login__head">
            <Logo size={64} alt={`${PLATFORM.name} logo`} />
            <div>
              <h1>{joinName ? `Join ${joinName}` : 'Create your account'}</h1>
              <p className="muted">
                {joinSlug ? 'Create your account, confirm your email, then you’re in.' : `Create an account to join a church on ${PLATFORM.name}.`}
              </p>
            </div>
          </header>
          <FlashToast kind="error" text={errors?.detail} />
          <form className="form form--grid" onSubmit={onSubmit} noValidate={false}>
            <div className="field">
                <label htmlFor="first_name">First name</label>
                <input id="first_name" name="first_name" autoComplete="given-name" required />
                <span className="error-msg">Please enter your first name.</span>
                {fieldError('first_name')}
              </div>
              <div className="field">
                <label htmlFor="last_name">Last name</label>
                <input id="last_name" name="last_name" autoComplete="family-name" />
              </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required defaultValue={invitedEmail} />
              {invitedEmail && <span className="hint">Use this address so your church can link you to their member register.</span>}
              <span className="error-msg">Please enter a valid email address.</span>
              {fieldError('email')}
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="At least 8 characters" />
              <span className="error-msg">Use at least 8 characters.</span>
              {fieldError('password')}
              {fieldError('non_field_errors')}
            </div>
            <button className="btn form__submit form__wide" disabled={busy}>{busy ? 'Creating account…' : joinName ? `Create account & join` : 'Create account'}</button>
          </form>
          <GoogleButton text="signup_with" onSignedIn={async (d) => {
            // Google confirms the email, so joining can happen straight away.
            if (joinSlug && d.user.email_verified) {
              try { await api(`/api/v1/churches/${joinSlug}/join/`, { method: 'POST' }); await refreshUser() } catch { /* shown on the church page */ }
            }
            navigate(from, { replace: true })
          }} />
          <p className="muted login__help">
            Already have an account? <Link to="/login" state={location.state}>Sign in</Link>
          </p>
        </div>
      </div>
    </section>
  )
}
