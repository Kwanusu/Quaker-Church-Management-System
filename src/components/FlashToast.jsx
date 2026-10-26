import { useEffect } from 'react'
import { useToast } from './toastContext'

/**
 * Shows a toast whenever `flash` changes: a string, or `{ kind: 'success' | 'error' | 'info', text }`.
 * Lets screens that keep a "last result" in state notify with a toast instead of a banner.
 * Or pass `kind` + `text` directly. Renders nothing.
 */
export default function FlashToast({ flash, kind = 'success', text }) {
  const toast = useToast()
  const message = text ?? (typeof flash === 'string' ? flash : flash?.text)
  const level = (flash && typeof flash === 'object' ? flash.kind : null) || kind
  useEffect(() => {
    if (message) toast[level === 'error' ? 'error' : level === 'info' ? 'info' : 'success'](message)
    // `flash` identity is the trigger, so repeating the same message after a new action still notifies.
  }, [flash, message, level, toast])
  return null
}
