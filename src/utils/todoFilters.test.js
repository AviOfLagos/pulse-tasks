import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  dayKeyOf,
  filterByDay,
  filterTodos,
  getDayIndex,
  getDueReminders,
  getStats,
  getUrgentTodos,
  matchesTab,
  sortTodos,
} from './todoFilters.js'

/** Monday 28 September 2026, 12:00 local. */
const NOW = new Date(2026, 8, 28, 12, 0, 0, 0)

const at = (dayOffset, hour = 12, minute = 0) =>
  new Date(2026, 8, 28 + dayOffset, hour, minute, 0, 0).toISOString()

function todo(overrides = {}) {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    title: 'Task',
    description: '',
    priority: 'medium',
    dueAt: null,
    tags: [],
    completed: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    promptedAt: null,
    ...overrides,
  }
}

describe('matchesTab', () => {
  it('puts undated, overdue and today tasks in Today', () => {
    assert.equal(matchesTab(todo({ dueAt: null }), 'today', NOW), true)
    assert.equal(matchesTab(todo({ dueAt: at(0, 9) }), 'today', NOW), true)
    assert.equal(matchesTab(todo({ dueAt: at(-3) }), 'today', NOW), true)
    assert.equal(matchesTab(todo({ dueAt: at(1) }), 'today', NOW), false)
  })

  it('puts later days in Upcoming, undated tasks never', () => {
    assert.equal(matchesTab(todo({ dueAt: at(1) }), 'upcoming', NOW), true)
    assert.equal(matchesTab(todo({ dueAt: null }), 'upcoming', NOW), false)
    assert.equal(matchesTab(todo({ dueAt: at(0, 23) }), 'upcoming', NOW), false)
  })

  it('only completed tasks are Done, wherever they are dated', () => {
    assert.equal(matchesTab(todo({ completed: true, dueAt: at(5) }), 'done', NOW), true)
    assert.equal(matchesTab(todo({ completed: true }), 'today', NOW), false)
    assert.equal(matchesTab(todo({ completed: true }), 'upcoming', NOW), false)
  })
})

describe('filterTodos', () => {
  const todos = [
    todo({ id: 'a', title: 'Write report', dueAt: at(0, 17) }),
    todo({ id: 'b', title: 'Book flights', dueAt: at(2) }),
    todo({ id: 'c', title: 'Old chore', completed: true, tags: ['home'] }),
    todo({ id: 'd', title: 'Loose end' }),
  ]

  it('filters by tab', () => {
    assert.deepEqual(
      filterTodos(todos, 'today', '', NOW).map((item) => item.id),
      ['a', 'd'],
    )
    assert.deepEqual(
      filterTodos(todos, 'upcoming', '', NOW).map((item) => item.id),
      ['b'],
    )
    assert.deepEqual(
      filterTodos(todos, 'done', '', NOW).map((item) => item.id),
      ['c'],
    )
  })

  it('searches title, notes and tags', () => {
    assert.deepEqual(
      filterTodos(todos, 'all', 'flights', NOW).map((item) => item.id),
      ['b'],
    )
    assert.deepEqual(
      filterTodos(todos, 'all', 'home', NOW).map((item) => item.id),
      ['c'],
    )
    assert.equal(filterTodos(todos, 'all', 'nothing here', NOW).length, 0)
  })

  it('ignores surrounding whitespace and case in the query', () => {
    assert.equal(filterTodos(todos, 'all', '  REPORT ', NOW).length, 1)
    assert.equal(filterTodos(todos, 'all', '   ', NOW).length, todos.length)
  })
})

describe('sortTodos', () => {
  const late = todo({ id: 'late', createdAt: '2026-09-20T00:00:00.000Z', dueAt: at(3) })
  const soon = todo({ id: 'soon', createdAt: '2026-09-10T00:00:00.000Z', dueAt: at(1) })
  const undated = todo({ id: 'undated', createdAt: '2026-09-25T00:00:00.000Z' })
  const urgent = todo({ id: 'urgent', priority: 'high', createdAt: '2026-09-05T00:00:00.000Z' })

  it('sorts by newest created by default', () => {
    assert.deepEqual(
      sortTodos([urgent, soon, undated, late]).map((item) => item.id),
      ['undated', 'late', 'soon', 'urgent'],
    )
  })

  it('sorts by due moment, undated last', () => {
    assert.deepEqual(
      sortTodos([late, undated, soon], 'due').map((item) => item.id),
      ['soon', 'late', 'undated'],
    )
  })

  it('sorts by priority first, then by due moment', () => {
    assert.deepEqual(
      sortTodos([late, urgent, soon], 'priority').map((item) => item.id),
      ['urgent', 'soon', 'late'],
    )
  })

  it('does not mutate the input', () => {
    const input = [late, soon]
    sortTodos(input, 'due')
    assert.deepEqual(
      input.map((item) => item.id),
      ['late', 'soon'],
    )
  })
})

describe('getStats', () => {
  it('counts totals, tabs and the completed percentage', () => {
    const stats = getStats(
      [
        todo({ dueAt: at(0, 15) }),
        todo({ dueAt: at(-1) }),
        todo({ dueAt: at(4) }),
        todo({ completed: true }),
      ],
      NOW,
    )

    assert.deepEqual(stats, {
      total: 4,
      active: 3,
      completed: 1,
      today: 2,
      upcoming: 1,
      done: 1,
      percent: 25,
    })
  })

  it('is 0% on an empty list', () => {
    assert.equal(getStats([], NOW).percent, 0)
  })
})

describe('getUrgentTodos', () => {
  it('includes overdue and this-week tasks, soonest first', () => {
    const result = getUrgentTodos(
      [
        todo({ id: 'next-month', dueAt: at(30) }),
        todo({ id: 'in-two-days', dueAt: at(2) }),
        todo({ id: 'overdue', dueAt: at(-2) }),
        todo({ id: 'done', dueAt: at(1), completed: true }),
        todo({ id: 'undated' }),
      ],
      NOW,
    )

    assert.deepEqual(
      result.map((item) => item.id),
      ['overdue', 'in-two-days'],
    )
  })

  it('breaks ties on priority', () => {
    const result = getUrgentTodos(
      [
        todo({ id: 'low', dueAt: at(1), priority: 'low' }),
        todo({ id: 'high', dueAt: at(1), priority: 'high' }),
      ],
      NOW,
    )

    assert.deepEqual(
      result.map((item) => item.id),
      ['high', 'low'],
    )
  })
})

describe('getDueReminders', () => {
  it('returns unfinished, un-prompted tasks whose moment has passed', () => {
    const result = getDueReminders(
      [
        todo({ id: 'later', dueAt: at(0, 18) }),
        todo({ id: 'due-now', dueAt: at(0, 12) }),
        todo({ id: 'long-overdue', dueAt: at(-1) }),
        todo({ id: 'asked', dueAt: at(-1), promptedAt: at(-1) }),
        todo({ id: 'finished', dueAt: at(-1), completed: true }),
        todo({ id: 'undated' }),
      ],
      NOW,
    )

    assert.deepEqual(
      result.map((item) => item.id),
      ['long-overdue', 'due-now'],
    )
  })
})

describe('calendar helpers', () => {
  const todos = [
    todo({ id: 'today-1', dueAt: at(0, 9) }),
    todo({ id: 'today-2', dueAt: at(0, 18) }),
    todo({ id: 'overdue', dueAt: at(0, 8) }),
    todo({ id: 'done-today', dueAt: at(0, 10), completed: true }),
    todo({ id: 'tomorrow', dueAt: at(1, 9) }),
    todo({ id: 'undated' }),
  ]

  it('keys a task by its local calendar day', () => {
    assert.equal(dayKeyOf(todos[0]), '2026-09-28')
    assert.equal(dayKeyOf(todos[5]), null)
  })

  it('counts tasks, completions and overdue work per day', () => {
    const index = getDayIndex(todos, NOW)

    assert.deepEqual(index.get('2026-09-28'), { total: 4, done: 1, overdue: 2 })
    assert.deepEqual(index.get('2026-09-29'), { total: 1, done: 0, overdue: 0 })
    assert.equal(index.has('2026-09-30'), false)
  })

  it('filters to one day, soonest first, and searches within it', () => {
    assert.deepEqual(
      filterByDay(todos, '2026-09-28').map((item) => item.id),
      ['overdue', 'today-1', 'done-today', 'today-2'],
    )
    assert.equal(filterByDay(todos, null).length, 0)
    assert.equal(filterByDay(todos, '2026-09-28', 'nothing').length, 0)
  })
})
