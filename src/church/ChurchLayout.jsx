import { BookOpen, Church, CircleHelp, House, MessageSquare, Music, Settings, Users } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Page, SiteFooter } from '../components/Layout'
import { ErrorState, Loading } from '../components/States'
import { mediaUrl } from '../config'
import { useApi } from '../hooks/useApi'
import NotFound from '../pages/NotFound'
import { TENANT_SLUG } from '../tenant'
import { ChurchContext, roleFlags } from './ChurchContext'
import JoinButton from './JoinButton'

/** Everything under /c/:slug — loads the church once and shares it with its pages. */
export default function ChurchLayout() {
  const params = useParams()
  const slug = TENANT_SLUG || params.slug // on a church's own subdomain the slug is the host, not part of the path
  const { user } = useAuth()
  // Re-fetch when the user signs in/out so `my_role` stays correct.
  const { data: church, error, loading, reload } = useApi(`/api/v1/churches/${encodeURIComponent(slug)}/?u=${user?.id ?? ''}`)

  useEffect(() => {
    if (church?.name) document.title = `${church.name} · ${church.subtitle || 'Friends Church'}`
  }, [church?.name, church?.subtitle])

  const value = useMemo(() => church && ({
    church,
    slug: church.slug,
    api: (path) => `/api/v1/churches/${church.slug}${path}`,
    base: TENANT_SLUG ? '' : `/c/${church.slug}`,
    reload,
    ...roleFlags(church.my_role),
    myDepartments: church.my_departments || [],
    // Messages: church members, or anyone in a department (their department's room)
    canMessage: roleFlags(church.my_role).isMember || (church.my_departments || []).length > 0,
  }), [church, reload])

  if (loading && !church) return <Loading label="Loading church…" />
  if (error?.status === 404) return <NotFound what="church" />
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!value || value.slug !== slug) return <Loading label="Loading church…" />

  const { base, canMessage, isLeader } = value
  const links = [
    { to: base || '/', label: 'Home', icon: House, end: true },
    { to: `${base}/worship`, label: 'Worship', icon: Church },
    { to: `${base}/hymnal`, label: 'Hymnal', icon: Music },
    { to: `${base}/bible`, label: 'Bible', icon: BookOpen },
    { to: `${base}/queries`, label: 'Queries', icon: CircleHelp },
    { to: `${base}/departments`, label: 'Departments', icon: Users },
    ...(canMessage ? [{ to: `${base}/fellowship`, label: 'Messages', icon: MessageSquare }] : []),
    ...(isLeader ? [{ to: `${base}/manage`, label: 'Manage', icon: Settings }] : []),
  ]

  return (
    <ChurchContext.Provider value={value}>
      <Page
        brand={{ to: base || '/', name: church.name, subtitle: church.subtitle || 'Friends Church (Quakers)', logo: mediaUrl(church.logo) }}
        links={links}
        role={church.my_role}
        topAction={<JoinButton compact className="sidebar__link sidebar__link--cta" />}
        footer={<SiteFooter church={church} />}
      />
    </ChurchContext.Provider>
  )
}
