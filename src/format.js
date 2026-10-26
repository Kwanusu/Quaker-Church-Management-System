const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const shortDateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short' })

export const formatDate = (iso) => dateFmt.format(new Date(iso))
export const formatShortDate = (iso) => shortDateFmt.format(new Date(iso))
export const formatTime = (iso) => timeFmt.format(new Date(iso))
export const formatTimeRange = (a, b) => `${formatTime(a)} – ${formatTime(b)}`
export const dayOfMonth = (iso) => new Date(iso).getDate()
export const monthShort = (iso) => monthFmt.format(new Date(iso))

// Date-only strings (YYYY-MM-DD) must not be shifted by the viewer's time zone.
export const formatWeek = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return dateFmt.format(new Date(y, m - 1, d))
}

export const isLive = (ev, now = Date.now()) =>
  new Date(ev.start_time).getTime() - 15 * 60_000 <= now && now <= new Date(ev.end_time).getTime()

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm"
export const toLocalInput = (iso) => {
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null)
