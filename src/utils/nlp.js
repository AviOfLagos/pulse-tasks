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

/** `#work/clients` anywhere in the text. */
const TAG_PATTERN = /#([\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*)/gu

/**
 * The spoken form, at the end of the sentence only: "…under work slash clients".
 * Bounded deliberately — an unbounded tail would swallow half the task.
 */
const SPOKEN_TAG_PATTERN =
  /(?:^|\s)(?:tagged|tag|under|filed under)\s+([\p{L}\p{N}][\p{L}\p{N}\- /]{0,40})$/iu

/** Words a real tag phrase never starts with. */
const TAG_STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'my',
  'our',
  'his',
  'her',
  'their',
  'its',
  'this',
  'that',
  'these',
  'those',
  'it',
  'them',
  'there',
  'here',
])

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
 * Nested tags. `#work/clients` is the typed form; "under work slash clients"
 * is the spoken one, since dictation will not produce a `#`. Spaces stay part
 * of a segment ("under weekly review" is one tag), and only the word "slash"
 * nests — guessing at nesting from spaces gets it wrong more often than not.
 */
function matchTags(text, cuts) {
  const tags = []

  for (const match of text.matchAll(TAG_PATTERN)) {
    tags.push(match[1])
    cuts.push([match.index, match.index + match[0].length])
  }

  if (tags.length > 0) return tags

  const spoken = SPOKEN_TAG_PATTERN.exec(text)

  // "put the box under the stairs" is a sentence, not a tag. A tag phrase
  // never opens with a determiner, so that one word is enough to tell them
  // apart without a parser.
  if (spoken && !TAG_STOP_WORDS.has(spoken[1].trim().split(/\s+/)[0].toLowerCase())) {
    const phrase = spoken[1]
      .trim()
      .replace(/\s+slash\s+/gi, '/')
      .replace(/\s*\/\s*/g, '/')
      .replace(/\s+/g, ' ')

    if (phrase) {
      tags.push(phrase)
      cuts.push([spoken.index, spoken.index + spoken[0].length])
    }
  }

  return tags
}

/** "urgent" → high, "someday" → low. `found` says whether the text mentioned it at all. */
function matchPriority(lower, cuts) {
  for (const [pattern, level] of PRIORITY_PATTERNS) {
    const match = pattern.exec(lower)
    if (match) {
      cut(cuts, match)
      return { priority: level, found: true }
    }
  }

  return { priority: DEFAULT_PRIORITY, found: false }
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
  if (!text) return { title: '', dueAt: null, priority: DEFAULT_PRIORITY, tags: [] }

  const lower = text.toLowerCase()
  const cuts = []

  const tags = matchTags(text, cuts)
  const { priority } = matchPriority(lower, cuts)

  const { dueAt, cuts: dueCuts } = parseDueExpression(text, now, defaultHour)
  cuts.push(...dueCuts)

  const title = buildTitle(text, cuts)

  return {
    // Never lose the task: if the date words ate everything, keep the raw text.
    title: title || text,
    dueAt,
    priority,
    tags,
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

/**
 * Splits a phrase into "when" and "what is left".
 * "tomorrow 6pm" → { dueAt, remainder: '' }; "buy oat milk" → { dueAt: null,
 * remainder: 'Buy oat milk' }. That difference is how an edit command tells a
 * reschedule from a rename.
 */
export function splitDueExpression(raw, now = new Date(), defaultHour = DEFAULT_DUE_HOUR) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim()
  const { dueAt, cuts } = parseDueExpression(text, now, defaultHour)

  return { dueAt, remainder: buildTitle(text, cuts) }
}

/** Normalised words, for loose title matching. */
function words(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Finds the task a spoken phrase refers to.
 *
 * Speech recognition rarely returns a title verbatim, so this scores rather
 * than matches: exact, then prefix, then substring, then shared words. Below
 * half the words in common it gives up and returns null — acting on the wrong
 * task is worse than admitting it did not catch the name.
 */
export function findTodoByTitle(todos, phrase) {
  const needle = words(phrase).join(' ')
  if (!needle) return null

  let best = null
  let bestScore = 0

  for (const todo of todos) {
    const hay = words(todo.title).join(' ')
    if (!hay) continue

    let score
    if (hay === needle) score = 1
    else if (hay.startsWith(needle) || needle.startsWith(hay)) score = 0.9
    else if (hay.includes(needle) || needle.includes(hay)) score = 0.8
    else {
      const needleWords = new Set(words(needle))
      const shared = words(hay).filter((word) => needleWords.has(word)).length
      score = shared / Math.max(needleWords.size, words(hay).length)
    }

    // On a tie, prefer the task still to be done.
    const better = score > bestScore || (score === bestScore && best?.completed && !todo.completed)
    if (better) {
      best = todo
      bestScore = score
    }
  }

  return bestScore >= 0.5 ? best : null
}

/**
 * "Edit water the plants to 7pm" / "change buy milk to buy oat milk".
 * Returns { todo, changes } or null when it is not an edit command, or when
 * the task could not be identified.
 */
export function parseEditCommand(raw, todos = [], now = new Date(), defaultHour = DEFAULT_DUE_HOUR) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim()
  const match = /^(?:edit|change|update|rename|reschedule|move)\s+(.+?)\s+to\s+(.+)$/i.exec(text)
  if (!match) return null

  const todo = findTodoByTitle(todos, match[1])
  if (!todo) return null

  const rest = match[2]
  const cuts = []
  const { priority, found } = matchPriority(rest.toLowerCase(), cuts)
  const { dueAt, remainder } = splitDueExpression(buildTitle(rest, cuts), now, defaultHour)

  const changes = {}
  if (dueAt) changes.dueAt = dueAt
  if (found) changes.priority = priority
  if (remainder) changes.title = remainder

  return Object.keys(changes).length > 0 ? { todo, changes } : null
}

/**
 * The answer to "Add '<title>' for <time>? Say yes or no."
 * intent: 'confirm' | 'cancel' | 'reschedule' | 'unknown'
 */
export function parseConfirmReply(raw, now = new Date(), defaultHour = DEFAULT_DUE_HOUR) {
  const lower = String(raw ?? '').trim().toLowerCase()
  if (!lower) return { intent: 'unknown' }

  const reschedule =
    /\b(?:change|make|move|set|shift)\s*(?:the\s+)?(?:time|it|this|that)?\s*(?:to|for)\s+(.+)$/.exec(
      lower,
    )
  if (reschedule) {
    const { dueAt } = parseDueExpression(reschedule[1], now, defaultHour)
    if (dueAt) return { intent: 'reschedule', dueAt }
  }

  if (/\b(?:no|nope|cancel|discard|forget it|never mind|nevermind|delete it)\b/.test(lower)) {
    return { intent: 'cancel' }
  }

  if (/\b(?:yes|yeah|yep|yup|add it|add|confirm|correct|that's right|sure|ok(?:ay)?|save it)\b/.test(lower)) {
    return { intent: 'confirm' }
  }

  return { intent: 'unknown' }
}
