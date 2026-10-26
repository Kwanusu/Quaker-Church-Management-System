import { TENANT_BASE_DOMAIN } from './config'

// Mirrors RESERVED_SLUGS in churches/models.py: these names belong to the platform, not to a church.
const RESERVED = new Set([
  'admin', 'api', 'new', 'register', 'login', 'bible', 'static', 'media', 'ws', 'c', 'www', 'app', 'mail', 'smtp',
  'ftp', 'cdn', 'status', 'support', 'help', 'blog', 'dev', 'staging', 'test', 'platform', 'onboarding', 'accept-invite',
])

const hostnameOf = (v) => (v || '').split(':')[0].trim().toLowerCase().replace(/\.$/, '')

/** 'kaimosi.friends.example.org' → 'kaimosi' when the platform's base domain is friends.example.org, else null. */
export function tenantSlugFromHost(host = window.location.hostname) {
  const base = hostnameOf(TENANT_BASE_DOMAIN)
  const h = hostnameOf(host)
  if (!base || !h.endsWith(`.${base}`)) return null
  const label = h.slice(0, -(base.length + 1))
  return label.includes('.') || RESERVED.has(label) ? null : label
}

/** The church whose own site this is (its subdomain), or null on the platform's site and in development. */
export const TENANT_SLUG = tenantSlugFromHost()

/**
 * Address of a page inside a church. On that church's own site it is just the path ('/worship');
 * elsewhere it's /c/<slug>/…; for a different church than the site's it's that church's own subdomain.
 */
export function churchPath(slug, sub = '') {
  if (TENANT_SLUG === slug) return sub || '/'
  if (TENANT_SLUG && TENANT_BASE_DOMAIN) return `${window.location.protocol}//${slug}.${TENANT_BASE_DOMAIN}${sub}`
  return `/c/${slug}${sub}`
}

export const isExternal = (to) => /^https?:\/\//.test(to)
