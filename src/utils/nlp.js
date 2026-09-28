/**
 * Natural-language parsing for the voice features.
 *
 * Two entry points, both pure so they can be unit tested with `node --test`:
 *  - `parseTaskInput`  — "call mum tomorrow 5pm, urgent" → title + dueAt + priority
 *  - `parseReply`      — the spoken answer to a due reminder ("yes", "later",
 *                        "change it to 6pm", "add note bring the receipt")
 *
 * The strategy is the same in both: run a set of matchers over the text,
 * remember which character ranges they consumed, then rebuild the leftover
 * words as the title. That way "tomorrow 5pm" never ends up in the title.
 */

import { DEFAULT_DUE_HOUR, DEFAULT_PRIORITY } from '../constants.js'
import { startOfDay } from './date.js'

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

/** Words that map onto a rough hour of the day. */
const DAY_PARTS = {
  morning: 9,
  noon: 12,
  midday: 12,
  afternoon: 14,
  evening: 18,
  tonight: 20,
  night: 20,
  midnight: 0,
}

const PRIORITY_PATTERNS = [
  [/\b(?:urgent(?:ly)?|asap|critical|emergency|top priority|high priority)\b/, 'high'],
  [/\b(?:important|priority)\b/, 'high'],
  [/\b(?:low priority|whenever|someday|no rush|sometime)\b/, 'low'],
  [/\b(?:medium priority|normal priority)\b/, 'medium'],
]

const FILLER_PREFIX =
  /^(?:(?:please|hey|ok(?:ay)?)\s+)*(?:remind me to|remind me|remember to|don't forget to|dont forget to|i need to|i have to|add(?: a)?(?: new)?(?: task)?(?: to)?|create(?: a)?(?: new)?(?: task)?(?: to)?|new task(?: to)?|task(?: to)?|todo(?: to)?)\s+/

const DANGLING_WORDS = /\b(?:at|by|on|due|for|before|around|about|in|and|to|the)\b/

/** Records a consumed range so the title builder can skip it. */
function cut(cuts, match) {
  if (!match) return
  cuts.push([match.index, match.index + match[0].length])
}

/** Removes the consumed ranges and tidies what is left into a title. */
function buildTitle(text, cuts) {
  let title = ''
  let at = 0

  for (const [start, end] of [...cuts].sort((a, b) => a[0] - b[0])) {
    if (start < at) {
      at = Math.max(at, end)
      continue
    }
    title += text.slice(at, start)
    title += ' '
    at = end
  }

  title += text.slice(at)

  title = title
    .replace(/[,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(FILLER_PREFIX, '')
    .trim()

  // Drop prepositions left stranded by a removed date ("call mum at" → "call mum").
  let previous
  do {
    previous = title
    title = title.replace(new RegExp(`\\s+${DANGLING_WORDS.source}\\s*$`, 'i'), '').trim()
    title = title.replace(new RegExp(`^${DANGLING_WORDS.source}\\s+`, 'i'), '').trim()
  } while (title !== previous)

  title = title
    .replace(/[.!?\s]+$/, '')
    .replace(/^[\s:;,.\-–—]+/, '')
    .replace(/\s+([,.!?])/g, '$1')
    .trim()

  return title ? title[0].toUpperCase() + title.slice(1) : ''
}

/** "5pm", "5:30 pm", "17:00", "at 6" → { hour, minute }. */
function matchTime(lower, cuts) {
  const explicit = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/.exec(lower)
  if (explicit) {
    let hour = Number(explicit[1]) % 12
    if (explicit[3].startsWith('p')) hour += 12
    cut(cuts, explicit)
    return { hour, minute: Number(explicit[2] ?? 0) }
  }

  const military = /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/.exec(lower)
  if (military) {
    cut(cuts, military)
    return { hour: Number(military[1]), minute: Number(military[2]) }
  }

  const bare = /\bat\s+(\d{1,2})\b(?!\s*(?:st|nd|rd|th|minutes?|mins?|hours?|hrs?|days?))/.exec(
    lower,
  )
  if (bare) {
    const hour = Number(bare[1])
    if (hour <= 23) {
      cut(cuts, bare)
      // "at 5" almost always means the afternoon.
      return { hour: hour >= 1 && hour <= 7 ? hour + 12 : hour, minute: 0 }
    }
  }

  const part = new RegExp(`\\b(?:this\\s+|in the\\s+)?(${Object.keys(DAY_PARTS).join('|')})\\b`).exec(
    lower,
  )
  if (part) {
    cut(cuts, part)
    return {
      hour: DAY_PARTS[part[1]],
      minute: 0,
      // "tonight" / "midnight" also pin the day.
      day: part[1] === 'midnight' ? 1 : 0,
    }
  }

  return null
}

/** "today", "tomorrow", "friday", "next week", "in 3 days" → a day offset. */
function matchDay(lower, cuts, now) {
  const relative = /\bin\s+(\d{1,3})\s*(minutes?|mins?|hours?|hrs?|days?|weeks?)\b/.exec(lower)
  if (relative) {
    cut(cuts, relative)
    const amount = Number(relative[1])
    const unit = relative[2]
    const ms = unit.startsWith('min')
      ? amount * 60_000
      : unit.startsWith('h')
        ? amount * 3_600_000
        : unit.startsWith('d')
          ? amount * 86_400_000
          : amount * 7 * 86_400_000

    return { exact: new Date(now.getTime() + ms) }
  }

  const today = /\btoday\b/.exec(lower)
  if (today) {
    cut(cuts, today)
    return { offset: 0 }
  }

  const tomorrow = /\b(?:tomorrow|tmrw?|tmr)\b/.exec(lower)
  if (tomorrow) {
    cut(cuts, tomorrow)
    return { offset: 1 }
  }

  const nextWeek = /\bnext week\b/.exec(lower)
  if (nextWeek) {
    cut(cuts, nextWeek)
    return { offset: 7 }
  }

  const weekday = new RegExp(`\\b(?:on\\s+|next\\s+|this\\s+)?(${WEEKDAYS.join('|')})\\b`).exec(
    lower,
  )
  if (weekday) {
    cut(cuts, weekday)
    const target = WEEKDAYS.indexOf(weekday[1])
    let offset = (target - now.getDay() + 7) % 7
    if (offset === 0) offset = 7
    return { offset }
  }

  return null
}

/**
 * Parses a phrase into a timestamp. Returns null when it holds no time at all.
 * Exported because the reminder reply ("change it to 6pm") needs the same rules.
 */
export function parseDueExpression(raw, now = new Date(), defaultHour = DEFAULT_DUE_HOUR) {
  const lower = String(raw ?? '').toLowerCase()
  if (!lower.trim()) return { dueAt: null, cuts: [] }

  const cuts = []
  const day = matchDay(lower, cuts, now)
  const time = matchTime(lower, cuts)

  if (!day && !time) return { dueAt: null, cuts }

  if (day?.exact) return { dueAt: day.exact.toISOString(), cuts }

  const offset = day?.offset ?? time?.day ?? null
  const date = startOfDay(now)
  date.setDate(date.getDate() + (offset ?? 0))
  date.setHours(time ? time.hour : defaultHour, time ? time.minute : 0, 0, 0)

  // A bare time that has already passed means the next day.
  if (offset === null && date.getTime() <= now.getTime()) {
    date.setDate(date.getDate() + 1)
  }

  return { dueAt: date.toISOString(), cuts }
}

/**
 * Turns a spoken or typed phrase into an add-task payload.
 * Always returns an object; `title` is '' when there is nothing usable.
 */
export function parseTaskInput(raw, now = new Date(), defaultHour = DEFAULT_DUE_HOUR) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return { title: '', dueAt: null, priority: DEFAULT_PRIORITY }

  const lower = text.toLowerCase()
  const cuts = []

  let priority = DEFAULT_PRIORITY
  for (const [pattern, level] of PRIORITY_PATTERNS) {
    const match = pattern.exec(lower)
    if (match) {
      priority = level
      cut(cuts, match)
      break
    }
  }

  const { dueAt, cuts: dueCuts } = parseDueExpression(text, now, defaultHour)
  cuts.push(...dueCuts)

  const title = buildTitle(text, cuts)

  return {
    // Never lose the task: if the date words ate everything, keep the raw text.
    title: title || text,
    dueAt,
    priority,
  }
}

/**
 * Parses the answer to a due reminder.
 * intent: 'complete' | 'snooze' | 'reschedule' | 'note' | 'unknown'
 */
export function parseReply(raw, now = new Date(), defaultHour = DEFAULT_DUE_HOUR) {
  const text = String(raw ?? '').trim()
  const lower = text.toLowerCase()
  if (!lower) return { intent: 'unknown' }

  // Notes first — a note's text may itself contain "no" or "later".
  const note = /\b(?:add(?: a)? note|note that|note|remark)\b[:,\s]+(.+)$/.exec(lower)
  if (note) {
    const offset = lower.length - note[1].length
    return { intent: 'note', note: text.slice(offset).trim().replace(/[.\s]+$/, '') }
  }

  const reschedule =
    /\b(?:change|move|reschedule|push|shift|make|set|do)\s*(?:it|this|that|the time)?\s*(?:to|for|until|till)\s+(.+)$/.exec(
      lower,
    )
  if (reschedule) {
    const { dueAt } = parseDueExpression(reschedule[1], now, defaultHour)
    if (dueAt) return { intent: 'reschedule', dueAt }
  }

  if (/\b(?:yes|yeah|yep|yup|yes i have|done|did it|completed|finished|already did)\b/.test(lower)) {
    return { intent: 'complete' }
  }

  if (/\b(?:no|nope|not yet|later|snooze|in a bit|hold on|remind me later)\b/.test(lower)) {
    return { intent: 'snooze' }
  }

  return { intent: 'unknown' }
}
