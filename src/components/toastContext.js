import { createContext, useContext, useMemo } from 'react'

export const ToastContext = createContext(null)

/** `toast.success('Saved')`, `.error(...)`, `.info(...)`. Safe to call from effects and handlers. */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

/**
 * Drop-in for the old `[flash, setFlash]` banners: `const flash = useFlash()` then
 * `flash('Saved.')`, `flash({ kind: 'error', text })`. Empty values are ignored.
 */
export function useFlash() {
  const toast = useToast()
  return useMemo(() => (value, kind = 'success') => {
    if (!value) return
    const { kind: k = kind, text } = typeof value === 'string' ? { text: value } : value
    if (text) toast[k === 'error' ? 'error' : k === 'info' ? 'info' : 'success'](text)
  }, [toast])
}
