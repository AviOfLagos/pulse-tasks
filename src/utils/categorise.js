/**
 * Guessing a tag from the words of a task.
 *
 * A keyword table, not a model: it has to run offline, instantly, on every
 * keystroke, and — more importantly — be predictable. A wrong guess you can
 * see coming is a small annoyance; a clever one you cannot is a filing system
 * you stop trusting.
 *
 * Which is why the result is only ever a *suggestion*: it is shown before the
 * task is created, it never overrides a tag typed by hand or the branch you
 * are working in, and returning nothing is a perfectly good answer.
 */

/** Longer phrases first within a rule: "pull request" should beat "request". */
const RULES = [
  {
    tag: 'work/code',
    words: [
      'pull request',
      'code review',
      'merge',
      'deploy',
      'refactor',
      'bug',
      'hotfix',
      'release',
      'ship',
      'launch',
      'api',
      'endpoint',
      'migration',
      'test suite',
      'repo',
      'branch',
      'app',
    ],
  },
  {
    tag: 'work/clients',
    words: ['invoice', 'client', 'proposal', 'contract', 'pitch', 'quote', 'onboarding', 'demo'],
  },
  {
    tag: 'work/admin',
    words: [
      'meeting',
      'standup',
      'stand-up',
      'report',
      'expenses',
      'payroll',
      'renew',
      'domain',
      'subscription',
      'licence',
      'license',
      'timesheet',
    ],
  },
  {
    tag: 'home/bills',
    words: ['bill', 'rent', 'mortgage', 'electricity', 'insurance', 'council tax', 'tax return'],
  },
  {
    tag: 'home/errands',
    words: [
      'groceries',
      'shopping',
      'post office',
      'parcel',
      'dry cleaning',
      'laundry',
      'bins',
      'car wash',
      'haircut',
    ],
  },
  {
    tag: 'home/garden',
    words: ['plants', 'garden', 'lawn', 'water the', 'weeds'],
  },
  {
    tag: 'health',
    words: [
      'dentist',
      'doctor',
      'gp',
      'appointment',
      'prescription',
      'pharmacy',
      'gym',
      'physio',
      'optician',
    ],
  },
  {
    tag: 'travel',
    words: ['flight', 'flights', 'hotel', 'passport', 'visa', 'airport', 'train', 'itinerary'],
  },
  {
    tag: 'family',
    words: ['mum', 'mom', 'dad', 'birthday', 'anniversary', 'grandma', 'grandad', 'school run'],
  },
]

/** Whole-word (or whole-phrase) match, so "app" does not fire inside "apparel". */
function mentions(haystack, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i').test(haystack)
}

/**
 * The best-matching tag path, or null when nothing matches confidently.
 * Ties go to the rule with the longer matched phrase — the more specific hit.
 */
export function suggestTag(text) {
  const haystack = String(text ?? '').toLowerCase()
  if (!haystack.trim()) return null

  let best = null

  for (const rule of RULES) {
    for (const word of rule.words) {
      if (!mentions(haystack, word)) continue

      if (!best || word.length > best.length) best = { tag: rule.tag, length: word.length }
      break
    }
  }

  return best?.tag ?? null
}
