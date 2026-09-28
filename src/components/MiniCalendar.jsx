import { useMemo, useState } from 'react'

import { startOfDay, toISODateString } from '../utils/date.js'

/**
 * Compact month calendar.
 *
 * A day with tasks gets a dot — neon when the work is still ahead, red when
 * something on that day is overdue. Clicking a day filters the list to it;
 * clicking it again clears the filter. Today keeps a ring whatever month you
 * browse to, so you never lose your place.
 */

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** The six-week grid for a month, starting on Monday. */
function monthGrid(year, month) {
  const first = new Date(year, month, 1)
  // getDay() is Sunday-based; shift so Monday is 0.
  const lead = (first.getDay() + 6) % 7

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, index - lead + 1)
    return { date, key: toISODateString(date), inMonth: date.getMonth() === month }
  })
}

export default function MiniCalendar({ dayIndex, selectedDay, onSelectDay, now }) {
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))

  const todayKey = toISODateString(now)
  const grid = useMemo(
    () => monthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  )

  const shiftMonth = (delta) =>
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <section className="card calendar-card" aria-label="Calendar">
      <div className="calendar-head">
        <h2 className="card-title calendar-month">{monthLabel}</h2>

        <div className="calendar-nav">
          <button
            type="button"
            className="icon-btn"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            title="Previous month"
          >
            ‹
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1))
              onSelectDay(null)
            }}
            aria-label="Back to today"
            title="Today"
          >
            ·
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            title="Next month"
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
        {grid.map(({ date, key, inMonth }) => {
          const entry = dayIndex.get(key)
          const open = entry ? entry.total - entry.done : 0
          const classes = [
            'calendar-day',
            inMonth ? '' : 'is-outside',
            key === todayKey ? 'is-today' : '',
            key === selectedDay ? 'is-selected' : '',
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

/** Exported for the "Showing: Mon 29" chip. */
export function formatDayLabel(dayKey, locale = undefined) {
  if (!dayKey) return ''

  const [year, month, day] = dayKey.split('-').map(Number)
  const date = startOfDay(new Date(year, month - 1, day))

  // Built by hand rather than with one toLocaleDateString call, because most
  // locales put the number first and the chip reads better as "Tue 29".
  return `${date.toLocaleDateString(locale, { weekday: 'short' })} ${date.getDate()}`
}
