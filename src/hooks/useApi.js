import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

/**
 * Fetch `path` and re-fetch when it changes. Aborts stale requests so a fast
 * typist on the hymnal search never sees results arrive out of order.
 * Pass `null` as path to skip fetching.
 */
export function useApi(path, { auth = true } = {}) {
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const key = path ? `${path}#${version}` : null
  // State remembers which request it belongs to; "loading" is derived, so the
  // effect never sets state synchronously (no cascading renders).
  const [state, setState] = useState({ key: null, data: null, error: null })

  useEffect(() => {
    if (!key) return
    const ctrl = new AbortController()
    api(path, { auth, signal: ctrl.signal })
      .then((data) => setState({ key, data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ key, data: null, error })
      })
    return () => ctrl.abort()
  }, [key, path, auth])

  const current = state.key === key
  return {
    // Previous data stays visible while the next page/search loads.
    data: state.data,
    error: current ? state.error : null,
    loading: Boolean(key) && !current,
    reload,
  }
}

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
