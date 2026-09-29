import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { BACKUP_VERSION, fromBackup, mergeTodos, toBackup } from './backup.js'

const todo = (id, title = 'Task') => ({
  id,
  title,
  description: '',
  priority: 'medium',
  dueAt: null,
  tags: [],
  completed: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  promptedAt: null,
})

describe('toBackup', () => {
  it('wraps the tasks with enough to recognise the file later', () => {
    const backup = toBackup([todo('1')], new Date('2026-09-29T00:00:00.000Z'))

    assert.equal(backup.app, 'pulse-tasks')
    assert.equal(backup.version, BACKUP_VERSION)
    assert.equal(backup.exportedAt, '2026-09-29T00:00:00.000Z')
    assert.equal(backup.todos.length, 1)
  })
})

describe('fromBackup', () => {
  it('reads its own export', () => {
    const json = JSON.stringify(toBackup([todo('1', 'Kept')]))

    assert.equal(fromBackup(json).todos[0].title, 'Kept')
  })

  it('accepts a bare array, because someone will hand-edit the file', () => {
    assert.equal(fromBackup([todo('1')]).todos.length, 1)
  })

  it('keeps the usable rows and counts the rest', () => {
    const result = fromBackup({ todos: [todo('1'), { title: '' }, 42, null] })

    assert.equal(result.todos.length, 1)
    assert.equal(result.skipped, 3)
  })

  it('explains itself rather than throwing', () => {
    assert.match(fromBackup('{oops').error, /not valid JSON/)
    assert.match(fromBackup({ hello: 'world' }).error, /does not look like/)
    assert.match(fromBackup([]).error, /no usable tasks/)
  })
})

describe('mergeTodos', () => {
  it('adds what is new and keeps what is there', () => {
    const result = mergeTodos([todo('1')], [todo('2'), todo('3')])

    assert.equal(result.todos.length, 3)
    assert.equal(result.added, 2)
  })

  it('is idempotent — the same file twice changes nothing', () => {
    const current = [todo('1'), todo('2')]
    const result = mergeTodos(current, [todo('1'), todo('2')])

    assert.equal(result.added, 0)
    assert.deepEqual(result.todos, current)
  })
})
