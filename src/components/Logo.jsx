import fullUrl from '../assets/logo-full.webp'
import markUrl from '../assets/logo-mark.png'

/**
 * Church logo.
 *  variant="mark" — dove & open book on a white disc (header, small sizes)
 *  variant="full" — complete round badge with the church name (login, footer)
 * Decorative by default because the church name is always written next to it;
 * pass `alt` when the logo stands alone.
 */
export default function Logo({ size = 48, variant = 'mark', alt = '' }) {
  return (
    <img
      src={variant === 'full' ? fullUrl : markUrl}
      width={size}
      height={size}
      alt={alt}
      className={`logo logo--${variant}`}
      decoding="async"
    />
  )
}
