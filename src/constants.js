/**
 * Shared constants for the todo app.
 * Anything that both the pure logic layer and the UI need lives here,
 * so there is a single source of truth for ids, labels and limits.
 */

/** localStorage key. Bump the suffix when the stored shape changes. */
export const STORAGE_KEY = 'todo-webapp:v1'

/** Priority ids in ascending severity. Do not reorder without checking sorts. */
export const PRIORITIES = ['low', 'medium', 'high']

export const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

/** Lower rank = more urgent. Used by the "priority" sort mode. */
export const PRIORITY_RANK = {
  high: 0,
  medium: 1,
  low: 2,
}

export const MAX_TAGS = 3

/** Main navigation tabs: what is left to do vs. what is done. */
export const TABS = [
  { id: 'active', label: 'To do' },
  { id: 'completed', label: 'Done' },
]

/** How far ahead (in days) the "Needs attention" panel looks. */
export const URGENT_WINDOW_DAYS = 7

/** How often the app re-checks due dates (ms) to auto-expire urgent items. */
export const CLOCK_TICK_MS = 30_000

export const DEFAULT_PRIORITY = 'medium'

/** How long the undo toast stays on screen (ms). */
export const UNDO_TIMEOUT = 8000
