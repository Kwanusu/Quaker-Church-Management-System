import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, qs } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ErrorState, Loading, Pagination } from '../components/States'
import { DEPARTMENT_ROLES, ROLES } from '../config'
import { formatDate } from '../format'
import { useApi, useDebounced } from '../hooks/useApi'
import { useChurch } from './ChurchContext'
import FlashToast from '../components/FlashToast'
import { useConfirm } from '../components/confirmContext'

/* ==========================================================================
   Member register (Manage → Members). The Clerk adds anyone — with or without
   an account, with or without a church role — and puts them in departments.
   ========================================================================== */
function MemberForm({ initial, departments, onSaved, onCancel }) {
  const { api: path } = useChurch()
  const editing = Boolean(initial)
  const linked = Boolean(initial?.has_account)
  const [form, setForm] = useState(() => ({
    first_name: initial?.first_name ?? '',
    last_name: initial?.last_name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    role: '',
    department_ids: [],
  }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }))
  const toggleDept = (id) => setForm((f) => ({
    ...f, department_ids: f.department_ids.includes(id) ? f.department_ids.filter((x) => x !== id) : [...f.department_ids, id],
  }))

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    let body
    if (linked) body = { phone: form.phone }
    else if (editing) body = { first_name: form.first_name, last_name: form.last_name, email: form.email, phone: form.phone }
    else body = { ...form, role: form.role || undefined }
    try {
      const saved = await api(path(editing ? `/members/${initial.id}/` : '/members/'), { method: editing ? 'PATCH' : 'POST', body })
      onSaved(saved, editing)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card card--gold form manage__editor" onSubmit={onSubmit}>
      <h2>{editing ? `Edit ${initial.full_name}` : 'Add a member'}</h2>
      {!editing && (
        <p className="muted">
          Add anyone in your church, even if they don’t use this website. If you give an email address, they’re
          invited to create an account; when they do, they’re linked to this record automatically.
        </p>
      )}
      {linked && <p className="muted">{initial.full_name} has an account, so their name and email come from it. You can keep a phone number here.</p>}
      <FlashToast kind="error" text={error} />
      <div className="form-row">
        {!linked && (
          <>
            <div className="field">
              <label htmlFor="m-first">First name<span aria-hidden="true"> *</span></label>
              <input id="m-first" value={form.first_name} onChange={set('first_name')} required maxLength={150} autoComplete="off" />
              <span className="error-msg">Enter their first name.</span>
            </div>
            <div className="field">
              <label htmlFor="m-last">Last name</label>
              <input id="m-last" value={form.last_name} onChange={set('last_name')} maxLength={150} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="m-email">Email</label>
              <span className="hint">Optional. Used to invite them and link their account.</span>
              <input id="m-email" type="email" value={form.email} onChange={set('email')} autoComplete="off" />
              <span className="error-msg">Enter a full email address, or leave it empty.</span>
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor="m-phone">Phone</label>
          <span className="hint">Optional.</span>
          <input id="m-phone" type="tel" value={form.phone} onChange={set('phone')} maxLength={30} autoComplete="off" />
        </div>
        {!editing && (
          <div className="field">
            <label htmlFor="m-role">Church role</label>
            <span className="hint">Optional. Leave as it is for an ordinary member.</span>
            <select id="m-role" value={form.role} onChange={set('role')}>
              <option value="">Member (no special role)</option>
              {Object.entries(ROLES).filter(([v]) => v !== 'member').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}
      </div>
      {!editing && departments.length > 0 && (
        <fieldset className="fieldset">
          <legend>Departments (optional)</legend>
          <div className="check-grid">
            {departments.map((d) => (
              <label key={d.id} className="check">
                <input type="checkbox" checked={form.department_ids.includes(d.id)} onChange={() => toggleDept(d.id)} /> {d.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="manage__actions">
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save' : 'Add to register'}</button>
        <button type="button" className="btn btn--outline" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export function MembersPanel() {
  const confirm = useConfirm()
  const { api: path, isClerk, base } = useChurch()
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [dept, setDept] = useState('')
  const [page, setPage] = useState(1)
  const term = useDebounced(q.trim())
  const { data, error, loading, reload } = useApi(path(`/members/${qs({ q: term, role, department: dept, page })}`))
  const { data: departments } = useApi(path('/departments/'))
  const [editing, setEditing] = useState(null) // null | 'new' | member
  const [flash, setFlash] = useState({ kind: '', text: '' })

  async function run(fn, success) {
    setFlash({ kind: '', text: '' })
    try {
      const res = await fn()
      setFlash({ kind: 'success', text: typeof success === 'function' ? success(res) : success })
      reload()
    } catch (err) {
      setFlash({ kind: 'error', text: err.message })
    }
  }

  if (editing) {
    return (
      <MemberForm initial={editing === 'new' ? null : editing} departments={departments || []}
        onCancel={() => setEditing(null)}
        onSaved={(m, wasEditing) => {
          setEditing(null)
          reload()
          setFlash({
            kind: 'success',
            text: wasEditing ? 'Changes saved.'
              : m.has_account ? `${m.full_name} was added and linked to their account.`
                : m.email ? `${m.full_name} was added. We emailed ${m.email} an invitation to create an account.`
                  : `${m.full_name} was added to the register.`,
          })
        }} />
    )
  }

  return (
    <div>
      <div className="section-head">
        <h2>Member register</h2>
        {isClerk && <button type="button" className="btn btn--gold btn--sm" onClick={() => setEditing('new')}>+ Add member</button>}
      </div>
      <p className="muted">
        Everyone in your church, with or without an account. {isClerk ? 'Give people a church role here; department roles are set on each department’s page.' : 'Only the Clerk can change the register.'}
      </p>
      <div className="toolbar">
        <label className="toolbar__search">
          <span className="visually-hidden">Search members</span>
          <input type="search" placeholder="Search by name, phone or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </label>
        <label className="toolbar__select">
          <span className="visually-hidden">Church role</span>
          <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1) }}>
            <option value="">All roles</option>
            {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="toolbar__select">
          <span className="visually-hidden">Department</span>
          <select value={dept} onChange={(e) => { setDept(e.target.value); setPage(1) }}>
            <option value="">All departments</option>
            {(departments || []).map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
          </select>
        </label>
      </div>
      <FlashToast flash={flash} />
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data.results.length ? (
        <p className="muted">{term || role || dept ? 'No one matches.' : 'No one on the register yet.'}</p>
      ) : (
        <>
          <p className="muted">{data.count} {data.count === 1 ? 'person' : 'people'}</p>
          <ul className="manage__list">
            {data.results.map((m) => (
              <li key={m.id}>
                <div>
                  <strong>{m.full_name}</strong>{' '}
                  {m.user_id === user.id && <span className="badge">You</span>}
                  {!m.has_account && (m.invited_at
                    ? <span className="badge badge--draft" title={`Invited ${formatDate(m.invited_at)}`}>Invited</span>
                    : <span className="badge badge--draft">No account</span>)}
                  {!isClerk && <span className="badge badge--gold">{ROLES[m.role]}</span>}
                  <div className="muted">
                    {[m.phone, m.email, `added ${formatDate(m.joined_at)}`].filter(Boolean).join(' · ')}
                  </div>
                  {m.departments.length > 0 && (
                    <div className="chips">
                      {m.departments.map((d) => (
                        <Link key={d.id} to={`${base}/departments/${d.slug}`} className="chip">
                          {d.name}{d.role !== 'member' && ` · ${DEPARTMENT_ROLES[d.role]}`}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                {isClerk && (
                  <div className="manage__row-actions">
                    <label>
                      <span className="visually-hidden">Church role for {m.full_name}</span>
                      <select value={m.role} onChange={(e) => run(() => api(path(`/members/${m.id}/`), { method: 'PATCH', body: { role: e.target.value } }),
                        `${m.full_name} is now ${ROLES[e.target.value]}.`)}>
                        {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </label>
                    <button type="button" className="btn btn--outline btn--sm" onClick={() => setEditing(m)}>Edit</button>
                    {!m.has_account && m.email && (
                      <button type="button" className="btn btn--outline btn--sm"
                        onClick={() => run(() => api(path(`/members/${m.id}/invite/`), { method: 'POST' }), (r) => r.detail)}>
                        {m.invited_at ? 'Resend invite' : 'Invite'}
                      </button>
                    )}
                    <button type="button" className="btn btn--danger btn--sm"
                      onClick={async () => await confirm({ title: `Remove ${m.full_name}?`, message: 'They come off the member register and out of every department.', confirmLabel: 'Remove', tone: 'danger' })
                        && run(() => api(path(`/members/${m.id}/`), { method: 'DELETE' }), `${m.full_name} was removed.`)}>
                      Remove
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={page} count={data.count} onPage={setPage} />
        </>
      )}
    </div>
  )
}

/* ==========================================================================
   Departments (Manage → Departments): the Clerk adds, renames and removes them.
   People are managed on each department's own page.
   ========================================================================== */
function DepartmentForm({ initial, onSaved, onCancel }) {
  const { api: path } = useChurch()
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const saved = await api(path(initial ? `/departments/${initial.slug}/` : '/departments/'),
        { method: initial ? 'PATCH' : 'POST', body: { name, description } })
      onSaved(saved, Boolean(initial))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card card--gold form manage__editor" onSubmit={onSubmit}>
      <h2>{initial ? `Edit ${initial.name}` : 'New department'}</h2>
      <FlashToast kind="error" text={error} />
      <div className="form-row">
        <div className="field">
          <label htmlFor="d-name">Name<span aria-hidden="true"> *</span></label>
          <input id="d-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          <span className="error-msg">Give the department a name.</span>
        </div>
        <div className="field">
          <label htmlFor="d-desc">Description</label>
          <input id="d-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={255} />
        </div>
      </div>
      <div className="manage__actions">
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn btn--outline" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export function DepartmentsPanel() {
  const confirm = useConfirm()
  const { api: path, base } = useChurch()
  const { data, error, loading, reload } = useApi(path('/departments/'))
  const [editing, setEditing] = useState(null) // null | 'new' | department
  const [flash, setFlash] = useState({ kind: '', text: '' })

  async function remove(d) {
    if (!(await confirm({ title: `Remove ${d.name}?`, message: 'Its member list and chat room are deleted. Events stay on the calendar.', confirmLabel: 'Remove department', tone: 'danger' }))) return
    try {
      await api(path(`/departments/${d.slug}/`), { method: 'DELETE' })
      setFlash({ kind: 'success', text: `${d.name} was removed.` })
      reload()
    } catch (err) {
      setFlash({ kind: 'error', text: err.message })
    }
  }

  if (editing) {
    return (
      <DepartmentForm initial={editing === 'new' ? null : editing} onCancel={() => setEditing(null)}
        onSaved={(d, wasEditing) => { setEditing(null); setFlash({ kind: 'success', text: wasEditing ? 'Changes saved.' : `${d.name} was added.` }); reload() }} />
    )
  }

  return (
    <div>
      <div className="section-head">
        <h2>Departments</h2>
        <button type="button" className="btn btn--gold btn--sm" onClick={() => setEditing('new')}>+ Add department</button>
      </div>
      <p className="muted">
        Every church has the five standard departments; you can rename them and add your own. Open a department to add
        people and appoint its officials (Chairperson, Vice Chairperson, Secretary, Treasurer), who can then manage it too.
      </p>
      <FlashToast flash={flash} />
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
        <ul className="manage__list">
          {data.map((d) => (
            <li key={d.id}>
              <div>
                <strong>{d.name}</strong> {!d.is_standard && <span className="badge">Added by you</span>}
                <div className="muted">
                  {d.member_count} {d.member_count === 1 ? 'person' : 'people'}
                  {d.officials.length > 0 && ` · ${d.officials.map((o) => `${o.role_label}: ${o.name}`).join(', ')}`}
                </div>
              </div>
              <div className="manage__row-actions">
                <Link to={`${base}/departments/${d.slug}`} className="btn btn--gold btn--sm">People</Link>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setEditing(d)}>Rename</button>
                {!d.is_standard && <button type="button" className="btn btn--danger btn--sm" onClick={() => remove(d)}>Remove</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
