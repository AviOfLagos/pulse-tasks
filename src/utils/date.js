/**
 * Date helpers for `YYYY-MM-DD` due dates.
 *
 * Due dates are stored as plain calendar strings (no time, no timezone), so we
 * parse them into local midnight and compare whole days. `daysUntil` is derived
 * from midnight-to-midnight differences, which keeps labels correct even across
 * daylight-saving boundaries (Math.round absorbs the +-1h drift).
 */

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** True when `value` is a real calendar date in `YYYY-MM-DD` form. */
export function isISODateString(value) {
  if (typeof value !== 'string') return false

  const match = ISO_DATE_PATTERN.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

/** Parses a `YYYY-MM-DD` string into a Date at local midnight, or null. */
export function parseISODate(value) {
  if (!isISODateString(value)) return null

  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Returns a copy of `date` at local midnight. */
export function startOfDay(date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/** Serialises a Date to `YYYY-MM-DD` using local calendar values. */
export function toISODateString(date) {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Whole days from `reference` to `value`.
 * 0 = today, 1 = tomorrow, -1 = yesterday. Returns null for invalid input.
 */
export function daysUntil(value, reference = new Date()) {
  const target = parseISODate(value)
  if (!target) return null

  return Math.round((startOfDay(target) - startOfDay(reference)) / MS_PER_DAY)
}

/** A finished task is never overdue. */
export function isOverdue(value, { completed = false, reference = new Date() } = {}) {
  if (completed) return false

  const diff = daysUntil(value, reference)
  return diff !== null && diff < 0
}

/**
 * Human label for a due date.
 * Returns '' when there is no (valid) due date.
 */
export function formatDueDate(value, reference = new Date()) {
  const diff = daysUntil(value, reference)
  if (diff === null) return ''

  if (diff === 0) return 'Due today'
  if (diff === 1) return 'Due tomorrow'
  if (diff === -1) return 'Due yesterday'
  if (diff < -1) return `Overdue by ${Math.abs(diff)} days`
  if (diff <= 7) return `Due in ${diff} days`

  const date = parseISODate(value)
  return `Due ${date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`
}

/* ------------------------------------------------------------------ *
 * dueAt helpers
 *
 * `dueAt` is a full ISO timestamp (date *and* time), because reminders
 * need to fire at a moment, not on a day. The calendar helpers above are
 * still used for day-level grouping and for reading legacy `dueDate`
 * values written by earlier versions of the app.
 * ------------------------------------------------------------------ */

/** True when `value` parses as a usable timestamp. */
export function isDueAtString(value) {
  if (typeof value !== 'string' || !value.trim()) return false

  return !Number.isNaN(new Date(value).getTime())
}

/** Parses a stored `dueAt` into a Date, or null. */
export function parseDueAt(value) {
  if (!isDueAtString(value)) return null

  return new Date(value)
}

/**
 * Normalises anything date-ish into an ISO timestamp, or null.
 * Accepts a Date, a full timestamp, a `datetime-local` value, or a legacy
 * `YYYY-MM-DD` string (which lands at DEFAULT_DUE_HOUR local time).
 */
export function toDueAt(value, defaultHour = 9) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }

  if (typeof value !== 'string' || !value.trim()) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    // Day-only input: reject impossible calendar dates rather than letting the
    // Date constructor roll them over (it turns 2026-02-30 into 2026-03-02).
    const date = parseISODate(value.trim())
    if (!date) return null

    date.setHours(defaultHour, 0, 0, 0)
    return date.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/** `dueAt` as the `datetime-local` input wants it (`YYYY-MM-DDTHH:mm`, local). */
export function toDateTimeLocal(value) {
  const date = parseDueAt(value)
  if (!date) return ''

  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${toISODateString(date)}T${hours}:${minutes}`
}

/** Just the clock part, e.g. "5:00 PM". */
export function formatClockTime(value, locale = undefined) {
  const date = value instanceof Date ? value : parseDueAt(value)
  if (!date || Number.isNaN(date.getTime())) return ''

  return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
}

/** Whole days from today to `dueAt`: 0 today, 1 tomorrow, -1 yesterday. */
export function dueDayOffset(value, reference = new Date()) {
  const date = parseDueAt(value)
  if (!date) return null

  return Math.round((startOfDay(date) - startOfDay(reference)) / MS_PER_DAY)
}

/** True when an unfinished task's moment has already passed. */
export function isDue(todo, reference = new Date()) {
  if (!todo || todo.completed) return false

  const date = parseDueAt(todo.dueAt)
  return date !== null && date.getTime() <= reference.getTime()
}

/**
 * Short chip label for a task row: "5:00 PM" today, "Tomorrow 5:00 PM",
 * "Mon 5:00 PM" inside the week, "12 Oct, 5:00 PM" beyond it.
 */
export function formatDueChip(value, reference = new Date(), locale = undefined) {
  const date = parseDueAt(value)
  if (!date) return ''

  const offset = dueDayOffset(value, reference)
  const time = formatClockTime(date, locale)

  if (offset === 0) return time
  if (offset === 1) return `Tomorrow ${time}`
  if (offset === -1) return `Yesterday ${time}`
  if (offset > 1 && offset <= 6) {
    return `${date.toLocaleDateString(locale, { weekday: 'short' })} ${time}`
  }

  // The year only earns its place when it is not this one.
  const sameYear = date.getFullYear() === reference.getFullYear()
  const day = date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })

  return `${day}, ${time}`
}

/** Adds minutes to a timestamp and returns a new ISO string. */
export function addMinutes(value, minutes, reference = new Date()) {
  const base = parseDueAt(value) ?? reference
  return new Date(base.getTime() + minutes * 60_000).toISOString()
}
