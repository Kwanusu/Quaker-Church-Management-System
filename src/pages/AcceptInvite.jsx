import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import FlashToast from '../components/FlashToast'
import Logo from '../components/Logo'
import { Loading } from '../components/States'
import { useToast } from '../components/toastContext'
import { churchAddress, PLATFORM, TENANT_BASE_DOMAIN } from '../config'
import { useApi } from '../hooks/useApi'

/** The page behind the emailed link that invites a church's first Clerk. */
export default function AcceptInvite() {
  const { token } = useParams()
  const { user, adoptSession, refreshUser, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: invite, error, loading } = useApi(`/api/v1/onboarding/invitations/${encodeURIComponent(token)}/`, { auth: false })
  const [errors, setErrors] = useState(null)
  const [busy, setBusy] = useState(false)

  async function accept(body = {}) {
    setBusy(true)
    setErrors(null)
    try {
      // Signed in: the bearer token identifies them. Otherwise this creates their account.
      const r = await api(`/api/v1/onboarding/invitations/${encodeURIComponent(token)}/accept/`, { method: 'POST', body, auth: !!user })
      if (r.access) adoptSession(r)
      else await refreshUser()
      toast.success(`Welcome! ${r.church.name} is ready for you to set up.`, { duration: 7000 })
      if (TENANT_BASE_DOMAIN) {
        // Each church has its own address; sign-in is per site, so they sign in once there.
        window.location.assign(`${r.church.url}/manage?welcome=1`)
        return
      }
      navigate(`/c/${r.church.slug}/manage?welcome=1`, { replace: true })
    } catch (err) {
      setErrors(err.data && typeof err.data === 'object' ? err.data : { detail: err.message })
      setBusy(false)
    }
  }

  const fieldError = (n) => errors?.[n] && <span className="field-error" role="alert">{[].concat(errors[n]).join(' ')}</span>
  const wrongAccount = invite && user && user.email.toLowerCase() !== invite.email

  let body
  if (loading && !invite) body = <Loading label="Checking your invitation…" />
  else if (error) {
    body = (
      <>
        <p>{error.message}</p>
        <Link to="/login" className="btn btn--outline">Sign in</Link>
      </>
    )
  } else if (wrongAccount) {
    body = (
      <>
        <p>This invitation was sent to <strong>{invite.email}</strong>, but you’re signed in as <strong>{user.email}</strong>.</p>
        <button type="button" className="btn" onClick={async () => { await logout() }}>Sign out and continue</button>
      </>
    )
  } else if (user) {
    body = (
      <>
        <p>You’re signed in as <strong>{user.email}</strong>. Accepting makes you the Clerk of <strong>{invite.church.name}</strong>.</p>
        <button type="button" className="btn" disabled={busy} onClick={() => accept()}>{busy ? 'Setting up…' : 'Accept and set up my church'}</button>
      </>
    )
  } else if (invite.has_account) {
    body = (
      <>
        <p>An account already exists for <strong>{invite.email}</strong>. Sign in to accept the invitation.</p>
        <Link to="/login" state={{ from: `/accept-invite/${token}` }} className="btn">Sign in to continue</Link>
      </>
    )
  } else {
    body = (
      <form className="form form--grid" onSubmit={(e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        accept({ first_name: f.get('first_name').trim(), last_name: f.get('last_name').trim(), password: f.get('password') })
      }}>
        <p className="form__wide muted">Create your account for <strong>{invite.email}</strong>. This invitation already confirms that address.</p>
        <div className="field">
          <label htmlFor="i-first">First name</label>
          <input id="i-first" name="first_name" required autoComplete="given-name" />
          {fieldError('first_name')}
        </div>
        <div className="field">
          <label htmlFor="i-last">Last name</label>
          <input id="i-last" name="last_name" autoComplete="family-name" />
        </div>
        <div className="field form__wide">
          <label htmlFor="i-pass">Choose a password</label>
          <input id="i-pass" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />
          {fieldError('password')}
        </div>
        <button className="btn form__wide" disabled={busy}>{busy ? 'Setting up…' : 'Create account and set up my church'}</button>
      </form>
    )
  }

  return (
    <section className="section login">
      <div className="container">
        <div className="card card--gold login__card">
          <header className="login__head">
            <Logo size={64} alt={`${PLATFORM.name} logo`} />
            <div>
              <h1>{invite ? invite.church.name : 'Your invitation'}</h1>
              <p className="muted">{invite ? <>You’re invited to be its Clerk · {churchAddress(invite.church.slug)}</> : 'Set up your church on the platform.'}</p>
            </div>
          </header>
          <FlashToast kind="error" text={errors?.detail} />
          {body}
        </div>
      </div>
    </section>
  )
}
