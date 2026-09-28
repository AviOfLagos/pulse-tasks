/**
 * View helpers: filtering, sorting, counting and the "urgent" selector.
 * All pure so they are cheap to memoize and trivial to test.
 */

import { PRIORITY_RANK, URGENT_WINDOW_DAYS } from '../constants.js'
import { daysUntil } from './date.js'

function matchesQuery(todo, query) {
  const needle = String(query ?? '').trim().toLowerCase()
  if (!needle) return true

  const haystack = [todo.title, todo.description, ...(todo.tags ?? [])]

  return haystack.some(
    (value) => typeof value === 'string' && value.toLowerCase().includes(needle),
  )
}

/** Filters by status ('all' | 'active' | 'completed') and a free-text search. */
export function filterTodos(todos, filter = 'all', query = '') {
  return todos.filter((todo) => {
    if (filter === 'active' && todo.completed) return false
    if (filter === 'completed' && !todo.completed) return false

    return matchesQuery(todo, query)
  })
}

/** Newest first. ISO timestamps compare correctly as strings. */
function byNewestFirst(a, b) {
  return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
}

/** Ascending due date; tasks without a due date sink to the bottom. */
function byDueDate(a, b) {
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
    return a.dueDate < b.dueDate ? -1 : 1
  }
  if (a.dueDate && !b.dueDate) return -1
  if (!a.dueDate && b.dueDate) return 1

  return byNewestFirst(a, b)
}

/** Most urgent first, then nearest due date, then newest. */
function byPriority(a, b) {
  const rankA = PRIORITY_RANK[a.priority] ?? PRIORITY_RANK.medium
  const rankB = PRIORITY_RANK[b.priority] ?? PRIORITY_RANK.medium
  if (rankA !== rankB) return rankA - rankB

  return byDueDate(a, b)
}

/** Returns a new, sorted array (input is never mutated). */
export function sortTodos(todos, sort = 'created') {
  const copy = [...todos]

  if (sort === 'due') return copy.sort(byDueDate)
  if (sort === 'priority') return copy.sort(byPriority)

  return copy.sort(byNewestFirst)
}

/** `{ total, active, completed }` counts for the status bar. */
export function getStats(todos) {
  const total = todos.length

  let completed = 0
  for (const todo of todos) {
    if (todo.completed) completed += 1
  }

  return { total, active: total - completed, completed }
}

/**
 * "Needs attention" selector: active tasks due within the next
 * URGENT_WINDOW_DAYS days, nearest due date first (priority breaks ties).
 *
 * Anything already expired (due date in the past) is deliberately EXCLUDED —
 * once a task's time is up it drops off the urgent panel automatically. The
 * task itself remains in the main list, flagged as overdue.
 */
export function getUrgentTodos(todos, reference = new Date()) {
  return todos
    .filter((todo) => {
      if (todo.completed || !todo.dueDate) return false

      const diff = daysUntil(todo.dueDate, reference)
      return diff !== null && diff >= 0 && diff <= URGENT_WINDOW_DAYS
    })
    .sort((a, b) => {
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1

      const rankA = PRIORITY_RANK[a.priority] ?? PRIORITY_RANK.medium
      const rankB = PRIORITY_RANK[b.priority] ?? PRIORITY_RANK.medium
      return rankA - rankB
    })
}
