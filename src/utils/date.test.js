import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  daysUntil,
  formatDueDate,
  isISODateString,
  isOverdue,
  parseISODate,
  startOfDay,
  toISODateString,
} from './date.js'

const reference = new Date(2026, 8, 28, 15, 30) // 28 Sep 2026, local afternoon

describe('isISODateString', () => {
  it('accepts real dates', () => {
    assert.equal(isISODateString('2026-09-28'), true)
    assert.equal(isISODateString('2024-02-29'), true)
  })

  it('rejects malformed or impossible dates', () => {
    assert.equal(isISODateString('2026-2-8'), false)
    assert.equal(isISODateString('2026-02-30'), false)
    assert.equal(isISODateString('28/09/2026'), false)
    assert.equal(isISODateString(''), false)
    assert.equal(isISODateString(null), false)
  })
})

describe('parseISODate / toISODateString', () => {
  it('round-trips through local midnight', () => {
    const parsed = parseISODate('2026-09-28')
    assert.equal(parsed.getFullYear(), 2026)
    assert.equal(parsed.getMonth(), 8)
    assert.equal(parsed.getDate(), 28)
    assert.equal(toISODateString(parsed), '2026-09-28')
  })

  it('returns null for invalid input', () => {
    assert.equal(parseISODate('nope'), null)
  })
})

describe('startOfDay', () => {
  it('zeroes the time without mutating the input', () => {
    const source = new Date(2026, 8, 28, 15, 30, 45, 500)
    const result = startOfDay(source)

    assert.notEqual(result, source)
    assert.deepEqual(
      [result.getHours(), result.getMinutes(), result.getSeconds(), result.getMilliseconds()],
      [0, 0, 0, 0],
    )
    assert.equal(source.getHours(), 15)
  })
})

describe('daysUntil', () => {
  it('counts whole days from today', () => {
    assert.equal(daysUntil('2026-09-28', reference), 0)
    assert.equal(daysUntil('2026-09-29', reference), 1)
    assert.equal(daysUntil('2026-09-27', reference), -1)
    assert.equal(daysUntil('2026-10-05', reference), 7)
  })

  it('is independent of the time of day', () => {
    const morning = new Date(2026, 8, 28, 1, 0)
    const night = new Date(2026, 8, 28, 23, 59)

    assert.equal(daysUntil('2026-09-29', morning), 1)
    assert.equal(daysUntil('2026-09-29', night), 1)
  })

  it('returns null without a valid date', () => {
    assert.equal(daysUntil(null, reference), null)
    assert.equal(daysUntil('soon', reference), null)
  })
})

describe('formatDueDate', () => {
  it('uses friendly labels for the near future and past', () => {
    assert.equal(formatDueDate('2026-09-28', reference), 'Due today')
    assert.equal(formatDueDate('2026-09-29', reference), 'Due tomorrow')
    assert.equal(formatDueDate('2026-09-27', reference), 'Due yesterday')
    assert.equal(formatDueDate('2026-09-25', reference), 'Overdue by 3 days')
    assert.equal(formatDueDate('2026-10-02', reference), 'Due in 4 days')
  })

  it('falls back to an absolute date further out', () => {
    const label = formatDueDate('2026-11-15', reference)

    assert.match(label, /^Due /)
    assert.match(label, /2026/)
  })

  it('returns an empty string when there is no due date', () => {
    assert.equal(formatDueDate(null, reference), '')
    assert.equal(formatDueDate('', reference), '')
  })
})

describe('isOverdue', () => {
  it('flags past due dates', () => {
    assert.equal(isOverdue('2026-09-27', { reference }), true)
    assert.equal(isOverdue('2026-09-28', { reference }), false)
    assert.equal(isOverdue('2026-09-30', { reference }), false)
  })

  it('never flags a completed todo', () => {
    assert.equal(isOverdue('2026-09-01', { completed: true, reference }), false)
  })

  it('is false without a due date', () => {
    assert.equal(isOverdue(null, { reference }), false)
  })
})
