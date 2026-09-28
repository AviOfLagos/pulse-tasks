/**
 * View helpers: filtering, sorting, counting, the "needs attention" selector
 * and the reminder queue. All pure so they are cheap to memoize and trivial to
 * test.
 */

import { PRIORITY_RANK, URGENT_WINDOW_DAYS } from '../constants.js'
import { dueDayOffset, isDue, parseDueAt } from './date.js'

function matchesQuery(todo, query) {
  const needle = String(query ?? '').trim().toLowerCase()
  if (!needle) return true

  const haystack = [todo.title, todo.description, ...(todo.tags ?? [])]

  return haystack.some(
    (value) => typeof value === 'string' && value.toLowerCase().includes(needle),
  )
}

/**
 * True when a task belongs in a tab.
 *
 * today    — unfinished work for right now: due today, already overdue, or
 *            carrying no due date at all (it has to live somewhere)
 * upcoming — unfinished work dated for a later day
 * done     — completed, whenever it was due
 */
export function matchesTab(todo, tab = 'today', reference = new Date()) {
  if (tab === 'all') return true
  if (tab === 'done') return Boolean(todo.completed)
  if (todo.completed) return false

  const offset = dueDayOffset(todo.dueAt, reference)

  if (tab === 'upcoming') return offset !== null && offset > 0
  if (tab === 'today') return offset === null || offset <= 0

  // 'active' — every unfinished task.
  return true
}

/** Filters by tab and a free-text search. */
export function filterTodos(todos, tab = 'today', query = '', reference = new Date()) {
  return todos.filter((todo) => matchesTab(todo, tab, reference) && matchesQuery(todo, query))
}

/** Newest first. ISO timestamps compare correctly as strings. */
function byNewestFirst(a, b) {
  return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
}

/** Ascending due moment; tasks without a due date sink to the bottom. */
function byDueDate(a, b) {
  const timeA = parseDueAt(a.dueAt)?.getTime() ?? null
  const timeB = parseDueAt(b.dueAt)?.getTime() ?? null

  if (timeA !== null && timeB !== null && timeA !== timeB) return timeA - timeB
  if (timeA !== null && timeB === null) return -1
  if (timeA === null && timeB !== null) return 1

  return byNewestFirst(a, b)
}

/** Most urgent first, then nearest due moment, then newest. */
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

/** Counts for the tabs and the progress ring. */
export function getStats(todos, reference = new Date()) {
  const total = todos.length

  let completed = 0
  let today = 0
  let upcoming = 0

  for (const todo of todos) {
    if (todo.completed) {
      completed += 1
      continue
    }
    if (matchesTab(todo, 'today', reference)) today += 1
    else upcoming += 1
  }

  return {
    total,
    active: total - completed,
    completed,
    today,
    upcoming,
    done: completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}

/**
 * "Needs attention": unfinished tasks that are already overdue or fall due
 * within the next URGENT_WINDOW_DAYS days. Overdue first, then nearest due
 * moment, priority breaking ties.
 */
export function getUrgentTodos(todos, reference = new Date()) {
  return todos
    .filter((todo) => {
      if (todo.completed || !todo.dueAt) return false

      const offset = dueDayOffset(todo.dueAt, reference)
      return offset !== null && offset <= URGENT_WINDOW_DAYS
    })
    .sort((a, b) => {
      const dueA = parseDueAt(a.dueAt).getTime()
      const dueB = parseDueAt(b.dueAt).getTime()
      if (dueA !== dueB) return dueA - dueB

      const rankA = PRIORITY_RANK[a.priority] ?? PRIORITY_RANK.medium
      const rankB = PRIORITY_RANK[b.priority] ?? PRIORITY_RANK.medium
      return rankA - rankB
    })
}

/**
 * Tasks the app should speak up about: due now or earlier, unfinished, and not
 * already prompted for this due moment. Oldest first, so the most overdue task
 * is asked about before the one that just came due.
 */
export function getDueReminders(todos, reference = new Date()) {
  return todos
    .filter((todo) => isDue(todo, reference) && !todo.promptedAt)
    .sort((a, b) => parseDueAt(a.dueAt).getTime() - parseDueAt(b.dueAt).getTime())
}
