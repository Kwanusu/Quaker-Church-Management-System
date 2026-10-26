import { useState } from 'react'
import EventCard from '../components/EventCard'
import { Empty, ErrorState, Loading, Pagination } from '../components/States'
import YouTubeDialog from '../components/YouTubePlayer'
import { qs } from '../api/client'
import { EVENT_TYPES } from '../config'
import { useApi } from '../hooks/useApi'
import { useChurch } from './ChurchContext'

// Local calendar date (stable for the whole day, so the request URL doesn't
// change on every render and trigger a refetch loop).
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Worship() {
  const { church, api: path } = useChurch()
  const [type, setType] = useState('')
  const [when, setWhen] = useState('upcoming')
  const [page, setPage] = useState(1)
  const [watching, setWatching] = useState(null)

  const params = {
    type, page,
    ...(when === 'upcoming' ? { start_date: today(), order: 'asc' } : { end_date: today() }),
  }
  const { data, error, loading, reload } = useApi(path(`/schedules/${qs(params)}`))

  const events = data?.results ?? []

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow eyebrow--light">Worship &amp; events</div>
          <h1>Gather with us</h1>
          <p className="hero__lead">Meeting for worship, special meetings, adult education and committee work at {church.name}. Online gatherings stream on YouTube.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="toolbar" role="group" aria-label="Filter events">
            <div className="segmented">
              {['upcoming', 'past'].map((w) => (
                <button key={w} type="button" aria-pressed={when === w} onClick={() => { setWhen(w); setPage(1) }}>
                  {w === 'upcoming' ? 'Upcoming' : 'Past'}
                </button>
              ))}
            </div>
            <label className="toolbar__select">
              <span className="visually-hidden">Event type</span>
              <select value={type} onChange={(e) => { setType(e.target.value); setPage(1) }}>
                <option value="">All gatherings</option>
                {Object.entries(EVENT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>

          {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : events.length === 0 ? (
            <Empty>No {when} gatherings{type ? ` of this type` : ''} yet.</Empty>
          ) : (
            <>
              <div className="event-list">
                {events.map((ev) => <EventCard key={ev.id} event={ev} onWatch={setWatching} />)}
              </div>
              <Pagination page={page} count={data.count} onPage={setPage} />
            </>
          )}
        </div>
      </section>
      {watching && <YouTubeDialog event={watching} onClose={() => setWatching(null)} />}
    </>
  )
}
