import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createTodo,
  normalizeTags,
  sanitizeTodo,
  todosReducer,
} from './todoReducer.js'

const base = (overrides = {}) => ({
  id: 'a',
  title: 'Write tests',
  createdAt: '2026-01-01T10:00:00.000Z',
  ...overrides,
})

const add = (payload) => todosReducer([], { type: 'add', payload })

describe('normalizeTags', () => {
  it('splits, trims and de-duplicates comma separated input', () => {
    assert.deepEqual(normalizeTags(' work , home , work ,, '), ['work', 'home'])
  })

  it('accepts arrays and caps the result', () => {
    assert.deepEqual(normalizeTags(['a', 'b', 'c', 'd', 'e']), ['a', 'b', 'c'])
  })

  it('returns an empty array for empty input', () => {
    assert.deepEqual(normalizeTags(undefined), [])
    assert.deepEqual(normalizeTags(''), [])
  })
})

describe('createTodo', () => {
  it('normalises a full input object', () => {
    const todo = createTodo({
      title: '  Ship stage 1  ',
      description: '  with notes  ',
      priority: 'high',
      dueDate: '2026-10-01',
      tags: 'work, work, urgent',
      completed: true,
      createdAt: '2026-01-01T10:00:00.000Z',
      id: 'fixed-id',
    })

    assert.deepEqual(todo, {
      id: 'fixed-id',
      title: 'Ship stage 1',
      description: 'with notes',
      priority: 'high',
      // The legacy `dueDate` is upgraded to a 09:00 local timestamp.
      dueAt: new Date(2026, 9, 1, 9, 0, 0, 0).toISOString(),
      tags: ['work', 'urgent'],
      completed: true,
      createdAt: '2026-01-01T10:00:00.000Z',
      promptedAt: null,
    })
  })

  it('falls back to safe defaults', () => {
    const todo = createTodo({ title: 'No extras' })

    assert.equal(todo.priority, 'medium')
    assert.equal(todo.dueAt, null)
    assert.deepEqual(todo.tags, [])
    assert.equal(todo.completed, false)
    assert.ok(todo.id)
    assert.ok(!Number.isNaN(Date.parse(todo.createdAt)))
  })

  it('rejects an empty title', () => {
    assert.throws(() => createTodo({ title: '   ' }), /needs a title/)
  })

  it('drops invalid priorities and due dates', () => {
    const todo = createTodo({ title: 'Bad input', priority: 'urgent', dueAt: '2026-02-30' })

    assert.equal(todo.priority, 'medium')
    assert.equal(todo.dueAt, null)
  })
})

describe('sanitizeTodo', () => {
  it('returns null instead of throwing on junk', () => {
    assert.equal(sanitizeTodo(null), null)
    assert.equal(sanitizeTodo('nope'), null)
    assert.equal(sanitizeTodo({ title: '' }), null)
  })

  it('repairs a partially valid stored todo', () => {
    const todo = sanitizeTodo({ title: 'Kept', priority: 'nonsense' })

    assert.equal(todo.title, 'Kept')
    assert.equal(todo.priority, 'medium')
  })
})

describe('todosReducer', () => {
  it('adds new todos to the top', () => {
    const first = add({ title: 'First', id: '1', createdAt: '2026-01-01T00:00:00.000Z' })
    const second = todosReducer(first, {
      type: 'add',
      payload: { title: 'Second', id: '2', createdAt: '2026-01-02T00:00:00.000Z' },
    })

    assert.deepEqual(
      second.map((todo) => todo.title),
      ['Second', 'First'],
    )
  })

  it('ignores an add without a title', () => {
    const state = add({ title: 'Kept' })
    assert.equal(todosReducer(state, { type: 'add', payload: { title: '   ' } }), state)
  })

  it('updates a single todo by id', () => {
    const state = [base({ id: '1' }), base({ id: '2', title: 'Other' })]
    const next = todosReducer(state, {
      type: 'update',
      payload: { id: '2', changes: { title: '  Renamed  ', priority: 'low', tags: ['x'] } },
    })

    assert.equal(next[0].title, 'Write tests')
    assert.equal(next[1].title, 'Renamed')
    assert.equal(next[1].priority, 'low')
    assert.deepEqual(next[1].tags, ['x'])
  })

  it('keeps the old value when an update is invalid', () => {
    const state = [base({ id: '1', title: 'Keep me', priority: 'high' })]
    const next = todosReducer(state, {
      type: 'update',
      payload: { id: '1', changes: { title: '   ', priority: 'urgent' } },
    })

    assert.equal(next[0].title, 'Keep me')
    assert.equal(next[0].priority, 'high')
  })

  it('toggles completion', () => {
    const state = [base({ id: '1', completed: false })]
    const on = todosReducer(state, { type: 'toggle', payload: { id: '1' } })
    const off = todosReducer(on, { type: 'toggle', payload: { id: '1' } })

    assert.equal(on[0].completed, true)
    assert.equal(off[0].completed, false)
  })

  it('marks every todo with toggle-all', () => {
    const state = [base({ id: '1' }), base({ id: '2', completed: true })]

    assert.deepEqual(
      todosReducer(state, { type: 'toggle-all', payload: { completed: true } }).map(
        (todo) => todo.completed,
      ),
      [true, true],
    )
    assert.deepEqual(
      todosReducer(state, { type: 'toggle-all', payload: { completed: false } }).map(
        (todo) => todo.completed,
      ),
      [false, false],
    )
  })

  it('removes by id', () => {
    const state = [base({ id: '1' }), base({ id: '2' })]
    assert.deepEqual(
      todosReducer(state, { type: 'remove', payload: { id: '1' } }).map((todo) => todo.id),
      ['2'],
    )
  })

  it('clears completed todos only', () => {
    const state = [base({ id: '1', completed: true }), base({ id: '2', completed: false })]
    assert.deepEqual(
      todosReducer(state, { type: 'clear-completed' }).map((todo) => todo.id),
      ['2'],
    )
  })

  it('replaces state for undo and ignores a bad snapshot', () => {
    const state = [base({ id: '1' })]
    const snapshot = [base({ id: '2' }), base({ id: '3' })]

    assert.equal(
      todosReducer(state, { type: 'replace', payload: { todos: snapshot } }),
      snapshot,
    )
    assert.equal(todosReducer(state, { type: 'replace', payload: {} }), state)
  })

  it('returns the same state for unknown actions', () => {
    const state = [base()]
    assert.equal(todosReducer(state, { type: 'nope' }), state)
    assert.equal(todosReducer(state, undefined), state)
  })
})

describe('voice actions', () => {
  const at = (h, m = 0) => new Date(2026, 8, 28, h, m, 0, 0)
  const base = createTodo({ id: 'v1', title: 'Water plants', dueAt: at(17).toISOString() })

  it('snooze pushes an upcoming due time by the given minutes', () => {
    const [todo] = todosReducer([base], {
      type: 'snooze',
      payload: { id: 'v1', minutes: 15, from: at(12).toISOString() },
    })

    assert.equal(new Date(todo.dueAt).getTime(), at(17, 15).getTime())
    assert.equal(todo.promptedAt, null)
  })

  it('snooze on an overdue task counts from now, not from the old due time', () => {
    const overdue = { ...base, dueAt: at(9).toISOString(), promptedAt: at(9).toISOString() }
    const [todo] = todosReducer([overdue], {
      type: 'snooze',
      payload: { id: 'v1', minutes: 15, from: at(12).toISOString() },
    })

    assert.equal(new Date(todo.dueAt).getTime(), at(12, 15).getTime())
  })

  it('reschedule replaces the due moment and clears the prompt flag', () => {
    const prompted = { ...base, promptedAt: at(17).toISOString() }
    const [todo] = todosReducer([prompted], {
      type: 'reschedule',
      payload: { id: 'v1', dueAt: at(18).toISOString() },
    })

    assert.equal(new Date(todo.dueAt).getTime(), at(18).getTime())
    assert.equal(todo.promptedAt, null)
  })

  it('reschedule ignores an unparseable time', () => {
    const todos = [base]
    assert.equal(todosReducer(todos, { type: 'reschedule', payload: { id: 'v1', dueAt: 'soon' } }), todos)
  })

  it('append-note adds a line and keeps existing notes', () => {
    const once = todosReducer([base], { type: 'append-note', payload: { id: 'v1', note: 'Use the rain water' } })
    assert.equal(once[0].description, 'Use the rain water')

    const twice = todosReducer(once, { type: 'append-note', payload: { id: 'v1', note: 'Back porch too' } })
    assert.equal(twice[0].description, 'Use the rain water\nBack porch too')
  })

  it('append-note ignores empty text', () => {
    assert.equal(todosReducer([base], { type: 'append-note', payload: { id: 'v1', note: '  ' } })[0], base)
  })

  it('complete always completes, never toggles back', () => {
    const done = todosReducer([base], { type: 'complete', payload: { id: 'v1' } })
    assert.equal(done[0].completed, true)
    assert.equal(todosReducer(done, { type: 'complete', payload: { id: 'v1' } })[0].completed, true)
  })

  it('mark-prompted stamps the todo so it is not asked twice', () => {
    const stamp = at(17).toISOString()
    const [todo] = todosReducer([base], { type: 'mark-prompted', payload: { id: 'v1', at: stamp } })
    assert.equal(todo.promptedAt, stamp)
  })

  it('editing the due date makes a task promptable again', () => {
    const prompted = { ...base, promptedAt: at(17).toISOString() }
    const [todo] = todosReducer([prompted], {
      type: 'update',
      payload: { id: 'v1', changes: { title: 'Water plants', dueAt: at(19).toISOString() } },
    })

    assert.equal(todo.promptedAt, null)
  })
})
