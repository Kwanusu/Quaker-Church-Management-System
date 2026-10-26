import { API_URL } from '../config'

const ACCESS = 'fp.access'
const REFRESH = 'fp.refresh'

// Storage can throw (private mode, blocked site data) — never let that break the site.
const store = {
  get(key) {
    try { return localStorage.getItem(key) } catch { return null }
  },
  set(key, value) {
    try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch { /* ignore */ }
  },
}

export const tokens = {
  get access() { return store.get(ACCESS) },
  get refresh() { return store.get(REFRESH) },
  save({ access, refresh }) {
    if (access) store.set(ACCESS, access)
    if (refresh) store.set(REFRESH, refresh)
  },
  clear() {
    store.set(ACCESS, null)
    store.set(REFRESH, null)
  },
}

export class ApiError extends Error {
  constructor(status, data) {
    super(ApiError.describe(data) || `Request failed (${status})`)
    this.status = status
    this.data = data
  }

  // DRF returns {detail}, {field: [msgs]} or [msgs]; flatten into one readable line.
  static describe(data) {
    if (!data) return ''
    if (typeof data === 'string') return data
    if (Array.isArray(data)) return data.join(' ')
    if (data.detail) return String(data.detail)
    return Object.entries(data)
      .map(([field, msgs]) => `${field === 'non_field_errors' ? '' : field.replace(/_/g, ' ') + ': '}${[].concat(msgs).join(' ')}`)
      .join(' · ')
  }
}

// One shared refresh request, so ten parallel 401s don't trigger ten refreshes
// (and, with rotation + blacklisting, log the user out).
let refreshing = null
let onAuthLost = () => {}
export function setAuthLostHandler(fn) { onAuthLost = fn }

async function refreshAccess() {
  const refresh = tokens.refresh
  if (!refresh) return false
  refreshing ??= fetch(`${API_URL}/api/v1/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
    .then(async (res) => {
      if (!res.ok) return false
      tokens.save(await res.json())
      return true
    })
    .catch(() => false)
    .finally(() => { refreshing = null })
  return refreshing
}

export async function api(path, { method = 'GET', body, auth = true, signal, retry = true } = {}) {
  const headers = { Accept: 'application/json' }
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData // file uploads (e.g. church logo)
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  const access = tokens.access
  if (auth && access) headers.Authorization = `Bearer ${access}`

  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method, headers, signal, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError(0, 'Cannot reach the server. Please check your connection and try again.')
  }

  // Expired access token: refresh once, then retry once (no infinite loop).
  if (res.status === 401 && auth && access && retry) {
    if (await refreshAccess()) return api(path, { method, body, auth, signal, retry: false })
    tokens.clear()
    onAuthLost()
  }

  if (res.status === 204 || res.status === 205) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 429) throw new ApiError(429, 'Too many requests. Please wait a little and try again.')
    throw new ApiError(res.status, data)
  }
  return data
}

export const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString()
  return s ? `?${s}` : ''
}
