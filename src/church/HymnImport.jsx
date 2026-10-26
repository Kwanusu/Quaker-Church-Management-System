import { useMemo, useState } from 'react'
import { api } from '../api/client'
import { SONG_TYPES } from '../config'
import { useChurch } from './ChurchContext'
import FlashToast from '../components/FlashToast'

// Template rows are placeholders showing the format, not real hymn texts.
const TEMPLATE = [
  ['namba', 'kichwa', 'mwandishi', 'aina', 'maneno'],
  ['1', 'Kichwa cha wimbo', 'Mtunzi (si lazima)', 'wimbo', 'Ubeti wa kwanza, mstari wa kwanza\nmstari wa pili\n\nKiitikio: …\n\nUbeti wa pili …'],
  ['2', 'Kichwa kingine', '', 'wimbo', 'Maneno ya wimbo…'],
]
const PASTE_EXAMPLE = `1. Kichwa cha wimbo
Mwandishi: Jina (si lazima)
Ubeti wa kwanza…
mstari wa pili

Kiitikio: …

2. Kichwa kingine
Maneno…`

const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

function downloadTemplate() {
  // Leading BOM so Excel opens Swahili text correctly.
  const csv = '﻿' + TEMPLATE.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: 'hymn-book-template.csv' })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const STATUS = {
  new: { label: 'New', cls: 'badge' },
  replace: { label: 'Replaces', cls: 'badge badge--gold' },
  skip: { label: 'Already there, skipped', cls: 'badge badge--draft' },
  error: { label: 'Needs fixing', cls: 'badge badge--live' },
}

export default function HymnImport({ book, onClose }) {
  const { api: path } = useChurch()
  const [source, setSource] = useState('file')
  const [file, setFile] = useState(null)
  const [text, setText] = useState('')
  const [mode, setMode] = useState('skip')
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [onlyErrors, setOnlyErrors] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const ready = source === 'file' ? Boolean(file) : text.trim().length > 0

  function body(dryRun) {
    if (source === 'file') {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mode', mode)
      fd.append('dry_run', dryRun ? 'true' : 'false')
      return fd
    }
    return { text, mode, dry_run: dryRun }
  }

  async function send(dryRun) {
    setBusy(true)
    setError('')
    try {
      const data = await api(path(`/hymnbooks/${book.id}/import/`), { method: 'POST', body: body(dryRun) })
      if (dryRun) { setPreview(data); setOnlyErrors(data.summary.error > 0) } else setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Any change to the input makes the old preview stale.
  const reset = () => { setPreview(null); setResult(null); setError('') }

  const rows = useMemo(() => {
    if (!preview) return []
    return onlyErrors ? preview.rows.filter((r) => r.status === 'error') : preview.rows
  }, [preview, onlyErrors])

  if (result) {
    const r = result.result
    return (
      <div className="card card--gold import">
        <h2>Imported into {book.title} ✓</h2>
        <p className="alert alert--success" role="status">
          {r.created} new {r.created === 1 ? 'song' : 'songs'} added
          {r.replaced > 0 && `, ${r.replaced} replaced`}
          {r.skipped > 0 && `, ${r.skipped} skipped (already in the book)`}.
        </p>
        <div className="manage__actions">
          <button type="button" className="btn" onClick={() => onClose(true)}>Done</button>
          <button type="button" className="btn btn--outline" onClick={() => { setResult(null); setPreview(null); setFile(null); setText('') }}>Import more</button>
        </div>
      </div>
    )
  }

  const s = preview?.summary
  const willWrite = s ? s.new + s.replace : 0

  return (
    <div className="card card--gold import">
      <div className="section-head">
        <h2>Import songs into “{book.title}”</h2>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => onClose(false)}>Cancel</button>
      </div>
      <p className="muted">
        Type the songs from your church’s copy into a spreadsheet, or paste them as text. You’ll see a preview before anything is saved.
        Only import hymn books your church has permission to reproduce.
      </p>

      <div className="segmented" role="group" aria-label="Import from">
        <button type="button" aria-pressed={source === 'file'} onClick={() => { setSource('file'); reset() }}>Spreadsheet</button>
        <button type="button" aria-pressed={source === 'text'} onClick={() => { setSource('text'); reset() }}>Paste text</button>
      </div>

      {source === 'file' ? (
        <div className="import__source">
          <div className="field">
            <label htmlFor="imp-file">Spreadsheet (.csv or .xlsx)</label>
            <span className="hint">
              First row = column names: <code>namba, kichwa, maneno</code> (and optionally <code>mwandishi, aina</code>), or
              in English <code>number, title, lyrics, author, type</code>. Put each song’s words in one cell; press Alt+Enter in Excel for a new line.
            </span>
            <input id="imp-file" type="file" accept=".csv,.xlsx,.txt,text/csv"
              onChange={(e) => { setFile(e.target.files[0] || null); reset() }} />
          </div>
          <button type="button" className="btn btn--outline btn--sm" onClick={downloadTemplate}>⬇ Download template</button>
        </div>
      ) : (
        <div className="import__source">
          <div className="field">
            <label htmlFor="imp-text">Songs</label>
            <span className="hint">Start every song with its number and title on one line (e.g. “12. Title”). Blank lines between verses are kept.</span>
            <textarea id="imp-text" rows={12} value={text} placeholder={PASTE_EXAMPLE}
              onChange={(e) => { setText(e.target.value); reset() }} />
          </div>
        </div>
      )}

      <fieldset className="fieldset">
        <legend>If a song number is already in {book.title}</legend>
        <label className="check"><input type="radio" name="mode" checked={mode === 'skip'} onChange={() => { setMode('skip'); reset() }} /> Keep the existing song (skip)</label>
        <label className="check"><input type="radio" name="mode" checked={mode === 'replace'} onChange={() => { setMode('replace'); reset() }} /> Replace it with the imported one</label>
      </fieldset>

      <FlashToast kind="error" text={error} />

      {!preview && (
        <div className="manage__actions">
          <button type="button" className="btn" disabled={!ready || busy} onClick={() => send(true)}>{busy ? 'Checking…' : 'Check & preview'}</button>
        </div>
      )}

      {preview && (
        <div className="import__preview">
          <div className="import__summary" role="status">
            <span className="badge">{s.new} new</span>
            {s.replace > 0 && <span className="badge badge--gold">{s.replace} to replace</span>}
            {s.skip > 0 && <span className="badge badge--draft">{s.skip} skipped</span>}
            {s.error > 0 && <span className="badge badge--live">{s.error} need fixing</span>}
            {s.error > 0 && (
              <label className="check import__filter">
                <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} /> Show only problems
              </label>
            )}
          </div>
          {s.error > 0 && <p className="alert alert--error">Fix the rows marked “Needs fixing” in your file, then check again. Nothing has been saved.</p>}
          <div className="import__table-wrap">
            <table className="import__table">
              <thead>
                <tr><th>Line</th><th>No.</th><th>Title</th><th>First line</th><th>Type</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className={r.status === 'error' ? 'is-error' : undefined}>
                    <td>{r.line}</td>
                    <td>{r.number}</td>
                    <td>{r.title || <em className="muted">—</em>}{r.author && <div className="muted">{r.author}</div>}</td>
                    <td className="muted">{r.lyrics_preview}</td>
                    <td>{SONG_TYPES[r.song_type] || r.song_type}</td>
                    <td>
                      <span className={STATUS[r.status].cls}>{STATUS[r.status].label}</span>
                      {r.errors.map((e) => <div key={e} className="field-error">{e}</div>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="manage__actions">
            <button type="button" className="btn btn--gold" disabled={busy || s.error > 0 || willWrite === 0} onClick={() => send(false)}>
              {busy ? 'Importing…' : `Import ${willWrite} ${willWrite === 1 ? 'song' : 'songs'}`}
            </button>
            <button type="button" className="btn btn--outline" onClick={reset}>Change file</button>
          </div>
        </div>
      )}
    </div>
  )
}
