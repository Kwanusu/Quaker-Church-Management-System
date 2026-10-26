import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ChurchLayout from './church/ChurchLayout'
import ConfirmProvider from './components/ConfirmProvider'
import ToastProvider from './components/ToastProvider'
import PlatformLayout from './components/Layout'
import RequireRole, { RequireAdmin, RequireAuth } from './components/RequireRole'
import { LEADERSHIP_ROLES, MEMBER_ROLES } from './config'
import { TENANT_SLUG } from './tenant'
import NotFound from './pages/NotFound'
import PlatformHome from './pages/PlatformHome'
import './App.css'

// Pages load on demand; member/clerk-only pages never load for visitors.
const Bible = lazy(() => import('./pages/Bible'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const RequestOnboarding = lazy(() => import('./pages/RequestOnboarding'))
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'))
const Account = lazy(() => import('./pages/Account'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const ForgotPassword = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.ForgotPassword })))
const ResetPassword = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.ResetPassword })))
const VerifyEmail = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.VerifyEmail })))
const Unsubscribe = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.Unsubscribe })))
const ChurchHome = lazy(() => import('./church/ChurchHome'))
const Worship = lazy(() => import('./church/Worship'))
const Hymnal = lazy(() => import('./church/Hymnal').then((m) => ({ default: m.Hymnal })))
const SongDetail = lazy(() => import('./church/Hymnal').then((m) => ({ default: m.SongDetail })))
const Queries = lazy(() => import('./church/Queries'))
const Fellowship = lazy(() => import('./church/Fellowship'))
const Manage = lazy(() => import('./church/Manage'))
const Departments = lazy(() => import('./church/Departments').then((m) => ({ default: m.Departments })))
const DepartmentPage = lazy(() => import('./church/Departments').then((m) => ({ default: m.DepartmentPage })))

function ChurchBible() {
  const { slug } = useParams()
  return <Bible base={TENANT_SLUG ? '/bible' : `/c/${slug}/bible`} />
}

const churchPages = (
  <>
    <Route index element={<ChurchHome />} />
    <Route path="worship" element={<Worship />} />
    <Route path="hymnal" element={<Hymnal />} />
    <Route path="hymnal/:id" element={<SongDetail />} />
    <Route path="bible" element={<ChurchBible />} />
    <Route path="bible/:book/:chapter" element={<ChurchBible />} />
    <Route path="queries" element={<Queries />} />
    <Route path="departments" element={<Departments />} />
    <Route path="departments/:dept" element={<DepartmentPage />} />
    <Route
      path="fellowship"
      element={
        <RequireRole allow={MEMBER_ROLES} allowDepartments reason="Messages are open to members of this church and of its departments.">
          <Fellowship />
        </RequireRole>
      }
    />
    <Route
      path="manage"
      element={
        <RequireRole allow={LEADERSHIP_ROLES} reason="Only the Clerk and Recording Clerk can manage this church.">
          <Manage />
        </RequireRole>
      }
    />
    <Route path="*" element={<NotFound />} />
  </>
)

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
        <AuthProvider>
          <Routes>
            {TENANT_SLUG ? (
              <>
                {/* A church's own site (its subdomain): the church is the whole site. */}
                <Route element={<PlatformLayout />}>
                  <Route path="login" element={<Login />} />
                  <Route path="register" element={<Register />} />
                  <Route path="account" element={<RequireAuth to="/login"><Account /></RequireAuth>} />
                  <Route path="forgot-password" element={<ForgotPassword />} />
                  <Route path="reset-password/:uid/:token" element={<ResetPassword />} />
                  <Route path="verify-email/:token" element={<VerifyEmail />} />
                  <Route path="unsubscribe/:token" element={<Unsubscribe />} />
                </Route>
                <Route path="/" element={<ChurchLayout />}>
                  {churchPages}
                </Route>
              </>
            ) : (
              <>
                {/* Platform: directory, Bible, accounts, onboarding */}
                <Route element={<PlatformLayout />}>
                  <Route index element={<PlatformHome />} />
                  <Route path="bible" element={<Bible />} />
                  <Route path="bible/:book/:chapter" element={<Bible />} />
                  <Route path="login" element={<Login />} />
                  <Route path="register" element={<Register />} />
                  {/* Churches are onboarded by the platform: they ask, an admin approves, the first Clerk accepts an invitation. */}
                  <Route path="request-onboarding" element={<RequestOnboarding />} />
                  <Route path="churches/new" element={<Navigate to="/request-onboarding" replace />} />
                  <Route path="accept-invite/:token" element={<AcceptInvite />} />
                  <Route path="account" element={<RequireAuth to="/login"><Account /></RequireAuth>} />
                  <Route path="admin-dashboard" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
                  <Route path="forgot-password" element={<ForgotPassword />} />
                  <Route path="reset-password/:uid/:token" element={<ResetPassword />} />
                  <Route path="verify-email/:token" element={<VerifyEmail />} />
                  <Route path="unsubscribe/:token" element={<Unsubscribe />} />
                  <Route path="*" element={<NotFound />} />
                </Route>

                {/* One church: /c/<slug>/... */}
                <Route path="c/:slug" element={<ChurchLayout />}>
                  {churchPages}
                </Route>
              </>
            )}
          </Routes>
        </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
