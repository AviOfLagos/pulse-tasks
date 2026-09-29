import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildSystemPrompt, buildTaskPrompt, isWorthAsking, parseAiResult } from './aiTagger.js'

describe('buildSystemPrompt', () => {
  it('offers the tags the user already has, so the model reuses them', () => {
    const prompt = buildSystemPrompt(['work/clients', 'home/garden'])

    assert.match(prompt, /work\/clients, home\/garden/)
    assert.match(prompt, /Reuse one of these/)
  })

  it('falls back to broad categories for an empty vocabulary', () => {
    assert.match(buildSystemPrompt([]), /work, home, health/)
  })

  it('caps the vocabulary so the prompt stays small', () => {
    const many = Array.from({ length: 50 }, (_, i) => `tag${i}`)
    const prompt = buildSystemPrompt(many)

    assert.ok(prompt.includes('tag23'))
    assert.ok(!prompt.includes('tag24'))
  })
})

describe('buildTaskPrompt', () => {
  it('sends the task and nothing else', () => {
    assert.equal(buildTaskPrompt('  Book the dentist  '), 'Task: Book the dentist')
  })

  it('truncates something absurd', () => {
    assert.equal(buildTaskPrompt('x'.repeat(500)).length, 'Task: '.length + 200)
  })
})

describe('parseAiResult', () => {
  it('accepts a clean answer, as an object or a JSON string', () => {
    assert.deepEqual(parseAiResult({ tag: 'work/clients', priority: 'high' }), {
      tag: 'work/clients',
      priority: 'high',
    })
    assert.deepEqual(parseAiResult('{"tag":"health","priority":"medium"}'), {
      tag: 'health',
      priority: 'medium',
    })
  })

  it('normalises the shapes a small model actually returns', () => {
    assert.equal(parseAiResult({ tag: '#Work/Clients' }).tag, 'work/clients')
    assert.equal(parseAiResult({ tag: ' Home / Garden ' }).tag, 'home/garden')
    assert.equal(parseAiResult({ tag: 'weekly review' }).tag, 'weekly-review')
  })

  it('drops anything that is not a plausible tag', () => {
    // Prose, not a category.
    assert.equal(
      parseAiResult({ tag: 'this task is about sending an invoice to a client today' }).tag,
      null,
    )
    assert.equal(parseAiResult({ tag: 'a/b/c/d' }).tag, null)
    assert.equal(parseAiResult({ tag: '' }).tag, null)
    assert.equal(parseAiResult({ tag: '///' }).tag, null)
  })

  it('survives junk instead of throwing', () => {
    assert.deepEqual(parseAiResult('Sure! Here is your JSON:'), { tag: null, priority: null })
    assert.deepEqual(parseAiResult(null), { tag: null, priority: null })
    assert.deepEqual(parseAiResult(42), { tag: null, priority: null })
  })

  it('only accepts a known priority', () => {
    assert.equal(parseAiResult({ tag: 'work', priority: 'URGENT!' }).priority, null)
    assert.equal(parseAiResult({ tag: 'work', priority: 'low' }).priority, 'low')
  })
})

describe('isWorthAsking', () => {
  it('waits for something with a category in it', () => {
    assert.equal(isWorthAsking('book the dentist'), true)
    assert.equal(isWorthAsking('call'), false)
    assert.equal(isWorthAsking('milk'), false)
    assert.equal(isWorthAsking('   '), false)
  })
})
