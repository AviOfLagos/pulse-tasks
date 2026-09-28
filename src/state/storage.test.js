import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { DRAFT_KEY, STORAGE_KEY } from '../constants.js'
import { loadDraft, loadTodos, saveDraft, saveTodos } from './storage.js'

/**
 * storage.js reads `localStorage` at call time, so stubbing the global before
 * each test is enough — no jsdom required.
 */
const backing = new Map()

const fakeStorage = {
  getItem: (key) => (backing.has(key) ? backing.get(key) : null),
  setItem: (key, value) => backing.set(key, String(value)),
  removeItem: (key) => backing.delete(key),
  clear: () => backing.clear(),
}

function stubStorage(value) {
  Object.defineProperty(globalThis, 'localStorage', {
    value,
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  backing.clear()
  stubStorage(fakeStorage)
})

afterEach(() => {
  stubStorage(undefined)
})

describe('storage', () => {
  it('returns an empty list when nothing is stored', () => {
    assert.deepEqual(loadTodos(), [])
  })

  it('round-trips todos through storage', () => {
    const todos = [
      {
        id: '1',
        title: 'Persist me',
        description: 'with notes',
        priority: 'high',
        dueAt: new Date(2026, 9, 1, 17, 0, 0, 0).toISOString(),
        tags: ['work'],
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        promptedAt: null,
      },
    ]

    saveTodos(todos)
    assert.deepEqual(loadTodos(), todos)
  })

  it('upgrades a legacy day-only dueDate to a timestamp', () => {
    backing.set(
      STORAGE_KEY,
      JSON.stringify([{ id: 'old', title: 'From v1', dueDate: '2026-10-01' }]),
    )

    const [loaded] = loadTodos()
    assert.equal(loaded.dueAt, new Date(2026, 9, 1, 9, 0, 0, 0).toISOString())
    assert.equal(loaded.promptedAt, null)
  })

  it('drops unusable entries and repairs the rest', () => {
    backing.set(
      STORAGE_KEY,
      JSON.stringify([{ title: '' }, { title: 'Kept', priority: 'urgent' }, 42, null]),
    )

    const loaded = loadTodos()
    assert.equal(loaded.length, 1)
    assert.equal(loaded[0].title, 'Kept')
    assert.equal(loaded[0].priority, 'medium')
  })

  it('reads the legacy { todos: [...] } shape', () => {
    backing.set(STORAGE_KEY, JSON.stringify({ todos: [{ title: 'Legacy task' }] }))

    assert.equal(loadTodos().length, 1)
    assert.equal(loadTodos()[0].title, 'Legacy task')
  })

  it('falls back to an empty list on corrupted JSON', () => {
    backing.set(STORAGE_KEY, '{not json')

    assert.deepEqual(loadTodos(), [])
  })

  it('survives a storage that throws', () => {
    stubStorage({
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota exceeded')
      },
    })

    assert.deepEqual(loadTodos(), [])
    assert.doesNotThrow(() => saveTodos([{ title: 'Anything' }]))
  })

  it('works when localStorage is unavailable', () => {
    stubStorage(undefined)

    assert.deepEqual(loadTodos(), [])
    assert.doesNotThrow(() => saveTodos([{ title: 'Anything' }]))
  })
})

describe('draft storage', () => {
  it('is empty when nothing was typed', () => {
    assert.equal(loadDraft(), '')
  })

  it('round-trips the composer text', () => {
    saveDraft('pay rent tomorrow 5pm')
    assert.equal(loadDraft(), 'pay rent tomorrow 5pm')
  })

  it('clears the key when the input is emptied', () => {
    saveDraft('something')
    saveDraft('')

    assert.equal(backing.has(DRAFT_KEY), false)
    assert.equal(loadDraft(), '')
  })

  it('survives a missing localStorage', () => {
    stubStorage(undefined)

    assert.equal(loadDraft(), '')
    assert.doesNotThrow(() => saveDraft('still fine'))
  })
})
