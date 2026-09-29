/**
 * On-device task understanding, via Chrome's built-in Prompt API (Gemini Nano).
 *
 * Everything here is the pure half — the prompts, the schema and the
 * validation — so it can be tested without a model, and so the only thing the
 * hook has to do is call it.
 *
 * Two rules shape the design:
 *
 *   1. It is a *suggestion*. The model never writes to a task directly. It
 *      proposes a tag, the proposal is shown before the task is created, and an
 *      explicit `#tag` or the branch you are working in always beats it.
 *   2. Its output is untrusted. A local model is still a text generator: the
 *      answer is JSON-schema constrained, then validated again here, and
 *      anything that is not a plausible tag path is dropped rather than shown.
 */

import { PRIORITIES } from '../constants.js'

/** Keeps the model in JSON and out of "Sure, here you go:". */
export const TAG_SCHEMA = {
  type: 'object',
  properties: {
    tag: {
      type: 'string',
      description: 'A lowercase category path, at most two levels, e.g. "work/clients". Empty when unsure.',
    },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
    },
  },
  required: ['tag', 'priority'],
}

/**
 * The system prompt is set once per session, at creation, and reused by every
 * clone — so it carries the rules, and the per-task prompt carries only the
 * task. `knownTags` matters more than it looks: without it the model invents a
 * fresh vocabulary every time and the sidebar fills with near-duplicates.
 */
export function buildSystemPrompt(knownTags = []) {
  const vocabulary = knownTags.slice(0, 24)

  return [
    'You file personal tasks into short category paths.',
    'Answer with JSON only: {"tag": string, "priority": "low"|"medium"|"high"}.',
    'The tag is lowercase, one or two levels, slash separated, e.g. "work/clients" or "health".',
    vocabulary.length > 0
      ? `Reuse one of these existing categories whenever it fits: ${vocabulary.join(', ')}.`
      : 'Prefer broad, reusable categories such as work, home, health, travel, family, finance.',
    'Only invent a new category when none of the existing ones fit.',
    'Return an empty tag rather than guessing at a task you do not understand.',
    'Priority is high only for something urgent or time-critical, low for someday work, otherwise medium.',
  ].join(' ')
}

/** The per-task prompt. Short on purpose: the model is small and local. */
export function buildTaskPrompt(text) {
  return `Task: ${String(text ?? '').trim().slice(0, 200)}`
}

/** A tag the app is willing to store: lowercase, slug-ish, at most three levels. */
function cleanTag(value) {
  const tag = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9/\s-]/g, '')
    // Trim around the separator first, so "home / garden" does not become
    // "home-/-garden" once spaces turn into hyphens.
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^-|-$/g, '')
    .replace(/^\/|\/$/g, '')

  if (!tag) return null

  const segments = tag.split('/').filter(Boolean)
  if (segments.length === 0 || segments.length > 3) return null
  if (segments.some((segment) => segment.length > 24)) return null
  if (tag.length > 48) return null

  return segments.join('/')
}

/**
 * Validates what came back. Returns `{ tag, priority }` with either field null
 * when it did not survive — a local model is small enough to hand back prose,
 * an empty object, or a category with a sentence in it.
 */
export function parseAiResult(raw) {
  let data = raw

  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return { tag: null, priority: null }
    }
  }

  if (!data || typeof data !== 'object') return { tag: null, priority: null }

  return {
    tag: cleanTag(data.tag),
    priority: PRIORITIES.includes(data.priority) ? data.priority : null,
  }
}

/**
 * Whether a task is worth asking the model about at all.
 * Running on every keystroke would be both slow and pointless: a few letters
 * carry no category, and the keyword table already covers the obvious cases.
 */
export function isWorthAsking(text) {
  const trimmed = String(text ?? '').trim()

  return trimmed.length >= 8 && trimmed.split(/\s+/).length >= 2
}
