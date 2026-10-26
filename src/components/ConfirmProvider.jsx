import { CircleHelp, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmContext } from './confirmContext'

/** A native <dialog> gives us the focus trap, Escape key and inert background for free. */
function ConfirmDialog({ request, onDone }) {
  const ref = useRef(null)
  const { title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default' } = request
  const Icon = tone === 'danger' ? TriangleAlert : CircleHelp

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog ref={ref} className={`modal modal--${tone}`} aria-labelledby="modal-title" aria-describedby="modal-text"
      onCancel={(e) => { e.preventDefault(); onDone(false) }}
      onClick={(e) => { if (e.target === ref.current) onDone(false) }}>
      <div className="modal__body">
        <span className="modal__icon" aria-hidden="true"><Icon size={26} /></span>
        <div>
          <h2 id="modal-title" className="modal__title">{title}</h2>
          {message && <p id="modal-text" className="modal__text">{message}</p>}
        </div>
      </div>
      <div className="modal__actions">
        {cancelLabel && <button type="button" className="btn btn--outline" onClick={() => onDone(false)}>{cancelLabel}</button>}
        <button type="button" className={`btn${tone === 'danger' ? ' btn--danger' : ''}`} autoFocus onClick={() => onDone(true)}>{confirmLabel}</button>
      </div>
    </dialog>
  )
}

/** Mounts the confirmation modal once, near the root. */
export default function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null)
  const resolver = useRef(null)

  const finish = useCallback((answer) => {
    resolver.current?.(answer)
    resolver.current = null
    setRequest(null)
  }, [])

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current?.(false) // a newer question replaces an unanswered one
    resolver.current = resolve
    setRequest(typeof options === 'string' ? { title: options } : options)
  }), [])

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {request && <ConfirmDialog key={request.title + (request.message || '')} request={request} onDone={finish} />}
    </ConfirmContext.Provider>
  )
}
