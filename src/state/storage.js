/**
 * localStorage adapter.
 *
 * Reads are defensive: corrupted JSON, a removed key while the tab is open, or
 * a payload written by an older version of the app all fall back to an empty
 * list instead of breaking the render. Writes are wrapped too, because Safari
 * private mode throws on setItem.
 */

import { STORAGE_KEY } from '../constants.js'
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
