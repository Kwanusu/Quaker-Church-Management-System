import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useChurch } from '../church/ChurchContext'
import JoinButton from '../church/JoinButton'
import NotFound from '../pages/NotFound'
import { Loading } from './States'

/** Signed-in only (platform pages such as "Register a church"). */
export function RequireAuth({ children, to = '/register' }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading label="Checking your sign-in…" />
  if (!user) return <Navigate to={to} replace state={{ from: location.pathname + location.search }} />
  return children
}

/** Platform admins and system admins only. Everyone else sees "page not found" (the page isn't advertised). */
export function RequireAdmin({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading label="Checking your sign-in…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (!user.is_platform_admin) return <NotFound />
  return children
}

/** Gate a church page by the user's role in THIS church. */
export default function RequireRole({ allow, allowDepartments = false, children, reason }) {
  const { user, loading } = useAuth()
  const { church, role, base, myDepartments } = useChurch()
  const location = useLocation()

  if (loading) return <Loading label="Checking your sign-in…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (!allow.includes(role) && !(allowDepartments && myDepartments.length > 0)) {
    return (
      <section className="section">
        <div className="container narrow card card--gold">
          <h1>Members only</h1>
          <p>{reason || 'Your account does not have access to this page.'}</p>
          {role
            ? <p className="muted">You are an Attender at {church.name}. The Clerk can change your role.</p>
            : <p><JoinButton /></p>}
          <Link to={base || '/'} className="btn btn--outline">Back to {church.name}</Link>
        </div>
      </section>
    )
  }
  return children
}
