import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, tokens } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ErrorState, Loading } from '../components/States'
import { wsUrl } from '../config'
import { formatShortDate, formatTime } from '../format'
import { useApi } from '../hooks/useApi'
import { useChurch } from './ChurchContext'
import FlashToast from '../components/FlashToast'
import { useConfirm } from '../components/confirmContext'
import { useToast } from '../components/toastContext'

const MAX_LENGTH = 2000
const MAX_RETRIES = 5
const MAX_MESSAGES_KEPT = 500

/** Merge messages by id (history and live can overlap), oldest first. */
function merge(existing, incoming) {
  const byId = new Map(existing.map((m) => [m.id, m]))
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id - b.id).slice(-MAX_MESSAGES_KEPT)
}

function useRoom(churchSlug, room) {
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('connecting')
  const [notice, setNotice] = useState('')
  const [older, setOlder] = useState(null) // URL for earlier history, or null
  const socketRef = useRef(null)
  const historyUrl = `/api/v1/churches/${churchSlug}/rooms/${room}/messages/`

  useEffect(() => {
    let socket
    let retries = 0
    let timer
    let stopped = false
    let refreshedOnce = false

    // History is (re)loaded after every (re)connect so nothing sent while we were away is missed.
    const loadHistory = () => api(historyUrl).then((page) => {
      if (stopped) return
      setMessages((m) => merge(m, page.results))
      setOlder((o) => o ?? page.next)
    }).catch(() => {})

    const connect = () => {
      socket = new WebSocket(wsUrl(`/ws/chat/${churchSlug}/${room}/?token=${encodeURIComponent(tokens.access || '')}`))
      socketRef.current = socket
      socket.onopen = () => { retries = 0; setStatus('open'); setNotice(''); loadHistory() }
      socket.onmessage = (e) => {
        let data
        try { data = JSON.parse(e.data) } catch { return }
        if (data.error) { setNotice(data.error); return }
        if (data.event_type === 'message') setMessages((m) => merge(m, [data]))
      }
      socket.onclose = async (e) => {
        if (stopped) return
        if (e.code === 4403) { setStatus('forbidden'); return }
        if (e.code === 4404) { setStatus('missing'); return }
        if (e.code === 4412) { setStatus('unverified'); return }
        if (e.code === 4401 && !refreshedOnce) {
          refreshedOnce = true // access token probably expired: one authenticated call refreshes it
          try { await api('/api/v1/auth/me/') } catch { setStatus('signed-out'); return }
          if (!stopped) connect()
          return
        }
        if (e.code === 4401) { setStatus('signed-out'); return }
        // Network drop: back off 1s, 2s, 4s… and give up after MAX_RETRIES (no endless loop).
        if (retries >= MAX_RETRIES) { setStatus('failed'); return }
        setStatus('reconnecting')
        timer = setTimeout(connect, 1000 * 2 ** retries++)
      }
    }

    // Deferred a tick so React StrictMode's throwaway mount never opens a real socket.
    timer = setTimeout(connect, 0)
    return () => { stopped = true; clearTimeout(timer); socket?.close() }
  }, [churchSlug, room, historyUrl])

  const loadOlder = useCallback(async () => {
    if (!older) return
    const page = await api(older.replace(/^https?:\/\/[^/]+/, ''))
    setMessages((m) => merge(page.results, m))
    setOlder(page.next)
  }, [older])

  const send = (message) => {
    const s = socketRef.current
    if (s?.readyState === WebSocket.OPEN) { s.send(JSON.stringify({ message })); return true }
    return false
  }

  const remove = (id) => setMessages((m) => m.filter((x) => x.id !== id))

  return { messages, status, notice, send, older, loadOlder, remove }
}

const STATUS_TEXT = {
  connecting: 'Connecting…',
  open: 'Connected',
  reconnecting: 'Connection lost — reconnecting…',
  failed: 'Could not connect. Please refresh the page.',
  forbidden: 'Only members of this church can take part.',
  missing: 'This room no longer exists.',
  unverified: 'Please confirm your email address to use messages (see your account page).',
  'signed-out': 'Your session has ended. Please sign in again.',
}

function ChatRoom({ room }) {
  const { user } = useAuth()
  const { slug, api: path, isLeader } = useChurch()
  const toast = useToast()
  const confirm = useConfirm()
  const [draft, setDraft] = useState('')
  const { messages, status, notice, send, older, loadOlder, remove } = useRoom(slug, room.slug)
  const listRef = useRef(null)
  const stickToBottom = useRef(true)

  useEffect(() => {
    const el = listRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  function onSubmit(e) {
    e.preventDefault()
    const text = draft.trim()
    if (text && send(text)) { stickToBottom.current = true; setDraft('') }
  }

  async function del(m) {
    if (!(await confirm({ title: 'Remove this message?', message: 'It will disappear for everyone in the room.', confirmLabel: 'Remove', tone: 'danger' }))) return
    try {
      await api(path(`/messages/${m.id}/`), { method: 'DELETE' })
      remove(m.id)
    } catch (err) { toast.error(err.message) }
  }

  // Insert a date divider whenever the day changes (computed before render).
  const items = []
  messages.forEach((m, i) => {
    const day = formatShortDate(m.timestamp)
    if (i === 0 || day !== formatShortDate(messages[i - 1].timestamp)) items.push({ divider: day })
    items.push(m)
  })

  return (
    <div className="chat__panel card">
      <div className={`chat__status chat__status--${status}`} role="status">
        <span><strong>#{room.name}</strong>{room.description && <span className="muted"> · {room.description}</span>}</span>
        <span>{STATUS_TEXT[status]}</span>
      </div>
      <ol className="chat__messages" ref={listRef} aria-live="polite" aria-label={`${room.name} messages`}
        onScroll={(e) => { const el = e.currentTarget; stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60 }}>
        {older && (
          <li className="chat__older">
            <button type="button" className="btn btn--outline btn--sm" onClick={() => { stickToBottom.current = false; loadOlder() }}>
              Load earlier messages
            </button>
          </li>
        )}
        {messages.length === 0 && status === 'open' && <li className="chat__empty">No messages yet. Say hello.</li>}
        {items.map((m) => {
          if (m.divider) return <li className="msg msg--event" key={`d-${m.divider}`}>{m.divider}</li>
          const mine = m.username === user?.username
          return (
            <li key={m.id} className={`msg${mine ? ' msg--mine' : ''}`}>
              <div className="msg__meta">
                <strong>{m.full_name}</strong> <time dateTime={m.timestamp}>{formatTime(m.timestamp)}</time>
                {isLeader && (
                  <button type="button" className="msg__delete" onClick={() => del(m)} aria-label="Remove message">×</button>
                )}
              </div>
              <div className="msg__text">{m.text}</div>
            </li>
          )
        })}
      </ol>
      <FlashToast kind="info" text={notice} />
      {room.can_post ? (
        <form className="chat__form" onSubmit={onSubmit}>
          <label htmlFor="chat-input" className="visually-hidden">Message</label>
          <textarea id="chat-input" rows={2} maxLength={MAX_LENGTH}
            placeholder={status === 'open' ? `Message #${room.name}…` : 'Waiting for connection…'}
            value={draft} disabled={status !== 'open'} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e) } }} />
          <button className="btn" disabled={status !== 'open' || !draft.trim()}>Send</button>
        </form>
      ) : (
        <p className="chat__readonly muted">Only the Clerk and Recording Clerk post here.</p>
      )}
    </div>
  )
}

export default function Fellowship() {
  const { church, api: path } = useChurch()
  const { data: rooms, error, loading, reload } = useApi(path('/rooms/'))
  const [params, setParams] = useSearchParams()
  const current = rooms?.find((r) => r.slug === params.get('room')) || rooms?.find((r) => r.slug === 'fellowship') || rooms?.[0]

  return (
    <section className="section">
      <div className="container chat">
        <div className="chat__side">
          <div className="eyebrow">Messages</div>
          <h1 className="chat__title">{church.name}</h1>
          <p className="muted">Speak with care, as in meeting. Church rooms are for members; each department’s room is for its own people.</p>
          {rooms && [
            { label: 'Church', list: rooms.filter((r) => !r.department) },
            { label: 'Departments', list: rooms.filter((r) => r.department) },
          ].filter((g) => g.list.length).map((g) => (
            <div key={g.label}>
              <h2 className="chat__group">{g.label}</h2>
              <div className="chat__rooms" role="tablist" aria-label={`${g.label} rooms`}>
                {g.list.map((r) => (
                  <button key={r.slug} type="button" role="tab" aria-selected={current?.slug === r.slug}
                    onClick={() => setParams({ room: r.slug }, { replace: true })}>
                    # {r.name}{r.leaders_only_post && ' 📢'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {loading && !rooms ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : current ? (
          // key: switching rooms gives a fresh socket and history
          <ChatRoom key={current.slug} room={current} />
        ) : <p className="muted">This church has no rooms yet.</p>}
      </div>
    </section>
  )
}
