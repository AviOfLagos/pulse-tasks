import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { filterTodos, getStats, getUrgentTodos, sortTodos } from './todoFilters.js'

const todo = (overrides = {}) => ({
  id: 'id',
  title: 'Task',
  description: '',
  priority: 'medium',
  dueDate: null,
  tags: [],
  completed: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('filterTodos', () => {
  const todos = [
    todo({ id: '1', title: 'Walk the dog', tags: ['home'], createdAt: '2026-01-03T00:00:00.000Z' }),
    todo({ id: '2', title: 'Ship the app', completed: true, createdAt: '2026-01-02T00:00:00.000Z' }),
    todo({
      id: '3',
      title: 'Review PR',
      description: 'Check the dark mode styles',
      priority: 'high',
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
  ]

  it('returns everything for "all"', () => {
    assert.equal(filterTodos(todos, 'all').length, 3)
  })

  it('separates active from completed', () => {
    assert.deepEqual(
      filterTodos(todos, 'active').map((item) => item.id),
      ['1', '3'],
    )
    assert.deepEqual(
      filterTodos(todos, 'completed').map((item) => item.id),
      ['2'],
    )
  })

  it('searches titles, descriptions and tags, case-insensitively', () => {
    assert.deepEqual(filterTodos(todos, 'all', 'SHIP').map((item) => item.id), ['2'])
    assert.deepEqual(filterTodos(todos, 'all', 'dark mode').map((item) => item.id), ['3'])
    assert.deepEqual(filterTodos(todos, 'all', 'home').map((item) => item.id), ['1'])
    assert.deepEqual(filterTodos(todos, 'all', 'nothing here'), [])
  })

  it('ignores a blank search', () => {
    assert.equal(filterTodos(todos, 'all', '   ').length, 3)
  })

  it('combines the status filter with the search', () => {
    assert.deepEqual(filterTodos(todos, 'completed', 'dog'), [])
    assert.deepEqual(filterTodos(todos, 'active', 'dog').map((item) => item.id), ['1'])
  })
})

describe('sortTodos', () => {
  const todos = [
    todo({ id: 'low', priority: 'low', dueDate: '2026-09-30', createdAt: '2026-01-03T00:00:00.000Z' }),
    todo({ id: 'high-late', priority: 'high', dueDate: '2026-12-01', createdAt: '2026-01-02T00:00:00.000Z' }),
    todo({ id: 'high-soon', priority: 'high', dueDate: '2026-09-29', createdAt: '2026-01-01T00:00:00.000Z' }),
    todo({ id: 'no-date', priority: 'medium', dueDate: null, createdAt: '2026-01-04T00:00:00.000Z' }),
  ]

  it('sorts newest first by default and does not mutate the input', () => {
    const input = [...todos]
    assert.deepEqual(
      sortTodos(input, 'created').map((item) => item.id),
      ['no-date', 'low', 'high-late', 'high-soon'],
    )
    assert.deepEqual(input.map((item) => item.id), todos.map((item) => item.id))
  })

  it('sorts by due date with undated todos last', () => {
    assert.deepEqual(
      sortTodos(todos, 'due').map((item) => item.id),
      ['high-soon', 'low', 'high-late', 'no-date'],
    )
  })

  it('sorts by priority, breaking ties with the due date', () => {
    assert.deepEqual(
      sortTodos(todos, 'priority').map((item) => item.id),
      ['high-soon', 'high-late', 'no-date', 'low'],
    )
  })

  it('returns a new array for an unknown sort mode', () => {
    const result = sortTodos(todos, 'nonsense')

    assert.notEqual(result, todos)
    assert.equal(result.length, todos.length)
  })
})

describe('getStats', () => {
  it('counts total, active and completed', () => {
    const todos = [
      todo({ completed: true }),
      todo({ completed: false }),
      todo({ completed: true }),
    ]

    assert.deepEqual(getStats(todos), { total: 3, active: 1, completed: 2 })
  })

  it('handles an empty list', () => {
    assert.deepEqual(getStats([]), { total: 0, active: 0, completed: 0 })
  })
})

describe('getUrgentTodos', () => {
  const reference = new Date(2026, 8, 28, 12) // Mon 28 Sep 2026, local noon
  const dayOffset = (offset) => {
    const date = new Date(2026, 8, 28 + offset)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${month}-${day}`
  }

  const todos = [
    todo({ id: 'today', dueDate: dayOffset(0) }),
    todo({ id: 'tomorrow-high', dueDate: dayOffset(1), priority: 'high' }),
    todo({ id: 'tomorrow-low', dueDate: dayOffset(1), priority: 'low' }),
    todo({ id: 'next-week', dueDate: dayOffset(7) }),
    todo({ id: 'too-far', dueDate: dayOffset(8) }),
    todo({ id: 'expired', dueDate: dayOffset(-1) }),
    todo({ id: 'no-due' }),
    todo({ id: 'done', dueDate: dayOffset(0), completed: true }),
  ]

  it('keeps active tasks due within the window, nearest first', () => {
    const ids = getUrgentTodos(todos, reference).map((t) => t.id)
    assert.deepEqual(ids, ['today', 'tomorrow-high', 'tomorrow-low', 'next-week'])
  })

  it('drops expired, completed, due-less and out-of-window tasks', () => {
    const ids = getUrgentTodos(todos, reference).map((t) => t.id)
    assert.equal(ids.includes('expired'), false)
    assert.equal(ids.includes('done'), false)
    assert.equal(ids.includes('no-due'), false)
    assert.equal(ids.includes('too-far'), false)
  })

  it('an expired task disappears as time moves past its due date', () => {
    const before = getUrgentTodos(todos, reference).map((t) => t.id)
    assert.equal(before.includes('today'), true)

    const nextDay = new Date(2026, 8, 29, 0, 30)
    const after = getUrgentTodos(todos, nextDay).map((t) => t.id)
    assert.equal(after.includes('today'), false)
  })
})
