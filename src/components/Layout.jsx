import {
  BookOpen, CirclePlus, House, Landmark, LogIn, LogOut, Menu,
  PanelLeftClose, PanelLeftOpen, ShieldCheck, X,
} from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { GUIDING_TEXT, PLATFORM, ROLES } from '../config'
import Avatar from './Avatar'
import ResendButton from './ResendButton'
import Logo from './Logo'
import { Loading } from './States'
import { useToast } from './toastContext'
import { churchPath, TENANT_SLUG } from '../tenant'

const COLLAPSE_KEY = 'fp.sidebar.collapsed'
function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
}

/**
 * Collapsible sidebar. `brand` = { to, name, subtitle, logo } and `links` = [{ to, label, icon, end }].
 * Used by both the platform pages and each church's pages. On phones it slides in over the page.
 */
export function Sidebar({ brand, links, role, collapsed, onToggleCollapse, topAction }) {
  const { user, logout } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  // The drawer belongs to the page it was opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState(null)
  const open = openOn === location.pathname
  const toggle = () => setOpenOn(open ? null : location.pathname)

  async function handleLogout() {
    await logout()
    navigate(brand.to)
    toast.info('You have been signed out.')
  }

  return (
    <>
      <div className="mobilebar">
        <button type="button" className="mobilebar__btn" aria-expanded={open} aria-controls="sidebar" onClick={toggle}>
          {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          <span className="visually-hidden">{open ? 'Close menu' : 'Open menu'}</span>
        </button>
        <Link to={brand.to} className="mobilebar__brand">{brand.name}</Link>
      </div>
      {open && <button type="button" className="sidebar-backdrop" aria-label="Close menu" onClick={toggle} tabIndex={-1} />}

      <aside id="sidebar" className={`sidebar${open ? ' is-open' : ''}`} aria-label="Sidebar">
        <button type="button" className="sidebar__collapse" onClick={onToggleCollapse} aria-pressed={collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
          <span className="sidebar__label">Collapse</span>
        </button>
        <Link to={brand.to} className="brand" aria-label={`${brand.name} home`} title={collapsed ? brand.name : undefined}>
          {brand.logo
            ? <img src={brand.logo} alt="" width={44} height={44} className="logo logo--custom" />
            : <Logo size={44} />}
          <span className="brand__text sidebar__label">
            <span className="brand__name">{brand.name}</span>
            {brand.subtitle && <span className="brand__sub">{brand.subtitle}</span>}
          </span>
        </Link>

        <nav className="sidebar__nav" aria-label="Main">
          <ul>
            {links.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} title={collapsed ? label : undefined}>
                  {Icon && <Icon size={20} aria-hidden="true" />}
                  <span className="sidebar__label">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar__account">
          {topAction}
          {user ? (
            <>
              <Link to="/account" className="who" title={collapsed ? user.full_name : 'Your account'}>
                <Avatar user={user} size={32} />
                <span className="sidebar__label who__text">
                  <span className="who__name">{user.full_name}</span>
                  {role && <span className="badge badge--gold">{ROLES[role]}</span>}
                </span>
              </Link>
              {user.is_platform_admin && !TENANT_SLUG && (
                <NavLink to="/admin-dashboard" className="sidebar__link" title={collapsed ? 'Admin' : undefined}>
                  <ShieldCheck size={20} aria-hidden="true" /><span className="sidebar__label">Admin</span>
                  {user.pending_onboarding > 0 && (
                    <span className="sidebar__badge" title={`${user.pending_onboarding} onboarding request(s) waiting`}>{user.pending_onboarding}</span>
                  )}
                </NavLink>
              )}
              <button type="button" className="sidebar__link" onClick={handleLogout} title={collapsed ? 'Sign out' : undefined}>
                <LogOut size={20} aria-hidden="true" /><span className="sidebar__label">Sign out</span>
              </button>
            </>
          ) : (
            <Link to="/login" state={{ from: location.pathname }} className="sidebar__link sidebar__link--cta" title={collapsed ? 'Sign in' : undefined}>
              <LogIn size={20} aria-hidden="true" /><span className="sidebar__label">Sign in</span>
            </Link>
          )}
        </div>
      </aside>
    </>
  )
}

export function SiteFooter({ church }) {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div>
          <Logo variant="full" size={110} alt={`${PLATFORM.name} logo`} />
          <blockquote className="guiding-text">
            “{GUIDING_TEXT.text}”
            <cite>{GUIDING_TEXT.ref}</cite>
          </blockquote>
        </div>
        {church ? (
          <div>
            <h2 className="site-footer__title">{church.name}</h2>
            <ul>
              {church.address && <li>{church.address}{church.town && `, ${church.town}`}</li>}
              {church.email && <li><a href={`mailto:${church.email}`}>{church.email}</a></li>}
              {church.phone && <li><a href={`tel:${church.phone.replace(/\s/g, '')}`}>{church.phone}</a></li>}
              {church.website && <li><a href={church.website} target="_blank" rel="noreferrer">Website</a></li>}
              <li><Link to={churchPath(church.slug, '/worship')}>Worship times</Link></li>
            </ul>
          </div>
        ) : (
          <div>
            <h2 className="site-footer__title">Explore</h2>
            <ul>
              <li><Link to="/#churches">Find a church</Link></li>
              <li><Link to="/bible">Holy Bible (KJV)</Link></li>
              <li><Link to="/request-onboarding">Bring your church onboard</Link></li>
            </ul>
          </div>
        )}
        <div>
          <h2 className="site-footer__title">{PLATFORM.name}</h2>
          <ul>
            <li><Link to="/">All churches</Link></li>
            <li><Link to="/bible">Bible</Link></li>
          </ul>
        </div>
      </div>
      <div className="container site-footer__base">
        <span>© {new Date().getFullYear()} {PLATFORM.name} ({PLATFORM.subtitle})</span>
        <span className="site-footer__motto">Religious Society of Friends</span>
      </div>
    </footer>
  )
}

/** Shown on every page until the signed-in person confirms their email. */
function VerifyBanner() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  if (!user || user.email_verified || pathname.startsWith('/verify-email')) return null
  return (
    <div className="verify-banner" role="status">
      <div className="container verify-banner__inner">
        <span>Please confirm your email: we sent a link to <strong>{user.email}</strong>. You’ll need it to join churches and use messages.</span>
        <ResendButton className="btn btn--sm btn--gold" />
      </div>
    </div>
  )
}

// Sign-in style pages are a single card that should fit one screen, so they skip the footer.
const AUTH_ROUTES = /^\/(login|register|forgot-password|reset-password|verify-email|request-onboarding|accept-invite)(\/|$)/

export function Page({ brand, links, role, footer, topAction }) {
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  const toggleCollapse = () => setCollapsed((c) => {
    try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1') } catch { /* the preference just isn't remembered */ }
    return !c
  })
  return (
    <div className={`shell${collapsed ? ' is-collapsed' : ''}`}>
      <a className="skip-link" href="#main">Skip to content</a>
      <Sidebar brand={brand} links={links} role={role} collapsed={collapsed} onToggleCollapse={toggleCollapse} topAction={topAction} />
      <div className="shell__main">
        <VerifyBanner />
        <main id="main" tabIndex={-1}>
          {/* Suspense inside <main> keeps the sidebar/footer on screen while a page chunk loads */}
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </main>
        {!AUTH_ROUTES.test(pathname) && footer}
      </div>
    </div>
  )
}

/** Layout for platform pages: home, Bible, sign-in, onboarding. */
export default function PlatformLayout() {
  const { user } = useAuth()
  const hasChurch = Boolean(user?.memberships?.length)
  // What each visitor needs: anonymous people find a church or onboard theirs; members get their churches;
  // on a church's own site these pages (sign in, account) just lead back to the church.
  const links = TENANT_SLUG
    ? [{ to: '/', label: 'Back to the church', icon: House, end: true }]
    : [
      hasChurch
        ? { to: '/', label: 'My churches', icon: House, end: true }
        : { to: '/', label: 'Find a church', icon: Landmark, end: true },
      { to: '/bible', label: 'Bible', icon: BookOpen },
      ...(hasChurch ? [] : [{ to: '/request-onboarding', label: 'Onboard a church', icon: CirclePlus }]),
    ]
  return (
    <Page
      brand={{ to: '/', name: PLATFORM.name, subtitle: PLATFORM.subtitle }}
      links={links}
      footer={<SiteFooter />}
    />
  )
}
