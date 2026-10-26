import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { qs } from '../api/client'
import { Empty, ErrorState, Loading, Pagination } from '../components/States'
import { SONG_TYPES } from '../config'
import { useApi, useDebounced } from '../hooks/useApi'
import { useChurch } from './ChurchContext'

export function Hymnal() {
  const { church, api: path, base } = useChurch()
  const [params, setParams] = useSearchParams()
  const { data: books } = useApi(path('/hymnbooks/'), { auth: false })
  const bookId = params.get('book') || ''
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const term = useDebounced(search.trim(), 300)
  const { data, error, loading, reload } = useApi(path(`/songs/${qs({ book: bookId, search: term, type, page })}`), { auth: false })

  const selectBook = (id) => {
    setPage(1)
    setParams(id ? { book: id } : {}, { replace: true })
  }

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow eyebrow--light">Hymn books</div>
          <h1>Songs, poems &amp; readings</h1>
          <p className="hero__lead">The hymn books of {church.name}. Search by number, title or any words from the song.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {books?.length > 1 && (
            <div className="tabs" role="tablist" aria-label="Hymn books">
              <button type="button" role="tab" aria-selected={!bookId} onClick={() => selectBook('')}>All books</button>
              {books.map((b) => (
                <button key={b.id} type="button" role="tab" aria-selected={bookId === String(b.id)} onClick={() => selectBook(String(b.id))}>
                  {b.title} <span className="muted">({b.song_count})</span>
                </button>
              ))}
            </div>
          )}
          <form className="toolbar" role="search" onSubmit={(e) => e.preventDefault()}>
            <label className="toolbar__search">
              <span className="visually-hidden">Search the hymnal</span>
              <input type="search" placeholder="e.g. 23, Mungu Mtukufu, To God Be the Glory" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
            </label>
            <label className="toolbar__select">
              <span className="visually-hidden">Type</span>
              <select value={type} onChange={(e) => { setType(e.target.value); setPage(1) }}>
                <option value="">All types</option>
                {Object.entries(SONG_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </form>

          {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.results.length ? (
            <Empty>{term ? `Nothing found for “${term}”.` : 'No songs here yet.'}</Empty>
          ) : (
            <>
              <p className="muted" aria-live="polite">{data.count} {data.count === 1 ? 'item' : 'items'}</p>
              <ol className="song-list" aria-busy={loading}>
                {data.results.map((s) => (
                  <li key={s.id}>
                    <Link to={`${base}/hymnal/${s.id}`} className="song-row">
                      <span className="song-row__num">{s.number}</span>
                      <span className="song-row__main">
                        <span className="song-row__title">{s.title}</span>
                        <span className="song-row__author">
                          {[s.english_title, s.author, books?.length > 1 && !bookId ? s.book_title : null].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="badge">{SONG_TYPES[s.song_type]}</span>
                    </Link>
                  </li>
                ))}
              </ol>
              <Pagination page={page} count={data.count} onPage={setPage} />
            </>
          )}
        </div>
      </section>
    </>
  )
}

export function SongDetail() {
  const { id } = useParams()
  const { api: path, base } = useChurch()
  const { data, error, loading, reload } = useApi(path(`/songs/${encodeURIComponent(id)}/`), { auth: false })

  return (
    <section className="section">
      <div className="container narrow">
        <Link to={`${base}/hymnal`} className="back-link">← Back to hymn books</Link>
        {loading ? <Loading /> : error ? (
          error.status === 404 ? <Empty>That song isn’t in this church’s hymn books.</Empty> : <ErrorState error={error} onRetry={reload} />
        ) : (
          <article className="card card--gold song">
            <div className="song__number">{data.book_title} · No. {data.number}</div>
            <h1>{data.title}</h1>
            {data.english_title && <p className="muted"><em>{data.english_title}</em></p>}
            <p className="muted">{SONG_TYPES[data.song_type]}{data.author && <> · {data.author}</>}</p>
            <div className="song__lyrics">{data.lyrics}</div>
            <button type="button" className="btn btn--outline btn--sm no-print" onClick={() => window.print()}>Print</button>
          </article>
        )}
      </div>
    </section>
  )
}
