import { createContext, useContext } from 'react'
import { LEADERSHIP_ROLES, MEMBER_ROLES } from '../config'

export const ChurchContext = createContext(null)

/** Current church (from /c/:slug) plus the signed-in user's role there. */
export function useChurch() {
  const ctx = useContext(ChurchContext)
  if (!ctx) throw new Error('useChurch must be used inside a church page')
  return ctx
}

export function roleFlags(role) {
  return {
    role,
    isMember: MEMBER_ROLES.includes(role),
    isLeader: LEADERSHIP_ROLES.includes(role),
    isClerk: role === 'clerk',
  }
}
