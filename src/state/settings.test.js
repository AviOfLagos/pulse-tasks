import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEFAULT_SETTINGS, sanitizeSettings } from './settings.js'

describe('sanitizeSettings', () => {
  it('returns the defaults for anything unusable', () => {
    assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS)
    assert.deepEqual(sanitizeSettings('nope'), DEFAULT_SETTINGS)
    assert.deepEqual(sanitizeSettings({}), DEFAULT_SETTINGS)
  })

  it('keeps valid values', () => {
    const settings = sanitizeSettings({
      voiceReminders: false,
      voiceURI: 'Daniel',
      speechRate: 1.4,
      snoozeMinutes: 30,
      defaultDueHour: 7,
      aiSuggestions: false,
      keywordSuggestions: false,
      defaultPriority: 'high',
    })

    assert.equal(settings.voiceReminders, false)
    assert.equal(settings.voiceURI, 'Daniel')
    assert.equal(settings.speechRate, 1.4)
    assert.equal(settings.snoozeMinutes, 30)
    assert.equal(settings.defaultDueHour, 7)
    assert.equal(settings.aiSuggestions, false)
    assert.equal(settings.defaultPriority, 'high')
  })

  it('clamps a speech rate into the intelligible range', () => {
    assert.equal(sanitizeSettings({ speechRate: 9 }).speechRate, 2)
    assert.equal(sanitizeSettings({ speechRate: 0 }).speechRate, 0.5)
    assert.equal(sanitizeSettings({ speechRate: 'fast' }).speechRate, 1)
  })

  it('only accepts an offered snooze length', () => {
    assert.equal(sanitizeSettings({ snoozeMinutes: 7 }).snoozeMinutes, 15)
    assert.equal(sanitizeSettings({ snoozeMinutes: '60' }).snoozeMinutes, 60)
  })

  it('keeps the default hour on the clock', () => {
    assert.equal(sanitizeSettings({ defaultDueHour: 30 }).defaultDueHour, 23)
    assert.equal(sanitizeSettings({ defaultDueHour: -4 }).defaultDueHour, 0)
    assert.equal(sanitizeSettings({ defaultDueHour: 8.6 }).defaultDueHour, 9)
  })

  it('rejects an unknown priority', () => {
    assert.equal(sanitizeSettings({ defaultPriority: 'urgent' }).defaultPriority, 'medium')
  })
})
