import { EVENT_TYPES } from '../config'
import { dayOfMonth, formatDate, formatTimeRange, isLive, monthShort } from '../format'

export default function EventCard({ event, onWatch, children }) {
  const live = isLive(event)
  const watchable = Boolean(event.youtube_embed_url)
  return (
    <article className="event-card">
      <div className="event-card__date" aria-hidden="true">
        <span className="event-card__month">{monthShort(event.start_time)}</span>
        <span className="event-card__day">{dayOfMonth(event.start_time)}</span>
      </div>
      <div className="event-card__body">
        <div className="event-card__tags">
          <span className="badge">{EVENT_TYPES[event.event_type] || event.event_type}</span>
          {event.department_name && <span className="badge badge--dept">{event.department_name}</span>}
          {event.is_hybrid && <span className="badge badge--gold">In person &amp; online</span>}
          {live && watchable && <span className="badge badge--live">● Live now</span>}
          {event.is_published === false && <span className="badge badge--draft">Draft</span>}
        </div>
        <h3>{event.title}</h3>
        <p className="event-card__meta">
          <time dateTime={event.start_time}>{formatDate(event.start_time)}</time>
          <br />
          {formatTimeRange(event.start_time, event.end_time)}
          {event.location && <> · {event.location}</>}
        </p>
        {event.description && <p className="event-card__desc">{event.description}</p>}
        <div className="event-card__actions">
          {watchable && onWatch && (
            <button type="button" className={`btn btn--sm ${live ? 'btn--gold' : 'btn--outline'}`} onClick={() => onWatch(event)}>
              {live ? '▶ Watch live' : '▶ Watch on YouTube'}
            </button>
          )}
          {children}
        </div>
      </div>
    </article>
  )
}
