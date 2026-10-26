import { useState } from 'react'
import { qs } from '../api/client'
import { Empty, ErrorState, Loading, Pagination } from '../components/States'
import { formatWeek } from '../format'
import { useApi } from '../hooks/useApi'
import { useChurch } from './ChurchContext'

export default function Queries() {
  const { church, api: path } = useChurch()
  const [page, setPage] = useState(1)
  const { data, error, loading, reload } = useApi(path(`/queries/${qs({ page })}`), { auth: false })

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow eyebrow--light">Queries</div>
          <h1>Questions for reflection</h1>
          <p className="hero__lead">
            Each week {church.name} holds a query in the silence: a question to examine our lives against our testimonies.
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container narrow">
          {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data.results.length ? (
            <Empty>No queries have been published yet.</Empty>
          ) : (
            <>
              <ul className="query-list">
                {data.results.map((q) => (
                  <li key={q.id} className={`card${q.is_active ? ' card--gold' : ''}`}>
                    <div className="query-list__head">
                      <span className="muted">Week of {formatWeek(q.week_starting)}</span>
                      {q.is_active && <span className="badge badge--gold">This week</span>}
                    </div>
                    <h2>{q.title}</h2>
                    <blockquote className="query-list__text">{q.text}</blockquote>
                  </li>
                ))}
              </ul>
              <Pagination page={page} count={data.count} onPage={setPage} />
            </>
          )}
        </div>
      </section>
    </>
  )
}
