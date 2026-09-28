/**
 * Mock data for the "Load demo data" button.
 *
 * Every task is positioned relative to *now* rather than to a fixed date, so
 * the demo always lands the same way: something already overdue (which trips a
 * spoken reminder within the next sweep — that is the feature being shown),
 * a couple of things due later today, a filled Upcoming tab, and some history
 * in Done so the progress ring is not at 0%.
 */

import { createTodo } from './todoReducer.js'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Offsets are in milliseconds from now; `null` means "no due time". */
const DEMO = [
  {
    title: 'Water the plants',
    description: 'Back porch too.',
    offset: -90 * MINUTE,
    priority: 'medium',
    tags: ['home/garden'],
  },
  {
    title: 'Send the invoice to Vettika',
    offset: 45 * MINUTE,
    priority: 'high',
    tags: ['work/clients', 'billing'],
  },
  {
    title: 'Review the pull request',
    description: 'Focus on the reducer tests.',
    offset: 4 * HOUR,
    priority: 'high',
    tags: ['work/code'],
  },
  {
    title: 'Read the design spec',
    offset: null,
    priority: 'low',
    tags: ['work/code'],
  },
  {
    title: 'Call the dentist',
    offset: DAY,
    priority: 'medium',
    tags: ['home'],
  },
  {
    title: 'Book flights for the conference',
    offset: 2 * DAY,
    priority: 'medium',
    tags: ['travel'],
  },
  {
    title: 'Renew the domain',
    offset: 6 * DAY,
    priority: 'low',
    tags: ['work/admin'],
  },
  {
    title: 'Pay the electricity bill',
    offset: -DAY,
    priority: 'high',
    completed: true,
    tags: ['home/bills'],
  },
  {
    title: 'Clear the inbox',
    offset: -3 * HOUR,
    priority: 'medium',
    completed: true,
  },
]

/** Builds the demo list. `now` is injectable so the result can be asserted on. */
export function createDemoTodos(now = new Date()) {
  const base = now.getTime()

  return DEMO.map((item, index) =>
    createTodo({
      title: item.title,
      description: item.description ?? '',
      priority: item.priority,
      tags: item.tags ?? [],
      completed: Boolean(item.completed),
      dueAt: item.offset === null ? null : new Date(base + item.offset).toISOString(),
      // Stagger creation times so the Done tab has a sensible order.
      createdAt: new Date(base - (index + 1) * HOUR).toISOString(),
    }),
  )
}

/**
 * The demo tasks that are not already in `todos`, matched on title so pressing
 * the button twice does not double the list.
 */
export function missingDemoTodos(todos, now = new Date()) {
  const existing = new Set(todos.map((todo) => todo.title.trim().toLowerCase()))

  return createDemoTodos(now).filter((todo) => !existing.has(todo.title.toLowerCase()))
}
