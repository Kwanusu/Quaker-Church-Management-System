import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, qs } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ErrorState, Loading, Pagination } from '../components/States'
import { EVENT_TYPES, mediaUrl, SONG_TYPES } from '../config'
import { formatDate, formatTimeRange, formatWeek, fromLocalInput, toLocalInput } from '../format'
import { useApi, useDebounced } from '../hooks/useApi'
import { useChurch } from './ChurchContext'
import HymnImport from './HymnImport'
import { DepartmentsPanel, MembersPanel } from './People'
import StreamingSetup from './StreamingSetup'
import FlashToast from '../components/FlashToast'
import { useConfirm } from '../components/confirmContext'
import { useToast } from '../components/toastContext'
import PublishBanner from './PublishBanner'

/* --------------------------------------------------------------------------
   Resource definitions: one generic editor drives hymn books, songs, queries
   and events. `roles` mirrors the backend permissions so nobody sees a form
   that would be refused.
   -------------------------------------------------------------------------- */
const RESOURCES = {
  hymnbooks: {
    label: 'Hymn books',
    singular: 'hymn book',
    path: '/hymnbooks/',
    roles: ['recording_clerk', 'clerk'],
    empty: { title: '', language: 'English', description: '', position: 0 },
    fields: [
      { name: 'title', label: 'Title', required: true, maxLength: 150, error: 'Please give the book a title.' },
      { name: 'language', label: 'Language', maxLength: 40 },
      { name: 'position', label: 'Order', type: 'number', min: 0, hint: 'Lower numbers are listed first.' },
      { name: 'description', label: 'Description', type: 'textarea', wide: true },
    ],
    summary: (b) => ({ title: b.title, meta: `${b.language || ''} · ${b.song_count} songs`, badge: b.shared && 'Shared' }),
    importable: true, // bulk "Import songs" from a spreadsheet or pasted text
    deleteWarning: (b) => `Delete “${b.title}” and all ${b.song_count} songs in it? This cannot be undone.`,
  },
  songs: {
    label: 'Songs',
    singular: 'song',
    path: '/songs/',
    roles: ['recording_clerk', 'clerk'],
    searchable: true,
    empty: { book: '', number: '', title: '', english_title: '', author: '', song_type: 'hymn', lyrics: '' },
    fields: [
      { name: 'book', label: 'Hymn book', type: 'select', required: true, options: (ctx) => ctx.books, error: 'Choose a hymn book.' },
      { name: 'number', label: 'Number', type: 'number', required: true, min: 1, error: 'A positive number is required.' },
      { name: 'title', label: 'Title', required: true, maxLength: 255, error: 'Please give a title.' },
      { name: 'english_title', label: 'English title', maxLength: 255 },
      { name: 'author', label: 'Author', maxLength: 255 },
      { name: 'song_type', label: 'Type', type: 'select', options: () => SONG_TYPES },
      { name: 'lyrics', label: 'Words', type: 'textarea', required: true, wide: true, error: 'Please add the words.' },
    ],
    // List rows have no lyrics; fetch the full song before editing.
    loadForEdit: true,
    summary: (s) => ({ title: `${s.number}. ${s.title}`, meta: [s.book_title, SONG_TYPES[s.song_type], s.author].filter(Boolean).join(' · '), badge: s.shared && 'Shared' }),
  },
  queries: {
    label: 'Weekly queries',
    singular: 'query',
    path: '/queries/',
    roles: ['clerk'],
    empty: { title: '', week_starting: '', text: '', is_active: false },
    fields: [
      { name: 'title', label: 'Title', required: true, maxLength: 255, error: 'Please give a title.' },
      { name: 'week_starting', label: 'Week starting', type: 'date', required: true, error: 'Choose the first day of the week.' },
      { name: 'text', label: 'Query', type: 'textarea', required: true, wide: true, error: 'Please write the query.' },
      { name: 'is_active', label: 'Make this the active query (replaces the current one)', type: 'checkbox' },
    ],
    summary: (q) => ({ title: q.title, meta: `Week of ${formatWeek(q.week_starting)}`, badge: q.is_active && 'Active' }),
  },
  schedules: {
    label: 'Worship & events',
    singular: 'event',
    path: '/schedules/',
    roles: ['clerk'],
    empty: { title: '', event_type: 'worship', department: '', start_time: '', end_time: '', location: '', description: '', is_hybrid: true, youtube_url: '', is_published: false },
    fields: [
      { name: 'title', label: 'Title', required: true, maxLength: 255, error: 'Please give a title.' },
      { name: 'event_type', label: 'Type', type: 'select', options: () => EVENT_TYPES },
      {
        name: 'department', label: 'Department', type: 'select',
        hint: 'Optional: e.g. a USFW meeting or Sunday Church School.',
        options: (ctx) => [['', 'Whole church'], ...ctx.departments.map((d) => [d.id, d.name])],
      },
      { name: 'start_time', label: 'Starts', type: 'datetime-local', required: true, error: 'Choose a start time.' },
      { name: 'end_time', label: 'Ends', type: 'datetime-local', required: true, error: 'Choose an end time.' },
      { name: 'location', label: 'Location', maxLength: 255 },
      {
        name: 'youtube_url', label: 'YouTube link', type: 'url',
        hint: 'Optional. Paste the video or live link. Leave empty to show your channel’s live stream (set in Church settings).',
        error: 'Enter a full YouTube address starting with https://',
      },
      { name: 'description', label: 'Description', type: 'textarea', wide: true },
      { name: 'is_hybrid', label: 'Streamed online', type: 'checkbox' },
      { name: 'is_published', label: 'Published (visible to everyone)', type: 'checkbox' },
    ],
    toForm: (e) => ({ ...e, department: e.department ?? '', start_time: toLocalInput(e.start_time), end_time: toLocalInput(e.end_time) }),
    toApi: (f) => ({ ...f, department: f.department || null, start_time: fromLocalInput(f.start_time), end_time: fromLocalInput(f.end_time) }),
    summary: (e) => ({
      title: e.title,
      meta: [`${formatDate(e.start_time)}, ${formatTimeRange(e.start_time, e.end_time)}`, e.department_name].filter(Boolean).join(' · '),
      badge: e.is_published ? null : 'Draft',
    }),
  },
}

function Field({ field, value, onChange, ctx }) {
  const id = `f-${field.name}`
  const common = { id, name: field.name, required: field.required, 'aria-describedby': field.hint ? `${id}-hint` : undefined }
  if (field.type === 'checkbox') {
    return (
      <label className="check" style={{ gridColumn: '1 / -1' }}>
        <input type="checkbox" {...common} checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {field.label}
      </label>
    )
  }
  let control
  if (field.type === 'textarea') control = <textarea {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  else if (field.type === 'select') {
    const options = field.options(ctx) || {}
    // Options: an object, or [[value, label], …] when the order matters
    const pairs = Array.isArray(options) ? options : Object.entries(options)
    control = (
      <select {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {field.required && <option value="">Choose…</option>}
        {pairs.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    )
  } else {
    control = (
      <input {...common} type={field.type || 'text'} value={value ?? ''} min={field.min} maxLength={field.maxLength}
        onChange={(e) => onChange(e.target.value)} />
    )
  }
  return (
    <div className="field" style={field.wide ? { gridColumn: '1 / -1' } : undefined}>
      <label htmlFor={id}>{field.label}{field.required && <span aria-hidden="true"> *</span>}</label>
      {field.hint && <span id={`${id}-hint`} className="hint">{field.hint}</span>}
      {control}
      {field.error && <span className="error-msg">{field.error}</span>}
    </div>
  )
}

function Editor({ config, initial, onSaved, onCancel, ctx }) {
  const { api: path } = useChurch()
  const editing = Boolean(initial?.id)
  const [form, setForm] = useState(() => {
    if (initial) return (config.toForm || ((x) => x))(initial)
    const empty = { ...config.empty }
    if ('book' in empty && ctx.defaultBook) empty.book = ctx.defaultBook
    return empty
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const body = (config.toApi || ((x) => x))(form)
    try {
      await api(path(editing ? `${config.path}${initial.id}/` : config.path), { method: editing ? 'PATCH' : 'POST', body })
      onSaved(editing ? 'Changes saved.' : `New ${config.singular} added.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card card--gold form manage__editor" onSubmit={onSubmit}>
      <h2>{editing ? `Edit ${config.singular}` : `New ${config.singular}`}</h2>
      <FlashToast kind="error" text={error} />
      <div className="form-row">
        {config.fields.map((f) => (
          <Field key={f.name} field={f} ctx={ctx} value={form[f.name]} onChange={(v) => setForm((s) => ({ ...s, [f.name]: v }))} />
        ))}
      </div>
      <div className="manage__actions">
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn btn--outline" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

/** Hymn books kept by the platform (e.g. Nyimbo Za Injili): switch each on or off for this church. */
function SharedBooks({ onChanged }) {
  const { api: path } = useChurch()
  const toast = useToast()
  const { data: catalog, reload } = useApi(path('/hymnbooks/catalog/'))
  const [busy, setBusy] = useState(null)
  if (!catalog?.length) return null

  async function toggle(book) {
    setBusy(book.id)
    try {
      await api(path(`/hymnbooks/${book.id}/${book.enabled ? 'disable' : 'enable'}/`), { method: 'POST' })
      toast.success(book.enabled ? `“${book.title}” is switched off for your church.` : `“${book.title}” is now in your hymnal.`)
      reload()
      onChanged()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="card shared-books">
      <h3>Shared hymn books</h3>
      <p className="muted">Kept up to date by the platform for every church. Switch them on to show them in your hymnal.</p>
      <ul className="manage__list">
        {catalog.map((b) => (
          <li key={b.id}>
            <div><strong>{b.title}</strong><div className="muted">{b.language} · {b.song_count} songs</div></div>
            <label className="check">
              <input type="checkbox" checked={b.enabled} disabled={busy === b.id} onChange={() => toggle(b)} />
              {b.enabled ? 'On' : 'Off'}
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ResourcePanel({ config }) {
  const confirm = useConfirm()
  const toast = useToast()
  const { api: path } = useChurch()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const term = useDebounced(search.trim())
  const [editing, setEditing] = useState(null) // null | {} (new) | item
  const [importing, setImporting] = useState(null) // hymn book being imported into
  const [flash, setFlash] = useState('')
  const { data, error, loading, reload } = useApi(path(`${config.path}${qs({ page, search: term })}`))
  const { data: books, reload: reloadBooks } = useApi(path('/hymnbooks/'))
  const { data: departments } = useApi(config.path === '/schedules/' ? path('/departments/') : null)
  const rows = Array.isArray(data) ? data : data?.results ?? []
  const ctx = {
    // Songs can only be added to the church's own books; shared catalog books are read-only.
    books: Object.fromEntries((books || []).filter((b) => !b.shared).map((b) => [b.id, b.title])),
    defaultBook: (books || []).find((b) => !b.shared)?.id ?? '',
    departments: departments || [],
  }

  async function startEdit(item) {
    setFlash('')
    if (config.loadForEdit) {
      try { setEditing(await api(path(`${config.path}${item.id}/`))) } catch (err) { setFlash(err.message) }
    } else {
      setEditing(item)
    }
  }

  async function remove(item) {
    const { title } = config.summary(item)
    const warning = config.deleteWarning ? config.deleteWarning(item) : `Delete “${title}”? This cannot be undone.`
    if (!(await confirm({ title: `Delete “${title}”?`, message: config.deleteWarning ? warning : 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' }))) return
    try {
      await api(path(`${config.path}${item.id}/`), { method: 'DELETE' })
      setFlash(`Deleted “${title}”.`)
      reload()
      reloadBooks()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (importing) {
    return (
      <HymnImport book={importing} onClose={(changed) => {
        setImporting(null)
        if (changed) { setFlash(`Songs imported into “${importing.title}”.`); reload(); reloadBooks() }
      }} />
    )
  }

  if (editing) {
    return (
      <Editor config={config} ctx={ctx} initial={editing.id ? editing : null} onCancel={() => setEditing(null)}
        onSaved={(msg) => { setEditing(null); setFlash(msg); reload(); reloadBooks() }} />
    )
  }

  return (
    <div>
      <div className="section-head">
        <h2>{config.label}</h2>
        <button type="button" className="btn btn--gold btn--sm" onClick={() => { setFlash(''); setEditing({}) }}>
          + Add {config.singular}
        </button>
      </div>
      {config.searchable && (
        <div className="toolbar">
          <label className="toolbar__search">
            <span className="visually-hidden">Search {config.label}</span>
            <input type="search" placeholder={`Search ${config.label.toLowerCase()}`} value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </label>
        </div>
      )}
      <FlashToast flash={flash} />
      {config.path === '/hymnbooks/' && <SharedBooks onChanged={() => { reload(); reloadBooks() }} />}
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !rows.length ? (
        <p className="muted">Nothing here yet.</p>
      ) : (
        <>
          <ul className="manage__list">
            {rows.map((item) => {
              const s = config.summary(item)
              return (
                <li key={item.id}>
                  <div>
                    <strong>{s.title}</strong> {s.badge && <span className="badge badge--gold">{s.badge}</span>}
                    <div className="muted">{s.meta}</div>
                  </div>
                  <div className="manage__row-actions">
                    {item.shared ? <span className="muted">Kept by the platform</span> : <>
                    {config.importable && (
                      <button type="button" className="btn btn--gold btn--sm" onClick={() => { setFlash(''); setImporting(item) }}>Import songs</button>
                    )}
                    <button type="button" className="btn btn--outline btn--sm" onClick={() => startEdit(item)}>Edit</button>
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => remove(item)}>Delete</button>
                    </>}
                  </div>
                </li>
              )
            })}
          </ul>
          {!Array.isArray(data) && <Pagination page={page} count={data.count} onPage={setPage} />}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ Settings */
function SettingsPanel() {
  const { church, reload } = useChurch()
  const { refreshUser } = useAuth()
  const [form, setForm] = useState(() => ({
    name: church.name, subtitle: church.subtitle, tagline: church.tagline, about: church.about,
    address: church.address, town: church.town, country: church.country, email: church.email,
    phone: church.phone, website: church.website, youtube_channel_id: church.youtube_channel_id,
  }))
  const [logo, setLogo] = useState(null)
  const [flash, setFlash] = useState({ kind: '', text: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setFlash({ kind: '', text: '' })
    try {
      await api(`/api/v1/churches/${church.slug}/`, { method: 'PATCH', body: form })
      if (logo) {
        const fd = new FormData()
        fd.append('logo', logo)
        await api(`/api/v1/churches/${church.slug}/`, { method: 'PATCH', body: fd })
      }
      setFlash({ kind: 'success', text: 'Church details saved.' })
      setLogo(null)
      reload()
      refreshUser()
    } catch (err) {
      setFlash({ kind: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const text = (k, label, props = {}) => (
    <div className="field" style={props.wide ? { gridColumn: '1 / -1' } : undefined}>
      <label htmlFor={`s-${k}`}>{label}</label>
      {props.hint && <span className="hint">{props.hint}</span>}
      {props.textarea
        ? <textarea id={`s-${k}`} value={form[k] || ''} onChange={set(k)} />
        : <input id={`s-${k}`} type={props.type || 'text'} value={form[k] || ''} onChange={set(k)}
            required={props.required} pattern={props.pattern} maxLength={props.maxLength} />}
      {props.error && <span className="error-msg">{props.error}</span>}
    </div>
  )

  return (
    <form className="card card--gold form" onSubmit={onSubmit}>
      <h2>Church settings</h2>
      <FlashToast flash={flash} />
      <div className="settings-logo">
        {church.logo ? <img src={mediaUrl(church.logo)} alt="" width={72} height={72} className="logo logo--custom" /> : null}
        <div className="field">
          <label htmlFor="s-logo">Logo</label>
          <span className="hint">Square image, under 2 MB. Shown in your church’s header.</span>
          <input id="s-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogo(e.target.files[0] || null)} />
        </div>
      </div>
      <div className="form-row">
        {text('name', 'Church name', { required: true, maxLength: 120, error: 'A name is required.' })}
        {text('subtitle', 'Subtitle', { hint: 'Shown under the name, e.g. Friends Church (Quakers)' })}
        {text('tagline', 'Welcome line', { wide: true, maxLength: 200 })}
        {text('about', 'About the church', { wide: true, textarea: true })}
        {text('address', 'Address')}
        {text('town', 'Town')}
        {text('country', 'Country')}
        {text('email', 'Email', { type: 'email', error: 'Enter a valid email.' })}
        {text('phone', 'Phone', { type: 'tel' })}
        {text('website', 'Website', { type: 'url', error: 'Enter a full address starting with https://' })}
      </div>
      <fieldset className="fieldset">
        <legend>YouTube live streaming</legend>
        {text('youtube_channel_id', 'YouTube channel ID', {
          pattern: 'UC[\\w\\-]{22}', // hyphen escaped: browsers compile pattern= with the strict `v` flag
          hint: 'Starts with “UC” (24 characters). In YouTube Studio: Settings → Channel → Advanced settings. When you go live, the stream plays on your church page during any event marked “Streamed online”.',
          error: 'The channel ID starts with UC and is 24 characters long.',
        })}
      </fieldset>
      <div className="manage__actions">
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
      </div>
    </form>
  )
}

const ALL_TABS = [
  ...Object.entries(RESOURCES).map(([key, r]) => ({ key, label: r.label, roles: r.roles, render: () => <ResourcePanel config={r} /> })),
  { key: 'members', label: 'Members', roles: ['recording_clerk', 'clerk'], render: () => <MembersPanel /> },
  { key: 'departments', label: 'Departments', roles: ['clerk'], render: () => <DepartmentsPanel /> },
  { key: 'streaming', label: 'Live streaming', roles: ['clerk'], render: () => <StreamingSetup /> },
  { key: 'settings', label: 'Church settings', roles: ['clerk'], render: () => <SettingsPanel /> },
]

export default function Manage() {
  const { church, role, base } = useChurch()
  const [params, setParams] = useSearchParams()
  const tabs = ALL_TABS.filter((t) => t.roles.includes(role))
  const tab = tabs.find((t) => t.key === params.get('tab')) || tabs[0]
  const welcome = params.get('welcome') === '1'

  return (
    <section className="section">
      <div className="container">
        <div className="eyebrow">Clerk’s desk</div>
        <h1>Manage {church.name}</h1>
        <PublishBanner />
        {welcome && (
          <div className="card card--gold welcome">
            <h2>Welcome, Clerk! 🎉</h2>
            <p>Your church page is at <Link to={base || '/'}>{window.location.origin}{base}</Link>. Next steps:</p>
            <ol>
              <li>Add your logo and YouTube channel in <button type="button" className="linklike" onClick={() => setParams({ tab: 'settings' })}>Church settings</button>.</li>
              <li>Connect your camcorder to YouTube Live with the <button type="button" className="linklike" onClick={() => setParams({ tab: 'streaming' })}>Live streaming</button> guide.</li>
              <li>Publish your worship times under <button type="button" className="linklike" onClick={() => setParams({ tab: 'schedules' })}>Worship &amp; events</button>.</li>
              <li>Add hymns to your <button type="button" className="linklike" onClick={() => setParams({ tab: 'songs' })}>hymn books</button>.</li>
              <li>Share your church’s address so people can join, then give them roles under <button type="button" className="linklike" onClick={() => setParams({ tab: 'members' })}>People</button>.</li>
            </ol>
          </div>
        )}
        <div className="tabs" role="tablist" aria-label="Sections">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab?.key === t.key} onClick={() => setParams({ tab: t.key })}>
              {t.label}
            </button>
          ))}
        </div>
        {tab && <div key={tab.key}>{tab.render()}</div>}
      </div>
    </section>
  )
}
