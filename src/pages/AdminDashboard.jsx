import { useId, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, qs } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ErrorState, Loading, Pagination } from '../components/States'
import { churchAddress, DJANGO_ADMIN_URL, ROLES } from '../config'
import { useApi, useDebounced } from '../hooks/useApi'
import FlashToast from '../components/FlashToast'
import { useConfirm } from '../components/confirmContext'

/*
  Platform admin dashboard (/admin-dashboard). Shown only to platform admins
  (onboarded with `manage.py platform add-admin`) and system admins; the API
  enforces the same rule. The Django admin stays with the system admin.
*/
const P = (path) => `/api/v1/platform${path}`
const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const formatDate = (iso) => dayFmt.format(new Date(iso))

const ACCOUNT_LABEL = { platform_admin: 'Platform admin', system_admin: 'System admin' }

/** Mirrors platformadmin/permissions.py: who may suspend / verify / reset whom. */
function accountLock(me, target) {
  if (me.id === target.id) return 'This is your own account. Use your account page.'
  if (target.account_type === 'system_admin' && me.account_type !== 'system_admin') return 'System admin accounts are managed by the system admin.'
  if (target.account_type === 'platform_admin' && me.account_type !== 'system_admin') return 'Other platform admins are managed by the system admin.'
  return ''
}

function errorText(err) {
  const d = err.data
  if (d && typeof d === 'object') {
    const first = d.detail || d.non_field_errors || d.role || d.church || d.user || Object.values(d)[0]
    if (first) return [].concat(first).join(' ')
  }
  return err.message
}

function useFlash() {
  const [flash, setFlash] = useState(null)
  return [flash, setFlash, flash && <FlashToast flash={flash} />]
}

/* ------------------------------------------------------------ search picker */
function SearchPick({ label, endpoint, placeholder, describe, onPick, exclude = [], keyOf = (r) => r.id }) {
  const id = useId()
  const [q, setQ] = useState('')
  const term = useDebounced(q.trim())
  const { data, loading } = useApi(term.length >= 2 ? `${endpoint}${qs({ q: term })}` : null)
  const results = (term.length >= 2 && data?.results ? data.results : []).filter((r) => !exclude.includes(keyOf(r)))
  return (
    <div className="field picker">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="search" value={q} placeholder={placeholder} autoComplete="off" onChange={(e) => setQ(e.target.value)} />
      {term.length >= 2 && q.trim() && (
        <ul className="picker__results" aria-live="polite">
          {loading && !data ? <li className="muted">Searching…</li>
            : results.length === 0 ? <li className="muted">No matches.</li>
              : results.slice(0, 8).map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => { onPick(r); setQ('') }}>{describe(r)}</button>
                </li>
              ))}
        </ul>
      )}
    </div>
  )
}

function RoleSelect({ value, onChange, label, disabled }) {
  return (
    <label>
      <span className="visually-hidden">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

/* ------------------------------------------------------------ overview */
function Stat({ label, value, note, onClick }) {
  const body = <><span className="stat__value">{value}</span><span className="stat__label">{label}</span>{note && <span className="stat__note">{note}</span>}</>
  return onClick
    ? <button type="button" className="card stat stat--link" onClick={onClick}>{body}</button>
    : <div className="card stat">{body}</div>
}

function Overview({ go }) {
  const { data, error, loading, reload } = useApi(P('/overview/'))
  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const { users, churches, roles } = data
  return (
    <div className="admin-overview">
      <div className="stats">
        <Stat label="People" value={users.total} note={`${users.new_30d} new in 30 days`} onClick={() => go({ tab: 'people' })} />
        <Stat label="Churches" value={churches.total} note={`${churches.new_30d} new in 30 days`} onClick={() => go({ tab: 'churches' })} />
        <Stat label="Suspended accounts" value={users.suspended} onClick={() => go({ tab: 'people', status: 'suspended' })} />
        <Stat label="Email not confirmed" value={users.unverified} onClick={() => go({ tab: 'people', status: 'unverified' })} />
        <Stat label="Suspended churches" value={churches.suspended} onClick={() => go({ tab: 'churches', status: 'suspended' })} />
        <Stat label="Admins" value={users.admins} onClick={() => go({ tab: 'people', status: 'admins' })} />
      </div>

      <div className="admin-overview__grid">
        <div className="card">
          <h2>Roles across all churches</h2>
          <ul className="role-bars">
            {Object.entries(ROLES).map(([key, label]) => (
              <li key={key}><span>{label}</span><strong>{roles[key] ?? 0}</strong></li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>Churches without a Clerk</h2>
          {data.churches_without_clerk.length === 0
            ? <p className="muted">Every active church has a Clerk. ✓</p>
            : (
              <ul className="plain-list">
                {data.churches_without_clerk.map((c) => (
                  <li key={c.slug}>
                    <span>{c.name}</span>
                    <button type="button" className="btn btn--gold btn--sm" onClick={() => go({ tab: 'churches', church: c.slug })}>Appoint a Clerk</button>
                  </li>
                ))}
              </ul>
            )}
        </div>
        <div className="card">
          <h2>Newest sign-ups</h2>
          <ul className="plain-list">
            {data.recent_users.map((u) => (
              <li key={u.id}>
                <button type="button" className="linklike" onClick={() => go({ tab: 'people', user: u.id })}>{u.full_name}</button>
                <span className="muted nowrap">{formatDate(u.date_joined)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ people */
function PersonBadges({ u }) {
  return (
    <>
      {ACCOUNT_LABEL[u.account_type] && <span className="badge badge--gold">{ACCOUNT_LABEL[u.account_type]}</span>}
      {!u.is_active && <span className="badge badge--live">Suspended</span>}
      {!u.email_verified && <span className="badge badge--draft">Email not confirmed</span>}
    </>
  )
}

function PersonDetail({ id, onBack, onChanged }) {
  const { user: me } = useAuth()
  const { data: u, error, loading, reload } = useApi(P(`/users/${id}/`))
  const [, setFlash, flashEl] = useFlash()
  const confirm = useConfirm()
  const [newRole, setNewRole] = useState('member')
  const [busy, setBusy] = useState(false)

  async function run(fn, success) {
    setBusy(true)
    setFlash(null)
    try {
      const res = await fn()
      setFlash({ kind: 'success', text: typeof success === 'function' ? success(res) : success })
      reload()
      onChanged?.()
    } catch (err) {
      setFlash({ kind: 'error', text: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  if (loading && !u) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const lock = accountLock(me, u)
  const name = u.full_name

  return (
    <div className="admin-detail">
      <button type="button" className="linklike" onClick={onBack}>← All people</button>
      <div className="card card--gold">
        <div className="section-head">
          <div>
            <h2>{name}</h2>
            <div className="muted">@{u.username} · {u.email || 'no email'}{u.phone && ` · ${u.phone}`}</div>
            <div className="badge-row"><PersonBadges u={u} />{u.google_linked && <span className="badge">Google sign-in</span>}</div>
          </div>
          <div className="muted admin-detail__dates">
            Joined {formatDate(u.date_joined)}<br />Last sign-in {u.last_login ? formatDate(u.last_login) : 'never'}
          </div>
        </div>
        {flashEl}

        <h3>Churches and roles</h3>
        {u.memberships.length === 0 ? <p className="muted">Not in any church yet.</p> : (
          <ul className="manage__list">
            {u.memberships.map((m) => (
              <li key={m.id}>
                <div>
                  <strong>{m.church_name}</strong> {!m.church_active && <span className="badge badge--live">Church suspended</span>}
                  <div className="muted">Since {formatDate(m.joined_at)} · <Link to={`/c/${m.church}`}>/c/{m.church}</Link></div>
                </div>
                <div className="manage__row-actions">
                  <RoleSelect value={m.role} label={`Role at ${m.church_name}`} disabled={busy}
                    onChange={(role) => run(() => api(P(`/memberships/${m.id}/`), { method: 'PATCH', body: { role } }),
                      `${name} is now ${ROLES[role]} at ${m.church_name}.`)} />
                  <button type="button" className="btn btn--danger btn--sm" disabled={busy}
                    onClick={async () => await confirm({ title: `Remove ${name}?`, message: `${name} will lose their role at ${m.church_name}.`, confirmLabel: 'Remove', tone: 'danger' })
                      && run(() => api(P(`/memberships/${m.id}/`), { method: 'DELETE' }), `${name} was removed from ${m.church_name}.`)}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="admin-add">
          <h3>Add to a church</h3>
          {!u.is_active ? <p className="muted">Reactivate the account first.</p> : (
            <div className="admin-add__row">
              <div className="field">
                <label htmlFor="add-role">As</label>
                <select id="add-role" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <SearchPick label="Church" endpoint={P('/churches/')} placeholder="Type a church name or town"
                exclude={u.memberships.map((m) => m.church)} keyOf={(c) => c.slug}
                describe={(c) => <>{c.name} <span className="muted">{c.town}{!c.is_active && ' · suspended'}</span></>}
                onPick={(c) => run(() => api(P('/memberships/'), { method: 'POST', body: { user: u.id, church: c.slug, role: newRole } }),
                  `${name} was added to ${c.name} as ${ROLES[newRole]}.`)} />
            </div>
          )}
        </div>

        <h3>Account</h3>
        {lock ? <p className="muted">{lock}</p> : (
          <div className="manage__actions">
            {u.is_active ? (
              <button type="button" className="btn btn--danger" disabled={busy}
                onClick={async () => await confirm({ title: `Suspend ${name}?`, message: 'They will be signed out and can’t sign in until you reactivate the account.', confirmLabel: 'Suspend account', tone: 'danger' })
                  && run(() => api(P(`/users/${u.id}/`), { method: 'PATCH', body: { is_active: false } }), `${name}’s account is suspended.`)}>
                Suspend account
              </button>
            ) : (
              <button type="button" className="btn" disabled={busy}
                onClick={() => run(() => api(P(`/users/${u.id}/`), { method: 'PATCH', body: { is_active: true } }), `${name}’s account is active again.`)}>
                Reactivate account
              </button>
            )}
            {!u.email_verified && u.email && (
              <button type="button" className="btn btn--outline" disabled={busy}
                onClick={() => run(() => api(P(`/users/${u.id}/verify-email/`), { method: 'POST' }), `${u.email} is marked as confirmed.`)}>
                Mark email as confirmed
              </button>
            )}
            {u.is_active && u.email && (
              <button type="button" className="btn btn--outline" disabled={busy}
                onClick={() => run(() => api(P(`/users/${u.id}/send-password-reset/`), { method: 'POST' }), (r) => r.detail)}>
                Send password reset email
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function People({ params, go }) {
  const status = params.get('status') || ''
  const userId = params.get('user')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const term = useDebounced(q.trim())
  const { data, error, loading, reload } = useApi(userId ? null : P(`/users/${qs({ q: term, status, page })}`))

  if (userId) return <PersonDetail key={userId} id={userId} onBack={() => go({ tab: 'people', status })} />

  return (
    <div>
      <div className="toolbar">
        <label className="toolbar__search">
          <span className="visually-hidden">Search people</span>
          <input type="search" placeholder="Search by name, username or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </label>
        <label className="toolbar__select">
          <span className="visually-hidden">Show</span>
          <select value={status} onChange={(e) => { go({ tab: 'people', status: e.target.value }); setPage(1) }}>
            <option value="">Everyone</option>
            <option value="active">Active</option>
            <option value="invited">Invited (waiting for the Clerk)</option>
            <option value="setup">Setting up</option>
            <option value="suspended">Suspended</option>
            <option value="archived">Archived</option>
            <option value="unverified">Email not confirmed</option>
            <option value="admins">Admins</option>
          </select>
        </label>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data.results.length ? (
        <p className="muted">No one matches.</p>
      ) : (
        <>
          <p className="muted">{data.count} {data.count === 1 ? 'person' : 'people'}</p>
          <ul className="manage__list">
            {data.results.map((u) => (
              <li key={u.id}>
                <div>
                  <strong>{u.full_name}</strong> <PersonBadges u={u} />
                  <div className="muted">@{u.username} · {u.email || 'no email'} · {u.church_count} {u.church_count === 1 ? 'church' : 'churches'} · joined {formatDate(u.date_joined)}</div>
                </div>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => go({ tab: 'people', status, user: u.id })}>
                  Roles &amp; account
                </button>
              </li>
            ))}
          </ul>
          <Pagination page={page} count={data.count} onPage={setPage} />
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ churches */
function ChurchDetail({ slug, onBack, go }) {
  const church = useApi(P(`/churches/${slug}/`))
  const members = useApi(P(`/memberships/${qs({ church: slug })}`))
  const [, setFlash, flashEl] = useFlash()
  const confirm = useConfirm()
  const [newRole, setNewRole] = useState('clerk')
  const [busy, setBusy] = useState(false)

  async function run(fn, success) {
    setBusy(true)
    setFlash(null)
    try {
      await fn()
      setFlash({ kind: 'success', text: success })
      church.reload()
      members.reload()
    } catch (err) {
      setFlash({ kind: 'error', text: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  if (church.loading && !church.data) return <Loading />
  if (church.error) return <ErrorState error={church.error} onRetry={church.reload} />
  const c = church.data
  const list = members.data?.results || []

  return (
    <div className="admin-detail">
      <button type="button" className="linklike" onClick={onBack}>← All churches</button>
      <div className="card card--gold">
        <div className="section-head">
          <div>
            <h2>{c.name}</h2>
            <div className="muted">{[c.town, c.country].filter(Boolean).join(', ')} · <Link to={`/c/${c.slug}`}>/c/{c.slug}</Link></div>
            <div className="badge-row">
              <span className={c.is_active ? 'badge' : 'badge badge--live'}>{CHURCH_STATUS[c.status] || (c.is_active ? 'Active' : 'Suspended')}</span>
              {c.clerks.length === 0 && <span className="badge badge--live">No Clerk</span>}
            </div>
          </div>
          <div className="manage__actions">
            {c.is_active ? (
              <button type="button" className="btn btn--danger btn--sm" disabled={busy}
                onClick={async () => await confirm({ title: `Suspend ${c.name}?`, message: 'Its pages are hidden from everyone until you reactivate it.', confirmLabel: 'Suspend church', tone: 'danger' })
                  && run(() => api(P(`/churches/${c.slug}/`), { method: 'PATCH', body: { is_active: false } }), `${c.name} is suspended and hidden.`)}>
                Suspend church
              </button>
            ) : (
              <button type="button" className="btn btn--sm" disabled={busy}
                onClick={() => run(() => api(P(`/churches/${c.slug}/`), { method: 'PATCH', body: { is_active: true } }), `${c.name} is visible again.`)}>
                Reactivate church
              </button>
            )}
          </div>
        </div>
        {flashEl}

        <div className="admin-add">
          <h3>Add someone</h3>
          <div className="admin-add__row">
            <div className="field">
              <label htmlFor="church-add-role">As</label>
              <select id="church-add-role" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <SearchPick label="Person" endpoint={P('/users/')} placeholder="Type a name, username or email"
              exclude={list.map((m) => m.user)}
              describe={(u) => <>{u.full_name} <span className="muted">@{u.username} · {u.email}{!u.is_active && ' · suspended'}</span></>}
              onPick={(u) => run(() => api(P('/memberships/'), { method: 'POST', body: { user: u.id, church: c.slug, role: newRole } }),
                `${u.full_name} was added as ${ROLES[newRole]}.`)} />
          </div>
        </div>

        <h3>People ({c.member_count})</h3>
        {members.loading && !members.data ? <Loading /> : members.error ? <ErrorState error={members.error} onRetry={members.reload} />
          : list.length === 0 ? <p className="muted">No one has joined yet.</p> : (
            <>
              <ul className="manage__list">
                {list.map((m) => (
                  <li key={m.id}>
                    <div>
                      {m.user
                        ? <button type="button" className="linklike" onClick={() => go({ tab: 'people', user: m.user })}>{m.full_name}</button>
                        : <><strong>{m.full_name}</strong> <span className="badge badge--draft">No account</span></>}
                      <div className="muted">{[m.username && `@${m.username}`, m.email].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div className="manage__row-actions">
                      <RoleSelect value={m.role} label={`Role for ${m.full_name}`} disabled={busy}
                        onChange={(role) => run(() => api(P(`/memberships/${m.id}/`), { method: 'PATCH', body: { role } }), `${m.full_name} is now ${ROLES[role]}.`)} />
                      <button type="button" className="btn btn--danger btn--sm" disabled={busy}
                        onClick={async () => await confirm({ title: `Remove ${m.full_name}?`, message: `They will lose their role at ${c.name}.`, confirmLabel: 'Remove', tone: 'danger' })
                          && run(() => api(P(`/memberships/${m.id}/`), { method: 'DELETE' }), `${m.full_name} was removed.`)}>Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
              {members.data.count > list.length && <p className="muted">Showing the first {list.length}. Search by name under People to find others.</p>}
            </>
          )}
      </div>
    </div>
  )
}

function Churches({ params, go }) {
  const status = params.get('status') || ''
  const slug = params.get('church')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const term = useDebounced(q.trim())
  const { data, error, loading, reload } = useApi(slug ? null : P(`/churches/${qs({ q: term, status, page })}`))

  if (slug) return <ChurchDetail key={slug} slug={slug} go={go} onBack={() => go({ tab: 'churches', status })} />

  return (
    <div>
      <div className="toolbar">
        <label className="toolbar__search">
          <span className="visually-hidden">Search churches</span>
          <input type="search" placeholder="Search by name, town or address" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </label>
        <label className="toolbar__select">
          <span className="visually-hidden">Show</span>
          <select value={status} onChange={(e) => { go({ tab: 'churches', status: e.target.value }); setPage(1) }}>
            <option value="">All churches</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data.results.length ? (
        <p className="muted">No churches match.</p>
      ) : (
        <>
          <ul className="manage__list">
            {data.results.map((c) => (
              <li key={c.id}>
                <div>
                  <strong>{c.name}</strong>{' '}
                  {c.status !== 'active' && <span className={c.is_active ? 'badge badge--gold' : 'badge badge--live'}>{CHURCH_STATUS[c.status]}</span>}
                  {c.clerks.length === 0 && <span className="badge badge--live">No Clerk</span>}
                  <div className="muted">
                    {c.slug} · {c.town || '—'} · {c.member_count} {c.member_count === 1 ? 'person' : 'people'}
                    {c.clerks.length > 0 && ` · Clerk: ${c.clerks.map((k) => k.name).join(', ')}`} · since {formatDate(c.created_at)}
                  </div>
                </div>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => go({ tab: 'churches', status, church: c.slug })}>
                  People &amp; status
                </button>
              </li>
            ))}
          </ul>
          <Pagination page={page} count={data.count} onPage={setPage} />
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ onboarding requests */
const REQUEST_BADGE = { pending: ['badge badge--gold', 'Pending'], approved: ['badge', 'Approved'], rejected: ['badge badge--draft', 'Declined'] }
const CHURCH_STATUS = { invited: 'Invited', setup: 'Setting up', active: 'Active', suspended: 'Suspended', archived: 'Archived' }

function RequestCard({ r, onChanged }) {
  const [open, setOpen] = useState(r.status === 'pending')
  const [subdomain, setSubdomain] = useState(r.suggested_subdomain)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [, setFlash, flashEl] = useFlash()
  const confirm = useConfirm()
  const wanted = useDebounced(subdomain.trim().toLowerCase())
  const { data: check } = useApi(r.status === 'pending' && wanted ? `/api/v1/onboarding/subdomain/${qs({ name: wanted })}` : null, { auth: false })
  const taken = check && check.name === wanted && !check.available
  const [cls, label] = REQUEST_BADGE[r.status]

  async function act(action, body, success) {
    setBusy(true)
    setFlash(null)
    try {
      const res = await api(P(`/onboarding/${r.id}/${action}/`), { method: 'POST', body })
      setFlash({ kind: res.email_sent === false ? 'error' : 'success', text: res.email_sent === false ? 'Saved, but the email could not be sent. Use “Resend invitation”.' : success })
      onChanged()
    } catch (err) {
      setFlash({ kind: 'error', text: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="onb">
      {flashEl}
      <div className="onb__head">
        <div>
          <strong>{r.church_name}</strong> <span className={cls}>{label}</span>
          <div className="muted">
            {[r.town, r.country].filter(Boolean).join(', ')}{r.estimated_members != null && ` · ~${r.estimated_members} members`} · asked {formatDate(r.created_at)}
          </div>
          <div className="muted">{r.contact_name} · <a href={`mailto:${r.contact_email}`}>{r.contact_email}</a>{r.contact_phone && ` · ${r.contact_phone}`}</div>
        </div>
        <button type="button" className="btn btn--outline btn--sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Details'}</button>
      </div>
      {open && (
        <div className="onb__body">
          {r.message && <p className="query-list__text">{r.message}</p>}
          {r.status === 'pending' && (
            <>
              <div className="field">
                <label htmlFor={`sd-${r.id}`}>Subdomain</label>
                <input id={`sd-${r.id}`} value={subdomain} onChange={(e) => setSubdomain(e.target.value.toLowerCase())} maxLength={60} />
                <span className={`hint${taken ? ' field-error' : ''}`}>{taken ? check.reason : <>Will live at <strong>{churchAddress(subdomain || '…')}</strong></>}</span>
              </div>
              <div className="field">
                <label htmlFor={`nt-${r.id}`}>Note <span className="muted">(shown to the applicant if you decline)</span></label>
                <input id={`nt-${r.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
              </div>
              <div className="manage__actions">
                <button type="button" className="btn" disabled={busy || taken || !subdomain.trim()}
                  onClick={() => act('approve', { subdomain: subdomain.trim(), note }, 'Approved. The invitation was emailed to the first Clerk.')}>
                  Approve &amp; invite
                </button>
                <button type="button" className="btn btn--outline" disabled={busy}
                  onClick={async () => await confirm({ title: `Decline ${r.church_name}?`, message: 'They will be emailed, with your note if you wrote one.', confirmLabel: 'Decline request', tone: 'danger' }) && act('decline', { note }, 'Declined.')}>
                  Decline
                </button>
              </div>
            </>
          )}
          {r.church && (
            <p>
              Church: <button type="button" className="linklike" onClick={() => onChanged({ church: r.church.slug })}>{r.church.name}</button>{' '}
              <span className="badge">{CHURCH_STATUS[r.church.status]}</span> · <span className="muted">{churchAddress(r.church.slug)}</span>
              {r.invitation && (
                <>
                  <br />Invitation to {r.invitation.email}: <strong>{r.invitation.state}</strong>
                  {r.invitation.last_sent_at && <span className="muted"> · sent {formatDate(r.invitation.last_sent_at)}</span>}
                  {r.invitation.state === 'open' && (
                    <> · <button type="button" className="linklike" disabled={busy} onClick={() => act('resend-invitation', {}, 'A new invitation was emailed.')}>Resend invitation</button></>
                  )}
                </>
              )}
            </p>
          )}
          {r.status === 'rejected' && r.decision_note && <p className="muted">Note sent: {r.decision_note}</p>}
          {r.reviewed_by && <p className="muted">Reviewed by {r.reviewed_by}{r.reviewed_at && ` on ${formatDate(r.reviewed_at)}`}</p>}
        </div>
      )}
    </li>
  )
}

function Onboarding({ params, go }) {
  const status = params.get('status') ?? 'pending'
  const [page, setPage] = useState(1)
  const { data, error, loading, reload } = useApi(P(`/onboarding/${qs({ status: status === 'all' ? '' : status, page })}`))
  return (
    <div>
      <div className="toolbar">
        <label className="toolbar__select">
          <span className="visually-hidden">Show</span>
          <select value={status} onChange={(e) => { go({ tab: 'onboarding', status: e.target.value }); setPage(1) }}>
            <option value="pending">Waiting for review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Declined</option>
            <option value="all">All requests</option>
          </select>
        </label>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data.results.length ? (
        <p className="muted">{status === 'pending' ? 'No requests are waiting.' : 'No requests here.'}</p>
      ) : (
        <>
          <ul className="manage__list onb-list">
            {data.results.map((r) => <RequestCard key={r.id} r={r} onChanged={(next) => (next ? go({ tab: 'churches', ...next }) : reload())} />)}
          </ul>
          <Pagination page={page} count={data.count} onPage={setPage} />
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ page */
const TABS = [
  { key: 'overview', label: 'Overview', Panel: Overview },
  { key: 'people', label: 'People & roles', Panel: People },
  { key: 'churches', label: 'Churches', Panel: Churches },
  { key: 'onboarding', label: 'Onboarding', Panel: Onboarding },
]

export default function AdminDashboard() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.key === params.get('tab')) || TABS[0]
  // Drop empty values so URLs stay tidy (?tab=people&status=suspended).
  const go = (next) => setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v !== '' && v != null)))

  return (
    <section className="section">
      <div className="container">
        <div className="eyebrow">Platform admin</div>
        <h1>Admin dashboard</h1>
        <p className="muted">
          Signed in as {user.full_name} ({ACCOUNT_LABEL[user.account_type]}).
          {user.account_type === 'system_admin' && <> System settings are in the <a href={DJANGO_ADMIN_URL}>Django admin</a>.</>}
        </p>
        <div className="tabs" role="tablist" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab.key === t.key} onClick={() => go({ tab: t.key })}>{t.label}</button>
          ))}
        </div>
        <tab.Panel params={params} go={go} />
      </div>
    </section>
  )
}
