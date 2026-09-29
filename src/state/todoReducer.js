/**
 * The todo store. Kept free of React imports so it can be unit tested with
 * `node --test` and reused from anywhere.
 *
 * State shape: an array of todos. Every todo looks like:
 *   {
 *     id: string,             // stable, used as the React key
 *     title: string,          // required, trimmed
 *     description: string,    // notes, '' when empty — voice notes append here
 *     priority: 'low' | 'medium' | 'high',
 *     dueAt: string | null,   // ISO timestamp: a moment, not a day, because
 *                             // reminders fire on it
 *     tags: string[],         // de-duplicated, max MAX_TAGS
 *     steps: [{ id, text, done }], // checklist, max MAX_STEPS
 *     completed: boolean,
 *     createdAt: string,      // ISO timestamp, used for sorting
 *     promptedAt: string|null // when the due reminder last fired, so the app
 *                             // never nags twice for the same moment
 *   }
 *
 * Legacy `dueDate` ('YYYY-MM-DD') values written by earlier versions are read
 * and upgraded to `dueAt` on load — see `createTodo`.
 */

import {
  DEFAULT_DUE_HOUR,
  DEFAULT_PRIORITY,
  MAX_STEPS,
  MAX_STEP_TEXT,
  MAX_TAGS,
  PRIORITIES,
} from '../constants.js'
import { addMinutes, isDueAtString, toDueAt } from '../utils/date.js'

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
  const list = Array.isArray(tags) ? tags : String(tags ?? '').split(',')

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

/**
 * Normalises a checklist into `[{ id, text, done }]`: trimmed, capped, with
 * stable ids so React keys and step edits survive a re-render.
 */
export function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return []

  const result = []
  const seen = new Set()

  for (const raw of steps) {
    const text = String(typeof raw === 'string' ? raw : (raw?.text ?? ''))
      .trim()
      .slice(0, MAX_STEP_TEXT)
    if (!text) continue

    const id = typeof raw?.id === 'string' && raw.id ? raw.id : createId()
    if (seen.has(id)) continue

    seen.add(id)
    result.push({ id, text, done: Boolean(raw?.done) })

    if (result.length >= MAX_STEPS) break
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
    // `dueDate` is the legacy field; it upgrades to a timestamp at 09:00 local.
    dueAt: toDueAt(input.dueAt ?? input.dueDate ?? null, DEFAULT_DUE_HOUR),
    tags: normalizeTags(input.tags),
    steps: normalizeSteps(input.steps),
    completed: Boolean(input.completed),
    createdAt:
      typeof input.createdAt === 'string' && input.createdAt
        ? input.createdAt
        : new Date().toISOString(),
    promptedAt: isDueAtString(input.promptedAt) ? input.promptedAt : null,
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
      changes.description === undefined ? todo.description : String(changes.description).trim(),
    priority: PRIORITIES.includes(changes.priority) ? changes.priority : todo.priority,
    dueAt: changes.dueAt === undefined ? todo.dueAt : toDueAt(changes.dueAt, DEFAULT_DUE_HOUR),
    tags: changes.tags === undefined ? todo.tags : normalizeTags(changes.tags),
    steps: changes.steps === undefined ? todo.steps : normalizeSteps(changes.steps),
    completed: changes.completed === undefined ? todo.completed : Boolean(changes.completed),
    // Moving the due date makes the task promptable again.
    promptedAt: changes.dueAt === undefined ? todo.promptedAt : null,
  }
}

/** Appends a line to the notes, keeping existing text. */
function appendNote(todo, note) {
  const text = String(note ?? '').trim()
  if (!text) return todo

  return {
    ...todo,
    description: todo.description ? `${todo.description}\n${text}` : text,
  }
}

/**
 * Pure reducer.
 * Actions:
 *   add | update | toggle | complete | toggle-all | remove | clear-completed | replace
 *   snooze | reschedule | append-note | mark-prompted
 *   step-add | step-edit | step-toggle | step-remove | duplicate
 */
export function todosReducer(todos, action) {
  const map = (id, change) => todos.map((todo) => (todo.id === id ? change(todo) : todo))

  switch (action?.type) {
    case 'add': {
      const title = String(action.payload?.title ?? '').trim()
      if (!title) return todos

      // Newest first so the newest task is immediately visible.
      return [createTodo({ ...action.payload, title }), ...todos]
    }

    case 'update': {
      const { id, changes } = action.payload ?? {}
      return map(id, (todo) => mergeTodo(todo, changes))
    }

    case 'toggle':
      return map(action.payload?.id, (todo) => ({ ...todo, completed: !todo.completed }))

    case 'complete':
      return map(action.payload?.id, (todo) => ({ ...todo, completed: true }))

    case 'toggle-all': {
      const completed = Boolean(action.payload?.completed)
      return todos.map((todo) => ({ ...todo, completed }))
    }

    case 'snooze': {
      const { id, minutes = 15, from } = action.payload ?? {}
      const reference = from ? new Date(from) : new Date()

      // Snooze from *now* when the due moment is already in the past, so a
      // task that sat overdue for an hour still comes back in `minutes`.
      return map(id, (todo) => {
        const base =
          todo.dueAt && new Date(todo.dueAt).getTime() > reference.getTime()
            ? todo.dueAt
            : reference.toISOString()

        return { ...todo, dueAt: addMinutes(base, minutes, reference), promptedAt: null }
      })
    }

    case 'reschedule': {
      const { id, dueAt } = action.payload ?? {}
      const next = toDueAt(dueAt, DEFAULT_DUE_HOUR)
      if (!next) return todos

      return map(id, (todo) => ({ ...todo, dueAt: next, promptedAt: null }))
    }

    case 'append-note':
      return map(action.payload?.id, (todo) => appendNote(todo, action.payload?.note))

    case 'step-add': {
      const { id, text } = action.payload ?? {}
      const step = normalizeSteps([{ text }])[0]
      if (!step) return todos

      return map(id, (todo) =>
        todo.steps.length >= MAX_STEPS ? todo : { ...todo, steps: [...todo.steps, step] },
      )
    }

    case 'step-toggle': {
      const { id, stepId } = action.payload ?? {}
      return map(id, (todo) => ({
        ...todo,
        steps: todo.steps.map((step) =>
          step.id === stepId ? { ...step, done: !step.done } : step,
        ),
      }))
    }

    case 'step-edit': {
      const { id, stepId, text } = action.payload ?? {}
      const next = String(text ?? '').trim().slice(0, MAX_STEP_TEXT)

      // An emptied step keeps its old text: deleting is a button, not a typo.
      return map(id, (todo) => ({
        ...todo,
        steps: todo.steps.map((step) => (step.id === stepId && next ? { ...step, text: next } : step)),
      }))
    }

    case 'step-remove': {
      const { id, stepId } = action.payload ?? {}
      return map(id, (todo) => ({
        ...todo,
        steps: todo.steps.filter((step) => step.id !== stepId),
      }))
    }

    case 'duplicate': {
      // A copy lands directly under its source, so the pair reads as a pair.
      const { id } = action.payload ?? {}
      const at = todos.findIndex((todo) => todo.id === id)
      if (at === -1) return todos

      const source = todos[at]
      const copy = createTodo({
        ...source,
        id: undefined,
        title: `${source.title} (copy)`,
        completed: false,
        createdAt: undefined,
        promptedAt: null,
        // The copy is fresh work: the checklist comes along, unticked.
        steps: source.steps.map((step) => ({ text: step.text, done: false })),
      })

      return [...todos.slice(0, at + 1), copy, ...todos.slice(at + 1)]
    }

    case 'mark-prompted': {
      const { id, at } = action.payload ?? {}
      const stamp = isDueAtString(at) ? at : new Date().toISOString()
      return map(id, (todo) => ({ ...todo, promptedAt: stamp }))
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
