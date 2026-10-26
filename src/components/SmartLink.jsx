import { Link } from 'react-router-dom'
import { isExternal } from '../tenant'

/** A router link for paths on this site, a plain anchor for another site (a church's own subdomain). */
export default function SmartLink({ to, children, ...props }) {
  return isExternal(to) ? <a href={to} {...props}>{children}</a> : <Link to={to} {...props}>{children}</Link>
}
