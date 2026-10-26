import { useState } from 'react'
import { api } from '../api/client'
import { useToast } from '../components/toastContext'
import { useChurch } from './ChurchContext'

/** A church the platform has onboarded stays out of the directory until its Clerk publishes it. */
export default function PublishBanner() {
  const { church, slug, reload, isClerk } = useChurch()
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  if (church.status === 'active' || !isClerk) return null

  async function publish() {
    setBusy(true)
    try {
      const r = await api(`/api/v1/churches/${slug}/publish/`, { method: 'POST' })
      toast.success(r.detail)
      reload()
    } catch (err) {
      toast.error(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="card card--gold publish">
      <h2>Not live yet</h2>
      <p>
        {church.name} is visible only to you and the people you add. When your details, worship times and hymns look right,
        publish it to list it in the directory{church.url ? <> at <strong>{church.url.replace(/^https?:\/\//, '')}</strong></> : null}.
      </p>
      <button type="button" className="btn" disabled={busy} onClick={publish}>{busy ? 'Publishing…' : 'Publish my church'}</button>
    </div>
  )
}
