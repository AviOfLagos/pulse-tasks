import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { suggestTag } from './categorise.js'

describe('suggestTag', () => {
  it('matches on whole words only', () => {
    assert.equal(suggestTag('deploy the app'), 'work/code')
    // "app" must not fire inside another word.
    assert.equal(suggestTag('order apparel samples'), null)
  })

  it('prefers the more specific phrase', () => {
    // "pull request" (work/code) is longer than "report" (work/admin).
    assert.equal(suggestTag('write the pull request report'), 'work/code')
  })

  it('is case and punctuation insensitive', () => {
    assert.equal(suggestTag('Book the DENTIST, please'), 'health')
  })

  it('returns null rather than guessing', () => {
    assert.equal(suggestTag('ponder the universe'), null)
    assert.equal(suggestTag(''), null)
    assert.equal(suggestTag(null), null)
  })
})
