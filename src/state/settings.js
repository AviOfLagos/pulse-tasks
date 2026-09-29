/**
 * User settings.
 *
 * Small, flat and validated on read, for the same reason the todo store is:
 * this comes back from localStorage, where anything can have happened to it.
 * Every field has a default that makes the app behave exactly as it did before
 * settings existed, so a corrupt or missing blob is never a broken app.
 */

import { PRIORITIES } from '../constants.js'

export const SETTINGS_KEY = 'todo-webapp:settings'

export const DEFAULT_SETTINGS = {
  /** Speak a reminder out loud when a task falls due. */
  voiceReminders: true,
  /** `voiceURI` of the chosen speechSynthesis voice; '' means the default. */
  voiceURI: '',
  /** 0.5–2. Anything outside that range is unintelligible rather than fast. */
  speechRate: 1,
  /** Minutes added by "later" / the Snooze button. */
  snoozeMinutes: 15,
  /** Hour of the day a bare date like "tomorrow" lands on. */
  defaultDueHour: 9,
  /** Ask Chrome's on-device model for a category. */
  aiSuggestions: true,
  /** Guess a category from the keyword table. */
  keywordSuggestions: true,
  /** Priority given to a task that does not say otherwise. */
  defaultPriority: 'medium',
}

const SNOOZE_CHOICES = [5, 10, 15, 30, 60]

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

/** Coerces anything into a usable settings object. Never throws. */
export function sanitizeSettings(raw) {
  const input = raw && typeof raw === 'object' ? raw : {}

  return {
    voiceReminders:
      typeof input.voiceReminders === 'boolean'
        ? input.voiceReminders
        : DEFAULT_SETTINGS.voiceReminders,
    voiceURI: typeof input.voiceURI === 'string' ? input.voiceURI : DEFAULT_SETTINGS.voiceURI,
    speechRate: clampNumber(input.speechRate, 0.5, 2, DEFAULT_SETTINGS.speechRate),
    snoozeMinutes: SNOOZE_CHOICES.includes(Number(input.snoozeMinutes))
      ? Number(input.snoozeMinutes)
      : DEFAULT_SETTINGS.snoozeMinutes,
    defaultDueHour: Math.round(
      clampNumber(input.defaultDueHour, 0, 23, DEFAULT_SETTINGS.defaultDueHour),
    ),
    aiSuggestions:
      typeof input.aiSuggestions === 'boolean'
        ? input.aiSuggestions
        : DEFAULT_SETTINGS.aiSuggestions,
    keywordSuggestions:
      typeof input.keywordSuggestions === 'boolean'
        ? input.keywordSuggestions
        : DEFAULT_SETTINGS.keywordSuggestions,
    defaultPriority: PRIORITIES.includes(input.defaultPriority)
      ? input.defaultPriority
      : DEFAULT_SETTINGS.defaultPriority,
  }
}

export const SNOOZE_OPTIONS = SNOOZE_CHOICES

function getStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Reads settings from localStorage, falling back to the defaults. */
export function loadSettings() {
  const storage = getStorage()
  if (!storage) return { ...DEFAULT_SETTINGS }

  try {
    return sanitizeSettings(JSON.parse(storage.getItem(SETTINGS_KEY) ?? 'null'))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/** Persists settings. Never throws. */
export function saveSettings(settings) {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(sanitizeSettings(settings)))
  } catch {
    /* private mode — settings just will not survive a reload */
  }
}
