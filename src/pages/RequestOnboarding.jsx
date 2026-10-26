import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, qs } from '../api/client'
import FlashToast from '../components/FlashToast'
import Logo from '../components/Logo'
import { useToast } from '../components/toastContext'
import { churchAddress, PLATFORM } from '../config'
import { useApi, useDebounced } from '../hooks/useApi'

const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

/** A church asks to be onboarded. Nothing is created until the platform team approves. */
export default function RequestOnboarding() {
  const toast = useToast()
  const [name, setName] = useState('')
  const [sub, setSub] = useState('')
  const [subTouched, setSubTouched] = useState(false)
  const [errors, setErrors] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const subdomain = subTouched ? sub : slugify(name)
  const wanted = useDebounced(subdomain)
  const { data: check } = useApi(wanted ? `/api/v1/onboarding/subdomain/${qs({ name: wanted })}` : null, { auth: false })
  const taken = check && check.name === wanted && !check.available

  async function onSubmit(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setErrors(null)
    try {
      const body = Object.fromEntries([...f.entries()].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]))
      body.requested_subdomain = subdomain
      body.estimated_members = body.estimated_members ? Number(body.estimated_members) : null
      const r = await api('/api/v1/onboarding/requests/', { method: 'POST', body, auth: false })
      toast.success(r.detail, { duration: 9000 })
      setDone(r)
    } catch (err) {
      setErrors(err.data && typeof err.data === 'object' ? err.data : { detail: err.message })
    } finally {
      setBusy(false)
    }
  }

  const fieldError = (n) => errors?.[n] && <span className="field-error" role="alert">{[].concat(errors[n]).join(' ')}</span>

  if (done) {
    return (
      <section className="section login">
        <div className="container">
          <div className="card card--gold login__card">
            <header className="login__head"><Logo size={64} alt={`${PLATFORM.name} logo`} /><div><h1>Request received</h1></div></header>
            <p>{done.detail}</p>
            <p className="muted">Once it’s approved you’ll get an email with a link to set up your church as its Clerk.</p>
            <Link to="/" className="btn btn--outline">Back to the churches</Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="section login">
      <div className="container">
        <div className="card card--gold login__card login__card--wide">
          <header className="login__head">
            <Logo size={64} alt={`${PLATFORM.name} logo`} />
            <div>
              <h1>Bring your church onboard</h1>
              <p className="muted">Tell us about your meeting. We review every request, then email you a link to set it up.</p>
            </div>
          </header>
          <FlashToast kind="error" text={errors?.detail} />
          <form className="form form--grid" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="r-church">Church name</label>
              <input id="r-church" name="church_name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Kaimosi Friends Church" />
              {fieldError('church_name')}
            </div>
            <div className="field">
              <label htmlFor="r-sub">Web address</label>
              <input id="r-sub" value={subdomain} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*"
                onChange={(e) => { setSubTouched(true); setSub(e.target.value.toLowerCase()) }} aria-describedby="r-sub-hint" />
              <span id="r-sub-hint" className={`hint${taken ? ' field-error' : ''}`}>
                {taken ? check.reason : <>Your page: <strong>{churchAddress(subdomain || '…')}</strong></>}
              </span>
              {fieldError('requested_subdomain')}
            </div>
            <div className="field">
              <label htmlFor="r-town">Town</label>
              <input id="r-town" name="town" maxLength={100} />
            </div>
            <div className="field">
              <label htmlFor="r-members">Approximate members</label>
              <input id="r-members" name="estimated_members" type="number" min="0" inputMode="numeric" />
            </div>
            <div className="field">
              <label htmlFor="r-contact">Your name</label>
              <input id="r-contact" name="contact_name" required maxLength={150} autoComplete="name" />
              {fieldError('contact_name')}
            </div>
            <div className="field">
              <label htmlFor="r-email">Your email</label>
              <input id="r-email" name="contact_email" type="email" required autoComplete="email" />
              {fieldError('contact_email')}
            </div>
            <div className="field">
              <label htmlFor="r-phone">Phone <span className="muted">(optional)</span></label>
              <input id="r-phone" name="contact_phone" type="tel" autoComplete="tel" maxLength={30} />
            </div>
            <div className="field">
              <label htmlFor="r-country">Country</label>
              <input id="r-country" name="country" defaultValue="Kenya" maxLength={100} />
            </div>
            <div className="field form__wide">
              <label htmlFor="r-message">Anything we should know? <span className="muted">(optional)</span></label>
              <textarea id="r-message" name="message" rows={2} maxLength={2000} />
            </div>
            {/* Honeypot for bots: people never see or fill it. */}
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp" />
            <button className="btn form__wide" disabled={busy || taken}>{busy ? 'Sending…' : 'Request onboarding'}</button>
          </form>
        </div>
      </div>
    </section>
  )
}
