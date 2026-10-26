import { useState } from 'react'
import { Link } from 'react-router-dom'
import { qs } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import Logo from '../components/Logo'
import SmartLink from '../components/SmartLink'
import { Empty, ErrorState, Pagination } from '../components/States'
import { GUIDING_TEXT, mediaUrl, PLATFORM, ROLES, TENANT_BASE_DOMAIN } from '../config'
import { useApi, useDebounced } from '../hooks/useApi'
import { churchPath } from '../tenant'

const FEATURES = [
  ['▶', 'Live worship', 'Stream services from your YouTube channel straight onto your church page.'],
  ['✉', 'Messaging', 'Announcements, fellowship and prayer rooms, with history for those who join later.'],
  ['📖', 'Bible & hymns', 'The King James Bible built in, and as many hymn books as your meeting uses.'],
  ['⚙', 'Your own space', 'Each meeting runs independently, with its own Clerks, members, events and queries.'],
]

function ChurchDirectory() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const term = useDebounced(q.trim())
  const { data, error, loading, reload } = useApi(`/api/v1/churches/${qs({ q: term, page })}`, { auth: false })

  return (
    <>
      <form className="toolbar" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="toolbar__search">
          <span className="visually-hidden">Search churches</span>
          <input type="search" placeholder="Search by church name or town" value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </label>
      </form>
      {loading && !data ? (
        <div className="grid">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}</div>
      ) : error ? <ErrorState error={error} onRetry={reload} /> : !data.results.length ? (
        <Empty>{term ? `No church matches “${term}”.` : 'No churches are listed yet.'}</Empty>
      ) : (
        <>
          <ul className="church-grid" aria-busy={loading}>
            {data.results.map((c) => (
              <li key={c.slug}>
                <ChurchCardLink church={c}>
                  {c.logo
                    ? <img src={mediaUrl(c.logo)} alt="" width={56} height={56} className="logo logo--custom" />
                    : <Logo size={56} />}
                  <span className="church-card__body">
                    <span className="church-card__name">{c.name} {c.live && <span className="badge badge--live">● Live</span>}</span>
                    <span className="church-card__meta">
                      {[c.town, c.country].filter(Boolean).join(', ') || c.subtitle}
                    </span>
                    <span className="church-card__meta">
                      {c.member_count} {c.member_count === 1 ? 'person' : 'people'}
                      {c.my_role && <> · <strong>You: {ROLES[c.my_role]}</strong></>}
                    </span>
                  </span>
                </ChurchCardLink>
              </li>
            ))}
          </ul>
          <Pagination page={page} count={data.count} onPage={setPage} />
        </>
      )}
    </>
  )
}

/** A church card links to the church's own address when churches have subdomains, else to /c/<slug>. */
function ChurchCardLink({ church, children }) {
  return <SmartLink to={TENANT_BASE_DOMAIN ? church.url : `/c/${church.slug}`} className="church-card">{children}</SmartLink>
}

const STEPS = [
  ['1', 'Tell us about your meeting', 'Send a short request: your church’s name, where it meets and who we should contact.'],
  ['2', 'We review it', 'The platform team checks every request and emails you either way, usually within a few days.'],
  ['3', 'Set it up and go live', 'Accept the invitation as Clerk, add worship times and hymns, then publish your church at its own web address.'],
]

/** Signed-in members: their churches, with the one still being set up first. */
function MyChurches({ memberships }) {
  const ordered = [...memberships].sort((a, b) => (a.status === 'active') - (b.status === 'active'))
  return (
    <section className="section section--white" id="my-churches">
      <div className="container">
        <div className="eyebrow">Your churches</div>
        <h2>Pick up where you left off</h2>
        <ul className="church-grid">
          {ordered.map((m) => {
            const settingUp = m.status !== 'active'
            return (
              <li key={m.church}>
                <SmartLink to={churchPath(m.church, settingUp && m.role === 'clerk' ? '/manage' : '')} className="church-card">
                  <Logo size={56} />
                  <span className="church-card__body">
                    <span className="church-card__name">{m.church_name}</span>
                    <span className="church-card__meta"><strong>{ROLES[m.role]}</strong></span>
                    <span className="church-card__meta">
                      {settingUp ? (m.role === 'clerk' ? 'Finish setting up and publish →' : 'Being set up by its Clerk') : 'Open the church →'}
                    </span>
                  </span>
                </SmartLink>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="section" id="onboard">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">For churches</div>
            <h2>Bring your church onboard</h2>
          </div>
          <Link to="/request-onboarding" className="btn btn--gold">Request onboarding</Link>
        </div>
        <ol className="steps">
          {STEPS.map(([n, title, text]) => (
            <li key={n} className="card card--gold">
              <span className="steps__n" aria-hidden="true">{n}</span>
              <h3>{title}</h3>
              <p className="muted" style={{ margin: 0 }}>{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default function PlatformHome() {
  const { user } = useAuth()
  const memberships = user?.memberships || []
  const hasChurch = memberships.length > 0
  const first = memberships.find((m) => m.status === 'active') || memberships[0]

  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <div className="eyebrow eyebrow--light">{PLATFORM.name} ({PLATFORM.subtitle})</div>
            {user ? (
              <>
                <h1>Welcome{user.first_name ? `, ${user.first_name}` : ''}</h1>
                <p className="hero__lead">{hasChurch ? 'Your churches are below. You can also look for another meeting.' : 'You haven’t joined a church yet. Find yours and join in a click.'}</p>
                <div className="hero__actions">
                  {hasChurch
                    ? <SmartLink to={churchPath(first.church)} className="btn btn--gold">Open {first.church_name}</SmartLink>
                    : <a href="#churches" className="btn btn--gold">Find your church</a>}
                  {hasChurch && <a href="#churches" className="btn btn--ghost-light">Find another church</a>}
                </div>
              </>
            ) : (
              <>
                <h1>Worship together, wherever you are</h1>
                <p className="hero__lead">{PLATFORM.tagline}</p>
                <div className="hero__actions">
                  <a href="#churches" className="btn btn--gold">Find your church</a>
                  <Link to="/request-onboarding" className="btn btn--ghost-light">Bring your church onboard</Link>
                </div>
              </>
            )}
          </div>
          <figure className="query-card guiding">
            <Logo variant="full" size={120} alt={`${PLATFORM.name} logo`} />
            <blockquote><p>{GUIDING_TEXT.text}</p></blockquote>
            <figcaption><strong>{GUIDING_TEXT.ref}</strong></figcaption>
          </figure>
        </div>
      </section>

      {hasChurch && <MyChurches memberships={memberships} />}

      <section className={`section${hasChurch ? '' : ' section--white'}`} id="churches">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow">Churches</div>
              <h2>{hasChurch ? 'Find another meeting' : 'Find a meeting'}</h2>
            </div>
          </div>
          <ChurchDirectory />
        </div>
      </section>

      {!hasChurch && <HowItWorks />}

      {!user && (
        <section className="section section--white">
          <div className="container">
            <div className="eyebrow">For every meeting</div>
            <h2>Everything your church needs, in one place</h2>
            <div className="grid pillars">
              {FEATURES.map(([icon, title, text]) => (
                <div key={title} className="card card--gold">
                  <div className="feature-icon" aria-hidden="true">{icon}</div>
                  <h3>{title}</h3>
                  <p className="muted" style={{ margin: 0 }}>{text}</p>
                </div>
              ))}
            </div>
            <p className="muted coming-soon">Coming next: giving and tithes with M-Pesa and card payments.</p>
          </div>
        </section>
      )}
    </>
  )
}
