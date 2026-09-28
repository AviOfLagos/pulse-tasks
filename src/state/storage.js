/**
 * localStorage adapter.
 *
 * Reads are defensive: corrupted JSON, a removed key while the tab is open, or
 * a payload written by an older version of the app all fall back to an empty
 * list instead of breaking the render. Writes are wrapped too, because Safari
 * private mode throws on setItem.
 */

import { DRAFT_KEY, STORAGE_KEY } from '../constants.js'
import { sanitizeTodo } from './todoReducer.js'

function getStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Returns a sanitized array of todos from localStorage (never throws). */
export function loadTodos() {
  const storage = getStorage()
  if (!storage) return []

  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    const list = Array.isArray(parsed) ? parsed : parsed?.todos
    if (!Array.isArray(list)) return []

    return list.map(sanitizeTodo).filter(Boolean)
  } catch (error) {
    console.warn('Saved todos could not be read, starting fresh.', error)
    return []
  }
}

/** Persists todos (never throws). */
export function saveTodos(todos) {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(todos))
  } catch (error) {
    console.warn('Todos could not be saved to this browser.', error)
  }
}

/**
 * The composer draft.
 *
 * Losing a half-typed task to an accidental reload is a small thing that feels
 * like a big one, so the input keeps its text the same way the list keeps its
 * tasks. Stored as a plain string — there is no shape to sanitize.
 */
export function loadDraft() {
  const storage = getStorage()
  if (!storage) return ''

  try {
    return storage.getItem(DRAFT_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Persists (or, when empty, clears) the composer draft. Never throws. */
export function saveDraft(text) {
  const storage = getStorage()
  if (!storage) return

  try {
    if (text) storage.setItem(DRAFT_KEY, text)
    else storage.removeItem(DRAFT_KEY)
  } catch {
    /* private mode — the draft simply will not survive a reload */
  }
}
