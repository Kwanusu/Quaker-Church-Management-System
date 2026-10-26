import { useState } from 'react'
import { mediaUrl } from '../config'

// Calm colours from the site's palette; a person always gets the same one.
const TONES = ['#1d4e89', '#2a5a8c', '#0d2239', '#7a5d00', '#2f6f5e', '#6a3d7c', '#8a3b2e']

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

function initialsOf(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
}

/** A person's picture, or their initials on a coloured circle when they have none. */
export default function Avatar({ user, size = 40, className = '' }) {
  const [failedSrc, setFailedSrc] = useState(null)
  const name = user?.full_name || user?.username || ''
  const src = user?.avatar ? mediaUrl(user.avatar) : ''
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) }
  if (src && failedSrc !== src) {
    return <img src={src} alt="" width={size} height={size} className={`avatar ${className}`} style={style} onError={() => setFailedSrc(src)} />
  }
  return (
    <span className={`avatar avatar--initials ${className}`} style={{ ...style, background: TONES[hash(name) % TONES.length] }} aria-hidden="true">
      {initialsOf(name)}
    </span>
  )
}
