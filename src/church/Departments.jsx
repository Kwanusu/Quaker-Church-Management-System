import { useId, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, qs } from '../api/client'
import EventCard from '../components/EventCard'
import { ErrorState, Loading } from '../components/States'
import { DEPARTMENT_ROLES, LEADERSHIP_ROLES, ROLES } from '../config'
import { useApi, useDebounced } from '../hooks/useApi'
import NotFound from '../pages/NotFound'
import { useChurch } from './ChurchContext'
import FlashToast from '../components/FlashToast'
import { useConfirm } from '../components/confirmContext'
import { useToast } from '../components/toastContext'

/* ------------------------------------------------------------ all departments */
export function Departments() {
  const { church, api: path, base } = useChurch()
  const { data, error, loading, reload } = useApi(path('/departments/'))
  return (
    <section className="section">
      <div className="container">
        <div className="eyebrow">{church.name}</div>
        <h1>Departments</h1>
        <p className="muted">The ministries and offices of our meeting. Their officials look after each one.</p>
        {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
          <div className="dept-grid">
            {data.map((d) => (
              <Link key={d.id} to={`${base}/departments/${d.slug}`} className="card card--link dept-card">
                <h2>{d.name}</h2>
                {d.my_role && <span className="badge badge--gold">You: {DEPARTMENT_ROLES[d.my_role]}</span>}
                {d.description && <p className="muted">{d.description}</p>}
                {d.officials.length > 0 && (
                  <ul className="dept-card__officials">
                    {d.officials.map((o) => <li key={o.role}><span>{o.role_label}</span> {o.name}</li>)}
                  </ul>
                )}
                <p className="dept-card__count">{d.member_count} {d.member_count === 1 ? 'person' : 'people'}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ one department */
function AddPerson({ dept, onAdded }) {
  const { api: path } = useChurch()
  const id = useId()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('member')
  const toast = useToast()
  const term = useDebounced(q.trim())
  const { data, loading } = useApi(term ? path(`/departments/${dept.slug}/members/candidates/${qs({ q: term })}`) : null)

  async function add(c) {
    try {
      await api(path(`/departments/${dept.slug}/members/`), { method: 'POST', body: { membership: c.id, role } })
      setQ('')
      onAdded(`${c.full_name} was added${role !== 'member' ? ` as ${DEPARTMENT_ROLES[role]}` : ''}.`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="admin-add">
      <h3>Add someone from the member register</h3>
      <div className="admin-add__row">
        <div className="field">
          <label htmlFor={`${id}-role`}>As</label>
          <select id={`${id}-role`} value={role} onChange={(e) => setRole(e.target.value)}>
            {Object.entries(DEPARTMENT_ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field picker">
          <label htmlFor={id}>Person</label>
          <input id={id} type="search" value={q} autoComplete="off" placeholder="Type a name or phone number"
            onChange={(e) => setQ(e.target.value)} />
          {term && q.trim() && (
            <ul className="picker__results" aria-live="polite">
              {loading && !data ? <li className="muted">Searching…</li>
                : !data?.length ? <li className="muted">No one else matches. The Clerk adds new people to the register.</li>
                  : data.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => add(c)}>
                        {c.full_name} <span className="muted">{[ROLES[c.church_role], c.phone, !c.has_account && 'no account'].filter(Boolean).join(' · ')}</span>
                      </button>
                    </li>
                  ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function DepartmentPeople({ dept }) {
  const { api: path } = useChurch()
  const { data, error, loading, reload } = useApi(path(`/departments/${dept.slug}/members/`))
  const [flash, setFlash] = useState({ kind: '', text: '' })
  const confirm = useConfirm()
  const manage = dept.can_manage

  async function run(fn, success) {
    setFlash({ kind: '', text: '' })
    try {
      await fn()
      setFlash({ kind: 'success', text: success })
      reload()
    } catch (err) {
      setFlash({ kind: 'error', text: err.message })
    }
  }

  return (
    <div className="card">
      <div className="section-head">
        <h2>People ({data?.length ?? dept.member_count})</h2>
      </div>
      <FlashToast flash={flash} />
      {manage && <AddPerson dept={dept} onAdded={(text) => { setFlash({ kind: 'success', text }); reload() }} />}
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data.length ? (
        <p className="muted">No one yet.</p>
      ) : (
        <ul className="manage__list">
          {data.map((p) => (
            <li key={p.id}>
              <div>
                <strong>{p.full_name}</strong>{' '}
                {p.role !== 'member' && !manage && <span className="badge badge--gold">{DEPARTMENT_ROLES[p.role]}</span>}
                {!p.has_account && <span className="badge badge--draft">No account</span>}
                {manage && (p.phone || p.email) && <div className="muted">{[p.phone, p.email].filter(Boolean).join(' · ')}</div>}
              </div>
              {manage && (
                <div className="manage__row-actions">
                  <label>
                    <span className="visually-hidden">Role of {p.full_name} in {dept.name}</span>
                    <select value={p.role} onChange={(e) => run(() => api(path(`/departments/${dept.slug}/members/${p.id}/`),
                      { method: 'PATCH', body: { role: e.target.value } }), `${p.full_name} is now ${DEPARTMENT_ROLES[e.target.value]}.`)}>
                      {Object.entries(DEPARTMENT_ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                  <button type="button" className="btn btn--danger btn--sm"
                    onClick={async () => await confirm({ title: `Remove ${p.full_name}?`, message: `They will leave ${dept.name}. They stay on the church register.`, confirmLabel: 'Remove', tone: 'danger' })
                      && run(() => api(path(`/departments/${dept.slug}/members/${p.id}/`), { method: 'DELETE' }), `${p.full_name} was removed.`)}>
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function DepartmentPage() {
  const { dept: slug } = useParams()
  const { church, api: path, base, role } = useChurch()
  const { data: dept, error, loading, reload } = useApi(path(`/departments/${slug}/`))
  const events = useApi(path(`/schedules/upcoming/${qs({ department: slug })}`))

  if (error?.status === 404) return <NotFound />
  if (loading && !dept) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const canSeePeople = Boolean(dept.my_role) || LEADERSHIP_ROLES.includes(role)

  return (
    <section className="section">
      <div className="container">
        <p><Link to={`${base}/departments`} className="linklike">← All departments</Link></p>
        <div className="eyebrow">{church.name} · Department</div>
        <h1>{dept.name}</h1>
        {dept.description && <p className="lead">{dept.description}</p>}
        <div className="dept-head">
          {dept.my_role && <span className="badge badge--gold">You: {DEPARTMENT_ROLES[dept.my_role]}</span>}
          {dept.can_manage && <span className="badge">You can manage this department</span>}
          {dept.room && <Link to={`${base}/fellowship?room=${dept.room}`} className="btn btn--sm">💬 {dept.name} messages</Link>}
        </div>

        <div className="dept-layout">
          <div className="dept-layout__main">
            {canSeePeople ? <DepartmentPeople dept={dept} /> : (
              <div className="card">
                <h2>Officials</h2>
                {dept.officials.length ? (
                  <ul className="plain-list">
                    {dept.officials.map((o) => <li key={o.role}><span>{o.role_label}</span><strong>{o.name}</strong></li>)}
                  </ul>
                ) : <p className="muted">No officials listed yet.</p>}
                <p className="muted">To join {dept.name}, speak to one of its officials or the Clerk.</p>
              </div>
            )}
          </div>
          <div className="dept-layout__side">
            <h2>Coming up</h2>
            {events.loading && !events.data ? <Loading /> : !events.data?.length ? (
              <p className="muted">No {dept.name} events planned.</p>
            ) : events.data.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        </div>
      </div>
    </section>
  )
}
