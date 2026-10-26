import { Link } from 'react-router-dom'

export default function NotFound({ what = 'page' }) {
  return (
    <section className="section">
      <div className="container narrow card card--gold" style={{ textAlign: 'center' }}>
        <h1>{what === 'church' ? 'Church not found' : 'Page not found'}</h1>
        <p className="muted">
          {what === 'church'
            ? 'We couldn’t find a church at this address. It may have moved or been renamed.'
            : 'The page you were looking for isn’t here. It may have moved.'}
        </p>
        <Link to="/" className="btn">{what === 'church' ? 'Find a church' : 'Return home'}</Link>
      </div>
    </section>
  )
}
