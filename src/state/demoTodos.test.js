import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createDemoTodos, missingDemoTodos } from './demoTodos.js'
import { getStats, matchesTab } from '../utils/todoFilters.js'

const NOW = new Date(2026, 8, 28, 12, 0, 0, 0)

describe('createDemoTodos', () => {
  it('fills every tab, so the demo shows the whole app', () => {
    const todos = createDemoTodos(NOW)
    const stats = getStats(todos, NOW)

    assert.ok(stats.today > 0, 'expected tasks in Today')
    assert.ok(stats.upcoming > 0, 'expected tasks in Upcoming')
    assert.ok(stats.done > 0, 'expected tasks in Done')
    assert.ok(stats.percent > 0 && stats.percent < 100)
  })

  it('includes an overdue task, which is what triggers a reminder', () => {
    const overdue = createDemoTodos(NOW).filter(
      (todo) => !todo.completed && todo.dueAt && new Date(todo.dueAt) < NOW,
    )

    assert.ok(overdue.length > 0)
    assert.equal(overdue.every((todo) => todo.promptedAt === null), true)
  })

  it('includes an undated task, which lands in Today', () => {
    const undated = createDemoTodos(NOW).find((todo) => todo.dueAt === null)

    assert.ok(undated)
    assert.equal(matchesTab(undated, 'today', NOW), true)
  })

  it('gives every task a unique id', () => {
    const todos = createDemoTodos(NOW)
    assert.equal(new Set(todos.map((todo) => todo.id)).size, todos.length)
  })
})

describe('missingDemoTodos', () => {
  it('returns everything for an empty list', () => {
    assert.equal(missingDemoTodos([], NOW).length, createDemoTodos(NOW).length)
  })

  it('skips titles that are already there, whatever the casing', () => {
    const existing = [{ title: '  water the PLANTS  ' }]
    const missing = missingDemoTodos(existing, NOW)

    assert.equal(missing.length, createDemoTodos(NOW).length - 1)
    assert.equal(
      missing.some((todo) => todo.title === 'Water the plants'),
      false,
    )
  })

  it('is idempotent — loading twice adds nothing the second time', () => {
    const first = missingDemoTodos([], NOW)
    assert.equal(missingDemoTodos(first, NOW).length, 0)
  })
})
