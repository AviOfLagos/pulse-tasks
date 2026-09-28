import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildTagTree, matchesTag, tagAncestors, tagPath, tagSegments } from './tags.js'

const todo = (id, tags) => ({ id, title: id, tags })

describe('tagSegments / tagPath', () => {
  it('splits a path and drops empty segments', () => {
    assert.deepEqual(tagSegments('work/clients'), ['work', 'clients'])
    assert.deepEqual(tagSegments(' work / / clients '), ['work', 'clients'])
    assert.deepEqual(tagSegments(''), [])
  })

  it('normalises case for comparison', () => {
    assert.equal(tagPath('Work/Clients'), 'work/clients')
  })
})

describe('matchesTag', () => {
  const task = todo('a', ['Work/Clients/Vettika', 'billing'])

  it('matches the exact tag, any casing', () => {
    assert.equal(matchesTag(task, 'work/clients/vettika'), true)
    assert.equal(matchesTag(task, 'Billing'), true)
  })

  it('matches a parent, so a branch includes everything under it', () => {
    assert.equal(matchesTag(task, 'work'), true)
    assert.equal(matchesTag(task, 'work/clients'), true)
  })

  it('does not match a sibling or a partial segment', () => {
    assert.equal(matchesTag(task, 'work/admin'), false)
    assert.equal(matchesTag(task, 'bill'), false)
  })

  it('an empty path means "no filter"', () => {
    assert.equal(matchesTag(task, null), true)
    assert.equal(matchesTag(todo('b', []), ''), true)
  })
})

describe('buildTagTree', () => {
  const todos = [
    todo('1', ['work/clients/vettika']),
    todo('2', ['work/clients/nexprove']),
    todo('3', ['work/admin', 'billing']),
    todo('4', ['Work']),
    todo('5', []),
  ]

  it('nests by path and sorts each level', () => {
    const tree = buildTagTree(todos)

    assert.deepEqual(
      tree.map((node) => node.path),
      ['billing', 'work'],
    )
    assert.deepEqual(
      tree[1].children.map((node) => node.path),
      ['work/admin', 'work/clients'],
    )
    assert.deepEqual(
      tree[1].children[1].children.map((node) => node.path),
      ['work/clients/nexprove', 'work/clients/vettika'],
    )
  })

  it('counts each task once, at every level it belongs to', () => {
    const tree = buildTagTree(todos)
    const work = tree.find((node) => node.path === 'work')

    assert.equal(work.count, 4)
    assert.equal(work.children.find((node) => node.path === 'work/clients').count, 2)
    assert.equal(tree.find((node) => node.path === 'billing').count, 1)
  })

  it('keeps the casing it saw first, and copes with no tags at all', () => {
    assert.equal(buildTagTree(todos)[1].label, 'work')
    assert.deepEqual(buildTagTree([]), [])
    assert.deepEqual(buildTagTree([todo('1', undefined)]), [])
  })
})

describe('tagAncestors', () => {
  it('lists every parent, nearest last', () => {
    assert.deepEqual(tagAncestors('a/b/c'), ['a', 'a/b'])
    assert.deepEqual(tagAncestors('a'), [])
  })
})
