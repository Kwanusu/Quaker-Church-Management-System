import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ToastContext } from './toastContext'

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info }
const DURATION = { success: 5000, info: 6000, error: 8000 }
const MAX_VISIBLE = 4

function Toast({ toast, onClose }) {
  const Icon = ICONS[toast.kind]
  const timer = useRef(null)
  const start = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onClose(toast.id), toast.duration)
  }, [toast.id, toast.duration, onClose])

  useEffect(() => {
    start()
    return () => clearTimeout(timer.current)
  }, [start])

  return (
    <li className={`toast toast--${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={start}>
      <Icon className="toast__icon" size={20} aria-hidden="true" />
      <p className="toast__text">{toast.text}</p>
      <button type="button" className="toast__close" onClick={() => onClose(toast.id)} aria-label="Dismiss notification">
        <X size={16} aria-hidden="true" />
      </button>
    </li>
  )
}

/** Mounts the toast stack once, near the root. Toasts pause while hovered and never block the page. */
export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismiss = useCallback((id) => setToasts((all) => all.filter((t) => t.id !== id)), [])
  const push = useCallback((kind, text, options = {}) => {
    const id = ++nextId.current
    setToasts((all) => [...all.filter((t) => t.text !== text).slice(1 - MAX_VISIBLE), { id, kind, text, duration: options.duration ?? DURATION[kind] }])
    return id
  }, [])

  const api = useMemo(() => ({
    success: (text, o) => push('success', text, o),
    error: (text, o) => push('error', text, o),
    info: (text, o) => push('info', text, o),
    dismiss,
  }), [push, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ol className="toaster" aria-label="Notifications">
        {toasts.map((t) => <Toast key={t.id} toast={t} onClose={dismiss} />)}
      </ol>
    </ToastContext.Provider>
  )
}
