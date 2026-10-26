export function Loading({ label = 'Loading…' }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="spinner" />
      {label}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state" role="alert">
      <p className="alert alert--error" style={{ display: 'inline-block' }}>
        {error?.message || 'Something went wrong.'}
      </p>
      {onRetry && (
        <p>
          <button type="button" className="btn btn--outline btn--sm" onClick={onRetry}>Try again</button>
        </p>
      )}
    </div>
  )
}

export function Empty({ children }) {
  return <div className="state"><p>{children}</p></div>
}

export function Pagination({ page, count, pageSize = 50, onPage }) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  if (pages <= 1) return null
  return (
    <nav className="pagination" aria-label="Pages">
      <button type="button" className="btn btn--outline btn--sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Previous
      </button>
      <span aria-live="polite">Page {page} of {pages}</span>
      <button type="button" className="btn btn--outline btn--sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next →
      </button>
    </nav>
  )
}
