import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useChurch } from './ChurchContext'
import FlashToast from '../components/FlashToast'

/** "Join this church" — signs up/in first if needed, then joins as Attender. */
export default function JoinButton({ className = 'btn btn--gold', compact = false }) {
  const { user, refreshUser } = useAuth()
  const { church, role, reload } = useChurch()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Sidebar variant: icon + short label (the label is hidden when the sidebar is collapsed).
  const label = (text) => (compact ? <><UserPlus size={20} aria-hidden="true" /><span className="sidebar__label">{text}</span></> : text)

  if (role) return null
  if (user && !user.email_verified) {
    return compact
      ? <Link to="/account" className={className} title="Confirm your email to join">{label('Confirm email to join')}</Link>
      : <span className="join-note">Confirm your email to join {church.name}. <Link to="/account">Resend link</Link></span>
  }
  if (!user) {
    return (
      <Link to="/register" state={{ from: location.pathname, join: church.slug, joinName: church.name }} className={className} title={compact ? `Join ${church.name}` : undefined}>
        {label(compact ? 'Join this church' : `Join ${church.name}`)}
      </Link>
    )
  }

  async function join() {
    setBusy(true)
    setError('')
    try {
      await api(`/api/v1/churches/${church.slug}/join/`, { method: 'POST' })
      await refreshUser()
      reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={join} disabled={busy} title={compact ? `Join ${church.name}` : undefined}>
        {label(busy ? 'Joining…' : compact ? 'Join this church' : `Join ${church.name}`)}
      </button>
      <FlashToast kind="error" text={error} />
    </>
  )
}
