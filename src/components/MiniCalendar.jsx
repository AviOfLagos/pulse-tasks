import { useMemo, useState } from 'react'

import { startOfDay, toISODateString } from '../utils/date.js'

/**
 * A two-week calendar strip.
 *
 * Not a month: a month grid is six rows tall and most of it is days you are
 * not going to touch. Two weeks covers "this week and next", which is the span
 * a todo list actually plans over, and leaves the rail short enough that the
 * cards below it stay on screen.
 *
 * A day with tasks gets a dot — neon when the work is still ahead, red when
 * something that day is overdue. Clicking a day filters the list to it;
 * clicking it again clears the filter. Today keeps a ring wherever you page to.
 */

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAYS_SHOWN = 14

/** The Monday on or before `date`. */
function weekStart(date) {
  const monday = startOfDay(date)
  // getDay() is Sunday-based; shift so Monday is 0.
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return monday
}

export default function MiniCalendar({ dayIndex, selectedDay, onSelectDay, now }) {
  const [cursor, setCursor] = useState(() => weekStart(now))

  const todayKey = toISODateString(now)

  const days = useMemo(
    () =>
      Array.from({ length: DAYS_SHOWN }, (_, index) => {
        const date = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + index)
        return { date, key: toISODateString(date) }
      }),
    [cursor],
  )

  const shiftWeeks = (weeks) =>
    setCursor(
      (current) =>
        new Date(current.getFullYear(), current.getMonth(), current.getDate() + weeks * 7),
    )

  // "September 2026", or "Sep – Oct 2026" when the fortnight straddles a month.
  const first = days[0].date
  const last = days[DAYS_SHOWN - 1].date
  const rangeLabel =
    first.getMonth() === last.getMonth()
      ? first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : `${first.toLocaleDateString(undefined, { month: 'short' })} – ${last.toLocaleDateString(
          undefined,
          { month: 'short', year: 'numeric' },
        )}`

  return (
    <section className="card calendar-card" aria-label="Calendar">
      <div className="calendar-head">
        <h2 className="card-title calendar-month">{rangeLabel}</h2>

        <div className="calendar-nav">
          <button
            type="button"
            className="icon-btn"
            onClick={() => shiftWeeks(-2)}
            aria-label="Previous two weeks"
            title="Previous two weeks"
          >
            ‹
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setCursor(weekStart(now))
              onSelectDay(null)
            }}
            aria-label="Back to this week"
            title="This week"
          >
            ·
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => shiftWeeks(2)}
            aria-label="Next two weeks"
            title="Next two weeks"
          >
            ›
          </button>
        </div>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>

      <div className="calendar-grid" role="grid">
        {days.map(({ date, key }) => {
          const entry = dayIndex.get(key)
          const open = entry ? entry.total - entry.done : 0
          const classes = [
            'calendar-day',
            key === todayKey ? 'is-today' : '',
            key === selectedDay ? 'is-selected' : '',
            date.getDate() === 1 ? 'is-month-start' : '',
          ]
            .filter(Boolean)
            .join(' ')

          const label = date.toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })

          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              className={classes}
              aria-pressed={key === selectedDay}
              aria-label={
                entry
                  ? `${label} — ${entry.total} ${entry.total === 1 ? 'task' : 'tasks'}`
                  : `${label} — no tasks`
              }
              onClick={() => onSelectDay(key === selectedDay ? null : key)}
            >
              {date.getDate()}
              {entry && entry.total > 0 ? (
                <span
                  className={`calendar-dot${entry.overdue > 0 ? ' is-overdue' : ''}${
                    open === 0 ? ' is-done' : ''
                  }`}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** Exported for the "Showing: Tue 29" chip. */
export function formatDayLabel(dayKey, locale = undefined) {
  if (!dayKey) return ''

  const [year, month, day] = dayKey.split('-').map(Number)
  const date = startOfDay(new Date(year, month - 1, day))

  // Built by hand rather than with one toLocaleDateString call, because most
  // locales put the number first and the chip reads better as "Tue 29".
  return `${date.toLocaleDateString(locale, { weekday: 'short' })} ${date.getDate()}`
}
