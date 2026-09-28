/**
 * The todo store. Kept free of React imports so it can be unit tested with
 * `node --test` and reused from anywhere.
 *
 * State shape: an array of todos. Every todo looks like:
 *   {
 *     id: string,            // stable, used as the React key
 *     title: string,         // required, trimmed
 *     description: string,   // optional notes, '' when empty
 *     priority: 'low' | 'medium' | 'high',
 *     dueDate: string | null, // 'YYYY-MM-DD' in local time
 *     tags: string[],        // de-duplicated, max MAX_TAGS
 *     completed: boolean,
 *     createdAt: string,     // ISO timestamp, used for sorting
 *   }
 */

import { DEFAULT_PRIORITY, MAX_TAGS, PRIORITIES } from '../constants.js'
import { isISODateString } from '../utils/date.js'

let idCounter = 0

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  idCounter += 1
  return `todo-${Date.now().toString(36)}-${idCounter}`
}

/**
 * Accepts an array, a comma separated string or a single value and returns a
 * clean list of tags: trimmed, non-empty, case-insensitively unique, capped.
 */
export function normalizeTags(tags) {
  const list = Array.isArray(tags)
    ? tags
    : String(tags ?? '').split(',')

  const seen = new Set()
  const result = []

  for (const raw of list) {
    const tag = String(raw).trim()
    if (!tag) continue

    const key = tag.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    result.push(tag)

    if (result.length >= MAX_TAGS) break
  }

  return result
}

/** Coerces a possibly dirty input object into a valid todo. Throws without a title. */
export function createTodo(input = {}) {
  const title = String(input.title ?? '').trim()
  if (!title) throw new Error('A todo needs a title')

  return {
    id: typeof input.id === 'string' && input.id ? input.id : createId(),
    title,
    description: String(input.description ?? '').trim(),
    priority: PRIORITIES.includes(input.priority) ? input.priority : DEFAULT_PRIORITY,
    dueDate: isISODateString(input.dueDate) ? input.dueDate : null,
    tags: normalizeTags(input.tags),
    completed: Boolean(input.completed),
    createdAt:
      typeof input.createdAt === 'string' && input.createdAt
        ? input.createdAt
        : new Date().toISOString(),
  }
}

/** Non-throwing version used when reading persisted data. Returns null when unusable. */
export function sanitizeTodo(raw) {
  if (!raw || typeof raw !== 'object') return null

  try {
    return createTodo(raw)
  } catch {
    return null
  }
}

/** Applies a partial change set, re-normalising the result. Invalid edits are ignored. */
function mergeTodo(todo, changes = {}) {
  const title = String(changes.title ?? todo.title).trim()
  if (!title) return todo

  return {
    ...todo,
    title,
    description:
      changes.description === undefined
        ? todo.description
        : String(changes.description).trim(),
    priority: PRIORITIES.includes(changes.priority) ? changes.priority : todo.priority,
    dueDate:
      changes.dueDate === undefined
        ? todo.dueDate
        : isISODateString(changes.dueDate)
          ? changes.dueDate
          : null,
    tags: changes.tags === undefined ? todo.tags : normalizeTags(changes.tags),
    completed:
      changes.completed === undefined ? todo.completed : Boolean(changes.completed),
  }
}

/**
 * Pure reducer.
 * Actions: add | update | toggle | toggle-all | remove | clear-completed | replace
 */
export function todosReducer(todos, action) {
  switch (action?.type) {
    case 'add': {
      const title = String(action.payload?.title ?? '').trim()
      if (!title) return todos

      // Newest first so the newest task is immediately visible.
      return [createTodo({ ...action.payload, title }), ...todos]
    }

    case 'update': {
      const { id, changes } = action.payload ?? {}
      return todos.map((todo) => (todo.id === id ? mergeTodo(todo, changes) : todo))
    }

    case 'toggle':
      return todos.map((todo) =>
        todo.id === action.payload?.id ? { ...todo, completed: !todo.completed } : todo,
      )

    case 'toggle-all': {
      const completed = Boolean(action.payload?.completed)
      return todos.map((todo) => ({ ...todo, completed }))
    }

    case 'remove':
      return todos.filter((todo) => todo.id !== action.payload?.id)

    case 'clear-completed':
      return todos.filter((todo) => !todo.completed)

    case 'replace': {
      // Used to restore an undo snapshot.
      const next = action.payload?.todos
      return Array.isArray(next) ? next : todos
    }

    default:
      return todos
  }
}
