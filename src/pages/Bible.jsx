import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, qs } from '../api/client'
import { Empty, ErrorState, Loading, Pagination } from '../components/States'
import { BIBLE_VERSION, GUIDING_TEXT } from '../config'
import { useApi } from '../hooks/useApi'
import FlashToast from '../components/FlashToast'

/**
 * Bible reader (KJV). Mounted at /bible and at /c/:slug/bible, so `base` tells it
 * where its own links should point.
 */
export default function Bible({ base = '/bible' }) {
  const { book, chapter } = useParams()
  const [params] = useSearchParams()
  const highlight = Number(params.get('v')) || null
  const navigate = useNavigate()
  const { data: index } = useApi(`/api/v1/bible/${BIBLE_VERSION}/books/`, { auth: false })
  const books = index?.books ?? []
  const current = books.find((b) => b.slug === book)

  if (!book) return <BibleIndex base={base} books={books} />

  return (
    <section className="section bible">
      <div className="container narrow">
        <div className="bible__bar">
          <Link to={base} className="back-link">← All books</Link>
          <div className="bible__pickers">
            <label>
              <span className="visually-hidden">Book</span>
              <select value={book} onChange={(e) => navigate(`${base}/${e.target.value}/1`)}>
                {books.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
              </select>
            </label>
            {current && (
              <label>
                <span className="visually-hidden">Chapter</span>
                <select value={chapter} onChange={(e) => navigate(`${base}/${book}/${e.target.value}`)}>
                  {Array.from({ length: current.chapters }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>Chapter {n}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
        <BibleSearch base={base} />
        <Chapter base={base} book={book} chapter={chapter} highlight={highlight} />
      </div>
    </section>
  )
}

function BibleIndex({ base, books }) {
  const groups = [['OT', 'Old Testament'], ['NT', 'New Testament']]
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow eyebrow--light">Holy Bible · King James Version</div>
          <h1>Read the Scriptures</h1>
          <p className="hero__lead">“{GUIDING_TEXT.text}” <span className="muted-light">({GUIDING_TEXT.ref})</span></p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <BibleSearch base={base} />
          {!books.length ? <Loading /> : groups.map(([key, label]) => (
            <div key={key} className="bible__testament">
              <h2>{label}</h2>
              <ul className="bible__books">
                {books.filter((b) => b.testament === key).map((b) => (
                  <li key={b.slug}><Link to={`${base}/${b.slug}/1`}>{b.name}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function Chapter({ base, book, chapter, highlight }) {
  const { data, error, loading, reload } = useApi(`/api/v1/bible/${BIBLE_VERSION}/${book}/${chapter}/`, { auth: false })

  useEffect(() => {
    if (!highlight || !data) return
    document.getElementById(`v${highlight}`)?.scrollIntoView({ block: 'center' })
  }, [highlight, data])

  if (loading && !data) return <Loading />
  if (error) return error.status === 404 ? <Empty>That book isn’t in this Bible.</Empty> : <ErrorState error={error} onRetry={reload} />

  const nav = (ref, label) => ref
    ? <Link className="btn btn--outline btn--sm" to={`${base}/${ref.book}/${ref.chapter}`}>{label === 'prev' ? `← ${ref.book_name} ${ref.chapter}` : `${ref.book_name} ${ref.chapter} →`}</Link>
    : <span />

  return (
    <article className="card bible__chapter" aria-busy={loading}>
      <h1>{data.book_name} {data.chapter}</h1>
      <p className="bible__text">
        {data.verses.map((v) => (
          <span key={v.verse} id={`v${v.verse}`} className={v.verse === highlight ? 'verse is-highlighted' : 'verse'}>
            <sup>{v.verse}</sup>{v.text}{' '}
          </span>
        ))}
      </p>
      <nav className="bible__nav" aria-label="Chapters">
        {nav(data.previous, 'prev')}
        {nav(data.next, 'next')}
      </nav>
    </article>
  )
}

function BibleSearch({ base }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(query, p = 1) {
    setBusy(true)
    setError('')
    try {
      const data = await api(`/api/v1/bible/${BIBLE_VERSION}/search/${qs({ q: query, page: p })}`, { auth: false })
      if (data.type === 'reference') {
        setResults(null)
        navigate(`${base}/${data.book}/${data.chapter}${data.verse ? `?v=${data.verse}` : ''}`)
      } else {
        setResults(data)
        setPage(p)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bible__search">
      <form className="toolbar" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) run(q.trim()) }}>
        <label className="toolbar__search">
          <span className="visually-hidden">Search the Bible</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="John 15:14, Psalm 23, or words like “still waters”" />
        </label>
        <button className="btn" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
      </form>
      <FlashToast kind="error" text={error} />
      {results && (
        <div className="bible__results">
          <div className="section-head">
            <p className="muted" aria-live="polite">{results.count} verses found</p>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setResults(null)}>Clear</button>
          </div>
          <ul>
            {results.results.map((r) => (
              <li key={`${r.book}-${r.chapter}-${r.verse}`}>
                <Link to={`${base}/${r.book}/${r.chapter}?v=${r.verse}`} onClick={() => setResults(null)}>
                  <strong>{r.book_name} {r.chapter}:{r.verse}</strong>
                </Link>{' '}
                {r.text}
              </li>
            ))}
          </ul>
          <Pagination page={page} count={results.count} pageSize={25} onPage={(p) => run(q.trim(), p)} />
        </div>
      )}
    </div>
  )
}
