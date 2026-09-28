/**
 * Ranking for the quick switcher.
 *
 * Kept apart from the component so `node --test` can exercise it directly.
 */

/** Scores a subsequence match, favouring hits at word starts. Null = no match. */
function score(haystack, needle) {
  const hay = haystack.toLowerCase()
  const query = needle.toLowerCase()
  if (!query) return 0

  let at = 0
  let points = 0

  for (const char of query) {
    if (char === ' ') continue

    const found = hay.indexOf(char, at)
    if (found === -1) return null

    // A letter starting a word is worth more than one buried mid-word.
    const startsWord = found === 0 || hay[found - 1] === ' '
    points += startsWord ? 3 : 1
    if (found === at) points += 1

    at = found + 1
  }

  // Shorter titles win ties: they are the more precise match.
  return points - haystack.length * 0.01
}

export function rankTodos(todos, query, limit = 8) {
  const needle = String(query ?? '').trim()

  if (!needle) {
    return todos.filter((todo) => !todo.completed).slice(0, limit)
  }

  return todos
    .map((todo) => ({
      todo,
      points: score(`${todo.title} ${(todo.tags ?? []).join(' ')}`, needle),
    }))
    .filter((entry) => entry.points !== null)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit)
    .map((entry) => entry.todo)
}

