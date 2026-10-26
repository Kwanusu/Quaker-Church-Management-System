import { useState } from 'react'
import { api } from '../api/client'
import { useToast } from './toastContext'

/** "Send a new link" for email confirmation. */
export default function ResendButton({ className = 'btn btn--outline' }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function resend() {
    setBusy(true)
    try { toast.success((await api('/api/v1/auth/verify-email/resend/', { method: 'POST' })).detail) } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }
  return (
    <button type="button" className={className} onClick={resend} disabled={busy}>{busy ? 'Sending…' : 'Send a new link'}</button>
  )
}
