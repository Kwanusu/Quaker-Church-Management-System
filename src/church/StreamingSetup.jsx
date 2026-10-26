import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, tokens } from '../api/client'
import { ErrorState, Loading } from '../components/States'
import { wsUrl } from '../config'
import { formatTimeRange, isLive } from '../format'
import { useApi } from '../hooks/useApi'
import { useChurch } from './ChurchContext'
import FlashToast from '../components/FlashToast'
import { useConfirm } from '../components/confirmContext'

/*
  Live studio (Manage → Live streaming).
  Camcorder → capture card → this page (preview, sound meter) → our server → YouTube Live.
  The server re-encodes with ffmpeg and uses the church's saved stream key, which never reaches the browser.
*/

const QUALITY = {
  '480p': 'Standard (480p): slow internet',
  '720p': 'HD (720p): recommended',
  '1080p': 'Full HD (1080p): fast internet',
}
const CLOSE_REASONS = {
  4401: 'Please sign in again.',
  4403: 'Only the Clerk can broadcast.',
  4404: 'This church could not be found.',
  4412: 'Please confirm your email address first.',
}
const RECORDER_TYPES = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=h264,opus', 'video/webm']
const store = {
  get: (k) => { try { return localStorage.getItem(k) || '' } catch { return '' } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
}

function clock(seconds) {
  const s = Math.max(0, seconds | 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`
}

function shortWhen(iso) {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/* ------------------------------------------------------------ camera, microphone, sound meter */
function useDevices(width, height) {
  const supported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
  const [stream, setStream] = useState(null)
  const [devices, setDevices] = useState({ video: [], audio: [] })
  const [videoId, setVideoId] = useState(() => store.get('studio.video'))
  const [audioId, setAudioId] = useState(() => store.get('studio.audio'))
  const [error, setError] = useState('')
  const [level, setLevel] = useState(0)
  const streamRef = useRef(null)

  const listDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices()
    setDevices({ video: all.filter((d) => d.kind === 'videoinput'), audio: all.filter((d) => d.kind === 'audioinput') })
  }, [])

  const start = useCallback(async (vId = videoId, aId = audioId) => {
    setError('')
    streamRef.current?.getTracks().forEach((t) => t.stop())
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: vId ? { exact: vId } : undefined, width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: 30 } },
        audio: aId === 'none' ? false : { deviceId: aId ? { exact: aId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      streamRef.current = s
      setStream(s)
      await listDevices()
    } catch (err) {
      streamRef.current = null
      setStream(null)
      setError(err.name === 'NotAllowedError'
        ? 'The browser was not allowed to use the camera. Click the camera icon in the address bar and allow it, then try again.'
        : err.name === 'NotFoundError' || err.name === 'OverconstrainedError'
          ? 'That camera or microphone is not connected. Check the cable and capture card, then choose it again.'
          : err.name === 'NotReadableError'
            ? 'The camera is busy in another program (close OBS, Zoom or the Camera app) and try again.'
            : err.message)
    }
  }, [videoId, audioId, width, height, listDevices])

  const choose = useCallback((kind, id) => {
    if (kind === 'video') { setVideoId(id); store.set('studio.video', id); start(id, audioId) }
    else { setAudioId(id); store.set('studio.audio', id); start(videoId, id) }
  }, [start, videoId, audioId])

  // Sound meter
  useEffect(() => {
    const track = stream?.getAudioTracks()[0]
    if (!track) return undefined
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser)
    const buf = new Float32Array(analyser.fftSize)
    let raf
    const tick = () => {
      analyser.getFloatTimeDomainData(buf)
      let peak = 0
      for (const v of buf) peak = Math.max(peak, Math.abs(v))
      setLevel(peak)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => { cancelAnimationFrame(raf); ctx.close() }
  }, [stream])

  // Turn the camera off when leaving the page
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])

  return { supported, stream, devices, videoId, audioId, error, level, start, choose }
}

/* ------------------------------------------------------------ the broadcast itself */
function useBroadcast({ churchSlug, stream, onChange }) {
  const [state, setState] = useState('idle') // idle | connecting | starting | live | ended | failed
  const [message, setMessage] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [kbps, setKbps] = useState(0)
  const [backlog, setBacklog] = useState(false)
  const ws = useRef(null)
  const recorder = useRef(null)
  const ended = useRef(false)

  const cleanup = useCallback(() => {
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop()
    recorder.current = null
    if (ws.current && ws.current.readyState <= 1) ws.current.close()
    ws.current = null
  }, [])

  useEffect(() => cleanup, [cleanup]) // leaving the page ends the broadcast

  const goLive = useCallback(({ eventId, takeover = false }) => {
    const mimeType = RECORDER_TYPES.find((t) => window.MediaRecorder?.isTypeSupported(t))
    if (!mimeType) {
      setState('failed')
      setMessage('This browser can’t broadcast. Please use Chrome or Edge on a laptop.')
      return
    }
    ended.current = false
    setState('connecting')
    setMessage('Connecting to the server…')
    setSeconds(0)
    setKbps(0)
    const socket = new WebSocket(wsUrl(`/ws/stream/${churchSlug}/?token=${encodeURIComponent(tokens.access || '')}`))
    socket.binaryType = 'arraybuffer'
    ws.current = socket

    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'ready') {
        if (!msg.available) { setState('failed'); setMessage(msg.reason); socket.close(); return }
        socket.send(JSON.stringify({ action: 'start', event: eventId || null, has_audio: stream.getAudioTracks().length > 0, takeover }))
        return
      }
      if (msg.type !== 'status') return
      if (msg.state === 'starting' && !recorder.current) {
        const settings = stream.getVideoTracks()[0]?.getSettings() || {}
        const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: Math.min(8_000_000, (settings.height || 720) >= 1000 ? 6_000_000 : 3_500_000), audioBitsPerSecond: 128_000 })
        rec.ondataavailable = (ev) => {
          if (ev.data.size && socket.readyState === 1) {
            socket.send(ev.data)
            setBacklog(socket.bufferedAmount > 4_000_000) // upload can't keep up
          }
        }
        rec.start(500)
        recorder.current = rec
        onChange?.()
      }
      if (['starting', 'live'].includes(msg.state)) {
        setState(msg.state)
        setMessage(msg.message)
        if (msg.seconds != null) setSeconds(msg.seconds)
        if (msg.kbps != null) setKbps(msg.kbps)
        if (msg.state === 'live' && msg.seconds <= 1) onChange?.()
      }
      if (['ended', 'failed'].includes(msg.state)) {
        ended.current = true
        setState(msg.state)
        setMessage(msg.message)
        cleanup()
        onChange?.()
      }
    }
    socket.onclose = (e) => {
      if (ended.current) return
      ended.current = true
      setState('failed')
      setMessage(CLOSE_REASONS[e.code] || 'The connection to the server was lost. Check the internet connection and go live again.')
      cleanup()
      onChange?.()
    }
  }, [churchSlug, stream, cleanup, onChange])

  const end = useCallback(() => {
    if (ws.current?.readyState === 1) {
      if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop()
      ws.current.send(JSON.stringify({ action: 'stop' }))
      setMessage('Ending…')
    } else cleanup()
  }, [cleanup])

  const onAir = ['connecting', 'starting', 'live'].includes(state)

  // Closing the tab while live would cut the broadcast: ask first.
  useEffect(() => {
    if (!onAir) return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [onAir])

  return { state, message, seconds, kbps, backlog, onAir, goLive, end }
}

/* ------------------------------------------------------------ small pieces */
function CopyField({ label, value, secret = false, hint }) {
  const [copied, setCopied] = useState(false)
  const [shown, setShown] = useState(!secret)
  const id = useId()
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked: the value is still selectable */ }
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && <span className="hint">{hint}</span>}
      <div className="copy-field">
        <input id={id} readOnly value={shown ? value : '•'.repeat(Math.min(value.length, 24))} onFocus={(e) => shown && e.target.select()} />
        {secret && <button type="button" className="btn btn--outline btn--sm" onClick={() => setShown((s) => !s)}>{shown ? 'Hide' : 'Show'}</button>}
        <button type="button" className="btn btn--sm" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
      </div>
    </div>
  )
}

function Check({ ok, title, children }) {
  return (
    <li className={`studio-check ${ok ? 'is-ok' : 'is-todo'}`}>
      <span className="studio-check__icon" aria-hidden="true">{ok ? '✓' : '!'}</span>
      <div><strong>{title}</strong>{children && <div className="studio-check__body">{children}</div>}</div>
    </li>
  )
}

function KeyForm({ hasKey, last4, onSave, busy }) {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(!hasKey)
  if (!open) return <button type="button" className="linklike" onClick={() => setOpen(true)}>Change key (ends …{last4})</button>
  return (
    <form className="studio-key" onSubmit={(e) => { e.preventDefault(); onSave(value.trim()).then((ok) => ok && (setValue(''), setOpen(false))) }}>
      <label htmlFor="studio-key" className="visually-hidden">YouTube stream key</label>
      <input id="studio-key" value={value} onChange={(e) => setValue(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
        autoComplete="off" spellCheck={false} required pattern="[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3,5}" />
      <button className="btn btn--sm" disabled={busy}>Save</button>
      {hasKey && <button type="button" className="btn btn--outline btn--sm" onClick={() => setOpen(false)}>Cancel</button>}
      <span className="hint">YouTube Studio → Create → Go live → Stream → “Stream key” (choose a reusable one).</span>
    </form>
  )
}

/* ------------------------------------------------------------ the studio */
export default function StreamingSetup() {
  const confirm = useConfirm()
  const { church, api: path, base } = useChurch()
  const { data, error, loading, reload } = useApi(path('/streaming/'))
  const events = useApi(path('/schedules/upcoming/'))
  const [flash, setFlash] = useState(null)
  const [busy, setBusy] = useState(false)
  const [eventId, setEventId] = useState(null)
  const [revealed, setRevealed] = useState('')
  const videoRef = useRef(null)

  const bs = data?.browser_streaming
  const media = useDevices(bs?.width || 1280, bs?.height || 720)
  const cast = useBroadcast({ churchSlug: church.slug, stream: media.stream, onChange: reload })

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = media.stream
  }, [media.stream])

  // Suggest the event happening now, or the next one within 3 hours.
  const [openedAt] = useState(() => Date.now())
  const suggested = useMemo(() => {
    const list = events.data || []
    const soon = openedAt + 3 * 3600_000
    return list.find((e) => isLive(e, openedAt)) || list.find((e) => new Date(e.start_time) <= soon) || null
  }, [events.data, openedAt])
  const chosenEvent = eventId === null ? suggested?.id ?? '' : eventId

  async function save(body, message) {
    setBusy(true)
    setFlash(null)
    try {
      await api(path('/streaming/'), { method: 'PATCH', body })
      setFlash({ kind: 'success', text: message })
      reload()
      return true
    } catch (err) {
      setFlash({ kind: 'error', text: err.data?.stream_key ? [].concat(err.data.stream_key).join(' ') : err.message })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function stopElsewhere() {
    if (!(await confirm({ title: 'End the other broadcast?', message: 'A broadcast is running on another device. Viewers will see it end.', confirmLabel: 'End it', tone: 'danger' }))) return
    try {
      await api(path('/streaming/stop/'), { method: 'POST' })
      setFlash({ kind: 'success', text: 'The other broadcast was ended.' })
      reload()
    } catch (err) { setFlash({ kind: 'error', text: err.message }) }
  }

  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const liveElsewhere = data.live_session && !cast.onAir
  const camOk = Boolean(media.stream?.getVideoTracks().length)
  const ready = bs.available && camOk && !liveElsewhere
  const statusLabel = { connecting: 'Connecting…', starting: 'Starting…', live: 'Live' }[cast.state] || 'Off air'

  return (
    <div className="studio">
      <div className="studio__bar">
        <h2>Live studio</h2>
        <div className={`studio__status studio__status--${cast.state === 'live' ? 'live' : cast.onAir ? 'starting' : 'off'}`} role="status" aria-live="polite">
          <span className="studio__dot" aria-hidden="true" />
          <strong>{statusLabel}</strong>
          {cast.state === 'live' && <span className="studio__clock">{clock(cast.seconds)}</span>}
          {cast.onAir && cast.kbps > 0 && <span className="muted">{(cast.kbps / 1000).toFixed(1)} Mbps</span>}
        </div>
      </div>

      <FlashToast flash={flash} />
      {liveElsewhere && (
        <div className="alert alert--warning studio__elsewhere">
          <span><strong>{church.name} is live from another device</strong>{data.live_session.started_by && ` (started by ${data.live_session.started_by}`}{data.live_session.started_at && `, ${shortWhen(data.live_session.started_at)})`}.</span>
          <span className="manage__actions">
            <button type="button" className="btn btn--danger btn--sm" onClick={stopElsewhere}>End it</button>
            <button type="button" className="btn btn--outline btn--sm" disabled={!bs.available || !camOk}
              onClick={() => cast.goLive({ eventId: chosenEvent, takeover: true })}>Take over from here</button>
          </span>
        </div>
      )}
      {['ended', 'failed'].includes(cast.state) && (
        <FlashToast kind={cast.state === 'failed' ? 'error' : 'success'}
          text={`${cast.state === 'ended' ? 'Broadcast ended. ' : ''}${cast.message || ''}`.trim()} />
      )}
      {cast.backlog && <p className="alert alert--warning">Your internet upload is struggling to keep up. Choose a lower quality next time, or move closer to the router.</p>}

      <div className="studio__grid">
        <div className="studio__main">
          <div className={`studio__screen${cast.state === 'live' ? ' is-live' : ''}`}>
            <video ref={videoRef} autoPlay muted playsInline aria-label="Camera preview" />
            {!camOk && (
              <div className="studio__placeholder">
                {!media.supported ? (
                  <p>This page needs a secure (https) address to use the camera, in Chrome or Edge.</p>
                ) : (
                  <>
                    <p>Connect the camcorder (HDMI → capture card → USB), then:</p>
                    <button type="button" className="btn btn--gold" onClick={() => media.start()}>Turn on camera</button>
                  </>
                )}
              </div>
            )}
            {cast.state === 'live' && <span className="studio__onair">● LIVE</span>}
          </div>
          <div className="studio__meter" aria-hidden="true">
            <span style={{ width: `${Math.min(100, Math.round(Math.sqrt(media.level) * 100))}%` }} className={media.level > 0.9 ? 'is-hot' : ''} />
          </div>
          {media.error && <p className="alert alert--error" role="alert">{media.error}</p>}

          <div className="studio__controls">
            <div className="field">
              <label htmlFor="studio-cam">Camera</label>
              <select id="studio-cam" value={media.videoId} disabled={!media.devices.video.length || cast.onAir}
                onChange={(e) => media.choose('video', e.target.value)}>
                {!media.devices.video.length && <option value="">Turn on the camera to choose</option>}
                {media.devices.video.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="studio-mic">Sound</label>
              <select id="studio-mic" value={media.audioId} disabled={!camOk || cast.onAir}
                onChange={(e) => media.choose('audio', e.target.value)}>
                {media.devices.audio.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>)}
                <option value="none">No sound</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="studio-event">On air</label>
              <select id="studio-event" value={chosenEvent} disabled={cast.onAir} onChange={(e) => setEventId(e.target.value)}>
                <option value="">No particular event</option>
                {(events.data || []).map((e) => (
                  <option key={e.id} value={e.id}>{e.title} · {shortWhen(e.start_time)}{e.is_published ? '' : ' (draft)'}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="studio__go">
            {cast.onAir ? (
              <button type="button" className="btn btn--danger btn--lg"
                onClick={async () => await confirm({ title: 'End the broadcast?', message: 'It stops for everyone watching.', confirmLabel: 'End broadcast', tone: 'danger' }) && cast.end()}>■ End broadcast</button>
            ) : (
              <button type="button" className="btn btn--live btn--lg" disabled={!ready}
                onClick={() => cast.goLive({ eventId: chosenEvent })}>● Go live</button>
            )}
            <p className="muted">
              {cast.onAir
                ? 'Keep this page open while you are live. Closing it or turning off the laptop ends the broadcast.'
                : ready ? 'YouTube shows the stream about 15–30 seconds after you go live.'
                  : 'Complete the checklist to go live.'}
            </p>
          </div>
        </div>

        <aside className="studio__side">
          <div className="card">
            <h3>Before you go live</h3>
            <ul className="studio-checks">
              <Check ok={data.has_stream_key} title="YouTube stream key">
                <KeyForm hasKey={data.has_stream_key} last4={data.stream_key_last4} busy={busy}
                  onSave={(key) => save({ stream_key: key }, 'Stream key saved.')} />
              </Check>
              <Check ok={Boolean(church.youtube_channel_id)} title="Channel shown on your church page">
                {church.youtube_channel_id
                  ? <span className="muted">Viewers watch at <Link to={base || '/'}>your church page</Link> or on YouTube.</span>
                  : <>Add your channel ID in <Link to={`${base}/manage?tab=settings`}>Church settings</Link> so people can watch on your page.</>}
              </Check>
              <Check ok={bs.server_ready} title="Server ready">
                {!bs.server_ready && 'ffmpeg is not installed on the server, so it can’t send video to YouTube. See the setup guide, or use OBS below.'}
              </Check>
              <Check ok={camOk} title="Camera on">
                {!camOk && 'Turn on the camera and check the picture.'}
              </Check>
            </ul>
            <div className="field">
              <label htmlFor="studio-quality">Quality</label>
              <select id="studio-quality" value={data.resolution} disabled={cast.onAir || busy}
                onChange={(e) => save({ resolution: e.target.value }, 'Quality saved.').then((ok) => ok && camOk && media.start())}>
                {Object.entries(QUALITY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <span className="hint">Needs an upload speed of at least {{ '480p': 3, '720p': 5, '1080p': 8 }[data.resolution]} Mbps.</span>
            </div>
            <p className="studio__links">
              <a href={church.youtube_channel_id ? `https://studio.youtube.com/channel/${church.youtube_channel_id}/livestreaming` : 'https://studio.youtube.com'}
                target="_blank" rel="noreferrer">YouTube Studio ↗</a>
              <Link to={base || '/'} target="_blank">Church page ↗</Link>
            </p>
          </div>

          <div className="card">
            <h3>Recent broadcasts</h3>
            {!data.recent_sessions.length ? <p className="muted">None yet.</p> : (
              <ul className="plain-list studio-history">
                {data.recent_sessions.map((s) => (
                  <li key={s.id}>
                    <div>
                      <strong>{s.event || 'Broadcast'}</strong>
                      <div className="muted">{shortWhen(s.started_at)}{s.started_by && ` · ${s.started_by}`}</div>
                      {s.status === 'failed' && <div className="field-error">{s.end_reason}</div>}
                    </div>
                    <span className={`badge ${s.status === 'failed' ? 'badge--live' : ['live', 'starting'].includes(s.status) ? 'badge--gold' : ''}`}>
                      {s.status === 'failed' ? 'Failed' : ['live', 'starting'].includes(s.status) ? 'On air' : clock(s.duration_seconds)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <details className="card studio__encoder">
        <summary>Use OBS or a hardware encoder instead</summary>
        <p className="muted">
          For several cameras, titles or a dedicated streaming box (ATEM Mini, YoloBox…), send to YouTube directly with
          these details. In OBS: Settings → Stream → Service “YouTube - RTMPS”, then paste the key.
        </p>
        <CopyField label="Server" value={data.secure_server_url} />
        <CopyField label="Backup server (optional)" value={data.backup_server_url} />
        {data.has_stream_key && (revealed
          ? <CopyField label="Stream key" value={revealed} secret />
          : <button type="button" className="btn btn--outline btn--sm"
            onClick={async () => { try { setRevealed((await api(path('/streaming/?reveal=1'))).stream_key) } catch (err) { setFlash({ kind: 'error', text: err.message }) } }}>
            Show stream key to copy
          </button>)}
        <form className="form studio__notes" onSubmit={(e) => { e.preventDefault(); save({ notes: new FormData(e.currentTarget).get('notes') }, 'Notes saved.') }}>
          <label htmlFor="studio-notes">Your setup notes</label>
          <span className="hint">Only Clerks see these: which camcorder, cables and laptop you use, who runs the stream.</span>
          <textarea id="studio-notes" name="notes" defaultValue={data.notes} key={data.updated_at} rows={3} />
          <div className="manage__actions"><button className="btn btn--outline btn--sm" disabled={busy}>Save notes</button></div>
        </form>
        {suggested && <p className="muted">Next on the calendar: {suggested.title}, {formatTimeRange(suggested.start_time, suggested.end_time)}.</p>}
      </details>
    </div>
  )
}
