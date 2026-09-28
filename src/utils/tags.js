/**
 * Nested tags, borrowed from Obsidian.
 *
 * A tag is a path: `work/clients/vettika`. That gives the collapsible tree of
 * a folder pane without the thing folders get wrong for tasks — a folder gives
 * a task exactly one home, and a task is usually "work" *and* "vettika" *and*
 * "billing" at once. Obsidian's own users drift from folders to nested tags for
 * the same reason.
 *
 * Matching is case-insensitive; the tree shows whichever casing it saw first.
 */

/** `'Work/Clients'` → `['Work', 'Clients']`, with empty segments dropped. */
export function tagSegments(tag) {
  return String(tag ?? '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

/** Normalised path used as a key and for comparisons. */
export function tagPath(tag) {
  return tagSegments(tag).join('/').toLowerCase()
}

/** True when a task carries this tag, or anything nested under it. */
export function matchesTag(todo, path) {
  if (!path) return true

  const needle = tagPath(path)
  if (!needle) return true

  return (todo.tags ?? []).some((tag) => {
    const candidate = tagPath(tag)
    return candidate === needle || candidate.startsWith(`${needle}/`)
  })
}

/**
 * The tree the sidebar draws: `[{ path, label, count, children }]`, sorted
 * alphabetically at every level. `count` is the number of *tasks* at or under
 * the node, counted once each however many matching tags they carry.
 */
export function buildTagTree(todos = []) {
  const nodes = new Map()

  for (const todo of todos) {
    for (const tag of todo.tags ?? []) {
      const segments = tagSegments(tag)
      const prefix = []

      for (const segment of segments) {
        prefix.push(segment)
        const key = prefix.join('/').toLowerCase()

        let node = nodes.get(key)
        if (!node) {
          node = { path: key, label: segment, count: 0, ids: new Set(), children: [] }
          nodes.set(key, node)
        }

        node.ids.add(todo.id)
      }
    }
  }

  const roots = []
  for (const [key, node] of nodes) {
    const cut = key.lastIndexOf('/')
    const parent = cut === -1 ? null : nodes.get(key.slice(0, cut))

    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const finish = (list) => {
    list.sort((a, b) => a.label.localeCompare(b.label))

    for (const node of list) {
      node.count = node.ids.size
      delete node.ids
      finish(node.children)
    }

    return list
  }

  return finish(roots)
}

/** Every ancestor of a path, nearest last: `a/b/c` → `['a', 'a/b']`. */
export function tagAncestors(path) {
  const segments = tagSegments(path)

  return segments.slice(0, -1).map((_, index) =>
    segments
      .slice(0, index + 1)
      .join('/')
      .toLowerCase(),
  )
}
