const env = import.meta.env

/** The platform (the network of churches). Each church has its own name/logo from the API. */
export const PLATFORM = {
  name: env.VITE_PLATFORM_NAME || 'Friends Church',
  subtitle: env.VITE_PLATFORM_SUBTITLE || 'Quakers',
  tagline: env.VITE_PLATFORM_TAGLINE || 'One home online for every Friends meeting: worship, Scripture, song and fellowship.',
}

export const GUIDING_TEXT = {
  text: 'You are my friends if you do what I command you.',
  ref: 'John 15:14',
}

// Churches live at <slug>.<base domain> in production (set VITE_TENANT_BASE_DOMAIN); /c/<slug> otherwise.
export const TENANT_BASE_DOMAIN = (env.VITE_TENANT_BASE_DOMAIN || '').trim().toLowerCase()
/** Display address of a church's page, e.g. kaimosi.friends.example.org or localhost:5174/c/kaimosi. */
export const churchAddress = (slug) => (TENANT_BASE_DOMAIN ? `${slug}.${TENANT_BASE_DOMAIN}` : `${window.location.host}/c/${slug}`)
export const API_URL = (env.VITE_API_URL || '').replace(/\/$/, '')
// The Django admin (system admin only). In development the backend runs on port 8000.
export const DJANGO_ADMIN_URL = env.VITE_DJANGO_ADMIN_URL || `${API_URL || 'http://localhost:8000'}/admin/`

export function wsUrl(path) {
  const base = API_URL || window.location.origin
  return base.replace(/^http/, 'ws') + path
}

/** Absolute URL for files served by the backend (e.g. uploaded logos). */
export function mediaUrl(url) {
  if (!url) return ''
  return /^https?:/.test(url) ? url : `${API_URL}${url}`
}

export const ROLES = {
  attender: 'Attender',
  member: 'Member',
  recording_clerk: 'Recording Clerk',
  clerk: 'Clerk',
}

export const MEMBER_ROLES = ['member', 'recording_clerk', 'clerk']

// Roles inside a department. Officials (all but Member) manage the department's people.
export const DEPARTMENT_ROLES = {
  member: 'Member',
  chairperson: 'Chairperson',
  vice_chairperson: 'Vice Chairperson',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
}
export const DEPARTMENT_OFFICIALS = ['chairperson', 'vice_chairperson', 'secretary', 'treasurer']
export const LEADERSHIP_ROLES = ['recording_clerk', 'clerk']

export const SONG_TYPES = { hymn: 'Hymn', poem: 'Spiritual Poem', reading: 'Scripture Reading' }

export const EVENT_TYPES = {
  worship: 'Sunday Worship',
  special: 'Special Meeting',
  adult_ed: 'Adult Education',
  committee: 'Committee Meeting',
}

export const BIBLE_VERSION = 'kjv'
