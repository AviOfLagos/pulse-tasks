import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { rankTodos } from './rank.js'

const todo = (id, title, extra = {}) => ({
  id,
  title,
  tags: [],
  completed: false,
  priority: 'medium',
  ...extra,
})

const todos = [
  todo('1', 'Water the plants'),
  todo('2', 'Send the invoice to Vettika', { tags: ['work/clients'] }),
  todo('3', 'Walk the dog'),
  todo('4', 'Pay the electricity bill', { completed: true }),
]

describe('rankTodos', () => {
  it('matches a subsequence, not just a substring', () => {
    assert.deepEqual(
      rankTodos(todos, 'wtp').map((item) => item.id),
      ['1'],
    )
  })

  it('ranks a word start above a mid-word hit, even in a longer title', () => {
    const pair = [todo('mid', 'Rebilling'), todo('start', 'Bill the client')]

    assert.equal(rankTodos(pair, 'bill')[0].id, 'start')
  })

  it('breaks a tie on the shorter, more precise title', () => {
    assert.equal(rankTodos(todos, 'wa')[0].title, 'Walk the dog')
  })

  it('searches tags as well as titles', () => {
    assert.deepEqual(
      rankTodos(todos, 'clients').map((item) => item.id),
      ['2'],
    )
  })

  it('returns nothing for a query that matches nothing', () => {
    assert.deepEqual(rankTodos(todos, 'zzzz'), [])
  })

  it('an empty query lists unfinished tasks', () => {
    assert.deepEqual(
      rankTodos(todos, '').map((item) => item.id),
      ['1', '2', '3'],
    )
  })

  it('honours the limit', () => {
    assert.equal(rankTodos(todos, '', 2).length, 2)
  })
})
