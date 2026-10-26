import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ROLES } from '../config'
import SmartLink from '../components/SmartLink'
import { churchPath } from '../tenant'
import Avatar from '../components/Avatar'
import ResendButton from '../components/ResendButton'
import { useToast } from '../components/toastContext'
import { PasswordRules } from './AuthPages'
import FlashToast from '../components/FlashToast'

const flat = (data) => (data && typeof data === 'object' ? Object.values(data).flat().join(' ') : '')

function Flash({ flash }) {
  return <FlashToast flash={flash} />
}

/** Profile picture: choose a file and it is set straight away (the server crops it square). */
function AvatarEditor() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const input = useRef(null)
  const [busy, setBusy] = useState(false)

  async function send(method, body) {
    setBusy(true)
    try {
      setUser(await api('/api/v1/auth/me/avatar/', { method, body }))
      toast.success(method === 'DELETE' ? 'Picture removed.' : 'Picture updated.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  function onChoose(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Please choose a picture under 5 MB.'); e.target.value = ''; return }
    const fd = new FormData()
    fd.append('avatar', file)
    send('POST', fd)
  }

  return (
    <div className="avatar-editor">
      <Avatar user={user} size={96} className="avatar--ring" />
      <div className="avatar-editor__body">
        <strong>Profile picture</strong>
        <span className="hint">JPG, PNG or WebP, up to 5 MB. We crop it to a square.</span>
        <div className="manage__actions">
          <button type="button" className="btn btn--outline btn--sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Working…' : user.avatar ? 'Change picture' : 'Upload a picture'}
          </button>
          {user.avatar && <button type="button" className="btn btn--outline btn--sm" disabled={busy} onClick={() => send('DELETE')}>Remove</button>}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="visually-hidden" onChange={onChoose} tabIndex={-1} aria-label="Choose a profile picture" />
      </div>
    </div>
  )
}

function ProfileForm() {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState({ username: user.username, first_name: user.first_name, last_name: user.last_name, phone: user.phone })
  const [flash, setFlash] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setFlash(null)
    try {
      const me = await api('/api/v1/auth/me/', { method: 'PATCH', body: form })
      setUser(me)
      setFlash({ kind: 'success', text: 'Saved.' })
    } catch (err) {
      setFlash({ kind: 'error', text: flat(err.data) || err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card account__card">
      <h2>Your details</h2>
      <AvatarEditor />
      <form className="form" onSubmit={onSubmit}>
        <Flash flash={flash} />
        <div className="form-grid">
          <div className="field">
            <label htmlFor="a-first">First name</label>
            <input id="a-first" value={form.first_name} onChange={set('first_name')} required autoComplete="given-name" />
          </div>
          <div className="field">
            <label htmlFor="a-last">Last name</label>
            <input id="a-last" value={form.last_name} onChange={set('last_name')} autoComplete="family-name" />
          </div>
          <div className="field">
            <label htmlFor="a-username">Username</label>
            <input id="a-username" value={form.username} onChange={set('username')} required maxLength={150} pattern="[\w.@+\-]+" autoComplete="username" />
            <span className="hint">Shown to others in chat. Letters, numbers and @ . + - _ only.</span>
            <span className="error-msg">Choose a username without spaces.</span>
          </div>
          <div className="field">
            <label htmlFor="a-phone">Phone <span className="muted">(optional)</span></label>
            <input id="a-phone" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="+254 7…" />
            <span className="hint">Will be used for M-Pesa giving later.</span>
          </div>
          <div className="field form-grid__wide">
            <label htmlFor="a-email">Email</label>
            <input id="a-email" type="email" value={user.email} readOnly aria-readonly="true" autoComplete="email" />
            <span className="hint">Your email identifies your account, so it can’t be changed here.</span>
          </div>
        </div>
        {user.google_linked && <p className="muted account__meta"><span className="badge">Google sign-in linked</span></p>}
        <div className="manage__actions"><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save details'}</button></div>
      </form>
    </div>
  )
}

function EmailPreferences() {
  const { user, setUser } = useAuth()
  const [flash, setFlash] = useState(null)

  async function toggle(key, value) {
    setFlash(null)
    setUser((u) => ({ ...u, [key]: value })) // tick changes at once…
    try {
      setUser(await api('/api/v1/auth/me/', { method: 'PATCH', body: { [key]: value } }))
      setFlash({ kind: 'success', text: 'Preferences saved.' })
    } catch (err) {
      setUser((u) => ({ ...u, [key]: !value })) // …and is undone if saving fails
      setFlash({ kind: 'error', text: err.message })
    }
  }

  return (
    <div className="card form account__card">
      <h2>Emails from your churches</h2>
      <Flash flash={flash} />
      <label className="check">
        <input type="checkbox" checked={user.email_announcements} onChange={(e) => toggle('email_announcements', e.target.checked)} />
        Announcements posted by the Clerk
      </label>
      <label className="check">
        <input type="checkbox" checked={user.email_reminders} onChange={(e) => toggle('email_reminders', e.target.checked)} />
        Reminder the day before Sunday worship (with the YouTube link)
      </label>
      <p className="muted">Account emails (confirming your address, password changes) are always sent.</p>
    </div>
  )
}

function PasswordForm() {
  const { user, adoptSession } = useAuth()
  const [flash, setFlash] = useState(null)
  const [busy, setBusy] = useState(false)
  const setting = !user.has_password

  async function onSubmit(e) {
    e.preventDefault()
    const formEl = e.currentTarget
    const f = new FormData(formEl)
    if (f.get('new_password') !== f.get('confirm')) { setFlash({ kind: 'error', text: 'The two new passwords don’t match.' }); return }
    setBusy(true)
    setFlash(null)
    try {
      const data = await api('/api/v1/auth/password/change/', {
        method: 'POST', body: { current_password: f.get('current_password') || '', new_password: f.get('new_password') },
      })
      adoptSession(data)
      formEl.reset()
      setFlash({ kind: 'success', text: setting ? 'Password set. You can now also sign in with your username or email.' : 'Password changed. Other devices have been signed out.' })
    } catch (err) {
      setFlash({ kind: 'error', text: flat(err.data) || err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card form account__card" onSubmit={onSubmit}>
      <h2>{setting ? 'Set a password' : 'Change password'}</h2>
      {setting && <p className="muted">You sign in with Google. Add a password if you’d also like to sign in with your email.</p>}
      <Flash flash={flash} />
      {!setting && (
        <div className="field">
          <label htmlFor="p-current">Current password</label>
          <input id="p-current" name="current_password" type="password" autoComplete="current-password" required />
          <span className="error-msg">Enter your current password.</span>
        </div>
      )}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="p-new">New password</label>
          <input id="p-new" name="new_password" type="password" autoComplete="new-password" required minLength={8} />
          <PasswordRules />
          <span className="error-msg">Use at least 8 characters.</span>
        </div>
        <div className="field">
          <label htmlFor="p-confirm">Type it again</label>
          <input id="p-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </div>
      </div>
      <div className="manage__actions">
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : setting ? 'Set password' : 'Change password'}</button>
        {!setting && <Link to="/forgot-password" className="btn btn--outline">Forgot it?</Link>}
      </div>
    </form>
  )
}

export default function Account() {
  const { user } = useAuth()
  return (
    <>
      <section className="page-hero">
        <div className="container account-hero">
          <Avatar user={user} size={88} className="avatar--ring" />
          <div>
            <div className="eyebrow eyebrow--light">Your account</div>
            <h1>{user.full_name}</h1>
            <p className="hero__lead">{user.email}</p>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container narrow account">
          {!user.email_verified && (
            <div className="card card--gold">
              <h2>Confirm your email</h2>
              <p>We sent a link to <strong>{user.email}</strong>. You need to confirm it before joining churches or using messages.</p>
              <ResendButton />
            </div>
          )}
          <ProfileForm />
          <EmailPreferences />
          <PasswordForm />
          <div className="card">
            <h2>Your churches</h2>
            {user.memberships.length ? (
              <ul className="manage__list">
                {user.memberships.map((m) => (
                  <li key={m.church}>
                    <SmartLink to={churchPath(m.church)}><strong>{m.church_name}</strong></SmartLink>
                    <span className="badge badge--gold">{ROLES[m.role]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">You haven’t joined a church yet. <Link to="/#churches">Find one</Link> or <Link to="/request-onboarding">ask to onboard yours</Link>.</p>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
