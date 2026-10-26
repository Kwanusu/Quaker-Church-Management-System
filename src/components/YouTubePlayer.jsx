import { useEffect, useRef } from 'react'

/** Add privacy-friendly, autoplay-safe params to a YouTube embed URL. */
function playerSrc(embedUrl, autoplay = false) {
  const url = new URL(embedUrl)
  url.searchParams.set('rel', '0')
  url.searchParams.set('modestbranding', '1')
  if (autoplay) {
    url.searchParams.set('autoplay', '1')
  }
  return url.toString()
}

/** Inline 16:9 YouTube player (used for the live service on a church's home page). */
export function YouTubeEmbed({ src, title, autoplay = false }) {
  return (
    <div className="yt-frame">
      <iframe
        src={playerSrc(src, autoplay)}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  )
}

/** The same player in a modal <dialog> (from an event card's "Watch" button). */
export default function YouTubeDialog({ event, onClose }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog ref={dialogRef} className="stream-dialog" aria-labelledby="stream-title" onClose={onClose}>
      <div className="stream-dialog__head">
        <h2 id="stream-title">{event.title}</h2>
        <form method="dialog">
          <button className="btn btn--ghost-light btn--sm">Close</button>
        </form>
      </div>
      <YouTubeEmbed src={event.youtube_embed_url} title={event.title} autoplay />
      <p className="stream-dialog__link">
        Not playing? The stream may not have started yet.{' '}
        {event.youtube_url && <a href={event.youtube_url} target="_blank" rel="noreferrer">Open on YouTube</a>}
      </p>
    </dialog>
  )
}
