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
