/**
 * Export and import.
 *
 * Tasks live in one browser's localStorage, which is fine until you want them
 * in another browser — or until you clear site data by accident. A JSON file is
 * the smallest thing that fixes both without a server.
 */

import { sanitizeTodo } from '../state/todoReducer.js'

export const BACKUP_VERSION = 1

/** The object written to the downloaded file. */
export function toBackup(todos, now = new Date()) {
  return {
    app: 'pulse-tasks',
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    todos,
  }
}

/**
 * Reads a backup back into todos.
 *
 * Accepts the wrapper object or a bare array, because someone will hand-edit
 * the file. Every entry goes through the same sanitizer the store uses, so a
 * half-broken file loses the broken rows rather than the whole import.
 */
export function fromBackup(raw) {
  let data = raw

  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return { todos: [], error: 'That file is not valid JSON.' }
    }
  }

  const list = Array.isArray(data) ? data : data?.todos

  if (!Array.isArray(list)) {
    return { todos: [], error: 'That file does not look like a Pulse Tasks export.' }
  }

  const todos = list.map(sanitizeTodo).filter(Boolean)

  return {
    todos,
    error: todos.length === 0 ? 'There were no usable tasks in that file.' : '',
    skipped: list.length - todos.length,
  }
}

/**
 * Merges imported tasks into the current list.
 *
 * Adds rather than replaces: an import that silently wiped what you already had
 * would be the most expensive undo in the app. Ids already present are skipped,
 * so importing the same file twice changes nothing.
 */
export function mergeTodos(current, incoming) {
  const seen = new Set(current.map((todo) => todo.id))
  const added = incoming.filter((todo) => !seen.has(todo.id))

  return { todos: [...added, ...current], added: added.length }
}
