import { createContext, useContext } from 'react'

export const ConfirmContext = createContext(null)

/**
 * Replaces window.confirm / window.alert with a modal.
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title: 'Remove Grace?', message: '…', confirmLabel: 'Remove', tone: 'danger' }))) return
 * Resolves true when confirmed, false when cancelled, dismissed or Escape is pressed.
 * Pass `confirm({ ..., cancelLabel: null })` for a notice with a single button.
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}
