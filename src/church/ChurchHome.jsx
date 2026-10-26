import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EventCard from '../components/EventCard'
import { ErrorState } from '../components/States'
import YouTubeDialog, { YouTubeEmbed } from '../components/YouTubePlayer'
import { GUIDING_TEXT, ROLES } from '../config'
import { formatTimeRange, formatWeek, isLive } from '../format'
import { useApi } from '../hooks/useApi'
import { useChurch } from './ChurchContext'
import PublishBanner from './PublishBanner'
import JoinButton from './JoinButton'

function WeeklyQuery() {
  const { api: path } = useChurch()
  const { data, error, loading } = useApi(path('/queries/active/'), { auth: false })
  if (loading) return <div className="query-card skeleton" style={{ minHeight: 220 }} />
  if (error && error.status !== 404) return <div className="query-card"><p>{error.message}</p></div>
  return (
    <figure className="query-card">
      <div className="eyebrow eyebrow--light">{data ? 'Query for the week' : 'Our guiding text'}</div>
      {data ? (
        <>
          <blockquote><p>{data.text}</p></blockquote>
          <figcaption><strong>{data.title}</strong><span>Week of {formatWeek(data.week_starting)}</span></figcaption>
        </>
      ) : (
        <>
          <blockquote><p>{GUIDING_TEXT.text}</p></blockquote>
          <figcaption><strong>{GUIDING_TEXT.ref}</strong></figcaption>
        </>
      )}
    </figure>
  )
}

function LiveNow({ events }) {
  const { church } = useChurch()
  // On air from the church's live studio: the channel's live stream, whatever the calendar says
  if (church.live && church.youtube_live_embed_url) {
    return (
      <section className="section section--live" aria-labelledby="live-title">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="badge badge--live">● Live now</span>
              <h2 id="live-title">{church.live.event || `Live from ${church.name}`}</h2>
            </div>
          </div>
          <YouTubeEmbed src={church.youtube_live_embed_url} title={church.live.event || church.name} autoplay />
        </div>
      </section>
    )
  }
  const live = events.find((e) => e.youtube_embed_url && isLive(e))
  if (!live) return null
  return (
    <section className="section section--live" aria-labelledby="live-title">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="badge badge--live">● Live now</span>
            <h2 id="live-title">{live.title}</h2>
            <p className="muted">{formatTimeRange(live.start_time, live.end_time)}{live.location && ` · ${live.location}`}</p>
          </div>
        </div>
        <YouTubeEmbed src={live.youtube_embed_url} title={live.title} />
      </div>
    </section>
  )
}

export default function ChurchHome() {
  const { church, api: path, base, role, isMember, reload: reloadChurch } = useChurch()
  const { data: events, error, loading, reload } = useApi(path('/schedules/upcoming/'), { auth: false })
  const [watching, setWatching] = useState(null)

  // Notice when the church goes live (or ends) without a page refresh.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') reloadChurch() }, 60_000)
    return () => clearInterval(t)
  }, [reloadChurch])

  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <div className="eyebrow eyebrow--light">{church.subtitle || 'Friends Church (Quakers)'}</div>
            <h1>{church.name}</h1>
            <p className="hero__lead">
              {church.tagline || 'All are welcome to sit with us in worship, in the meetinghouse or online.'}
            </p>
            {church.town && <p className="hero__place">{[church.town, church.country].filter(Boolean).join(', ')}</p>}
            <div className="hero__actions">
              <Link to={`${base}/worship`} className="btn btn--gold">Join us in worship</Link>
              {isMember
                ? <Link to={`${base}/fellowship`} className="btn btn--ghost-light">Open messages</Link>
                : <JoinButton className="btn btn--ghost-light" />}
              {role && !isMember && <span className="hero__note">You’re an {ROLES[role]}. The Clerk can make you a member.</span>}
            </div>
          </div>
          <WeeklyQuery />
        </div>
      </section>

      <PublishBanner />
      {(events || church.live) && <LiveNow events={events || []} />}

      <section className="section section--white">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow">Gather with us</div>
              <h2>Upcoming worship &amp; events</h2>
            </div>
            <Link to={`${base}/worship`} className="btn btn--outline btn--sm">Full calendar</Link>
          </div>
          {loading && !events ? (
            <div className="event-list">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 150 }} />)}</div>
          ) : error ? <ErrorState error={error} onRetry={reload} /> : !events.length ? (
            <p className="muted">No upcoming gatherings are published yet. Please check back soon.</p>
          ) : (
            <div className="event-list">
              {events.slice(0, 3).map((ev) => <EventCard key={ev.id} event={ev} onWatch={setWatching} />)}
            </div>
          )}
        </div>
      </section>

      {church.about && (
        <section className="section">
          <div className="container narrow">
            <div className="eyebrow">About us</div>
            <h2>About {church.name}</h2>
            <p className="about-text">{church.about}</p>
          </div>
        </section>
      )}

      <section className="section">
        <div className="container">
          <div className="grid pillars">
            <Link to={`${base}/bible`} className="card card--gold card--link">
              <h3>📖 Holy Bible</h3>
              <p className="muted">Read the King James Version and search by verse or word.</p>
            </Link>
            <Link to={`${base}/hymnal`} className="card card--gold card--link">
              <h3>🎵 Hymn books</h3>
              <p className="muted">Songs, poems and readings for worship.</p>
            </Link>
            <Link to={`${base}/queries`} className="card card--gold card--link">
              <h3>🕊 Queries</h3>
              <p className="muted">Questions for reflection, week by week.</p>
            </Link>
          </div>
        </div>
      </section>
      {watching && <YouTubeDialog event={watching} onClose={() => setWatching(null)} />}
    </>
  )
}
