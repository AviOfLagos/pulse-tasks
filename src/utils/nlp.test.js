import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { parseDueExpression, parseReply, parseTaskInput } from './nlp.js'
import { formatClockTime } from './date.js'

/** Monday 28 September 2026, 12:00 local. */
const NOW = new Date(2026, 8, 28, 12, 0, 0, 0)

function local(dueAt) {
  const date = new Date(dueAt)
  return [
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ]
}

describe('parseTaskInput', () => {
  test('keeps a plain task as-is', () => {
    const result = parseTaskInput('buy milk', NOW)
    assert.equal(result.title, 'Buy milk')
    assert.equal(result.dueAt, null)
    assert.equal(result.priority, 'medium')
  })

  test('parses "tomorrow 5pm" out of the title', () => {
    const result = parseTaskInput('call the dentist tomorrow 5pm', NOW)
    assert.equal(result.title, 'Call the dentist')
    assert.deepEqual(local(result.dueAt), [2026, 8, 29, 17, 0])
  })

  test('parses "urgent" into a high priority', () => {
    const result = parseTaskInput('urgent: file the tax return today at 4pm', NOW)
    assert.equal(result.priority, 'high')
    assert.equal(result.title, 'File the tax return')
    assert.deepEqual(local(result.dueAt), [2026, 8, 28, 16, 0])
  })

  test('parses a low priority', () => {
    assert.equal(parseTaskInput('sort the garage someday', NOW).priority, 'low')
  })

  test('strips the "remind me to" preamble', () => {
    assert.equal(parseTaskInput('remind me to water the plants', NOW).title, 'Water the plants')
  })

  test('handles minutes and hours from now', () => {
    assert.deepEqual(local(parseTaskInput('stretch in 30 minutes', NOW).dueAt), [
      2026, 8, 28, 12, 30,
    ])
    assert.deepEqual(local(parseTaskInput('standup in 2 hours', NOW).dueAt), [2026, 8, 28, 14, 0])
  })

  test('a bare time that already passed rolls to tomorrow', () => {
    assert.deepEqual(local(parseTaskInput('gym at 7am', NOW).dueAt), [2026, 8, 29, 7, 0])
  })

  test('a weekday picks the next occurrence', () => {
    // NOW is a Monday, so "friday" is four days out.
    assert.deepEqual(local(parseTaskInput('send invoice on friday', NOW).dueAt), [
      2026, 9, 2, 9, 0,
    ])
  })

  test('"tonight" pins today at 8pm', () => {
    const result = parseTaskInput('pack the bag tonight', NOW)
    assert.equal(result.title, 'Pack the bag')
    assert.deepEqual(local(result.dueAt), [2026, 8, 28, 20, 0])
  })

  test('never returns an empty title', () => {
    assert.equal(parseTaskInput('tomorrow', NOW).title, 'tomorrow')
    assert.equal(parseTaskInput('   ', NOW).title, '')
  })

  test('minutes are preserved', () => {
    assert.deepEqual(local(parseTaskInput('leave at 5:45 pm', NOW).dueAt), [2026, 8, 28, 17, 45])
  })
})

describe('parseDueExpression', () => {
  test('returns null when there is no time in the phrase', () => {
    assert.equal(parseDueExpression('buy milk', NOW).dueAt, null)
  })

  test('honours the default hour for a bare day', () => {
    assert.deepEqual(local(parseDueExpression('tomorrow', NOW, 7).dueAt), [2026, 8, 29, 7, 0])
  })
})

describe('parseReply', () => {
  test('yes and done complete the task', () => {
    assert.equal(parseReply('yes', NOW).intent, 'complete')
    assert.equal(parseReply('yeah I did it', NOW).intent, 'complete')
    assert.equal(parseReply('done', NOW).intent, 'complete')
  })

  test('no and later snooze', () => {
    assert.equal(parseReply('no', NOW).intent, 'snooze')
    assert.equal(parseReply('not yet, later', NOW).intent, 'snooze')
  })

  test('"change it to 6pm" reschedules', () => {
    const result = parseReply('change it to 6pm', NOW)
    assert.equal(result.intent, 'reschedule')
    assert.deepEqual(local(result.dueAt), [2026, 8, 28, 18, 0])
  })

  test('"move it to tomorrow morning" reschedules', () => {
    const result = parseReply('move it to tomorrow morning', NOW)
    assert.equal(result.intent, 'reschedule')
    assert.deepEqual(local(result.dueAt), [2026, 8, 29, 9, 0])
  })

  test('"add note ..." captures the text, even when it contains "no"', () => {
    const result = parseReply('add note no rush on the delivery', NOW)
    assert.equal(result.intent, 'note')
    assert.equal(result.note, 'no rush on the delivery')
  })

  test('anything else is unknown', () => {
    assert.equal(parseReply('bananas', NOW).intent, 'unknown')
    assert.equal(parseReply('', NOW).intent, 'unknown')
  })

  test('formatClockTime renders the rescheduled moment', () => {
    const { dueAt } = parseReply('change it to 6pm', NOW)
    assert.match(formatClockTime(dueAt, 'en-US'), /6:00/)
  })
})
