import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  findTodoByTitle,
  parseConfirmReply,
  parseDueExpression,
  parseEditCommand,
  parseReply,
  parseTaskInput,
  splitDueExpression,
} from './nlp.js'
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

describe('splitDueExpression', () => {
  test('separates a pure time phrase from a rename', () => {
    assert.deepEqual(splitDueExpression('tomorrow 6pm', NOW).remainder, '')
    assert.equal(splitDueExpression('buy oat milk', NOW).remainder, 'Buy oat milk')
    assert.equal(splitDueExpression('buy oat milk at 6pm', NOW).remainder, 'Buy oat milk')
  })
})

describe('findTodoByTitle', () => {
  const todos = [
    { id: 'a', title: 'Water the plants', completed: false },
    { id: 'b', title: 'Send the invoice to Vettika', completed: false },
    { id: 'c', title: 'Water the plants', completed: true },
  ]

  test('matches exactly, and prefers the unfinished one', () => {
    assert.equal(findTodoByTitle(todos, 'water the plants').id, 'a')
  })

  test('matches a partial phrase', () => {
    assert.equal(findTodoByTitle(todos, 'the invoice').id, 'b')
    assert.equal(findTodoByTitle(todos, 'send invoice Vettika').id, 'b')
  })

  test('gives up rather than guessing', () => {
    assert.equal(findTodoByTitle(todos, 'book a flight'), null)
    assert.equal(findTodoByTitle(todos, ''), null)
    assert.equal(findTodoByTitle([], 'anything'), null)
  })
})

describe('parseEditCommand', () => {
  const todos = [
    { id: 'a', title: 'Water the plants', completed: false },
    { id: 'b', title: 'Buy milk', completed: false },
  ]

  test('"change X to 7pm" reschedules', () => {
    const result = parseEditCommand('change water the plants to 7pm', todos, NOW)

    assert.equal(result.todo.id, 'a')
    assert.deepEqual(local(result.changes.dueAt), [2026, 8, 28, 19, 0])
    assert.equal(result.changes.title, undefined)
  })

  test('"edit X to Y" renames', () => {
    const result = parseEditCommand('edit buy milk to buy oat milk', todos, NOW)

    assert.equal(result.todo.id, 'b')
    assert.equal(result.changes.title, 'Buy oat milk')
    assert.equal(result.changes.dueAt, undefined)
  })

  test('a rename can carry a time and a priority', () => {
    const result = parseEditCommand('change buy milk to buy oat milk tomorrow 8am, urgent', todos, NOW)

    assert.equal(result.changes.title, 'Buy oat milk')
    assert.equal(result.changes.priority, 'high')
    assert.deepEqual(local(result.changes.dueAt), [2026, 8, 29, 8, 0])
  })

  test('is null for anything that is not an edit command', () => {
    assert.equal(parseEditCommand('buy milk tomorrow', todos, NOW), null)
    assert.equal(parseEditCommand('change something unknown to 7pm', todos, NOW), null)
    assert.equal(parseEditCommand('', todos, NOW), null)
  })
})

describe('parseConfirmReply', () => {
  test('yes and "add it" confirm', () => {
    assert.equal(parseConfirmReply('yes', NOW).intent, 'confirm')
    assert.equal(parseConfirmReply('yeah add it', NOW).intent, 'confirm')
  })

  test('no and cancel discard', () => {
    assert.equal(parseConfirmReply('no', NOW).intent, 'cancel')
    assert.equal(parseConfirmReply('cancel that', NOW).intent, 'cancel')
  })

  test('"change time to 8pm" reschedules the pending task', () => {
    const result = parseConfirmReply('change time to 8pm', NOW)

    assert.equal(result.intent, 'reschedule')
    assert.deepEqual(local(result.dueAt), [2026, 8, 28, 20, 0])
  })

  test('"change it to tomorrow morning" reschedules', () => {
    assert.deepEqual(local(parseConfirmReply('change it to tomorrow morning', NOW).dueAt), [
      2026, 8, 29, 9, 0,
    ])
  })

  test('anything else is unknown', () => {
    assert.equal(parseConfirmReply('bananas', NOW).intent, 'unknown')
  })
})

describe('nested tags', () => {
  test('pulls #work/clients out of the title', () => {
    const result = parseTaskInput('draft the proposal #work/clients tomorrow 9am', NOW)

    assert.equal(result.title, 'Draft the proposal')
    assert.deepEqual(result.tags, ['work/clients'])
    assert.deepEqual(local(result.dueAt), [2026, 8, 29, 9, 0])
  })

  test('takes several hash tags', () => {
    assert.deepEqual(parseTaskInput('pay invoice #work #billing', NOW).tags, ['work', 'billing'])
  })

  test('understands the spoken form, with "slash" for nesting', () => {
    const spoken = parseTaskInput('call the printer under work slash admin', NOW)

    assert.equal(spoken.title, 'Call the printer')
    assert.deepEqual(spoken.tags, ['work/admin'])
  })

  test('keeps spaces inside one spoken segment', () => {
    assert.deepEqual(parseTaskInput('read the notes under weekly review', NOW).tags, [
      'weekly review',
    ])
  })

  test('only reads a spoken tag at the end, so it cannot eat the task', () => {
    const result = parseTaskInput('put the box under the stairs today', NOW)

    assert.deepEqual(result.tags, [])
    assert.equal(result.title, 'Put the box under the stairs')
  })

  test('is an empty list when nothing was tagged', () => {
    assert.deepEqual(parseTaskInput('buy milk', NOW).tags, [])
    assert.deepEqual(parseTaskInput('', NOW).tags, [])
  })
})
