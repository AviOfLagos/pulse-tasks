/**
 * Shared constants for Pulse Tasks.
 * Anything both the pure logic layer and the UI need lives here, so there is a
 * single source of truth for ids, labels, limits and timings.
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

/** A task can carry a small checklist ("steps"). Bounded so it stays a list. */
export const MAX_STEPS = 20

export const MAX_STEP_TEXT = 200

/** The three views. `today` also collects anything overdue or undated. */
export const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'done', label: 'Done' },
]

/** How far ahead (in days) the "Needs attention" panel looks. */
export const URGENT_WINDOW_DAYS = 7

/** How often the app re-checks due dates (ms) — also the reminder sweep. */
export const CLOCK_TICK_MS = 30_000

export const DEFAULT_PRIORITY = 'medium'

/** How long the undo toast stays on screen (ms). Spec: 5s. */
export const UNDO_TIMEOUT = 5000

/** Minutes added to dueAt when a reminder is snoozed. */
export const SNOOZE_MINUTES = 15

/** Hour (local) a bare date like "tomorrow" defaults to when no time is said. */
export const DEFAULT_DUE_HOUR = 9

/**
 * How long a listening window stays open (ms).
 *
 * Generous on purpose: the browser ends a recognition session on the first
 * pause, including the one before you start talking, and the hook restarts it
 * until this deadline. Too short and the mic appears to close on its own.
 */
export const REPLY_LISTEN_MS = 15_000

/** How long the composer mic stays open when adding a task by voice (ms). */
export const DICTATION_MS = 20_000

/** localStorage key for "the user has seen the voice explainer". */
export const VOICE_CONSENT_KEY = 'todo-webapp:voice-consent'

/** localStorage key for the half-written task still sitting in the composer. */
export const DRAFT_KEY = 'todo-webapp:draft'
